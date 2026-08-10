package com.oplforge.mobile.essentials

import org.json.JSONObject

data class RawArchiveFile(val name: String, val url: String, val sizeBytes: Long?, val mediaType: String)

/**
 * Pure JSON-to-domain mapping for one Internet Archive metadata file entry
 * (spec 008 research.md R1) — split out from [EssentialsCatalogClient] so it
 * can be unit-tested without an Android `Context`/Room dependency.
 */
object ArchiveFileMapper {
    private val supportedExtensions = listOf(".iso", ".bin", ".cue", ".torrent", ".zip", ".7z")

    fun mapFile(identifier: String, file: JSONObject): RawArchiveFile? {
        val name = file.optString("name").takeIf { it.isNotBlank() } ?: return null
        val extension = supportedExtensions.firstOrNull { name.lowercase().endsWith(it) } ?: return null
        val sizeBytes = file.optString("size").toLongOrNull()
        // Internet Archive's datanode servers (unlike the archive.org front-end)
        // treat "+" literally rather than as a space, so path segments need
        // %-encoding, not URLEncoder's form encoding.
        val url = "https://archive.org/download/$identifier/" +
            name.split('/').joinToString("/") {
                java.net.URLEncoder.encode(it, "UTF-8").replace("+", "%20")
            }
        return RawArchiveFile(name = name, url = url, sizeBytes = sizeBytes, mediaType = classifyMedia(name, extension))
    }

    fun classifyMedia(name: String, extension: String): String {
        val lower = name.lowercase()
        return when {
            extension == ".torrent" -> "torrent"
            extension == ".zip" || extension == ".7z" -> "archive"
            extension == ".bin" || extension == ".cue" -> "ps1"
            extension == ".iso" -> if (lower.contains("(cd)") || lower.contains("[cd]")) "ps2-cd" else "ps2-dvd"
            else -> "unknown"
        }
    }
}
