package com.oplforge.mobile.catalog

import com.oplforge.mobile.specs.NativeCatalogModuleSpec
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.oplforge.mobile.library.LibraryPreferences
import com.oplforge.mobile.library.SafDocumentTree
import com.oplforge.mobile.shared.AppDatabase
import com.oplforge.mobile.shared.AppError
import com.oplforge.mobile.shared.ErrorMapping
import com.oplforge.mobile.shared.HistoryStore
import com.oplforge.mobile.shared.TypedEventEmitter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

/**
 * TurboModule for catalog scanning (FR-006–FR-010). See
 * contracts/native-modules.md CatalogModule for the contract this implements.
 */
class CatalogScanModule(reactContext: ReactApplicationContext) :
    NativeCatalogModuleSpec(reactContext) {

    private val db = AppDatabase.getInstance(reactContext)
    private val store = CatalogIndexStore(db)
    private val historyStore = HistoryStore(db)
    private val preferences = LibraryPreferences(reactContext)
    private val events = TypedEventEmitter(reactContext)
    private val scope = CoroutineScope(Dispatchers.IO)
    private var activeScanJob: Job? = null
    @Volatile private var cancelRequested = false

    override fun startScan(promise: Promise) {
        if (activeScanJob?.isActive == true) {
            ErrorMapping.reject(promise, AppError("SCAN_ALREADY_RUNNING", "Uma catalogação já está em andamento."))
            return
        }
        val stored = preferences.load()
        if (stored == null) {
            ErrorMapping.reject(promise, AppError("NO_LIBRARY_SELECTED", "Nenhuma biblioteca foi selecionada."))
            return
        }
        if (!stored.accessValid) {
            ErrorMapping.reject(promise, AppError("LIBRARY_ACCESS_INVALID", "O acesso à biblioteca não é mais válido."))
            return
        }

        cancelRequested = false
        activeScanJob = scope.launch {
            val snapshot = store.startSnapshot()
            promise.resolve(snapshotToMap(snapshot))
            emitScanEvent(snapshot, "Catalogação iniciada.")

            try {
                val tree = SafDocumentTree(reactApplicationContext, android.net.Uri.parse(stored.treeUri))
                val scanner = CatalogScanner(tree)
                val result = scanner.scan(
                    snapshotId = snapshot.id,
                    onProgress = { scanned ->
                        scope.launch {
                            emitScanEvent(snapshot.copy(), "Catalogando... $scanned itens encontrados.")
                        }
                    },
                    isCancelled = { cancelRequested }
                )

                if (cancelRequested) {
                    store.cancelSnapshot(snapshot)
                    emitScanEvent(snapshot.copy(state = "cancelled"), "Catalogação cancelada.")
                    return@launch
                }

                store.appendEntries(result.entries)
                store.completeSnapshot(snapshot, result.countsByType, result.issueCount)
                val completed = db.catalogSnapshotDao().getById(snapshot.id) ?: snapshot
                historyStore.record(
                    HistoryStore.OP_CATALOG_SCAN_COMPLETED,
                    HistoryStore.RESULT_SUCCESS,
                    "Catalogação concluída: ${result.entries.size} itens, ${result.issueCount} com atenção."
                )
                emitScanEvent(completed, "Catalogação concluída.")
            } catch (e: Exception) {
                store.failSnapshot(snapshot, "SCAN_FAILED", e.message ?: "Falha desconhecida")
                emitScanEvent(snapshot.copy(state = "error"), "Falha na catalogação.")
            }
        }
    }

    override fun cancelScan(promise: Promise) {
        cancelRequested = true
        promise.resolve(null)
    }

    override fun getLatestSnapshot(promise: Promise) {
        scope.launch {
            val snapshot = store.getLatest()
            if (snapshot == null) {
                promise.resolve(Arguments.createMap().apply { putBoolean("exists", false) })
            } else {
                val map = snapshotToMap(snapshot)
                map.putBoolean("exists", true)
                promise.resolve(map)
            }
        }
    }

    /**
     * Windowed catalog browsing (US6, contracts/native-modules.md pagination
     * note) — always reads from the latest *completed* snapshot, never a
     * still-running one, so the list a user browses never shifts mid-scroll.
     */
    override fun getCatalogEntries(page: Double, pageSize: Double, typeFilter: String, promise: Promise) {
        scope.launch {
            val snapshot = store.getLatestCompleted()
            if (snapshot == null) {
                promise.resolve(Arguments.createArray())
                return@launch
            }
            val entries = store.getEntriesPage(snapshot.id, typeFilter, page.toInt(), pageSize.toInt())
            val array = Arguments.createArray()
            entries.forEach { entry -> array.pushMap(entryToMap(entry)) }
            promise.resolve(array)
        }
    }

    /**
     * Resolves a `content://` URI for [gameId]'s cover art, when present
     * (OPL convention, desktop's `local-art-index.service.ts` ART_NAME
     * regex: `<GAMEID>_COV[2].png`, gameId separator normalized to `_`/`-`/`.`
     * interchangeably). Returns `{ uri: null }` rather than rejecting when
     * there's no library, no ART folder, or no matching file — art is
     * optional decoration, never a hard requirement (data-model.md
     * GameArtStatus 'missing' is a normal state, not an error).
     */
    override fun getArtUri(gameId: String, promise: Promise) {
        val stored = preferences.load()
        if (stored == null || !stored.accessValid) {
            promise.resolve(Arguments.createMap().apply { putNull("uri") })
            return
        }
        scope.launch {
            val tree = SafDocumentTree(reactApplicationContext, android.net.Uri.parse(stored.treeUri))
            val artFolder = tree.findFolder("ART")
            val normalized = gameId.replace('-', '_').replace('.', '_').uppercase()
            val match = tree.filesIn(artFolder).firstOrNull { file ->
                val name = file.name?.uppercase() ?: return@firstOrNull false
                val base = name.substringBeforeLast('.').replace('-', '_').replace('.', '_')
                (base == "${normalized}_COV" || base == "${normalized}_COV2") && name.endsWith(".PNG")
            }
            promise.resolve(
                Arguments.createMap().apply {
                    if (match != null) putString("uri", match.uri.toString()) else putNull("uri")
                }
            )
        }
    }

    override fun addListener(eventName: String) = Unit
    override fun removeListeners(count: Double) = Unit

    private fun entryToMap(entry: CatalogEntryEntity): WritableMap = Arguments.createMap().apply {
        putString("id", entry.id)
        putString("contentType", entry.contentType)
        entry.gameId?.let { putString("gameId", it) }
        putString("title", entry.title)
        putString("extension", entry.extension)
        putDouble("sizeBytes", entry.sizeBytes.toDouble())
        putString("logicalPath", entry.logicalPath)
        putBoolean("hasArt", entry.hasArt)
        putString("namingConformance", entry.namingConformance)
        val issues = Arguments.createArray()
        entry.structuralIssues.forEach { issues.pushString(it) }
        putArray("structuralIssues", issues)
    }

    private suspend fun emitScanEvent(snapshot: CatalogSnapshotEntity, message: String) {
        val map = Arguments.createMap()
        map.putMap("snapshot", snapshotToMap(snapshot))
        map.putString("message", message)
        map.putString("timestamp", java.time.Instant.now().toString())
        events.emit(TypedEventEmitter.CATALOG_SCAN_EVENT, map)
    }

    private fun snapshotToMap(snapshot: CatalogSnapshotEntity): WritableMap {
        val counts = Arguments.createMap().apply {
            putInt("dvd", snapshot.dvdCount)
            putInt("cd", snapshot.cdCount)
            putInt("ps1", snapshot.ps1Count)
            putInt("app", snapshot.appCount)
        }
        return Arguments.createMap().apply {
            putString("id", snapshot.id)
            putString("state", snapshot.state)
            putString("startedAt", snapshot.startedAt)
            snapshot.completedAt?.let { putString("completedAt", it) }
            putMap("countsByType", counts)
            putInt("issueCount", snapshot.issueCount)
            if (snapshot.errorCode != null) {
                putMap("error", Arguments.createMap().apply {
                    putString("code", snapshot.errorCode)
                    putString("message", snapshot.errorMessage ?: "")
                })
            }
        }
    }

    companion object {
        const val NAME = "CatalogModule"
    }
}
