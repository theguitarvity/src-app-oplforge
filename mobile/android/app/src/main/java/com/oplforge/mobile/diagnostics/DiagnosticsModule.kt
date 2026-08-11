package com.oplforge.mobile.diagnostics

import com.oplforge.mobile.specs.NativeDiagnosticsModuleSpec
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.oplforge.mobile.catalog.CatalogIndexStore
import com.oplforge.mobile.catalog.CatalogScanner
import com.oplforge.mobile.library.LibraryPreferences
import com.oplforge.mobile.library.SafDocumentTree
import com.oplforge.mobile.shared.AppDatabase
import com.oplforge.mobile.shared.AppError
import com.oplforge.mobile.shared.ErrorMapping
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import java.time.Instant
import java.util.UUID

private const val DIAGNOSTICS_TIMEOUT_MS = 20_000L

/**
 * TurboModule for the Diagnostics screen (spec 008 FR-010). See
 * contracts/native-modules.md DiagnosticsModule for the contract this
 * implements — reuses spec 006's `CatalogIndexStore`/`CatalogScanner` rather
 * than duplicating scan logic.
 */
class DiagnosticsModule(reactContext: ReactApplicationContext) :
    NativeDiagnosticsModuleSpec(reactContext) {

    private val db = AppDatabase.getInstance(reactContext)
    private val catalogStore = CatalogIndexStore(db)
    private val libraryPreferences = LibraryPreferences(reactContext)
    private val scope = CoroutineScope(Dispatchers.IO)

    private val requiredFolders = listOf("DVD", "CD", "PS1", "APPS", "ART", "CFG", "VMC")

    override fun runDiagnostics(promise: Promise) {
        val stored = libraryPreferences.load()
        if (stored == null) {
            ErrorMapping.reject(promise, AppError("NO_LIBRARY_SELECTED", "Nenhuma biblioteca foi selecionada."))
            return
        }
        scope.launch {
            val result = withTimeoutOrNull(DIAGNOSTICS_TIMEOUT_MS) {
                val tree = SafDocumentTree(reactApplicationContext, android.net.Uri.parse(stored.treeUri))
                val missingFolders = requiredFolders.filter { tree.findFolder(it) == null }
                val freeBytes = tree.availableBytes()

                var snapshot = catalogStore.getLatestCompleted()
                if (snapshot == null) {
                    val started = catalogStore.startSnapshot()
                    val scanResult = CatalogScanner(tree).scan(
                        snapshotId = started.id,
                        onProgress = {},
                        isCancelled = { false }
                    )
                    catalogStore.appendEntries(scanResult.entries)
                    catalogStore.completeSnapshot(started, scanResult.countsByType, scanResult.issueCount)
                    snapshot = catalogStore.getLatestCompleted()
                }

                val readiness = ReadinessClassifier.classify(
                    missingFolders = missingFolders,
                    freeBytes = freeBytes,
                    catalogIssueCount = snapshot?.issueCount ?: 0,
                    libraryAccessValid = stored.accessValid
                )

                DiagnosticsReportEntity(
                    id = UUID.randomUUID().toString(),
                    missingFolders = missingFolders,
                    freeBytes = freeBytes,
                    catalogSnapshotId = snapshot?.id ?: "",
                    readiness = readiness,
                    checkedAt = Instant.now().toString()
                )
            }
            if (result == null) {
                ErrorMapping.reject(promise, AppError("DIAGNOSTICS_TIMEOUT", "O diagnóstico demorou demais e foi cancelado. Tente novamente."))
                return@launch
            }
            db.diagnosticsReportDao().insert(result)
            promise.resolve(reportToMap(result))
        }
    }

    override fun getLatestDiagnosticsReport(promise: Promise) {
        scope.launch {
            val report = db.diagnosticsReportDao().getLatest()
            promise.resolve(report?.let { reportToMap(it) })
        }
    }

    /** Creates any of the 7 mandatory OPL folders that don't exist yet, then re-runs diagnostics. */
    override fun prepareDeviceStructure(promise: Promise) {
        val stored = libraryPreferences.load()
        if (stored == null) {
            ErrorMapping.reject(promise, AppError("NO_LIBRARY_SELECTED", "Nenhuma biblioteca foi selecionada."))
            return
        }
        scope.launch {
            try {
                val tree = SafDocumentTree(reactApplicationContext, android.net.Uri.parse(stored.treeUri))
                requiredFolders.forEach { name ->
                    if (tree.findFolder(name) == null) tree.root?.createDirectory(name)
                }
                runDiagnostics(promise)
            } catch (e: Exception) {
                ErrorMapping.rejectUnexpected(promise, e)
            }
        }
    }

    private fun reportToMap(report: DiagnosticsReportEntity): WritableMap = Arguments.createMap().apply {
        putString("id", report.id)
        val missing = Arguments.createArray()
        report.missingFolders.forEach { missing.pushString(it) }
        putArray("missingFolders", missing)
        report.freeBytes?.let { putDouble("freeBytes", it.toDouble()) }
        putString("catalogSnapshotId", report.catalogSnapshotId)
        putString("readiness", report.readiness)
        putString("checkedAt", report.checkedAt)
    }

    companion object {
        const val NAME = "DiagnosticsModule"
    }
}
