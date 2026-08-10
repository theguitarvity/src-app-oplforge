package com.oplforge.mobile.essentials

/** Port of desktop's `GameRatingSeed` (src/data/game-ratings.seed.json) — same 6-title curated seed. */
data class GameRatingSeed(
    val normalizedTitle: String,
    val score: Int,
    val genres: List<String>,
    val priority: String // "must-have" | "recommended" | "optional" | "unrated"
)

data class ScoredListing(
    val id: String,
    val title: String,
    val normalizedTitle: String,
    val fileName: String,
    val url: String,
    val sizeBytes: Long?,
    val mediaType: String,
    val score: Int?,
    val scoreTier: String,
    val genres: List<String>,
    val priority: String
)

/**
 * Port of desktop's `GameScoringService.ts` (spec 008 research.md R3) —
 * same normalization, similarity matching, and score formula, against the
 * same curated seed list.
 */
object GameScoring {

    private val seeds = listOf(
        GameRatingSeed("shadow of the colossus", 98, listOf("Adventure", "Action"), "must-have"),
        GameRatingSeed("resident evil 4", 98, listOf("Survival Horror", "Action"), "must-have"),
        GameRatingSeed("metal gear solid 3 subsistence", 97, listOf("Stealth", "Action"), "must-have"),
        GameRatingSeed("okami", 96, listOf("Adventure"), "must-have"),
        GameRatingSeed("silent hill 2", 96, listOf("Horror"), "must-have"),
        GameRatingSeed("need for speed underground 2", 92, listOf("Racing"), "recommended")
    )

    private val gameIdPattern = Regex(
        "\\b(SLUS|SCUS|SLES|SCES|SLPM|SLPS|SLKA|SCAJ)[-_ ]?\\d{3}[._-]?\\d{2}\\b",
        RegexOption.IGNORE_CASE
    )
    private val regionPattern = Regex(
        "\\((usa|europe|japan|brazil|pal|ntsc|disc \\d+|cd|dvd).*?\\)",
        RegexOption.IGNORE_CASE
    )

    fun normalizeTitle(fileName: String): String {
        var value = fileName.replace(Regex("\\.(iso|bin|cue|7z|zip|torrent)$", RegexOption.IGNORE_CASE), "")
        value = gameIdPattern.replace(value, "")
        value = regionPattern.replace(value, "")
        value = value.replace(Regex("\\[(.*?)\\]"), " ")
        value = value.replace(Regex("[_.,-]+"), " ")
        value = value.replace(Regex("\\s+"), " ")
        return value.trim().lowercase()
    }

    private fun similarity(a: String, b: String): Double {
        val aWords = a.split(' ').filter { it.isNotEmpty() }.toSet()
        val bWords = b.split(' ').filter { it.isNotEmpty() }.toSet()
        val intersection = aWords.intersect(bWords).size
        val union = (aWords + bWords).size
        return if (union == 0) 0.0 else intersection.toDouble() / union
    }

    private fun findRating(normalizedTitle: String): GameRatingSeed? {
        var best: Pair<GameRatingSeed, Double>? = null
        for (seed in seeds) {
            val match = similarity(normalizedTitle, seed.normalizedTitle)
            if (best == null || match > best.second) best = seed to match
        }
        return best?.takeIf { it.second >= 0.6 }?.first
    }

    private fun priorityWeight(priority: String): Int = when (priority) {
        "must-have" -> 6
        "recommended" -> 3
        "optional" -> 1
        else -> 0
    }

    private fun sizePenalty(sizeBytes: Long?): Double {
        if (sizeBytes == null || sizeBytes == 0L) return 0.0
        val gb = sizeBytes / 1024.0 / 1024.0 / 1024.0
        return (gb - 4).coerceIn(0.0, 8.0)
    }

    private fun tierFromScore(score: Int?): String = when {
        score == null -> "Unrated"
        score >= 95 -> "S"
        score >= 88 -> "A"
        score >= 78 -> "B"
        else -> "C"
    }

    fun score(id: String, fileName: String, url: String, sizeBytes: Long?, mediaType: String): ScoredListing {
        val normalizedTitle = normalizeTitle(fileName)
        val seed = findRating(normalizedTitle)
        val finalScore = seed?.let {
            (it.score + priorityWeight(it.priority) - sizePenalty(sizeBytes)).let(Math::round).toInt()
        }
        return ScoredListing(
            id = id,
            title = normalizedTitle.split(' ').joinToString(" ") { word -> word.replaceFirstChar(Char::uppercase) },
            normalizedTitle = normalizedTitle,
            fileName = fileName,
            url = url,
            sizeBytes = sizeBytes,
            mediaType = mediaType,
            score = finalScore,
            scoreTier = tierFromScore(finalScore),
            genres = seed?.genres ?: emptyList(),
            priority = seed?.priority ?: "unrated"
        )
    }

    fun sort(games: List<ScoredListing>): List<ScoredListing> =
        games.sortedWith(
            compareByDescending<ScoredListing> { it.score ?: -1 }
                .thenBy { it.sizeBytes ?: 0 }
        )
}
