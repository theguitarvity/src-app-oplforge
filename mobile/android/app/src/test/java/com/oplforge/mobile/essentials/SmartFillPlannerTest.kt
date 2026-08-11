package com.oplforge.mobile.essentials

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SmartFillPlannerTest {

    private fun listing(id: String, tier: String, sizeBytes: Long, accessible: Boolean = true, title: String = id) =
        CatalogListingCacheEntity(id, title, "$title.iso", "https://example.test/$id", sizeBytes, "ps2-dvd", tier, accessible, "now")

    @Test
    fun `rating mode orders selection by tier, best first`() {
        val candidates = listOf(
            listing("1", "C", 1_000_000_000L),
            listing("2", "S", 1_000_000_000L),
            listing("3", "A", 1_000_000_000L)
        )
        val plan = SmartFillPlanner.plan(candidates, availableBytes = 2_000_000_000L, targetBytes = 2_000_000_000L, mode = SmartFillMode.RATING)
        assertEquals(listOf("2", "3"), plan.selectedItems.map { it.id })
        assertTrue(plan.warnings.isEmpty())
    }

    @Test
    fun `rating mode still fills remaining budget with lower tiers`() {
        val candidates = listOf(
            listing("1", "S", 1_000_000_000L),
            listing("2", "C", 1_000_000_000L)
        )
        val plan = SmartFillPlanner.plan(candidates, availableBytes = 5_000_000_000L, targetBytes = 5_000_000_000L, mode = SmartFillMode.RATING)
        assertEquals(2, plan.selectedItems.size)
    }

    @Test
    fun `random mode can select every eligible item regardless of tier`() {
        val candidates = listOf(listing("1", "C", 1_000_000_000L))
        val plan = SmartFillPlanner.plan(candidates, availableBytes = 10_000_000_000L, targetBytes = 10_000_000_000L, mode = SmartFillMode.RANDOM)
        assertEquals(1, plan.selectedItems.size)
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
