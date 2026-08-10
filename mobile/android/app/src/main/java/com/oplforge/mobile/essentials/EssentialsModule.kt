package com.oplforge.mobile.essentials

import com.oplforge.mobile.specs.NativeEssentialsModuleSpec
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.oplforge.mobile.library.LibraryPreferences
import com.oplforge.mobile.library.SafDocumentTree
import com.oplforge.mobile.shared.AppDatabase
import com.oplforge.mobile.shared.AppError
import com.oplforge.mobile.shared.ErrorMapping
import com.oplforge.mobile.transfer.TransferScheduler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * TurboModule for the Essentials catalog (spec 008 FR-001–FR-004). See
 * contracts/native-modules.md EssentialsModule for the contract this
 * implements.
 */
class EssentialsModule(reactContext: com.facebook.react.bridge.ReactApplicationContext) :
    NativeEssentialsModuleSpec(reactContext) {

    private val db = AppDatabase.getInstance(reactContext)
    private val client = EssentialsCatalogClient(db)
    private val libraryPreferences = LibraryPreferences(reactContext)
    private val scheduler = TransferScheduler(reactContext)
    private val scope = CoroutineScope(Dispatchers.IO)

    companion object {
        const val NAME = "EssentialsModule"

        // Must match the desktop's already-validated legal confirmation text
        // verbatim (spec 008 research.md R4) — not UI copy to be reworded.
        const val LEGAL_CONFIRMATION_TEXT =
            "Confirmo que possuo este jogo fisicamente/digitalmente ou tenho autorização legal para baixar este backup."
    }

    override fun listCatalog(query: ReadableMap, promise: Promise) {
        scope.launch {
            try {
                val all = client.getListings()
                val search = query.getString("search")?.lowercase()
                val tier = query.getString("tier")
                val mediaType = query.getString("mediaType")
                val filtered = all.filter { item ->
                    (search.isNullOrBlank() || item.title.lowercase().contains(search) || item.fileName.lowercase().contains(search)) &&
                        (tier.isNullOrBlank() || tier == "all" || item.scoreTier == tier) &&
                        (mediaType.isNullOrBlank() || mediaType == "all" || item.mediaType == mediaType)
                }
                val array = Arguments.createArray()
                filtered.forEach { array.pushMap(listingToMap(it)) }
                promise.resolve(array)
            } catch (e: Exception) {
                ErrorMapping.rejectUnexpected(promise, e)
            }
        }
    }

    override fun refreshCatalog(promise: Promise) {
        scope.launch {
            try {
                val refreshed = client.getListings(forceRefresh = true)
                val array = Arguments.createArray()
                refreshed.forEach { array.pushMap(listingToMap(it)) }
                promise.resolve(array)
            } catch (e: Exception) {
                ErrorMapping.rejectUnexpected(promise, e)
            }
        }
    }

    override fun createSmartFillPlan(targetBytes: Double, promise: Promise) {
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
            try {
                val tree = SafDocumentTree(reactApplicationContext, android.net.Uri.parse(stored.treeUri))
                val available = tree.availableBytes() ?: 0L
                val candidates = client.getListings()
                val plan = SmartFillPlanner.plan(candidates, available, targetBytes.toLong())
                val map = Arguments.createMap().apply {
                    putDouble("availableBytes", plan.availableBytes.toDouble())
                    val items = Arguments.createArray()
                    plan.selectedItems.forEach { items.pushMap(listingToMap(it)) }
                    putArray("selectedItems", items)
                    putDouble("estimatedTotalBytes", plan.estimatedTotalBytes.toDouble())
                    putDouble("remainingBytes", plan.remainingBytes.toDouble())
                    val warnings = Arguments.createArray()
                    plan.warnings.forEach { warnings.pushString(it) }
                    putArray("warnings", warnings)
                }
                promise.resolve(map)
            } catch (e: Exception) {
                ErrorMapping.rejectUnexpected(promise, e)
            }
        }
    }

    override fun confirmAndEnqueue(items: ReadableArray, legalConfirmationText: String, promise: Promise) {
        if (legalConfirmationText != LEGAL_CONFIRMATION_TEXT) {
            ErrorMapping.reject(promise, AppError("LEGAL_CONFIRMATION_REQUIRED", "Confirmação legal obrigatória ausente ou inválida."))
            return
        }
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
            try {
                val tree = SafDocumentTree(reactApplicationContext, android.net.Uri.parse(stored.treeUri))
                val available = tree.availableBytes()
                val selections = (0 until items.size()).mapNotNull { items.getMap(it) }
                val totalBytes = selections.sumOf { it.getDouble("sizeBytes").toLong() }
                if (available != null && totalBytes > available) {
                    ErrorMapping.reject(promise, AppError("INSUFFICIENT_SPACE", "Espaço insuficiente na biblioteca para os itens selecionados."))
                    return@launch
                }

                val created = Arguments.createArray()
                for (selection in selections) {
                    val mediaType = selection.getString("mediaType") ?: "ps2-dvd"
                    val folder = when (mediaType) {
                        "ps2-cd" -> "CD"
                        "ps1" -> "PS1"
                        else -> "DVD"
                    }
                    val fileName = selection.getString("fileName") ?: continue
                    val url = selection.getString("url") ?: continue
                    val title = selection.getString("title") ?: fileName
                    val sizeBytes = if (selection.hasKey("sizeBytes")) selection.getDouble("sizeBytes").toLong() else null
                    val legalReceiptId = "essentials:${selection.getString("id")}:${System.currentTimeMillis()}"

                    val item = scheduler.enqueueDownload(
                        destinationLogicalPath = "$folder/$fileName",
                        title = title,
                        sourceUrl = url,
                        expectedBytes = sizeBytes,
                        legalReceiptId = legalReceiptId
                    )
                    created.pushMap(transferItemToMap(item))
                }
                promise.resolve(created)
            } catch (e: Exception) {
                ErrorMapping.rejectUnexpected(promise, e)
            }
        }
    }

    private fun listingToMap(item: CatalogListingCacheEntity): WritableMap = Arguments.createMap().apply {
        putString("id", item.id)
        putString("title", item.title)
        putString("fileName", item.fileName)
        putString("url", item.url)
        item.sizeBytes?.let { putDouble("sizeBytes", it.toDouble()) }
        putString("mediaType", item.mediaType)
        putString("scoreTier", item.scoreTier)
        putBoolean("accessible", item.accessible)
        putString("checkedAt", item.checkedAt)
        item.boxArtUrl?.let { putString("boxArtUrl", it) }
    }

    private fun transferItemToMap(item: com.oplforge.mobile.transfer.TransferItemEntity): WritableMap = Arguments.createMap().apply {
        putString("id", item.id)
        putString("kind", item.kind)
        putString("destinationLogicalPath", item.destinationLogicalPath)
        putString("title", item.title)
        item.expectedBytes?.let { putDouble("expectedBytes", it.toDouble()) }
        putDouble("transferredBytes", item.transferredBytes.toDouble())
        putString("state", item.state)
        item.legalReceiptId?.let { putString("legalReceiptId", it) }
        putArray("partFiles", Arguments.createArray())
        putString("createdAt", item.createdAt)
        putString("updatedAt", item.updatedAt)
    }
}
