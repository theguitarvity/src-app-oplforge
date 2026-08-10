package com.oplforge.mobile.essentials

import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.net.URLEncoder

/**
 * Resolves cover art for Essentials catalog listings against
 * `libretro-thumbnails` (github.com/libretro-thumbnails) — a public,
 * no-API-key, community-maintained mirror of RetroArch's box art, keyed by
 * No-Intro-style filenames (e.g. `Shadow of the Colossus (USA).png`).
 * Internet Archive's `playstation2_essentials` item itself ships no
 * per-game art (verified: only ISOs/BINs plus one generic collection
 * thumbnail), so this is the only real art source available.
 *
 * The full box-art file list for a platform (~8-9k entries) is fetched once
 * via GitHub's recursive tree API and kept in memory for the process
 * lifetime — cheap relative to the 24h Room cache this feeds into
 * ([EssentialsCatalogClient]), so a stale in-memory list only matters across
 * app restarts, not within a session.
 */
class LibretroArtIndex(private val client: OkHttpClient) {

    /** One filename paired with its precomputed normalized form (computed once per repo fetch, not per lookup). */
    private data class Candidate(val fileName: String, val normalized: String)

    // [checkAccessibility]'s 8-way concurrent callers all race to resolve art
    // for the same repo at once; a plain map here would let each of them
    // kick off its own multi-MB tree fetch. Memoizing the in-flight Deferred
    // (guarded by a mutex just for the check-and-insert) means only the
    // first caller fetches — the rest await that same result.
    private val fetchesByRepo = mutableMapOf<String, Deferred<List<Candidate>>>()
    private val fetchesMutex = Mutex()

    private val repoForMediaType = mapOf(
        "ps2-dvd" to "Sony_-_PlayStation_2",
        "ps2-cd" to "Sony_-_PlayStation_2",
        "ps1" to "Sony_-_PlayStation"
    )

    /** Best-effort — returns null on any mismatch, network failure, or unmapped media type, never throws. */
    suspend fun findBoxArtUrl(title: String, mediaType: String): String? = coroutineScope {
        val repo = repoForMediaType[mediaType] ?: return@coroutineScope null
        val deferred = fetchesMutex.withLock {
            fetchesByRepo.getOrPut(repo) { async(Dispatchers.IO) { fetchCandidates(repo) } }
        }
        val candidates = deferred.await()
        if (candidates.isEmpty()) return@coroutineScope null

        val target = normalize(title)
        var best: String? = null
        var bestScore = 0.0
        for (candidate in candidates) {
            val score = similarity(target, candidate.normalized)
            if (score > bestScore) {
                bestScore = score
                best = candidate.fileName
            }
        }
        val match = best?.takeIf { bestScore >= 0.6 } ?: return@coroutineScope null
        "https://raw.githubusercontent.com/libretro-thumbnails/$repo/master/Named_Boxarts/" +
            URLEncoder.encode("$match.png", "UTF-8").replace("+", "%20")
    }

    private fun fetchCandidates(repo: String): List<Candidate> = try {
        val request = Request.Builder()
            .url("https://api.github.com/repos/libretro-thumbnails/$repo/git/trees/master?recursive=1")
            .build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return emptyList()
            val body = response.body?.string() ?: return emptyList()
            val tree = JSONObject(body).optJSONArray("tree") ?: return emptyList()
            (0 until tree.length()).mapNotNull { index ->
                val path = tree.getJSONObject(index).optString("path")
                if (path.startsWith("Named_Boxarts/") && path.endsWith(".png")) {
                    val fileName = path.removePrefix("Named_Boxarts/").removeSuffix(".png")
                    Candidate(fileName, normalize(stripRegionTags(fileName)))
                } else {
                    null
                }
            }
        }
    } catch (e: Exception) {
        emptyList()
    }

    private fun stripRegionTags(name: String): String = REGION_TAG_REGEX.replace(name, " ")

    private fun normalize(value: String): String =
        NON_ALNUM_REGEX.replace(value.lowercase(), " ").trim()

    private fun similarity(a: String, b: String): Double {
        val aWords = a.split(' ').filter { it.isNotEmpty() }.toSet()
        val bWords = b.split(' ').filter { it.isNotEmpty() }.toSet()
        if (aWords.isEmpty() || bWords.isEmpty()) return 0.0
        val intersection = aWords.intersect(bWords).size
        val union = (aWords + bWords).size
        return if (union == 0) 0.0 else intersection.toDouble() / union
    }

    companion object {
        // Compiled once — these were previously allocated fresh per call inside
        // a loop over ~9k filenames × up to ~300 catalog items (millions of
        // Regex compilations), which was the actual cause of a real on-device
        // hang discovered via profiling (qemu pegged at 400%+ CPU while the
        // Essentials catalog never finished loading).
        private val REGION_TAG_REGEX = Regex("\\([^)]*\\)")
        private val NON_ALNUM_REGEX = Regex("[^a-z0-9]+")
    }
}
