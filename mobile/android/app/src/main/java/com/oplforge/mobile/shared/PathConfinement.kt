package com.oplforge.mobile.shared

import androidx.documentfile.provider.DocumentFile
import com.oplforge.mobile.library.SafDocumentTree

/**
 * Resolves an SMB-style path (e.g. `\DVD\Game.iso`, `DVD\\Game.iso`) to a
 * `DocumentFile` confined to the authorized SAF tree — every served path is
 * confined this way (FR-028). Any `..` segment or empty-after-split segment
 * is rejected outright rather than normalized, so there is no traversal
 * surface at all, not even a "safely resolved" one.
 */
object PathConfinement {

    /** Returns null if the path is malformed, escapes the tree, or doesn't exist. */
    fun resolve(tree: SafDocumentTree, smbPath: String): DocumentFile? {
        val segments = smbPath.split('\\', '/').filter { it.isNotBlank() }
        if (segments.any { it == ".." || it == "." }) return null

        var current: DocumentFile = tree.root ?: return null
        for (segment in segments) {
            current = current.listFiles().firstOrNull { it.name?.equals(segment, ignoreCase = true) == true }
                ?: return null
        }
        return current
    }

    /** Directory listing for one confined path (used by FIND_FIRST2). Root path is `""`/`\`. */
    fun listDirectory(tree: SafDocumentTree, smbPath: String): List<DocumentFile>? {
        val dir = if (smbPath.isBlank() || smbPath == "\\") tree.root else resolve(tree, smbPath)
        if (dir == null || !dir.isDirectory) return null
        return dir.listFiles().toList()
    }
}
