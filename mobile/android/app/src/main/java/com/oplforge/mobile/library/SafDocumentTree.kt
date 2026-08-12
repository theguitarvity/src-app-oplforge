package com.oplforge.mobile.library

import android.content.Context
import android.net.Uri
import android.provider.DocumentsContract
import androidx.documentfile.provider.DocumentFile

/**
 * Thin wrapper over `DocumentFile`/`DocumentsContract`, confined to a single
 * SAF-granted tree (FR-001/FR-028). Every read in this app goes through here
 * rather than touching `ContentResolver` ad hoc, so path confinement is
 * enforced in exactly one place.
 */
class SafDocumentTree(private val context: Context, val treeUri: Uri) {

    val root: DocumentFile?
        get() = DocumentFile.fromTreeUri(context, treeUri)

    /** Case-insensitive lookup of a direct child folder (e.g. "DVD", "CD", "PS1", "APPS", "ART"). */
    fun findFolder(name: String): DocumentFile? =
        root?.listFiles()?.firstOrNull { it.isDirectory && it.name?.equals(name, ignoreCase = true) == true }

    /** Files directly inside [folder] (non-recursive — OPL's own folder layout is flat per type). */
    fun filesIn(folder: DocumentFile?): List<DocumentFile> =
        folder?.listFiles()?.filter { it.isFile } ?: emptyList()

    fun displayName(): String = root?.name ?: treeUri.lastPathSegment ?: treeUri.toString()

    /**
     * Creates a new empty file `displayName` inside the top-level [folderName]
     * (e.g. "DVD"), creating that folder first if it doesn't already exist
     * (spec 008 transfer writes — downloads/imports land in a fresh SAF
     * document, never an in-place overwrite of an existing one).
     */
    fun createFile(folderName: String, displayName: String, mimeType: String = "application/octet-stream"): DocumentFile? {
        val folder = findFolder(folderName) ?: root?.createDirectory(folderName) ?: return null
        return folder.createFile(mimeType, displayName)
    }

    /** Creates (or replaces) a plain-text file directly at the tree root — e.g. the "prepare device" README, which isn't scoped to any of the 7 OPL folders. */
    fun writeRootTextFile(displayName: String, mimeType: String, content: String) {
        val root = root ?: return
        val existing = root.listFiles().firstOrNull { it.isFile && it.name?.equals(displayName, ignoreCase = true) == true }
        val file = existing ?: root.createFile(mimeType, displayName) ?: return
        context.contentResolver.openOutputStream(file.uri)?.use { it.write(content.toByteArray(Charsets.UTF_8)) }
    }

    /**
     * Free space on the tree's underlying storage root, for local storage
     * (internal/SD/USB-OTG via `ExternalStorageProvider`) only.
     *
     * `DocumentsContract.buildRootsUri()` + query looks like the "proper" API
     * but requires `MANAGE_DOCUMENTS`, a system-only permission — a
     * persisted tree-URI grant from the picker covers reads/writes under
     * that tree, not the provider's roots table. Querying it throws
     * `SecurityException: Permission Denial` for any regular app (a real
     * crash found via on-device testing, spec 008 Diagnostics). Since this
     * app only ever selects local-storage trees (FR-001), resolve the
     * tree's document ID (`<rootId>:<path>`, e.g. `primary:Documents` or
     * `1234-5678:Movies`) to its real filesystem path and stat that instead.
     * Returns null when the authority isn't the local storage provider or
     * the path can't be resolved — callers must treat null as "unknown,"
     * not "unlimited" (FR-004).
     */
    fun availableBytes(): Long? {
        if (treeUri.authority != "com.android.externalstorage.documents") return null
        val docId = try {
            DocumentsContract.getTreeDocumentId(treeUri)
        } catch (e: Exception) {
            return null
        }
        val (rootId, relativePath) = docId.split(':', limit = 2).let {
            it[0] to it.getOrElse(1) { "" }
        }
        val basePath = if (rootId == "primary") {
            android.os.Environment.getExternalStorageDirectory().absolutePath
        } else {
            "/storage/$rootId"
        }
        val fullPath = if (relativePath.isEmpty()) basePath else "$basePath/$relativePath"
        return try {
            android.os.StatFs(fullPath).let { it.availableBlocksLong * it.blockSizeLong }
        } catch (e: Exception) {
            null
        }
    }
}
