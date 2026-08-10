package com.oplforge.mobile.essentials

import com.oplforge.mobile.shared.AppDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.time.Duration
import java.time.Instant
import java.util.Base64
import java.util.concurrent.Semaphore

/**
 * Port of desktop's `InternetArchiveDirectoryProvider` (spec 008 research.md
 * R1) — a plain JSON GET to Internet Archive's metadata API, no scraping, no
 * auth. Plus per-item HEAD accessibility checks with a 24h-TTL Room cache
 * (research.md R2).
 */
class EssentialsCatalogClient(private val db: AppDatabase) {

    private val client = OkHttpClient.Builder()
        .callTimeout(Duration.ofSeconds(15))
        .build()

    private val artIndex = LibretroArtIndex(client)

    suspend fun listFiles(): List<RawArchiveFile> = withContext(Dispatchers.IO) {
        val identifier = "playstation2_essentials"
        val request = Request.Builder().url("https://archive.org/metadata/$identifier").build()
        val response = client.newCall(request).execute()
        response.use {
            if (!it.isSuccessful) throw java.io.IOException("Archive metadata request failed: ${it.code}")
            val body = it.body?.string() ?: "{}"
            val json = JSONObject(body)
            val files = json.optJSONArray("files") ?: JSONArray()
            (0 until files.length()).mapNotNull { index -> ArchiveFileMapper.mapFile(identifier, files.getJSONObject(index)) }
        }
    }

    /** Checks accessibility for [files] concurrently (8-way, matches desktop), 8s timeout each. */
    suspend fun checkAccessibility(files: List<RawArchiveFile>): List<CatalogListingCacheEntity> = withContext(Dispatchers.IO) {
        val semaphore = Semaphore(8)
        val checkedAt = Instant.now().toString()
        files.map { file ->
            async {
                semaphore.acquire()
                try {
                    checkOne(file, checkedAt)
                } finally {
                    semaphore.release()
                }
            }
        }.awaitAll()
    }

    private suspend fun checkOne(file: RawArchiveFile, checkedAt: String): CatalogListingCacheEntity {
        val scored = GameScoring.score(
            id = idFor(file),
            fileName = file.name,
            url = file.url,
            sizeBytes = file.sizeBytes,
            mediaType = file.mediaType
        )
        val accessible = try {
            val head = Request.Builder().url(file.url).head().build()
            val response = client.newCall(head).execute()
            response.use { it.isSuccessful }
        } catch (e: Exception) {
            false
        }
        val boxArtUrl = try {
            artIndex.findBoxArtUrl(scored.title, scored.mediaType)
        } catch (e: Exception) {
            null
        }
        return CatalogListingCacheEntity(
            id = scored.id,
            title = scored.title,
            fileName = scored.fileName,
            url = scored.url,
            sizeBytes = scored.sizeBytes,
            mediaType = scored.mediaType,
            scoreTier = scored.scoreTier,
            accessible = accessible,
            checkedAt = checkedAt,
            boxArtUrl = boxArtUrl
        )
    }

    private fun idFor(file: RawArchiveFile): String =
        Base64.getUrlEncoder().withoutPadding().encodeToString(file.url.toByteArray(Charsets.UTF_8))

    /** Reads the cache if fresh (<24h since the oldest entry), otherwise refreshes it from the network. */
    suspend fun getListings(forceRefresh: Boolean = false): List<CatalogListingCacheEntity> {
        val dao = db.catalogListingCacheDao()
        if (!forceRefresh) {
            val oldest = dao.oldestCheckedAt()
            if (oldest != null && Duration.between(Instant.parse(oldest), Instant.now()) < Duration.ofHours(24)) {
                return dao.getAll()
            }
        }
        val files = listFiles().filter { it.mediaType == "ps2-dvd" || it.mediaType == "ps2-cd" || it.mediaType == "ps1" }
        val checked = checkAccessibility(files)
        dao.clear()
        dao.insertAll(checked)
        return dao.getAll()
    }
}
