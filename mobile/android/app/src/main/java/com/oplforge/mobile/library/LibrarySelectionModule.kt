package com.oplforge.mobile.library

import android.app.Activity
import android.content.Intent
import android.net.Uri
import com.oplforge.mobile.specs.NativeLibraryModuleSpec
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.oplforge.mobile.shared.AppError
import com.oplforge.mobile.shared.AppDatabase
import com.oplforge.mobile.shared.ErrorMapping
import com.oplforge.mobile.shared.HistoryStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.Instant

/**
 * TurboModule for library selection (FR-001–FR-005). See
 * contracts/native-modules.md LibraryModule for the contract this implements.
 */
class LibrarySelectionModule(reactContext: ReactApplicationContext) :
    NativeLibraryModuleSpec(reactContext), ActivityEventListener {

    private val preferences = LibraryPreferences(reactContext)
    private val historyStore = HistoryStore(AppDatabase.getInstance(reactContext))
    private val scope = CoroutineScope(Dispatchers.IO)
    private var pendingPromise: Promise? = null

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun selectLibrary(promise: Promise) {
        val activity = currentActivity
        if (activity == null) {
            ErrorMapping.reject(promise, AppError("NO_ACTIVITY", "Não foi possível abrir o seletor de pastas."))
            return
        }
        pendingPromise = promise
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
            addFlags(
                Intent.FLAG_GRANT_READ_URI_PERMISSION or
                    Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
                    Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
            )
        }
        activity.startActivityForResult(intent, REQUEST_CODE_SELECT_LIBRARY)
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != REQUEST_CODE_SELECT_LIBRARY) return
        val promise = pendingPromise ?: return
        pendingPromise = null

        if (resultCode != Activity.RESULT_OK || data?.data == null) {
            ErrorMapping.reject(promise, AppError("SELECTION_CANCELLED", "Seleção cancelada."))
            return
        }

        val treeUri: Uri = data.data!!
        try {
            reactApplicationContext.contentResolver.takePersistableUriPermission(
                treeUri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
            )
        } catch (e: SecurityException) {
            ErrorMapping.reject(promise, AppError("GRANT_FAILED", "Não foi possível obter acesso persistente à pasta."))
            return
        }

        val tree = SafDocumentTree(reactApplicationContext, treeUri)
        val now = Instant.now().toString()
        val stored = StoredLibrarySelection(
            treeUri = treeUri.toString(),
            displayName = tree.displayName(),
            sourceKind = classifySource(treeUri),
            accessGrantedAt = now,
            accessValid = true,
            lastValidatedAt = now
        )
        preferences.save(stored)
        scope.launch {
            historyStore.record(
                HistoryStore.OP_LIBRARY_SELECTED,
                HistoryStore.RESULT_SUCCESS,
                "Biblioteca selecionada: ${stored.displayName}"
            )
        }
        promise.resolve(toMap(stored))
    }

    override fun onNewIntent(intent: Intent) = Unit

    override fun getActiveLibrary(promise: Promise) {
        val stored = preferences.load()
        if (stored == null) {
            promise.resolve(Arguments.createMap().apply { putBoolean("exists", false) })
            return
        }
        val map = toMap(stored)
        map.putBoolean("exists", true)
        promise.resolve(map)
    }

    override fun revalidateAccess(promise: Promise) {
        val stored = preferences.load()
        if (stored == null) {
            promise.resolve(Arguments.createMap().apply { putBoolean("exists", false) })
            return
        }
        val uri = Uri.parse(stored.treeUri)
        val hasGrant = reactApplicationContext.contentResolver.persistedUriPermissions.any {
            it.uri == uri && it.isReadPermission
        }
        val now = Instant.now().toString()
        preferences.updateValidity(hasGrant, now)
        val updated = stored.copy(accessValid = hasGrant, lastValidatedAt = now)
        val map = toMap(updated)
        map.putBoolean("exists", true)
        promise.resolve(map)
    }

    /**
     * Full app-data reset (library selection, credentials, catalog cache,
     * transfer queue, everything) — equivalent to Settings > Apps > Clear
     * Data. `ActivityManager.clearApplicationUserData()` wipes it and
     * restarts the app process itself; this call never actually returns to
     * JS on success (the process is gone), so the promise only ever settles
     * on failure.
     */
    override fun clearAppData(promise: Promise) {
        val activityManager = reactApplicationContext.getSystemService(android.app.ActivityManager::class.java)
        val cleared = activityManager?.clearApplicationUserData() ?: false
        if (!cleared) promise.resolve(false)
    }

    private fun classifySource(uri: Uri): String {
        val authority = uri.authority ?: return "unknown"
        val docId = uri.lastPathSegment ?: ""
        return when {
            authority.contains("externalstorage") && docId.startsWith("primary:") -> "internal"
            authority.contains("externalstorage") -> "sd-card"
            authority.contains("usb") || docId.contains("usb", ignoreCase = true) -> "usb-otg"
            else -> "unknown"
        }
    }

    private fun toMap(stored: StoredLibrarySelection): WritableMap = Arguments.createMap().apply {
        putString("treeUri", stored.treeUri)
        putString("displayName", stored.displayName)
        putString("sourceKind", stored.sourceKind)
        putString("accessGrantedAt", stored.accessGrantedAt)
        putBoolean("accessValid", stored.accessValid)
        putString("lastValidatedAt", stored.lastValidatedAt)
    }

    companion object {
        const val NAME = "LibraryModule"
        private const val REQUEST_CODE_SELECT_LIBRARY = 4201
    }
}
