package com.oplforge.mobile.essentials

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SmartFillPlannerTest {

    private fun listing(id: String, tier: String, sizeBytes: Long, accessible: Boolean = true, title: String = id) =
        CatalogListingCacheEntity(id, title, "$title.iso", "https://example.test/$id", sizeBytes, "ps2-dvd", tier, accessible, "now")

    @Test
    fun `selects S and A tier items that fit within the budget`() {
        val candidates = listOf(
            listing("1", "S", 4_000_000_000L),
            listing("2", "A", 3_000_000_000L),
            listing("3", "C", 1_000_000_000L) // excluded — below A tier
        )
        val plan = SmartFillPlanner.plan(candidates, availableBytes = 10_000_000_000L, targetBytes = 10_000_000_000L)
        assertEquals(2, plan.selectedItems.size)
        assertTrue(plan.warnings.isEmpty())
    }

    @Test
    fun `never exceeds the smaller of available and target bytes`() {
        val candidates = listOf(listing("1", "S", 8_000_000_000L))
        val plan = SmartFillPlanner.plan(candidates, availableBytes = 5_000_000_000L, targetBytes = 10_000_000_000L)
        assertEquals(0, plan.selectedItems.size)
        assertEquals(5_000_000_000L, plan.availableBytes)
    }

    @Test
    fun `warns when nothing fits`() {
        val candidates = listOf(listing("1", "S", 20_000_000_000L))
        val plan = SmartFillPlanner.plan(candidates, availableBytes = 1_000_000_000L, targetBytes = 1_000_000_000L)
        assertTrue(plan.warnings.isNotEmpty())
    }

    @Test
    fun `excludes inaccessible items`() {
        val candidates = listOf(listing("1", "S", 1_000_000_000L, accessible = false))
        val plan = SmartFillPlanner.plan(candidates, availableBytes = 10_000_000_000L, targetBytes = 10_000_000_000L)
        assertEquals(0, plan.selectedItems.size)
    }

    @Test
    fun `deduplicates by normalized title`() {
        val candidates = listOf(
            listing("1", "S", 1_000_000_000L, title = "Okami"),
            listing("2", "S", 1_000_000_000L, title = "Okami")
        )
        val plan = SmartFillPlanner.plan(candidates, availableBytes = 10_000_000_000L, targetBytes = 10_000_000_000L)
        assertEquals(1, plan.selectedItems.size)
    }
}
