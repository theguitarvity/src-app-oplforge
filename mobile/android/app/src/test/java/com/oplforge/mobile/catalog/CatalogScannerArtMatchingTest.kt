package com.oplforge.mobile.catalog

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Regression guard for a real bug: `hasArt` was comparing against the bare
 * game ID / ISO file name instead of the `_COV[2]` cover file name, so
 * `hasArt` was always false even when the art file was present on disk.
 */
class CatalogScannerArtMatchingTest {

    @Test
    fun `matches the real OPL cover file naming convention`() {
        val artBaseNames = setOf(normalizeArtBaseName("SLUS_212.59_COV"))
        assertTrue(hasMatchingArt("SLUS_212.59", artBaseNames))
    }

    @Test
    fun `matches the COV2 alternate suffix`() {
        val artBaseNames = setOf(normalizeArtBaseName("SLUS_212.59_COV2"))
        assertTrue(hasMatchingArt("SLUS_212.59", artBaseNames))
    }

    @Test
    fun `does not match on the bare game id alone`() {
        // This is the exact shape of the bug: an art folder containing only
        // a file literally named after the game id (no _COV suffix) must
        // not be treated as a match, since that's not what OPL ever writes.
        val artBaseNames = setOf(normalizeArtBaseName("SLUS_212.59"))
        assertFalse(hasMatchingArt("SLUS_212.59", artBaseNames))
    }

    @Test
    fun `does not match an unrelated game`() {
        val artBaseNames = setOf(normalizeArtBaseName("SLUS_212.59_COV"))
        assertFalse(hasMatchingArt("SLUS_200.60", artBaseNames))
    }

    @Test
    fun `is case and separator insensitive`() {
        val artBaseNames = setOf(normalizeArtBaseName("slus-212.59_cov"))
        assertTrue(hasMatchingArt("SLUS_212.59", artBaseNames))
    }

    @Test
    fun `returns false for a null game id`() {
        assertFalse(hasMatchingArt(null, setOf("SLUS_212_59_COV")))
    }
}
