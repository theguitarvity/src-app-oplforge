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
        SmbCommand.NEGOTIATE -> negotiate(frame)
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

    private fun negotiate(frame: SmbFrame): SmbFrame {
        // Dialect index 0 ("NT LM 0.12" — the only one this server advertises), no Unicode,
        // no extended security: OEM 8-bit strings throughout (contracts/smb-protocol-scope.md).
        val buf = ByteBuffer.allocate(2 + 1 + 2 + 4 + 4 + 4 + 4 + 2 + 2 + 2 + 2 + 8).order(ByteOrder.LITTLE_ENDIAN)
        buf.putShort(0) // DialectIndex
        buf.put(0x03) // SecurityMode: user-level, plaintext (no challenge/response for this scope)
        buf.putShort(1) // MaxMpxCount
        buf.putInt(0x00FFFF) // MaxBufferSize-adjacent capabilities placeholder kept minimal
        buf.putInt(4096) // MaxRawSize (unused by this server, harmless if requested)
        buf.putInt(0) // SessionKey
        buf.putInt(0) // Capabilities (no unicode, no NT SMBs required for this scope)
        buf.putShort(0) // ServerTimeZone
        buf.putShort(0)
        buf.putShort(0) // EncryptionKeyLength
        buf.putShort(0)
        buf.put(ByteArray(8))
        return FrameCodec.response(frame, NtStatus.SUCCESS, params = buf.array())
    }

    private fun sessionSetup(frame: SmbFrame, state: SmbConnectionState): SmbFrame {
        val data = OEM.decode(java.nio.ByteBuffer.wrap(frame.data)).toString()
        val parts = data.split('\u0000').filter { it.isNotEmpty() }
        // OEM password blob (opaque bytes) followed by account/domain OEM strings — the account
        // name is the first readable OEM string after the password block in this simplified layout.
        val username = parts.firstOrNull { it.isNotBlank() } ?: ""
        val password = extractPassword(frame.params, frame.data)

        val valid = credentialStore.verify(username, password)
        if (!valid) return FrameCodec.response(frame, NtStatus.LOGON_FAILURE)

        state.authenticated = true
        return FrameCodec.response(frame, NtStatus.SUCCESS)
    }

    private fun extractPassword(params: ByteArray, data: ByteArray): String {
        if (params.size < 30) return ""
        val buf = ByteBuffer.wrap(params).order(ByteOrder.LITTLE_ENDIAN)
        buf.position(14) // OEMPasswordLen offset within SESSION_SETUP_ANDX request words
        val passwordLen = buf.short.toInt() and 0xFFFF
        if (passwordLen <= 0 || passwordLen > data.size) return ""
        return OEM.decode(ByteBuffer.wrap(data, 0, passwordLen)).toString()
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
