package com.oplforge.mobile.essentials

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Unit tests for the pure IA-metadata-to-domain mapping (spec 008
 * research.md R1). Exercises [ArchiveFileMapper] directly rather than
 * [EssentialsCatalogClient] itself, since the client's `db`/network
 * dependencies aren't needed for this classification logic.
 */
class EssentialsCatalogClientTest {

    @Test
    fun `maps a supported file and classifies DVD by default`() {
        val file = JSONObject().put("name", "Shadow of the Colossus.iso").put("size", "4700000000")
        val mapped = ArchiveFileMapper.mapFile("playstation2_essentials", file)
        assertEquals("ps2-dvd", mapped?.mediaType)
        assertEquals(4_700_000_000L, mapped?.sizeBytes)
        assertTrue(mapped?.url?.startsWith("https://archive.org/download/playstation2_essentials/") == true)
    }

    @Test
    fun `classifies a CD-marked iso as ps2-cd`() {
        val file = JSONObject().put("name", "Some Game (CD).iso")
        assertEquals("ps2-cd", ArchiveFileMapper.mapFile("playstation2_essentials", file)?.mediaType)
    }

    @Test
    fun `classifies bin-cue as ps1`() {
        assertEquals("ps1", ArchiveFileMapper.classifyMedia("Final Fantasy IX.bin", ".bin"))
        assertEquals("ps1", ArchiveFileMapper.classifyMedia("Final Fantasy IX.cue", ".cue"))
    }

    @Test
    fun `ignores files with unsupported extensions`() {
        val file = JSONObject().put("name", "readme.txt")
        assertNull(ArchiveFileMapper.mapFile("playstation2_essentials", file))
    }

    @Test
    fun `ignores files with a blank name`() {
        val file = JSONObject().put("name", "")
        assertNull(ArchiveFileMapper.mapFile("playstation2_essentials", file))
    }

    @Test
    fun `encodes spaces as percent-20 not plus for IA datanode compatibility`() {
        val file = JSONObject().put("name", "Resident Evil 4.iso")
        val mapped = ArchiveFileMapper.mapFile("playstation2_essentials", file)
        assertEquals(
            "https://archive.org/download/playstation2_essentials/Resident%20Evil%204.iso",
            mapped?.url
        )
    }
}
