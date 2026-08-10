package com.oplforge.mobile.art

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.time.Duration

/**
 * Fetches individual PNG art assets out of the remote `OPLM_ART_2024_09.zip`
 * (archive.org, ~5.5GB) using HTTP range requests against its ZIP64 central
 * directory — never downloading the whole archive. Mirrors desktop's
 * `electron/services/art/remote-zip-art.service.ts`.
 */
class RemoteZipArtIndex(private val client: OkHttpClient) {

    /** [gameId] (e.g. "SLUS_212.59") -> [type] (e.g. "COV", "COV2") -> entry. */
    private var cachedIndex: Map<String, Map<String, ZipArtEntry>>? = null

    suspend fun loadIndex(forceRefresh: Boolean = false): Map<String, Map<String, ZipArtEntry>> {
        cachedIndex?.let { if (!forceRefresh) return it }
        return withContext(Dispatchers.IO) {
            val fileSize = contentLength()
            // EOCD comment is bounded to 65535 bytes; the ZIP64 locator (20
            // bytes) can immediately precede it — fetch a small margin extra.
            val tailSize = minOf(fileSize, 65536L + 128L)
            val tailStart = fileSize - tailSize
            val tail = rangeGet(tailStart, fileSize - 1)
            val location = ZipCentralDirectoryParser.findCentralDirectory(tail, tailStart)

            val centralDirectory = rangeGet(location.offset, location.offset + location.size - 1)
            val entries = ZipCentralDirectoryParser.parseEntries(centralDirectory)

            val index = mutableMapOf<String, MutableMap<String, ZipArtEntry>>()
            for (entry in entries) {
                index.getOrPut(entry.gameId) { mutableMapOf() }[entry.type] = entry
            }
            index.also { cachedIndex = it }
        }
    }

    /** Fetches and validates the raw PNG bytes for [entry]. Null if the fetched bytes aren't a valid PNG. */
    suspend fun fetchEntryBytes(entry: ZipArtEntry): ByteArray? = withContext(Dispatchers.IO) {
        // One request covers the local header (fixed 30 bytes + name + a
        // margin for the extra field, whose exact length varies per entry)
        // plus the full uncompressed (STORE) file payload.
        val headerMargin = 512L
        val nameEstimate = 64L // generous upper bound; only used to size the fetch, not to parse
        val end = entry.localHeaderOffset + 30 + nameEstimate + headerMargin + entry.compressedSize - 1
        val buffer = rangeGet(entry.localHeaderOffset, end)
        val dataOffset = ZipCentralDirectoryParser.localFileDataOffset(buffer)
        if (dataOffset + entry.compressedSize > buffer.size) return@withContext null

        val png = buffer.copyOfRange(dataOffset, dataOffset + entry.compressedSize.toInt())
        if (!isPng(png)) return@withContext null
        png
    }

    private fun isPng(bytes: ByteArray): Boolean {
        val magic = byteArrayOf(
            0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
        )
        if (bytes.size < magic.size) return false
        return magic.indices.all { bytes[it] == magic[it] }
    }

    private fun contentLength(): Long {
        val request = Request.Builder().url(ZIP_URL).head().build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw java.io.IOException("HEAD request failed: ${response.code}")
            return response.header("Content-Length")?.toLongOrNull()
                ?: throw java.io.IOException("Missing Content-Length on OPLM art archive")
        }
    }

    private fun rangeGet(start: Long, endInclusive: Long): ByteArray {
        val request = Request.Builder()
            .url(ZIP_URL)
            .header("Range", "bytes=$start-$endInclusive")
            .build()
        client.newCall(request).execute().use { response ->
            if (response.code != 206 && response.code != 200) {
                throw java.io.IOException("Range request failed: ${response.code}")
            }
            return response.body?.bytes() ?: throw java.io.IOException("Empty range response body")
        }
    }

    companion object {
        const val ZIP_URL = "https://archive.org/download/OPLM_ART_2024_09/OPLM_ART_2024_09.zip"

        fun defaultClient(): OkHttpClient = OkHttpClient.Builder()
            // The central directory range-fetch is ~8.6MB in one request (real
            // OPLM_ART_2024_09.zip, 102,803 entries) — generous relative to a
            // per-entry PNG fetch, since it only happens once per sync.
            .callTimeout(Duration.ofSeconds(120))
            .build()
    }
}
