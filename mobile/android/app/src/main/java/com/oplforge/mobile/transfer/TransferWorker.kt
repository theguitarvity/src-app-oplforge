package com.oplforge.mobile.transfer

import android.content.Context
import android.net.Uri
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.oplforge.mobile.library.LibraryPreferences
import com.oplforge.mobile.library.SafDocumentTree
import com.oplforge.mobile.shared.AppDatabase
import com.oplforge.mobile.sharing.SharingForegroundService
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.IOException
import java.time.Instant

/**
 * Durable transfer executor (spec 008 research.md R5) — one instance per
 * queued `TransferItemEntity`, run by WorkManager so it survives process
 * death. Room is the source of truth for queue state; WorkManager only
 * drives execution and retry scheduling.
 */
class TransferWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    private val db = AppDatabase.getInstance(applicationContext)
    private val client = OkHttpClient()

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val itemId = inputData.getString(KEY_TRANSFER_ID) ?: return@withContext Result.failure()
        val dao = db.transferDao()
        val item = dao.getById(itemId) ?: return@withContext Result.failure()

        val stored = LibraryPreferences(applicationContext).load()
        if (stored == null || !stored.accessValid) {
            fail(item, "A biblioteca não está mais acessível.")
            return@withContext Result.failure()
        }
        val tree = SafDocumentTree(applicationContext, Uri.parse(stored.treeUri))

        dao.update(item.copy(state = TransferState.RUNNING, updatedAt = now()))

        val (folderName, fileName) = splitLogicalPath(item.destinationLogicalPath)
        // SAF's ExternalStorageProvider never overwrites on a displayName
        // collision — it silently disambiguates with a numeric suffix
        // instead — so a confirmed overwrite deletes the existing same-name
        // file first and lets the normal createFile path proceed unchanged,
        // reusing all of this worker's existing progress/checksum/error
        // handling instead of a second, parallel truncate-write branch.
        if (item.overwrite) {
            tree.findFolder(folderName)?.listFiles()?.firstOrNull { it.name == fileName }?.delete()
        }
        val destination = tree.createFile(folderName, fileName)
        if (destination == null) {
            fail(item, "Não foi possível criar o arquivo de destino.")
            return@withContext Result.failure()
        }

        val (result, wasConflict) = SharingForegroundService.writeLock.withWriteLock(item.destinationLogicalPath) {
            runCatching { performTransfer(item, dao, destination.uri) }
        }
        if (wasConflict) {
            // Not an error by itself — the WriteLock already serialized the
            // second writer behind the first; surfaced for observability only.
        }

        result.fold(
            onSuccess = { totalBytes ->
                val completed = dao.getById(itemId) ?: item
                dao.update(completed.copy(state = TransferState.COMPLETED, transferredBytes = totalBytes, updatedAt = now()))
                Result.success()
            },
            onFailure = { error ->
                runCatching { applicationContext.contentResolver.delete(destination.uri, null, null) }
                fail(dao.getById(itemId) ?: item, error.message ?: "Falha na transferência.")
                Result.failure()
            }
        )
    }

    private suspend fun performTransfer(item: TransferItemEntity, dao: TransferDao, destinationUri: Uri): Long {
        val output = applicationContext.contentResolver.openOutputStream(destinationUri)
            ?: throw IOException("Não foi possível abrir o destino para escrita.")

        val input = when (item.kind) {
            TransferKind.DOWNLOAD -> openHttpStream(item.sourceUrl ?: throw IOException("URL de origem ausente."))
            TransferKind.IMPORT -> applicationContext.contentResolver.openInputStream(Uri.parse(item.sourceTreeUri))
                ?: throw IOException("Não foi possível abrir o arquivo de origem.")
            else -> throw IOException("Tipo de transferência desconhecido.")
        }

        var totalBytes = 0L
        var sinceLastUpdate = 0L
        input.use { source ->
            output.use { sink ->
                val buffer = ByteArray(CHUNK_SIZE)
                while (true) {
                    if (isStopped) throw IOException("Transferência cancelada.")
                    val read = source.read(buffer)
                    if (read == -1) break
                    sink.write(buffer, 0, read)
                    totalBytes += read
                    sinceLastUpdate += read
                    if (sinceLastUpdate >= PROGRESS_UPDATE_THRESHOLD) {
                        sinceLastUpdate = 0
                        setProgressAsync(workDataOf(KEY_TRANSFERRED_BYTES to totalBytes))
                        dao.update(item.copy(transferredBytes = totalBytes, updatedAt = now()))
                    }
                }
                sink.flush()
            }
        }
        return totalBytes
    }

    private fun openHttpStream(url: String): java.io.InputStream {
        val response = client.newCall(Request.Builder().url(url).build()).execute()
        if (!response.isSuccessful) {
            response.close()
            throw IOException("Download falhou: HTTP ${response.code}")
        }
        return response.body?.byteStream() ?: throw IOException("Resposta de download vazia.")
    }

    private suspend fun fail(item: TransferItemEntity, message: String) {
        db.transferDao().update(item.copy(state = TransferState.FAILED, errorMessage = message, updatedAt = now()))
    }

    private fun splitLogicalPath(path: String): Pair<String, String> {
        val parts = path.split('/', '\\').filter { it.isNotBlank() }
        return if (parts.size >= 2) parts[0] to parts.drop(1).joinToString("/") else "APPS" to path
    }

    private fun now(): String = Instant.now().toString()

    companion object {
        const val KEY_TRANSFER_ID = "transferId"
        const val KEY_TRANSFERRED_BYTES = "transferredBytes"
        private const val CHUNK_SIZE = 64 * 1024
        private const val PROGRESS_UPDATE_THRESHOLD = 1024 * 1024 // 1MB — throttles Room writes
    }
}
