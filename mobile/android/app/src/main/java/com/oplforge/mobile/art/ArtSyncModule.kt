package com.oplforge.mobile.art

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.oplforge.mobile.catalog.CatalogEntryEntity
import com.oplforge.mobile.library.LibraryPreferences
import com.oplforge.mobile.library.SafDocumentTree
import com.oplforge.mobile.shared.AppDatabase
import com.oplforge.mobile.shared.AppError
import com.oplforge.mobile.shared.ErrorMapping
import com.oplforge.mobile.shared.TypedEventEmitter
import com.oplforge.mobile.specs.NativeArtSyncModuleSpec
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.launch
import java.util.concurrent.Semaphore
import java.util.concurrent.atomic.AtomicInteger

/** One box-art candidate: a locally-cataloged game missing art, matched against the remote archive. */
private data class ArtSyncMatch(val entry: CatalogEntryEntity, val zipEntry: ZipArtEntry, val type: String)

/**
 * TurboModule for Art Sync — downloads box art for games already in the
 * local library that don't have it yet, matched by exact game ID against
 * archive.org's `OPLM_ART_2024_09.zip` (mirrors desktop's Art Manager,
 * `electron/services/art/`). Unlike the Essentials catalog, this never
 * touches game files — only cover art — so there's no per-item legal
 * confirmation gate, matching desktop's `missing-only` automatic policy.
 */
class ArtSyncModule(reactContext: ReactApplicationContext) : NativeArtSyncModuleSpec(reactContext) {

    private val db = AppDatabase.getInstance(reactContext)
    private val libraryPreferences = LibraryPreferences(reactContext)
    private val remoteIndex = RemoteZipArtIndex(RemoteZipArtIndex.defaultClient())
    private val events = TypedEventEmitter(reactContext)
    private val scope = CoroutineScope(Dispatchers.IO)

    @Volatile private var plannedMatches: List<ArtSyncMatch> = emptyList()
    @Volatile private var running = false

    companion object {
        const val NAME = "ArtSyncModule"
        private const val PREFERRED_TYPE = "COV"
        private const val FALLBACK_TYPE = "COV2"
        private const val CONCURRENCY = 4
    }

    override fun planArtSync(promise: Promise) {
        val stored = libraryPreferences.load()
        if (stored == null) {
            ErrorMapping.reject(promise, AppError("NO_LIBRARY_SELECTED", "Nenhuma biblioteca foi selecionada."))
            return
        }
        scope.launch {
            try {
                emitProgress("planning")
                val snapshot = db.catalogSnapshotDao().getLatestCompleted()
                if (snapshot == null) {
                    ErrorMapping.reject(promise, AppError("NO_CATALOG_SNAPSHOT", "Catalogue sua biblioteca antes de sincronizar artes."))
                    return@launch
                }
                val missing = db.catalogEntryDao().getMissingArt(snapshot.id)
                val index = remoteIndex.loadIndex()

                val matches = mutableListOf<ArtSyncMatch>()
                for (entry in missing) {
                    val gameId = entry.gameId ?: continue
                    val forGame = index[gameId.uppercase()] ?: continue
                    val zipEntry = forGame[PREFERRED_TYPE] ?: forGame[FALLBACK_TYPE] ?: continue
                    val type = if (forGame.containsKey(PREFERRED_TYPE)) PREFERRED_TYPE else FALLBACK_TYPE
                    matches.add(ArtSyncMatch(entry, zipEntry, type))
                }
                plannedMatches = matches

                val summary = Arguments.createMap().apply {
                    putInt("totalGames", missing.size)
                    putInt("missingArt", missing.size)
                    putInt("matchedInSource", matches.size)
                }
                emitProgress("planned", totalGames = missing.size, matchedInSource = matches.size)
                promise.resolve(summary)
            } catch (e: Exception) {
                emitProgress("error", errorMessage = "Não foi possível preparar a sincronização de artes.")
                ErrorMapping.rejectUnexpected(promise, e)
            }
        }
    }

    override fun startArtSync(promise: Promise) {
        val stored = libraryPreferences.load()
        if (stored == null) {
            ErrorMapping.reject(promise, AppError("NO_LIBRARY_SELECTED", "Nenhuma biblioteca foi selecionada."))
            return
        }
        if (plannedMatches.isEmpty()) {
            ErrorMapping.reject(promise, AppError("NOTHING_PLANNED", "Prepare a sincronização antes de iniciar."))
            return
        }
        if (running) {
            ErrorMapping.reject(promise, AppError("ART_SYNC_ALREADY_RUNNING", "A sincronização de artes já está em andamento."))
            return
        }
        running = true
        val ack = Arguments.createMap().apply { putString("status", "started") }
        promise.resolve(ack)

        scope.launch {
            val tree = SafDocumentTree(reactApplicationContext, android.net.Uri.parse(stored.treeUri))
            val total = plannedMatches.size
            val installed = AtomicInteger(0)
            val failed = AtomicInteger(0)
            val semaphore = Semaphore(CONCURRENCY)

            emitProgress("running", totalGames = total, matchedInSource = total, installed = 0, failed = 0)

            plannedMatches.map { match ->
                scope.async {
                    semaphore.acquire()
                    try {
                        val bytes = remoteIndex.fetchEntryBytes(match.zipEntry)
                        if (bytes == null) {
                            failed.incrementAndGet()
                        } else {
                            val gameId = match.entry.gameId!!
                            val fileName = "${gameId}_${match.type}.png"
                            val target = tree.createFile("ART", fileName, "image/png")
                            val written = target != null && writeBytes(target.uri, bytes)
                            if (written) installed.incrementAndGet() else failed.incrementAndGet()
                        }
                    } catch (e: Exception) {
                        failed.incrementAndGet()
                    } finally {
                        semaphore.release()
                        emitProgress("running", totalGames = total, matchedInSource = total, installed = installed.get(), failed = failed.get())
                    }
                }
            }.awaitAll()

            running = false
            plannedMatches = emptyList()
            emitProgress("completed", totalGames = total, matchedInSource = total, installed = installed.get(), failed = failed.get())
        }
    }

    private fun writeBytes(uri: android.net.Uri, bytes: ByteArray): Boolean = try {
        reactApplicationContext.contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
        true
    } catch (e: Exception) {
        false
    }

    private fun emitProgress(
        state: String,
        totalGames: Int = 0,
        matchedInSource: Int = 0,
        installed: Int = 0,
        failed: Int = 0,
        errorMessage: String? = null
    ) {
        val map: WritableMap = Arguments.createMap().apply {
            putString("state", state)
            putInt("totalGames", totalGames)
            putInt("matchedInSource", matchedInSource)
            putInt("installed", installed)
            putInt("failed", failed)
            errorMessage?.let { putString("errorMessage", it) }
            putString("timestamp", java.time.Instant.now().toString())
        }
        events.emit(TypedEventEmitter.ART_SYNC_EVENT, map)
    }
}
