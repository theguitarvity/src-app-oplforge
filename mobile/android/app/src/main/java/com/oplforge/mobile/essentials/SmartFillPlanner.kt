package com.oplforge.mobile.essentials

data class SmartFillPlanResult(
    val availableBytes: Long,
    val selectedItems: List<CatalogListingCacheEntity>,
    val estimatedTotalBytes: Long,
    val remainingBytes: Long,
    val warnings: List<String>
)

/** Fill strategy the user picks in the Smart Fill wizard (FR — device-space-aware Smart Fill wizard). */
enum class SmartFillMode { RATING, RANDOM }

/**
 * Port of desktop's `createSmartFillPlan` (spec 008 research.md R3) — greedy
 * fill of deduplicated-by-title items up to a byte budget, in one of two
 * orders the user picks via the wizard: [SmartFillMode.RATING] (best
 * scoreTier first — S, then A, B, C, Unrated) or [SmartFillMode.RANDOM]
 * (shuffled). Both draw from the same accessible/deduplicated candidate
 * pool — RATING no longer hard-excludes B/C/Unrated titles, since a rating
 * fill should still use leftover budget on lower tiers rather than leaving
 * space unused.
 */
object SmartFillPlanner {

    private const val DEFAULT_FALLBACK_SIZE_BYTES = 4_700_000_000L // ~4.7GB, same default as desktop for size-unknown items
    private val TIER_RANK = mapOf("S" to 0, "A" to 1, "B" to 2, "C" to 3, "Unrated" to 4)

    fun plan(
        candidates: List<CatalogListingCacheEntity>,
        availableBytes: Long,
        targetBytes: Long,
        mode: SmartFillMode = SmartFillMode.RATING
    ): SmartFillPlanResult {
        val effectiveBudget = minOf(availableBytes, targetBytes)
        val seenTitles = mutableSetOf<String>()
        val eligible = candidates
            .filter { it.accessible }
            .filter { seenTitles.add(it.title.lowercase()) }

        val ordered = when (mode) {
            SmartFillMode.RATING -> eligible.sortedBy { TIER_RANK[it.scoreTier] ?: TIER_RANK.size }
            SmartFillMode.RANDOM -> eligible.shuffled()
        }

        val selected = mutableListOf<CatalogListingCacheEntity>()
        var total = 0L
        for (item in ordered) {
            val size = item.sizeBytes ?: DEFAULT_FALLBACK_SIZE_BYTES
            if (total + size <= effectiveBudget) {
                selected.add(item)
                total += size
            }
        }

        val warnings = if (selected.isEmpty()) listOf("Nenhum jogo coube no espaço disponível.") else emptyList()
        return SmartFillPlanResult(
            availableBytes = effectiveBudget,
            selectedItems = selected,
            estimatedTotalBytes = total,
            remainingBytes = (effectiveBudget - total).coerceAtLeast(0),
            warnings = warnings
        )
    }
}
