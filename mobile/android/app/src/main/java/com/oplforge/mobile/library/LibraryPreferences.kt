package com.oplforge.mobile.library

import android.content.Context

data class StoredLibrarySelection(
    val treeUri: String,
    val displayName: String,
    val sourceKind: String,
    val accessGrantedAt: String,
    val accessValid: Boolean,
    val lastValidatedAt: String
)

/**
 * Lightweight preferences store for the active `LibrarySelection` (data-model.md,
 * research.md R7). [preferencesName] is parameterizable so instrumented tests
 * never write to the same file as the real app — a real bug found during
 * on-device testing wiped a real selected library when a test used the
 * production preferences name.
 */
class LibraryPreferences(context: Context, preferencesName: String = DEFAULT_PREFERENCES_NAME) {
    private val prefs = context.getSharedPreferences(preferencesName, Context.MODE_PRIVATE)

    fun save(selection: StoredLibrarySelection) {
        prefs.edit()
            .putString(KEY_TREE_URI, selection.treeUri)
            .putString(KEY_DISPLAY_NAME, selection.displayName)
            .putString(KEY_SOURCE_KIND, selection.sourceKind)
            .putString(KEY_ACCESS_GRANTED_AT, selection.accessGrantedAt)
            .putBoolean(KEY_ACCESS_VALID, selection.accessValid)
            .putString(KEY_LAST_VALIDATED_AT, selection.lastValidatedAt)
            .apply()
    }

    fun load(): StoredLibrarySelection? {
        val treeUri = prefs.getString(KEY_TREE_URI, null) ?: return null
        return StoredLibrarySelection(
            treeUri = treeUri,
            displayName = prefs.getString(KEY_DISPLAY_NAME, "") ?: "",
            sourceKind = prefs.getString(KEY_SOURCE_KIND, "unknown") ?: "unknown",
            accessGrantedAt = prefs.getString(KEY_ACCESS_GRANTED_AT, "") ?: "",
            accessValid = prefs.getBoolean(KEY_ACCESS_VALID, false),
            lastValidatedAt = prefs.getString(KEY_LAST_VALIDATED_AT, "") ?: ""
        )
    }

    fun updateValidity(accessValid: Boolean, lastValidatedAt: String) {
        prefs.edit()
            .putBoolean(KEY_ACCESS_VALID, accessValid)
            .putString(KEY_LAST_VALIDATED_AT, lastValidatedAt)
            .apply()
    }

    companion object {
        const val DEFAULT_PREFERENCES_NAME = "library_selection"
        private const val KEY_TREE_URI = "treeUri"
        private const val KEY_DISPLAY_NAME = "displayName"
        private const val KEY_SOURCE_KIND = "sourceKind"
        private const val KEY_ACCESS_GRANTED_AT = "accessGrantedAt"
        private const val KEY_ACCESS_VALID = "accessValid"
        private const val KEY_LAST_VALIDATED_AT = "lastValidatedAt"
    }
}
