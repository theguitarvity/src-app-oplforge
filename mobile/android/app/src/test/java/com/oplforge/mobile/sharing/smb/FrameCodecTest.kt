package com.oplforge.mobile.sharing.smb

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream

class FrameCodecTest {

    // Regression test for a real bug found on the desktop SMB1 server
    // (electron/services/network-share/smb/command-handlers.ts, "fixing smb
    // logic for games larger than 4gb"): a real PS2 OPL client sometimes
    // includes the NUL terminator inside a field's declared length. Verified
    // here at the string-transform level since exercising the full NT_CREATE
    // path requires a real SAF DocumentFile tree (covered by instrumented
    // tests instead).
    @Test
    fun `stripTrailingNul removes a NUL folded into the declared field length`() {
        assertEquals("games.bin", "games.bin\u0000".stripTrailingNul())
        assertEquals("games.bin", "games.bin".stripTrailingNul())
        assertEquals("games.bin", "games.bin ".stripTrailingNul())
        assertEquals("games.bin", "games.bin \u0000".stripTrailingNul())
    }

    @Test
    fun `writeFrame then readFrame round-trips all header fields`() {
        val frame = SmbFrame(
            command = SmbCommand.NEGOTIATE,
            status = 0,
            flags = 0,
            flags2 = 0,
            tid = 7,
            pid = 42,
            uid = 3,
            mid = 99,
            params = byteArrayOf(1, 2, 3, 4),
            data = "hello".toByteArray(Charsets.ISO_8859_1)
        )

        val out = ByteArrayOutputStream()
        FrameCodec.writeFrame(out, frame)
        val nbss = FrameCodec.readNbssFrame(ByteArrayInputStream(out.toByteArray()))
        assertEquals(NbssType.SESSION_MESSAGE, nbss.type)
        val decoded = FrameCodec.decodeSmb(nbss.payload)

        assertEquals(frame.command, decoded.command)
        assertEquals(frame.tid, decoded.tid)
        assertEquals(frame.pid, decoded.pid)
        assertEquals(frame.uid, decoded.uid)
        assertEquals(frame.mid, decoded.mid)
        assertArrayEquals(frame.params, decoded.params)
        assertArrayEquals(frame.data, decoded.data)
    }

    @Test
    fun `decodeSmb rejects a payload with the wrong protocol signature`() {
        val out = ByteArrayOutputStream()
        out.write(byteArrayOf(0x00, 0x00, 0x00, 0x04))
        out.write("ping".toByteArray(Charsets.ISO_8859_1))

        val nbss = FrameCodec.readNbssFrame(ByteArrayInputStream(out.toByteArray()))
        try {
            FrameCodec.decodeSmb(nbss.payload)
            throw AssertionError("Expected decode to reject a non-SMB payload")
        } catch (e: IllegalArgumentException) {
            // expected — a malformed frame must never be silently accepted
        }
    }

    @Test
    fun `readNbssFrame surfaces a SESSION_REQUEST without trying to decode it as SMB`() {
        val out = ByteArrayOutputStream()
        out.write(byteArrayOf(NbssType.SESSION_REQUEST.toByte(), 0x00, 0x00, 0x05))
        out.write("hello".toByteArray(Charsets.ISO_8859_1))

        val nbss = FrameCodec.readNbssFrame(ByteArrayInputStream(out.toByteArray()))
        assertEquals(NbssType.SESSION_REQUEST, nbss.type)
        assertArrayEquals("hello".toByteArray(Charsets.ISO_8859_1), nbss.payload)
    }

    @Test
    fun `response always forces the REPLY and NT_STATUS flag bits`() {
        val request = SmbFrame(
            command = SmbCommand.NEGOTIATE,
            status = 0,
            flags = 0x18, // some client-set bits that must be preserved
            flags2 = 0x0001,
            tid = 0,
            pid = 0,
            uid = 0,
            mid = 0,
            params = ByteArray(0),
            data = ByteArray(0)
        )
        val response = FrameCodec.response(request, NtStatus.SUCCESS)
        assertEquals(0x18 or 0x80, response.flags) // REPLY bit added, client bits preserved
        assertEquals(0x0001 or 0x4000, response.flags2) // NT_STATUS bit added, client bits preserved
    }

    @Test
    fun `response mirrors the request's routing fields`() {
        val request = SmbFrame(
            command = SmbCommand.TREE_CONNECT_ANDX,
            status = 0,
            flags = 0,
            flags2 = 0,
            tid = 5,
            pid = 10,
            uid = 2,
            mid = 20,
            params = ByteArray(0),
            data = ByteArray(0)
        )

        val response = FrameCodec.response(request, NtStatus.SUCCESS)

        assertEquals(request.command, response.command)
        assertEquals(request.tid, response.tid)
        assertEquals(request.pid, response.pid)
        assertEquals(request.uid, response.uid)
        assertEquals(request.mid, response.mid)
        assertEquals(NtStatus.SUCCESS, response.status)
    }
}
