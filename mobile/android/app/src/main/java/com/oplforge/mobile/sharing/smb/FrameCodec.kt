package com.oplforge.mobile.sharing.smb

import java.io.EOFException
import java.io.InputStream
import java.io.OutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

/** SMB1 commands this server understands (contracts/smb-protocol-scope.md "In scope"). */
object SmbCommand {
    const val NEGOTIATE = 0x72
    const val SESSION_SETUP_ANDX = 0x73
    const val LOGOFF_ANDX = 0x74
    const val TREE_CONNECT_ANDX = 0x75
    const val TREE_DISCONNECT = 0x71
    const val NT_CREATE_ANDX = 0xA2
    const val OPEN_ANDX = 0x2D
    const val ECHO = 0x2B
    const val CLOSE = 0x04
    const val READ_ANDX = 0x2E
    const val WRITE_ANDX = 0x2F
    const val TRANSACTION2 = 0x32
    const val FIND_CLOSE2 = 0x34
    const val CHECK_DIRECTORY = 0x10
}

object Trans2Subcommand {
    const val FIND_FIRST2 = 0x0001
    const val FIND_NEXT2 = 0x0002
    const val QUERY_PATH_INFORMATION = 0x0005
}

object InfoLevel {
    const val QUERY_FILE_BASIC_INFO = 0x0101
    const val QUERY_FILE_STANDARD_INFO = 0x0102
    const val FIND_FILE_BOTH_DIRECTORY_INFO = 0x0104
}

/** NT status codes this server returns — the small subset OPL's client needs to interpret correctly. */
object NtStatus {
    const val SUCCESS = 0x00000000L
    const val ACCESS_DENIED = 0xC0000022L
    const val NO_SUCH_FILE = 0xC000000FL
    const val INVALID_HANDLE = 0xC0000008L
    const val OBJECT_NAME_NOT_FOUND = 0xC0000034L
    const val LOGON_FAILURE = 0xC000006DL
    const val UNSUCCESSFUL = 0xC0000001L
    const val NOT_SUPPORTED = 0xC00000BBL
}

/** SMB1 header flag bits this server sets, mirrors desktop's protocol-constants.ts. */
private object SmbFlags {
    const val REPLY = 0x80
}

private object SmbFlags2 {
    /** Tells the client the Status field is a 32-bit NTSTATUS code, not the legacy DOS error class/code pair — every status this server sends (0xC0000xxx-style) is meaningless to a client that doesn't see this bit set. */
    const val NT_STATUS = 0x4000
}

/**
 * RFC 1002 NetBIOS Session Service message types carried in the NBSS record
 * header's first byte. Real PS2/OPL SMB clients (unlike modern "direct
 * hosting of SMB over TCP" clients on port 445) send SESSION_REQUEST first
 * regardless of port and expect a POSITIVE_SESSION_RESPONSE before any SMB
 * traffic — skipping this handshake causes the client to see an immediate
 * connection failure. Mirrors desktop's `frame-codec.ts` NBSS_TYPE exactly.
 */
object NbssType {
    const val SESSION_MESSAGE = 0x00
    const val SESSION_REQUEST = 0x81
    const val POSITIVE_SESSION_RESPONSE = 0x82
    const val NEGATIVE_SESSION_RESPONSE = 0x83
}

/** One raw NBSS record: a type byte plus its payload, before any SMB-specific interpretation. */
data class NbssFrame(val type: Int, val payload: ByteArray)

/** One decoded SMB1 message: fixed 32-byte header + variable words (params) + bytes (data). */
data class SmbFrame(
    val command: Int,
    val status: Long,
    val flags: Int,
    val flags2: Int,
    val tid: Int,
    val pid: Int,
    val uid: Int,
    val mid: Int,
    val params: ByteArray,
    val data: ByteArray
) {
    companion object {
        const val HEADER_SIZE = 32
        val PROTOCOL = byteArrayOf(0xFF.toByte(), 'S'.code.toByte(), 'M'.code.toByte(), 'B'.code.toByte())
    }
}

/**
 * NetBIOS Session Service framing (1-byte message type + 3-byte big-endian
 * length) wrapping each SMB1 message, plus the SMB1 header itself
 * (research.md R5 — re-derived Kotlin implementation of the wire format, not
 * a transliteration of the desktop Node.js code).
 */
object FrameCodec {

    private const val NETBIOS_SESSION_MESSAGE = 0x00

    // The NetBIOS session-message length field is 24-bit (up to ~16MB) by wire
    // format, but this server advertises a 64KB MaxBufferSize in NEGOTIATE
    // (negotiate()'s params byte 7) — no legitimate frame should ever be
    // anywhere near that. Capping well above it (rather than trusting an
    // unauthenticated client's own length claim up to the wire format's full
    // 16MB ceiling) bounds the per-frame allocation an unauthenticated
    // connection can force.
    private const val MAX_FRAME_LENGTH = 256 * 1024

