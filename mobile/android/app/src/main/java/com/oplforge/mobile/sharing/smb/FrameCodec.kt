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
    const val CLOSE = 0x04
    const val READ_ANDX = 0x2E
    const val WRITE_ANDX = 0x2F
    const val TRANSACTION2 = 0x32
    const val CHECK_DIRECTORY = 0x10
}

object Trans2Subcommand {
    const val FIND_FIRST2 = 0x0001
    const val QUERY_PATH_INFORMATION = 0x0005
}

/** NT status codes this server returns — the small subset OPL's client needs to interpret correctly. */
object NtStatus {
    const val SUCCESS = 0x00000000L
    const val ACCESS_DENIED = 0xC0000022L
    const val NO_SUCH_FILE = 0xC000000FL
    const val OBJECT_NAME_NOT_FOUND = 0xC0000034L
    const val LOGON_FAILURE = 0xC000006DL
    const val UNSUCCESSFUL = 0xC0000001L
    const val NOT_SUPPORTED = 0xC00000BBL
}

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

    /** Reads one full NetBIOS-wrapped SMB1 frame, blocking until available. Throws EOFException on clean close. */
    fun readFrame(input: InputStream): SmbFrame {
        val nbHeader = input.readNBytesStrict(4)
        val type = nbHeader[0].toInt() and 0xFF
        val length = ((nbHeader[1].toInt() and 0xFF) shl 16) or
            ((nbHeader[2].toInt() and 0xFF) shl 8) or
            (nbHeader[3].toInt() and 0xFF)
        if (type != NETBIOS_SESSION_MESSAGE) throw IllegalStateException("Unsupported NetBIOS message type $type")

        val payload = input.readNBytesStrict(length)
        return decode(payload)
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

    /** Builds a response frame mirroring [request]'s routing fields (tid/pid/uid/mid), per SMB1 convention. */
    fun response(request: SmbFrame, status: Long, params: ByteArray = ByteArray(0), data: ByteArray = ByteArray(0)): SmbFrame =
        SmbFrame(
            command = request.command,
            status = status,
            flags = 0x88, // SERVER_RESPONSE bit + CASE_INSENSITIVE, minimal set OPL expects
            flags2 = request.flags2,
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
