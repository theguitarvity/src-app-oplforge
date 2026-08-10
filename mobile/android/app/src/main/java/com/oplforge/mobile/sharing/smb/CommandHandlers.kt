package com.oplforge.mobile.sharing.smb

import android.content.Context
import android.os.ParcelFileDescriptor
import androidx.documentfile.provider.DocumentFile
import com.oplforge.mobile.library.SafDocumentTree
import com.oplforge.mobile.shared.PathConfinement
import com.oplforge.mobile.sharing.CredentialStore
import com.oplforge.mobile.shared.WriteLock
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.charset.Charset

private val OEM = Charset.forName("ISO-8859-1")

/** Windows FILETIME (100ns ticks since 1601-01-01T00:00:00Z) — MS-CIFS 2.2.4.52.2 SystemTime field. */
private fun writeFileTime(buf: ByteBuffer, offset: Int, unixMillis: Long) {
    val fileTimeUnixEpochOffsetMs = 11_644_473_600_000L
    buf.putLong(offset, (unixMillis + fileTimeUnixEpochOffsetMs) * 10_000L)
}

/**
 * Some clients (confirmed: real PS2 OPL, found via a matching desktop SMB1
 * server bug — `electron/services/network-share/smb/command-handlers.ts`,
 * commit "fixing smb logic for games larger than 4gb") include the NUL
 * terminator inside a field's declared length (NameLength, path length,
 * etc.). On desktop that NUL byte survived into Node's `fs` calls and threw
 * an unhandled "path must not include null bytes" error, killing the whole
 * connection. Here it would instead just fail path-segment comparisons
 * silently (Kotlin string equality doesn't throw), returning a false
 * "file not found" for a file that exists — still a real bug, different
 * failure mode. Stripped wherever a decoded OEM string is used as a path/name.
 */
internal fun String.stripTrailingNul(): String = trimEnd(' ', '\u0000')

/** One open file/directory handle within a connection (SMB1 FID). */
data class OpenFile(val documentFile: DocumentFile, val pfd: ParcelFileDescriptor?, val isDirectory: Boolean)

/** Per-TCP-connection SMB1 protocol state — never shared across connections. */
class SmbConnectionState {
    var authenticated = false
    var tid: Int = 0
    // Per-connection NTLMv1 challenge, sent in the NEGOTIATE response and
    // verified against in SESSION_SETUP_ANDX — a real PS2 OPL client always
    // hashes this into its 24-byte password response, never plaintext.
    val challenge: ByteArray = NtlmV1.randomChallenge()
    private var nextFid = 1
    private val fids = mutableMapOf<Int, OpenFile>()

    fun openFile(documentFile: DocumentFile, pfd: ParcelFileDescriptor?, isDirectory: Boolean): Int {
        val fid = nextFid++
        fids[fid] = OpenFile(documentFile, pfd, isDirectory)
        return fid
    }

    fun get(fid: Int): OpenFile? = fids[fid]

    fun close(fid: Int) {
        fids[fid]?.pfd?.close()
        fids.remove(fid)
    }

    fun closeAll() {
        fids.values.forEach { it.pfd?.close() }
        fids.clear()
    }
}

/**
 * Handlers for the SMB1 command subset OPL's client actually uses
 * (contracts/smb-protocol-scope.md). One instance is shared across
 * connections for a given sharing session; per-connection mutable state
 * lives in [SmbConnectionState], passed in explicitly.
 */
