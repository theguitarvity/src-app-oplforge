package com.oplforge.mobile.diagnostics

/**
 * Port of desktop's `readiness-classifier.ts` four-state model (spec 008
 * research.md R8) — `ready` | `ready-with-warnings` | `requires-reorganization`
 * | `incompatible`, not a simplified three-state one. Desktop's classifier
 * reads fragmentation/compatibility signals from a direct block-device scan
 * that has no SAF equivalent (spec 006's `CatalogScanner` only tracks naming
 * conformance), so this adapts the same four states to the signals Android
 * actually has: missing mandatory folders, free space, and catalog naming
 * issues.
 */
object ReadinessClassifier {
    private val ESSENTIAL_FOLDERS = setOf("DVD", "CD", "PS1", "APPS")

    fun classify(
        missingFolders: List<String>,
        freeBytes: Long?,
        catalogIssueCount: Int,
        libraryAccessValid: Boolean
    ): String {
        if (!libraryAccessValid) return "incompatible"
        if (ESSENTIAL_FOLDERS.all { it in missingFolders }) return "incompatible"
        if (missingFolders.isNotEmpty()) return "requires-reorganization"
        val unknown = freeBytes == null || catalogIssueCount > 0
        return if (unknown) "ready-with-warnings" else "ready"
    }
}
