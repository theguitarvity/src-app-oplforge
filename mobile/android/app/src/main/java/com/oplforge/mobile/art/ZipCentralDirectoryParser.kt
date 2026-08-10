package com.oplforge.mobile.art

import java.nio.ByteBuffer
import java.nio.ByteOrder

/** One PNG art asset located inside the remote ZIP, not yet downloaded. */
data class ZipArtEntry(
    val gameId: String,
    val type: String,
    val compressedSize: Long,
    val localHeaderOffset: Long
)

data class CentralDirectoryLocation(val offset: Long, val size: Long)

/**
 * Pure parsing of the ZIP64 End Of Central Directory + Central Directory
 * structures needed to locate individual entries inside a large remote ZIP
 * without downloading it — verified against the real
 * `OPLM_ART_2024_09.zip` (archive.org, 5.5GB, 102,803 entries, 100% STORE/
 * uncompressed, laid out as `<PS1|PS2>/<GAMEID>/<GAMEID>_<TYPE>.png`).
 * Desktop's equivalent is `electron/services/art/remote-zip-art.service.ts`.
 */
object ZipCentralDirectoryParser {

    private const val EOCD_SIGNATURE = 0x06054b50
    private const val ZIP64_EOCD_LOCATOR_SIGNATURE = 0x07064b50
    private const val LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50
    private const val CENTRAL_DIR_HEADER_SIGNATURE = 0x02014b50

    /** OPL game ID convention: `<4 letters>_<3 digits>.<2 digits>`, e.g. `SLUS_212.59`. */
    private val entryNamePattern =
        Regex("^(?:PS1|PS2)/([A-Za-z]{4}_\\d{3}\\.\\d{2})/\\1_([A-Za-z0-9]+)\\.png$", RegexOption.IGNORE_CASE)

    /**
     * Locates the central directory from the ZIP's tail bytes. [tail] must
     * cover at least the last 65KB + 20 bytes of the file (the EOCD comment
     * field is bounded to 65535 bytes, and the ZIP64 locator is a further 20
     * bytes before a ZIP64 EOCD record) — [tailStartOffsetInFile] is that
     * tail's absolute offset within the full file, needed to translate the
     * ZIP64 EOCD record's absolute offset into an index within [tail].
     */
    fun findCentralDirectory(tail: ByteArray, tailStartOffsetInFile: Long): CentralDirectoryLocation {
        val buf = ByteBuffer.wrap(tail).order(ByteOrder.LITTLE_ENDIAN)
        val eocdOffset = findSignature(tail, EOCD_SIGNATURE, searchBackward = true)
            ?: throw IllegalStateException("EOCD signature not found — tail is too short or not a ZIP")

        val cdSize32 = buf.getInt(eocdOffset + 12).toLong() and 0xFFFFFFFFL
        val cdOffset32 = buf.getInt(eocdOffset + 16).toLong() and 0xFFFFFFFFL
        if (cdOffset32 != 0xFFFFFFFFL) {
            // Not ZIP64 — the 32-bit EOCD fields already hold the real values.
            return CentralDirectoryLocation(cdOffset32, cdSize32)
        }

        // ZIP64: the locator (20 bytes) immediately precedes the EOCD record.
        val locatorOffset = eocdOffset - 20
        require(locatorOffset >= 0 && buf.getInt(locatorOffset) == ZIP64_EOCD_LOCATOR_SIGNATURE) {
            "ZIP64 EOCD locator not found immediately before EOCD"
        }
        val zip64EocdAbsoluteOffset = buf.getLong(locatorOffset + 8)
        val zip64EocdOffset = zip64EocdAbsoluteOffset - tailStartOffsetInFile
        require(zip64EocdOffset in 0 until tail.size) {
            "ZIP64 EOCD record lies outside the fetched tail — fetch a larger tail"
        }

        val rel = zip64EocdOffset.toInt()
        require(buf.getInt(rel) == 0x06064b50) { "ZIP64 EOCD signature mismatch at computed offset" }
        val cdSize = buf.getLong(rel + 40)
        val cdOffset = buf.getLong(rel + 48)
        return CentralDirectoryLocation(cdOffset, cdSize)
    }

    private fun findSignature(data: ByteArray, signature: Int, searchBackward: Boolean): Int? {
        val sig = ByteArray(4)
        ByteBuffer.wrap(sig).order(ByteOrder.LITTLE_ENDIAN).putInt(signature)
        val indices = if (searchBackward) (data.size - 4) downTo 0 else 0..(data.size - 4)
        for (i in indices) {
            if (data[i] == sig[0] && data[i + 1] == sig[1] && data[i + 2] == sig[2] && data[i + 3] == sig[3]) return i
        }
        return null
    }

    /**
     * Parses every central directory record in [data]. Entries with an
     * unsupported compression method (anything but STORE/0) are skipped —
     * the real archive is 100% STORE, so decompression was never needed.
     * Entries whose path doesn't match the `<PLATFORM>/<GAMEID>/<GAMEID>_
     * <TYPE>.png` convention (the CSV/TXT index files at the archive root)
     * are skipped too.
     */
    fun parseEntries(data: ByteArray): List<ZipArtEntry> {
        val entries = mutableListOf<ZipArtEntry>()
        val buf = ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN)
        var offset = 0
        while (offset + 46 <= data.size) {
            if (buf.getInt(offset) != CENTRAL_DIR_HEADER_SIGNATURE) break
            val method = buf.getShort(offset + 10).toInt() and 0xFFFF
            val compressedSize = buf.getInt(offset + 20).toLong() and 0xFFFFFFFFL
            val nameLen = buf.getShort(offset + 28).toInt() and 0xFFFF
            val extraLen = buf.getShort(offset + 30).toInt() and 0xFFFF
            val commentLen = buf.getShort(offset + 32).toInt() and 0xFFFF
            val localHeaderOffset = buf.getInt(offset + 42).toLong() and 0xFFFFFFFFL

            if (offset + 46 + nameLen > data.size) break
            val name = String(data, offset + 46, nameLen, Charsets.UTF_8)

            if (method == 0) {
                entryNamePattern.find(name)?.let { match ->
                    entries.add(
                        ZipArtEntry(
                            gameId = match.groupValues[1].uppercase(),
                            type = match.groupValues[2].uppercase(),
                            compressedSize = compressedSize,
                            localHeaderOffset = localHeaderOffset
                        )
                    )
                }
            }
            offset += 46 + nameLen + extraLen + commentLen
        }
        return entries
    }

    /**
     * Given the bytes of a local file header plus a safety margin (must
     * cover at least `30 + nameLength + extraLength` bytes — the exact
     * extra-field length varies per entry and is only known once this
     * header itself is parsed), returns the offset within
     * [localHeaderAndMargin] where the raw file data begins.
     */
    fun localFileDataOffset(localHeaderAndMargin: ByteArray): Int {
        val buf = ByteBuffer.wrap(localHeaderAndMargin).order(ByteOrder.LITTLE_ENDIAN)
        require(buf.getInt(0) == LOCAL_FILE_HEADER_SIGNATURE) { "Not a local file header" }
        val nameLen = buf.getShort(26).toInt() and 0xFFFF
        val extraLen = buf.getShort(28).toInt() and 0xFFFF
        return 30 + nameLen + extraLen
    }
}