class CommandHandlers(
    private val context: Context,
    private val tree: SafDocumentTree,
    private val credentialStore: CredentialStore,
    private val shareName: String,
    private val writeLock: WriteLock,
    private val isWriteAccessAcknowledged: () -> Boolean
) {

    fun handle(frame: SmbFrame, state: SmbConnectionState): SmbFrame = when (frame.command) {
        SmbCommand.NEGOTIATE -> negotiate(frame, state)
        SmbCommand.SESSION_SETUP_ANDX -> sessionSetup(frame, state)
        SmbCommand.TREE_CONNECT_ANDX -> treeConnect(frame, state)
        SmbCommand.TREE_DISCONNECT -> FrameCodec.response(frame, NtStatus.SUCCESS)
        SmbCommand.LOGOFF_ANDX -> { state.closeAll(); FrameCodec.response(frame, NtStatus.SUCCESS) }
        SmbCommand.CHECK_DIRECTORY -> checkDirectory(frame)
        SmbCommand.NT_CREATE_ANDX -> ntCreate(frame, state)
        SmbCommand.READ_ANDX -> readAndx(frame, state)
        SmbCommand.WRITE_ANDX -> writeAndx(frame, state)
        SmbCommand.CLOSE -> closeFile(frame, state)
        SmbCommand.TRANSACTION2 -> transaction2(frame)
        else -> FrameCodec.response(frame, NtStatus.NOT_SUPPORTED)
    }

    /**
     * 17-word (34-byte) NT LM 0.12 negotiate response, MS-CIFS 2.2.4.52.2 —
     * mirrors desktop's `command-handlers.ts:handleNegotiate` layout exactly.
     * SecurityMode advertises real NTLMv1 challenge/response (bit0 user-level
     * + bit1 challenge/response): a real PS2 OPL client always hashes the
     * challenge below into its SESSION_SETUP_ANDX password, never plaintext.
     * Was previously cramming a placeholder challenge into `params` itself
     * (wrong section — the wire format expects it in the trailing byte-count
     * data, after the fixed 34-byte word block) with EncryptionKeyLength
     * left at 0, so the client never got a real challenge to hash against.
     */
    private fun negotiate(frame: SmbFrame, state: SmbConnectionState): SmbFrame {
        val params = ByteBuffer.allocate(34).order(ByteOrder.LITTLE_ENDIAN)
        params.putShort(0, 0) // DialectIndex — "NT LM 0.12", the only dialect this server advertises
        params.put(2, 0x03) // SecurityMode: user-level (bit0) + challenge/response (bit1)
        params.putShort(3, 1) // MaxMpxCount
        params.putShort(5, 1) // MaxNumberVcs
        params.putInt(7, 0x00010000) // MaxBufferSize (64KB)
        params.putInt(11, 0) // MaxRawSize (raw mode not supported)
        params.putInt(15, 0) // SessionKey
        params.putInt(19, 0x00000010 or 0x00000200 or 0x00000040) // Capabilities: NT SMBs + NT FIND + STATUS32
        writeFileTime(params, 23, System.currentTimeMillis())
        params.putShort(31, 0) // ServerTimeZone (UTC)
        params.put(33, state.challenge.size.toByte()) // EncryptionKeyLength

        val domain = OEM.encode("WORKGROUP\u0000")
        val data = ByteArray(state.challenge.size + domain.remaining())
        state.challenge.copyInto(data)
        domain.get(data, state.challenge.size, domain.remaining())

        return FrameCodec.response(frame, NtStatus.SUCCESS, params = params.array(), data = data)
    }

    private fun sessionSetup(frame: SmbFrame, state: SmbConnectionState): SmbFrame {
        val passwordLen = passwordLength(frame.params)
        if (passwordLen < 0 || passwordLen > frame.data.size) return FrameCodec.response(frame, NtStatus.LOGON_FAILURE)
        val passwordBytes = frame.data.copyOfRange(0, passwordLen)
        // AccountName/PrimaryDomain/NativeOS/NativeLanMan OEM strings follow the password block —
        // the account name is the first non-empty one (MS-CIFS 2.2.4.53.1). Previously this parsed
        // the *entire* frame.data (including the opaque password bytes) as OEM text from offset 0,
        // which could misread the username whenever those bytes happened to split oddly on NUL.
        val rest = OEM.decode(ByteBuffer.wrap(frame.data, passwordLen, frame.data.size - passwordLen)).toString()
        val username = rest.split('\u0000').firstOrNull { it.isNotBlank() } ?:  ""

        val valid = if (passwordLen == 24) {
            credentialStore.verifyNtlmV1(username, state.challenge, passwordBytes)
        } else {
            credentialStore.verify(username, OEM.decode(ByteBuffer.wrap(passwordBytes)).toString().stripTrailingNul())
        }
        if (!valid) return FrameCodec.response(frame, NtStatus.LOGON_FAILURE)

        state.authenticated = true
        return FrameCodec.response(frame, NtStatus.SUCCESS)
    }

    private fun passwordLength(params: ByteArray): Int {
        if (params.size < 30) return -1
        return ByteBuffer.wrap(params).order(ByteOrder.LITTLE_ENDIAN).getShort(14).toInt() and 0xFFFF
    }

    private fun treeConnect(frame: SmbFrame, state: SmbConnectionState): SmbFrame {
        if (!state.authenticated) return FrameCodec.response(frame, NtStatus.ACCESS_DENIED)
        val path = OEM.decode(ByteBuffer.wrap(frame.data)).toString().stripTrailingNul()
        val requestedShare = path.substringAfterLast('\\').trim()
        if (!requestedShare.equals(shareName, ignoreCase = true)) {
            return FrameCodec.response(frame, NtStatus.OBJECT_NAME_NOT_FOUND)
        }
        state.tid = (state.tid.takeIf { it != 0 } ?: 1)
        val response = FrameCodec.response(frame, NtStatus.SUCCESS)
        return response.copy(tid = state.tid)
    }

    private fun checkDirectory(frame: SmbFrame): SmbFrame {
        val path = OEM.decode(ByteBuffer.wrap(frame.data)).toString().stripTrailingNul()
        val exists = PathConfinement.listDirectory(tree, path) != null
        return FrameCodec.response(frame, if (exists) NtStatus.SUCCESS else NtStatus.OBJECT_NAME_NOT_FOUND)
    }

    private fun ntCreate(frame: SmbFrame, state: SmbConnectionState): SmbFrame {
        val nameLen = if (frame.params.size >= 6) {
            ByteBuffer.wrap(frame.params).order(ByteOrder.LITTLE_ENDIAN).getShort(4).toInt() and 0xFFFF
        } else 0
        val rawPath = if (nameLen > 0 && nameLen <= frame.data.size) {
            OEM.decode(ByteBuffer.wrap(frame.data, 0, nameLen)).toString()
        } else {
            OEM.decode(ByteBuffer.wrap(frame.data)).toString()
        }.stripTrailingNul()

        val target = if (rawPath.isBlank()) tree.root else PathConfinement.resolve(tree, rawPath)
        if (target == null) return FrameCodec.response(frame, NtStatus.OBJECT_NAME_NOT_FOUND)

        val pfd = if (!target.isDirectory) {
            try {
                context.contentResolver.openFileDescriptor(target.uri, "r")
            } catch (e: Exception) {
                null
            }
        } else null

        val fid = state.openFile(target, pfd, target.isDirectory)
        val buf = ByteBuffer.allocate(2 + 1 + 8 + 8 + 8 + 8 + 4 + 8 + 2 + 1).order(ByteOrder.LITTLE_ENDIAN)
        buf.putShort(fid.toShort()) // FID (params byte 0-1, simplified layout for this scope)
        buf.put(0) // OplockLevel
        buf.putLong(0) // Creation time
        buf.putLong(0) // Last access
        buf.putLong(0) // Last write
        buf.putLong(0) // Change time
        buf.putInt(if (target.isDirectory) 0x10 else 0x80) // ExtFileAttributes: DIRECTORY / NORMAL
        buf.putLong(target.length()) // AllocationSize / EndOfFile shared for this scope
        buf.putShort(0)
        buf.put(if (target.isDirectory) 1 else 0)
        return FrameCodec.response(frame, NtStatus.SUCCESS, params = buf.array())
    }

    private fun readAndx(frame: SmbFrame, state: SmbConnectionState): SmbFrame {
        if (frame.params.size < 12) return FrameCodec.response(frame, NtStatus.UNSUCCESSFUL)
        val buf = ByteBuffer.wrap(frame.params).order(ByteOrder.LITTLE_ENDIAN)
        val fid = buf.getShort(2).toInt() and 0xFFFF
        val offset = buf.getInt(4).toLong() and 0xFFFFFFFFL
        val maxCount = buf.getShort(8).toInt() and 0xFFFF

        val open = state.get(fid) ?: return FrameCodec.response(frame, NtStatus.NO_SUCH_FILE)
        val pfd = open.pfd ?: return FrameCodec.response(frame, NtStatus.ACCESS_DENIED)

        // Never buffers a full file (FR-026/SC-008) — reads exactly the requested,
        // OPL-bounded chunk directly from the seekable descriptor.
        val bytesRead = java.io.FileInputStream(pfd.fileDescriptor).use { stream ->
            stream.channel.position(offset)
            val chunk = ByteArray(maxCount)
            val n = stream.read(chunk)
            if (n <= 0) ByteArray(0) else chunk.copyOf(n)
        }

        val responseParams = ByteBuffer.allocate(20).order(ByteOrder.LITTLE_ENDIAN).apply {
            putShort(0xFF.toShort()) // AndXCommand: none
            put(0)
            putShort(0) // AndXOffset
            putShort(0) // Remaining
            putShort(0) // DataCompactionMode
            putShort(0) // Reserved
            putShort(bytesRead.size.toShort()) // DataLength
            putShort(0) // DataOffset (kept 0; data follows immediately in this simplified layout)
            put(ByteArray(8))
        }.array()

        return FrameCodec.response(frame, NtStatus.SUCCESS, params = responseParams, data = bytesRead)
    }

    private fun writeAndx(frame: SmbFrame, state: SmbConnectionState): SmbFrame {
        if (!isWriteAccessAcknowledged()) return FrameCodec.response(frame, NtStatus.ACCESS_DENIED)
        if (frame.params.size < 14) return FrameCodec.response(frame, NtStatus.UNSUCCESSFUL)
        val buf = ByteBuffer.wrap(frame.params).order(ByteOrder.LITTLE_ENDIAN)
        val fid = buf.getShort(2).toInt() and 0xFFFF
        val offset = buf.getInt(4).toLong() and 0xFFFFFFFFL
        val dataLength = buf.getShort(10).toInt() and 0xFFFF

        val open = state.get(fid) ?: return FrameCodec.response(frame, NtStatus.NO_SUCH_FILE)
        val writeData = frame.data.copyOf(minOf(dataLength, frame.data.size))

        val (written, wasConflict) = kotlinx.coroutines.runBlocking { writeLock.withWriteLock(open.documentFile.uri.toString()) {
            try {
                context.contentResolver.openFileDescriptor(open.documentFile.uri, "rw")?.use { writePfd ->
                    java.io.FileOutputStream(writePfd.fileDescriptor).use { stream ->
                        stream.channel.position(offset)
                        stream.write(writeData)
                    }
                }
                writeData.size
            } catch (e: Exception) {
                0
            }
        } }
        // wasConflict is surfaced to SharingSessionModule via its own write-observer, not here —
        // CommandHandlers stays protocol-focused, event emission is the module's responsibility.

        val responseParams = ByteBuffer.allocate(6).order(ByteOrder.LITTLE_ENDIAN).apply {
            putShort(0xFF.toShort())
            put(0)
            putShort(0)
            putShort(written.toShort())
        }.array()
        return FrameCodec.response(frame, if (written > 0) NtStatus.SUCCESS else NtStatus.ACCESS_DENIED, params = responseParams)
    }

    private fun closeFile(frame: SmbFrame, state: SmbConnectionState): SmbFrame {
        if (frame.params.size >= 2) {
            val fid = ByteBuffer.wrap(frame.params).order(ByteOrder.LITTLE_ENDIAN).getShort(0).toInt() and 0xFFFF
            state.close(fid)
        }
        return FrameCodec.response(frame, NtStatus.SUCCESS)
    }

    /** FIND_FIRST2 only (contracts/smb-protocol-scope.md directory listing) — single-response, no continuation. */
    private fun transaction2(frame: SmbFrame): SmbFrame {
        if (frame.params.size < 2) return FrameCodec.response(frame, NtStatus.NOT_SUPPORTED)
        val setup = ByteBuffer.wrap(frame.params).order(ByteOrder.LITTLE_ENDIAN).getShort(0).toInt() and 0xFFFF
        if (setup != Trans2Subcommand.FIND_FIRST2) return FrameCodec.response(frame, NtStatus.NOT_SUPPORTED)

        val searchPath = OEM.decode(ByteBuffer.wrap(frame.data)).toString()
            .stripTrailingNul()
            .substringBeforeLast('\\')
        val entries = PathConfinement.listDirectory(tree, searchPath) ?: emptyList()

        val listing = entries.joinToString(separator = " ") { entry ->
            "${entry.name}|${if (entry.isDirectory) 1 else 0}|${entry.length()}"
        }
        val data = OEM.encode(listing).array()
        val params = ByteBuffer.allocate(10).order(ByteOrder.LITTLE_ENDIAN).apply {
            putShort(0) // SID (search handle) — no continuation supported in this scope
            putShort(entries.size.toShort())
            putShort(1) // EndOfSearch
            putShort(0) // EaErrorOffset
            putShort(0) // LastNameOffset
        }.array()
        return FrameCodec.response(frame, NtStatus.SUCCESS, params = params, data = data)
    }
}
