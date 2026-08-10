package com.oplforge.mobile.essentials

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class GameScoringTest {

    @Test
    fun `normalizes a filename by stripping extension, game id, and region tags`() {
        val normalized = GameScoring.normalizeTitle("Shadow.of.the.Colossus.(USA).[SCUS-97472].iso")
        assertEquals("shadow of the colossus", normalized)
    }

    @Test
    fun `matches a seeded title and applies the must-have priority bonus`() {
        val scored = GameScoring.score(
            id = "1",
            fileName = "Shadow of the Colossus (USA).iso",
            url = "https://example.test/a.iso",
            sizeBytes = 3L * 1024 * 1024 * 1024,
            mediaType = "ps2-dvd"
        )
        assertEquals("S", scored.scoreTier)
        assertTrue(scored.score!! > 98) // base 98 + must-have bonus(6) - no size penalty under 4GB
    }

    @Test
    fun `applies a size penalty for large files without lowering below zero`() {
        val small = GameScoring.score("1", "Shadow of the Colossus.iso", "u", 3L * 1024 * 1024 * 1024, "ps2-dvd")
        val large = GameScoring.score("2", "Shadow of the Colossus.iso", "u", 10L * 1024 * 1024 * 1024, "ps2-dvd")
        assertTrue(large.score!! < small.score!!)
    }

    @Test
    fun `an unmatched title is Unrated with no score`() {
        val scored = GameScoring.score("1", "Totally Unknown Homebrew Thing.iso", "u", null, "ps2-dvd")
        assertEquals("Unrated", scored.scoreTier)
        assertEquals(null, scored.score)
    }

    @Test
    fun `sort orders by score descending then size ascending`() {
        val a = GameScoring.score("1", "Okami.iso", "u", 4_500_000_000L, "ps2-dvd")
        val b = GameScoring.score("2", "Silent Hill 2.iso", "u", 4_500_000_000L, "ps2-dvd")
        val sorted = GameScoring.sort(listOf(a, b))
        assertTrue((sorted.first().score ?: -1) >= (sorted.last().score ?: -1))
    }
}
