package com.oplforge.mobile.transfer

import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.documentfile.provider.DocumentFile
import androidx.lifecycle.Observer
import androidx.work.WorkInfo
import com.oplforge.mobile.specs.NativeTransferModuleSpec
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.oplforge.mobile.catalog.CatalogIndexStore
import com.oplforge.mobile.library.LibraryPreferences
import com.oplforge.mobile.shared.AppDatabase
import com.oplforge.mobile.shared.AppError
import com.oplforge.mobile.shared.ErrorMapping
import com.oplforge.mobile.shared.TypedEventEmitter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.Instant

/**
 * TurboModule for the durable transfer queue (spec 008 FR-005–FR-013). See
 * contracts/native-modules.md TransferQueueModule for the contract this
 * implements. `EssentialsModule` enqueues downloads through
 * [TransferScheduler] directly rather than round-tripping through this
 * module's bridge surface.
 */
class TransferQueueModule(reactContext: ReactApplicationContext) :
    NativeTransferModuleSpec(reactContext) {

    private val db = AppDatabase.getInstance(reactContext)
    private val catalogStore = CatalogIndexStore(db)
    private val libraryPreferences = LibraryPreferences(reactContext)
    private val scheduler = TransferScheduler(reactContext)
    private val events = TypedEventEmitter(reactContext)
    private val scope = CoroutineScope(Dispatchers.IO)

    private val workObserver = Observer<List<WorkInfo>> { infos ->
        scope.launch { infos.forEach { info -> emitForWorkTag(info) } }
    }

    init {
        // LiveData.observeForever() requires the main thread — TurboModule
        // construction (createNativeModules()) runs on a background thread,
        // so this must be posted rather than called directly (real crash
        // found via on-device testing: "Cannot invoke observeForever on a
        // background thread").
        Handler(Looper.getMainLooper()).post {
            scheduler.observeQueue().observeForever(workObserver)
        }
    }

    override fun invalidate() {
        Handler(Looper.getMainLooper()).post {
            scheduler.observeQueue().removeObserver(workObserver)
        }
        super.invalidate()
    }

    override fun enqueueImport(sourceUri: String, destinationHint: String, promise: Promise) {
        val stored = libraryPreferences.load()
        if (stored == null) {
            ErrorMapping.reject(promise, AppError("NO_LIBRARY_SELECTED", "Nenhuma biblioteca foi selecionada."))
            return
        }
        if (!stored.accessValid) {
            ErrorMapping.reject(promise, AppError("LIBRARY_ACCESS_INVALID", "O acesso à biblioteca não é mais válido."))
            return
        }
        scope.launch {
            val doc = DocumentFile.fromSingleUri(reactApplicationContext, Uri.parse(sourceUri))
            if (doc == null || !doc.exists()) {
                ErrorMapping.reject(promise, AppError("SOURCE_NOT_FOUND", "Arquivo de origem não encontrado."))
                return@launch
            }
            val fileName = doc.name ?: "arquivo"
            val folder = destinationHint.ifBlank { detectFolder(fileName) }

            val latestSnapshot = catalogStore.getLatestCompleted()
            if (latestSnapshot != null) {
                val duplicate = db.catalogEntryDao().findByFileName(latestSnapshot.id, fileName)
                if (duplicate != null) {
                    ErrorMapping.reject(promise, AppError("DUPLICATE_ITEM", "\"$fileName\" já existe na biblioteca."))
                    return@launch
                }
            }

            val item = scheduler.enqueueImport(
                destinationLogicalPath = "$folder/$fileName",
                title = fileName,
                sourceTreeUri = sourceUri,
                expectedBytes = doc.length().takeIf { it > 0 }
            )
            promise.resolve(itemToMap(item))
        }
    }

    override fun getQueue(promise: Promise) {
        scope.launch {
            val array = Arguments.createArray()
            db.transferDao().getAll().forEach { array.pushMap(itemToMap(it)) }
            promise.resolve(array)
        }
    }

    override fun cancel(transferId: String, promise: Promise) {
        scope.launch {
            val item = db.transferDao().getById(transferId)
            if (item != null) {
                scheduler.cancel(transferId)
                db.transferDao().update(item.copy(state = TransferState.FAILED, errorMessage = "Cancelado pelo usuário.", updatedAt = Instant.now().toString()))
                promise.resolve(itemToMap(db.transferDao().getById(transferId)!!))
            } else {
                promise.resolve(Arguments.createMap())
            }
        }
    }

    override fun retry(transferId: String, promise: Promise) {
        scope.launch {
            val item = db.transferDao().getById(transferId)
            if (item == null) {
                ErrorMapping.reject(promise, AppError("TRANSFER_NOT_FOUND", "Transferência não encontrada."))
                return@launch
            }
            db.transferDao().update(item.copy(state = TransferState.QUEUED, errorMessage = null, updatedAt = Instant.now().toString()))
            scheduler.retry(transferId)
            promise.resolve(itemToMap(db.transferDao().getById(transferId)!!))
        }
    }

    override fun addListener(eventName: String) = Unit
    override fun removeListeners(count: Double) = Unit

    private suspend fun emitForWorkTag(info: WorkInfo) {
        val transferId = info.tags.firstOrNull { it != TransferScheduler.TAG } ?: return
        val item = db.transferDao().getById(transferId) ?: return
        val map = Arguments.createMap().apply {
            putMap("item", itemToMap(item))
            putString("timestamp", Instant.now().toString())
        }
        events.emit(TypedEventEmitter.TRANSFER_QUEUE_EVENT, map)
    }

    private fun detectFolder(fileName: String): String {
        val lower = fileName.lowercase()
        return when {
            lower.endsWith(".elf") -> "APPS"
            lower.endsWith(".bin") || lower.endsWith(".cue") -> "PS1"
            lower.contains("(cd)") || lower.contains("[cd]") -> "CD"
            else -> "DVD"
        }
    }

    private fun itemToMap(item: TransferItemEntity): WritableMap = Arguments.createMap().apply {
        putString("id", item.id)
        putString("kind", item.kind)
        putString("destinationLogicalPath", item.destinationLogicalPath)
        putString("title", item.title)
        item.expectedBytes?.let { putDouble("expectedBytes", it.toDouble()) }
        putDouble("transferredBytes", item.transferredBytes.toDouble())
        putString("state", item.state)
        item.legalReceiptId?.let { putString("legalReceiptId", it) }
        val parts = Arguments.createArray()
        item.partFiles.forEach { parts.pushString(it) }
        putArray("partFiles", parts)
        item.errorMessage?.let { putString("errorMessage", it) }
        putString("createdAt", item.createdAt)
        putString("updatedAt", item.updatedAt)
    }

    companion object {
        const val NAME = "TransferModule"
    }
}
