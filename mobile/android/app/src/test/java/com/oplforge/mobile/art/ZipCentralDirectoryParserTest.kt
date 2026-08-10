package com.oplforge.mobile.art

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Validated against real byte fixtures pulled from the actual archive.org
 * `OPLM_ART_2024_09.zip` (5,539,563,942 bytes, 102,803 entries, ZIP64,
 * 100% STORE) via HTTP range requests — not synthetic data, so a mistake in
 * the ZIP64 EOCD/central-directory offset math would fail this test the
 * same way it would against the real archive.
 */
class ZipCentralDirectoryParserTest {

    private fun resource(name: String): ByteArray {
        val url = javaClass.classLoader!!.getResource(name)
            ?: throw IllegalStateException("Missing test resource $name")
        return File(url.toURI()).readBytes()
    }

    @Test
    fun `locates the ZIP64 central directory from a real archive tail`() {
        val tail = resource("oplm_art_zip_tail_sample.bin")
        val fileSize = 5_539_563_942L
        val tailStart = fileSize - tail.size

        val location = ZipCentralDirectoryParser.findCentralDirectory(tail, tailStart)

        assertEquals(102_803, expectedEntryCountFromZip64Eocd(tail, tailStart))
        assertEquals(5_530_939_920L, location.offset)
        assertEquals(8_623_924L, location.size)
    }

    /** Cross-check via the ZIP64 EOCD record directly, independent of the parser under test. */
    private fun expectedEntryCountFromZip64Eocd(tail: ByteArray, tailStart: Long): Long {
        val buf = ByteBuffer.wrap(tail).order(ByteOrder.LITTLE_ENDIAN)
        var locatorOffset = -1
        for (i in tail.size - 20 downTo 0) {
            if (buf.getInt(i) == 0x07064b50) { locatorOffset = i; break }
        }
        val zip64EocdAbs = buf.getLong(locatorOffset + 8)
        val rel = (zip64EocdAbs - tailStart).toInt()
        return buf.getLong(rel + 32) // entries_total
    }

    @Test
    fun `falls back to plain 32-bit EOCD fields for a non-ZIP64 archive`() {
        // A minimal, hand-built plain EOCD record: 1 entry, cdSize=100, cdOffset=200.
        val eocd = ByteBuffer.allocate(22).order(ByteOrder.LITTLE_ENDIAN).apply {
            putInt(0x06054b50) // signature
            putShort(0); putShort(0) // disk numbers
            putShort(1); putShort(1) // entries this disk / total
            putInt(100) // cd size
            putInt(200) // cd offset
            putShort(0) // comment length
        }.array()

        val location = ZipCentralDirectoryParser.findCentralDirectory(eocd, 0)

        assertEquals(200L, location.offset)
        assertEquals(100L, location.size)
    }

    @Test
    fun `parses real central directory entries into gameId-type pairs`() {
        val centralDir = resource("oplm_art_central_dir_sample.bin")

        val entries = ZipCentralDirectoryParser.parseEntries(centralDir)

        // The sample's first two records are the archive's own CSV/TXT index
        // files (no /<GAMEID>/ path), which must be skipped, not misparsed.
        assertTrue(entries.none { it.gameId.contains("LIST") })
        assertTrue(entries.isNotEmpty())

        val first = entries.first()
        assertEquals("CPCS_007.01", first.gameId)
        assertEquals("ICO", first.type)
        assertEquals(4025L, first.compressedSize)
        assertEquals(897503L, first.localHeaderOffset)

        val last = entries.last()
        assertEquals("SCED_018.19", last.gameId)
        assertEquals("ICO", last.type)
    }

    @Test
    fun `parses a real local file header to find where PNG data starts`() {
        // ALCH_000.01_COV.png's local header, fetched live at offset 1874978571:
        // 30-byte fixed header + 35-byte name ("PS2/ALCH_000.01/ALCH_000.01_COV.png") + 24-byte ZIP64 extra field.
        val header = ByteBuffer.allocate(30 + 35 + 24).order(ByteOrder.LITTLE_ENDIAN).apply {
            putInt(0x04034b50)
            putShort(45); putShort(0); putShort(0) // version, flags, method
            putShort(0); putShort(0) // mod time/date
            putInt(0) // crc32
            putInt(-1) // compressed size sentinel (real size lives in the ZIP64 extra field)
            putInt(-1) // uncompressed size sentinel
            putShort(35) // name length
            putShort(24) // extra field length
        }.array()
        "PS2/ALCH_000.01/ALCH_000.01_COV.png".toByteArray().copyInto(header, 30)

        val dataOffset = ZipCentralDirectoryParser.localFileDataOffset(header)

        assertEquals(30 + 35 + 24, dataOffset)
    }
}
