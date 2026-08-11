package com.oplforge.mobile.essentials

import com.oplforge.mobile.shared.AppDatabase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.time.Duration
import java.time.Instant
import java.util.Base64

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

    // Accessibility/box-art enrichment (a HEAD request + art lookup per item,
    // ~325 items in the real catalog) must never block the catalog from
    // rendering — it used to run inline inside getListings(), which on a slow
    // or loaded network could take minutes with nothing on screen but a
    // spinner ("essentials não abre"). Enrichment now runs on this
    // independent, longer-lived scope after the fast metadata-only listing
    // has already been returned and cached.
    private val enrichmentScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

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
                semaphore.withPermit { checkOne(file, checkedAt) }
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
            boxArtUrl = boxArtUrl,
            enriched = true
        )
    }

    /** Runs the accessibility/box-art pass for [files] and writes the results back, marked enriched. */
    private fun enrichInBackground(dao: CatalogListingCacheDao, files: List<RawArchiveFile>) {
        enrichmentScope.launch {
            try {
                dao.insertAll(checkAccessibility(files))
            } catch (e: Exception) {
                // Best-effort — the quick, metadata-only listing already stands.
            }
        }
    }

    private fun idFor(file: RawArchiveFile): String =
        Base64.getUrlEncoder().withoutPadding().encodeToString(file.url.toByteArray(Charsets.UTF_8))

    /**
     * Reads the cache if fresh (<24h since the oldest entry), otherwise
     * refreshes it from the network. Returns as soon as the (fast) metadata
     * listing is available — accessibility and box art are filled in
     * afterward, in the background, via [enrichmentScope]. A cache hit still
     * resumes enrichment for any rows the background pass hasn't reached yet
     * (e.g. the app was killed mid-enrichment, or a previous call's pass is
     * still running) — otherwise the quick write's own checkedAt satisfies
     * the freshness check forever and real accessibility/box art never gets
     * filled in. Callers that want to know when enrichment has actually
     * finished should re-fetch (`refreshCatalog`/re-`listCatalog`) after a
     * delay; the cache is what's updated, not this call's return value.
     */
    suspend fun getListings(forceRefresh: Boolean = false): List<CatalogListingCacheEntity> {
        val dao = db.catalogListingCacheDao()
        if (!forceRefresh) {
            val oldest = dao.oldestCheckedAt()
            if (oldest != null && Duration.between(Instant.parse(oldest), Instant.now()) < Duration.ofHours(24)) {
                val pending = dao.getUnenriched()
                if (pending.isNotEmpty()) {
                    enrichInBackground(dao, pending.map { RawArchiveFile(it.fileName, it.url, it.sizeBytes, it.mediaType) })
                }
                return dao.getAll()
            }
        }
        val files = listFiles().filter { it.mediaType == "ps2-dvd" || it.mediaType == "ps2-cd" || it.mediaType == "ps1" }
        val checkedAt = Instant.now().toString()
        val quick = files.map { file ->
            val scored = GameScoring.score(
                id = idFor(file),
                fileName = file.name,
                url = file.url,
                sizeBytes = file.sizeBytes,
                mediaType = file.mediaType
            )
            CatalogListingCacheEntity(
                id = scored.id,
                title = scored.title,
                fileName = scored.fileName,
                url = scored.url,
                sizeBytes = scored.sizeBytes,
                mediaType = scored.mediaType,
                scoreTier = scored.scoreTier,
                accessible = true, // optimistic — corrected by the background enrichment pass below
                checkedAt = checkedAt,
                boxArtUrl = null,
                enriched = false
            )
        }
        dao.clear()
        dao.insertAll(quick)
        enrichInBackground(dao, files)
        return dao.getAll()
    }
}