    /**
     * Reads one raw NBSS record (4-byte type + 24-bit big-endian length
     * header, then that many payload bytes), without assuming it's an SMB
     * SESSION_MESSAGE — a real client's very first record is a
     * SESSION_REQUEST (see [NbssType]), which has no SMB payload to decode
     * at all. Blocking until available; throws EOFException on clean close.
     */
    fun readNbssFrame(input: InputStream): NbssFrame {
        val nbHeader = input.readNBytesStrict(4)
        val type = nbHeader[0].toInt() and 0xFF
        val length = ((nbHeader[1].toInt() and 0xFF) shl 16) or
            ((nbHeader[2].toInt() and 0xFF) shl 8) or
            (nbHeader[3].toInt() and 0xFF)
        if (length > MAX_FRAME_LENGTH) throw IllegalStateException("NetBIOS frame length $length exceeds max $MAX_FRAME_LENGTH")
        val payload = input.readNBytesStrict(length)
        return NbssFrame(type, payload)
    }

    /** Decodes a SESSION_MESSAGE payload as an SMB1 message. Only valid for [NbssType.SESSION_MESSAGE] frames. */
    fun decodeSmb(payload: ByteArray): SmbFrame = decode(payload)

    /** Reply to a classic NBT SESSION_REQUEST (RFC 1002 4.3.2): type + zero-length, no payload. */
    fun writePositiveSessionResponse(output: OutputStream) {
        output.write(byteArrayOf(NbssType.POSITIVE_SESSION_RESPONSE.toByte(), 0, 0, 0))
        output.flush()
    }

    fun writeFrame(output: OutputStream, frame: SmbFrame) {
        val payload = encode(frame)
        val nbHeader = ByteArray(4)
        nbHeader[0] = NETBIOS_SESSION_MESSAGE.toByte()
        nbHeader[1] = ((payload.size shr 16) and 0xFF).toByte()
        nbHeader[2] = ((payload.size shr 8) and 0xFF).toByte()
        nbHeader[3] = (payload.size and 0xFF).toByte()
        output.write(nbHeader)
        output.write(payload)
        output.flush()
    }

    private fun decode(payload: ByteArray): SmbFrame {
        val buf = ByteBuffer.wrap(payload).order(ByteOrder.LITTLE_ENDIAN)
        val protocol = ByteArray(4).also { buf.get(it) }
        require(protocol.contentEquals(SmbFrame.PROTOCOL)) { "Not an SMB frame" }
        val command = buf.get().toInt() and 0xFF
        val status = buf.int.toLong() and 0xFFFFFFFFL
        val flags = buf.get().toInt() and 0xFF
        val flags2 = buf.short.toInt() and 0xFFFF
        buf.short // PIDHigh — unused by this server's scope
        val securityFeatures = ByteArray(8).also { buf.get(it) }
        buf.short // Reserved
        val tid = buf.short.toInt() and 0xFFFF
        val pid = buf.short.toInt() and 0xFFFF
        val uid = buf.short.toInt() and 0xFFFF
        val mid = buf.short.toInt() and 0xFFFF

        val wordCount = buf.get().toInt() and 0xFF
        val params = ByteArray(wordCount * 2).also { buf.get(it) }
        val byteCount = buf.short.toInt() and 0xFFFF
        val data = ByteArray(byteCount).also { buf.get(it) }

        return SmbFrame(command, status, flags, flags2, tid, pid, uid, mid, params, data)
    }

    private fun encode(frame: SmbFrame): ByteArray {
        val size = SmbFrame.HEADER_SIZE + 1 + frame.params.size + 2 + frame.data.size
        val buf = ByteBuffer.allocate(size).order(ByteOrder.LITTLE_ENDIAN)
        buf.put(SmbFrame.PROTOCOL)
        buf.put(frame.command.toByte())
        buf.putInt(frame.status.toInt())
        buf.put(frame.flags.toByte())
        buf.putShort(frame.flags2.toShort())
        buf.putShort(0) // PIDHigh
        buf.put(ByteArray(8)) // SecurityFeatures
        buf.putShort(0) // Reserved
        buf.putShort(frame.tid.toShort())
        buf.putShort(frame.pid.toShort())
        buf.putShort(frame.uid.toShort())
        buf.putShort(frame.mid.toShort())
        buf.put((frame.params.size / 2).toByte())
        buf.put(frame.params)
        buf.putShort(frame.data.size.toShort())
        buf.put(frame.data)
        return buf.array()
    }

    /**
     * Builds a response frame mirroring [request]'s routing fields
     * (tid/pid/uid/mid), per SMB1 convention. flags/flags2 byte-for-byte
     * mirror desktop's `successHeader`/`errorResponse` (`command-handlers.ts`):
     * OR the REPLY bit into whatever flags the client sent (not a fixed
     * value), and always force the NT_STATUS bit so every 0xC0000xxx-style
     * status this server sends is actually interpreted as one.
     */
    fun response(request: SmbFrame, status: Long, params: ByteArray = ByteArray(0), data: ByteArray = ByteArray(0)): SmbFrame =
        SmbFrame(
            command = request.command,
            status = status,
            flags = request.flags or SmbFlags.REPLY,
            flags2 = request.flags2 or SmbFlags2.NT_STATUS,
            tid = request.tid,
            pid = request.pid,
            uid = request.uid,
            mid = request.mid,
            params = params,
            data = data
        )
}

private fun InputStream.readNBytesStrict(n: Int): ByteArray {
    val buf = ByteArray(n)
    var offset = 0
    while (offset < n) {
        val read = read(buf, offset, n - offset)
        if (read == -1) throw EOFException("Connection closed while reading $n bytes (got $offset)")
        offset += read
    }
    return buf
}
