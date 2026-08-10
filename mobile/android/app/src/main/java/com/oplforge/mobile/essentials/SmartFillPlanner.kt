package com.oplforge.mobile.essentials

data class SmartFillPlanResult(
    val availableBytes: Long,
    val selectedItems: List<CatalogListingCacheEntity>,
    val estimatedTotalBytes: Long,
    val remainingBytes: Long,
    val warnings: List<String>
)

/**
 * Port of desktop's `createSmartFillPlan` (spec 008 research.md R3) — greedy
 * fill of S/A-tier, deduplicated-by-title items up to a byte budget.
 */
object SmartFillPlanner {

    private const val DEFAULT_FALLBACK_SIZE_BYTES = 4_700_000_000L // ~4.7GB, same default as desktop for size-unknown items

    fun plan(candidates: List<CatalogListingCacheEntity>, availableBytes: Long, targetBytes: Long): SmartFillPlanResult {
        val effectiveBudget = minOf(availableBytes, targetBytes)
        val seenTitles = mutableSetOf<String>()
        val eligible = candidates
            .filter { it.accessible && (it.scoreTier == "S" || it.scoreTier == "A") }
            .filter { seenTitles.add(it.title.lowercase()) }

        val selected = mutableListOf<CatalogListingCacheEntity>()
        var total = 0L
        for (item in eligible) {
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
