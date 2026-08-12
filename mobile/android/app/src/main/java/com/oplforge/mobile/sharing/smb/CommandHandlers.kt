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
import java.util.concurrent.Callable
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

private val OEM = Charset.forName("ISO-8859-1")

/** File I/O this server issues per SMB request has no client-visible timeout of its own — a stalled USB-OTG read/write must not hang the connection forever. */
private const val FILE_IO_TIMEOUT_MS = 10_000L

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

/** A blocking file read/write against the underlying storage exceeded [FILE_IO_TIMEOUT_MS] (e.g. a stalled USB-OTG device). */
class SmbIoTimeoutException(cause: Throwable) : Exception(cause)

/** One FIND_FIRST2/FIND_NEXT2 directory-listing entry. */
data class DirEntry(val name: String, val isDirectory: Boolean, val size: Long, val lastModified: Long)

/** FIND_FIRST2 search state, continued across FIND_NEXT2 calls by SID. */
data class SearchState(val entries: List<DirEntry>, var nextIndex: Int)

/** Per-TCP-connection SMB1 protocol state — never shared across connections. */
class SmbConnectionState {
    var authenticated = false
    var tid: Int = 0
    // Per-connection NTLMv1 challenge, sent in the NEGOTIATE response and
    // verified against in TREE_CONNECT_ANDX — a real PS2 OPL client always
    // hashes this into its 24-byte password response, never plaintext.
    val challenge: ByteArray = NtlmV1.randomChallenge()
    private var nextFid = 1
    private val fids = mutableMapOf<Int, OpenFile>()
    // A real PS2 OPL client always sends FIND_NEXT2 after FIND_FIRST2,
    // regardless of the EndOfSearch flag — without real per-SID state here
    // (was previously always SID=0, "no continuation supported"), that
    // FIND_NEXT2 had nothing to continue and every directory came back
    // empty on real hardware even though FIND_FIRST2 itself was correct.
    // Mirrors desktop's SmbSession.searches exactly.
    private var nextSid = 1
    val searches = mutableMapOf<Int, SearchState>()

    fun allocateSid(): Int = nextSid++

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
        searches.clear()
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
    // Bounds otherwise-unbounded blocking file I/O (see readAndx/writeAndx) —
    // created once per CommandHandlers instance (one per running SmbServer),
    // shut down via close(). Never create a new executor per call, that
    // leaks a thread on every request.
    private val ioTimeoutExecutor: ExecutorService = Executors.newCachedThreadPool()

    /** Shuts down the I/O timeout executor. Call once when the owning SmbServer stops. */
    fun close() {
        ioTimeoutExecutor.shutdownNow()
    }

    /**
     * Runs [block] with a hard wall-clock timeout, unblocking a stuck
     * blocking I/O call by interrupting its thread. [block] MUST perform its
     * blocking I/O through a `java.nio` interruptible channel (e.g.
     * `FileChannel.read`/`write`) — interrupting a thread blocked in the
     * older `java.io` stream APIs (`FileInputStream.read(ByteArray)`) does
     * NOT unblock it. A real PS2 freeze was traced to exactly this: a USB-OTG
     * drive stalling `readAndx`'s file read indefinitely, with nothing here
     * bounding it — `socket.soTimeout` only bounds waiting for the *next
     * network frame*, never the file I/O itself.
     */
    private fun <T> withIoTimeout(block: () -> T): T {
        val future = ioTimeoutExecutor.submit(Callable { block() })
        return try {
            future.get(FILE_IO_TIMEOUT_MS, TimeUnit.MILLISECONDS)
        } catch (e: TimeoutException) {
            future.cancel(true) // interrupts the worker thread -> ClosedByInterruptException on the blocked channel call
            throw SmbIoTimeoutException(e)
        } catch (e: java.util.concurrent.ExecutionException) {
            // A real I/O failure inside the Callable (e.g. a transient
            // USB-OTG hiccup under the burst of small reads a PS2 game boot
            // sends — far more likely to hit this than the sparse reads
            // during simple browsing) surfaces here, NOT as TimeoutException.
            // Left uncaught, this propagated all the way to SmbServer's
            // generic exception handler, which closes the whole TCP
            // connection — a real bug found via on-device testing: the
            // connection visibly dropped and reconnected exactly when a game
            // boot's burst of reads began, then hung. Must convert to the
            // same recoverable SMB error as a timeout, not kill the socket.
            throw SmbIoTimeoutException(e.cause ?: e)
        }
    }

    fun handle(frame: SmbFrame, state: SmbConnectionState): SmbFrame {
        return when (frame.command) {
            SmbCommand.NEGOTIATE -> negotiate(frame, state)
            SmbCommand.SESSION_SETUP_ANDX -> sessionSetup(frame, state)
            SmbCommand.TREE_CONNECT_ANDX -> treeConnect(frame, state)
            SmbCommand.TREE_DISCONNECT -> FrameCodec.response(frame, NtStatus.SUCCESS)
            SmbCommand.LOGOFF_ANDX -> { state.closeAll(); FrameCodec.response(frame, NtStatus.SUCCESS) }
            SmbCommand.ECHO -> echo(frame)
            SmbCommand.CHECK_DIRECTORY -> checkDirectory(frame, state)
            SmbCommand.NT_CREATE_ANDX -> ntCreate(frame, state)
            SmbCommand.OPEN_ANDX -> openAndx(frame, state)
            SmbCommand.READ_ANDX -> readAndx(frame, state)
            SmbCommand.WRITE_ANDX -> writeAndx(frame, state)
            SmbCommand.CLOSE -> closeFile(frame, state)
            SmbCommand.TRANSACTION2 -> transaction2(frame, state)
            SmbCommand.FIND_CLOSE2 -> {
                val sid = if (frame.params.size >= 2) ByteBuffer.wrap(frame.params).order(ByteOrder.LITTLE_ENDIAN).getShort(0).toInt() and 0xFFFF else -1
                state.searches.remove(sid)
                FrameCodec.response(frame, NtStatus.SUCCESS)
            }
            else -> FrameCodec.response(frame, NtStatus.NOT_SUPPORTED)
        }
    }

    /**
     * 17-word (34-byte) NT LM 0.12 negotiate response, MS-CIFS 2.2.4.52.2 —
     * mirrors desktop's `command-handlers.ts:handleNegotiate` layout exactly.
     * SecurityMode advertises real NTLMv1 challenge/response (bit0 user-level
     * + bit1 challenge/response): a real PS2 OPL client always hashes the
     * challenge below into its TREE_CONNECT_ANDX password, never plaintext.
     * Was previously cramming a placeholder challenge into `params` itself
     * (wrong section — the wire format expects it in the trailing byte-count
     * data, after the fixed 34-byte word block) with EncryptionKeyLength
     * left at 0, so the client never got a real challenge to hash against.
     */
    private fun negotiate(frame: SmbFrame, state: SmbConnectionState): SmbFrame {
        val params = ByteBuffer.allocate(34).order(ByteOrder.LITTLE_ENDIAN)
        params.putShort(0, 0) // DialectIndex — "NT LM 0.12", the only dialect this server advertises
        // SecurityMode: bit0=0 (share-level, matches how auth actually works —
        // see treeConnect) + bit1=1 (challenge/response). Was 0x03 (bit0=1,
        // user-level), internally inconsistent with a server that never
        // checks credentials at SESSION_SETUP_ANDX — a strict client reading
        // this bit could reasonably decide to send real creds there instead
        // of TREE_CONNECT_ANDX. Matches desktop's handleNegotiate exactly.
        params.put(2, 0x02)
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

    /**
     * Share-level security (MS-CIFS 3.1.1): a real PS2 OPL client never puts
     * real credentials here — it sends a dummy/empty SESSION_SETUP_ANDX and
     * puts the actual share password on TREE_CONNECT_ANDX instead. Trying to
     * authenticate at this layer (as a prior version of this file did)
     * rejects every real PS2 before it ever reaches TREE_CONNECT_ANDX —
     * mirrors desktop's `command-handlers.ts:handleSessionSetup`, which
     * learned this the same way (STATUS_LOGON_FAILURE on every real
     * connection despite a correct NTLMv1 implementation).
     */
    private fun sessionSetup(frame: SmbFrame, state: SmbConnectionState): SmbFrame {
        state.authenticated = true
        val params = ByteBuffer.allocate(6).order(ByteOrder.LITTLE_ENDIAN).apply {
            put(0, 0xFF.toByte()) // AndXCommand: no chained response
            put(1, 0) // AndXReserved
            putShort(2, 0) // AndXOffset
            putShort(4, 0) // Action: not a guest login
        }.array()
        val nativeOs = OEM.encode("OPL Forge\u0000")
        val nativeLanMan = OEM.encode("OPL Forge Network Share\u0000")
        val data = ByteArray(nativeOs.remaining() + nativeLanMan.remaining())
        val nativeOsLen = nativeOs.remaining()
        nativeOs.get(data, 0, nativeOsLen)
        nativeLanMan.get(data, nativeOsLen, nativeLanMan.remaining())
        return FrameCodec.response(frame, NtStatus.SUCCESS, params = params, data = data)
    }

    /**
     * The real authentication point for share-level security: OPL puts the
     * share password (plaintext or a 24-byte NTLMv1 response against the
     * challenge issued in NEGOTIATE) here, not in SESSION_SETUP_ANDX. No
     * username is involved at this layer (mirrors desktop's `connectTree`).
     */
    private fun treeConnect(frame: SmbFrame, state: SmbConnectionState): SmbFrame {
        if (!state.authenticated) return FrameCodec.response(frame, NtStatus.ACCESS_DENIED)
        if (frame.params.size < 8) return FrameCodec.response(frame, NtStatus.LOGON_FAILURE)
        val passwordLen = ByteBuffer.wrap(frame.params).order(ByteOrder.LITTLE_ENDIAN).getShort(6).toInt() and 0xFFFF
        if (passwordLen > frame.data.size) return FrameCodec.response(frame, NtStatus.LOGON_FAILURE)
        val passwordBytes = frame.data.copyOfRange(0, passwordLen)

        // Path is NUL-terminated and is followed by a second OEM string, Service
        // (real clients send "?????" here to mean "any resource type") — decoding
        // the whole remainder as one string and only trimming the *trailing* NUL
        // (as a prior version of this did) folds Service into the parsed share
        // name whenever Service is non-empty, so it never matches. Stop at the
        // first NUL instead.
        var pathEnd = passwordLen
        while (pathEnd < frame.data.size && frame.data[pathEnd] != 0.toByte()) pathEnd++
        val path = OEM.decode(ByteBuffer.wrap(frame.data, passwordLen, pathEnd - passwordLen)).toString()
        val requestedShare = path.substringAfterLast('\\').trim()
        if (!requestedShare.equals(shareName, ignoreCase = true)) {
            return FrameCodec.response(frame, NtStatus.OBJECT_NAME_NOT_FOUND)
        }

        val valid = if (passwordLen == 24) {
            credentialStore.verifyShareNtlmV1(state.challenge, passwordBytes)
        } else {
            credentialStore.verifySharePassword(OEM.decode(ByteBuffer.wrap(passwordBytes)).toString().stripTrailingNul())
        }
        if (!valid) return FrameCodec.response(frame, NtStatus.LOGON_FAILURE)

        state.tid = (state.tid.takeIf { it != 0 } ?: 1)
        val response = FrameCodec.response(frame, NtStatus.SUCCESS)
        return response.copy(tid = state.tid)
    }

    /**
     * SMB_COM_ECHO (0x2B) — a transport keepalive/probe, not scoped to any
     * session. A real PS2 OPL client sends this with UID 0 right when
     * entering the network menu, before SESSION_SETUP_ANDX/TREE_CONNECT_ANDX
     * — before this handler existed it fell through to NOT_SUPPORTED, which
     * OPL surfaced as "network startup error" (301/302-family). Desktop had
     * the identical gap (`command-handlers.ts:handleEcho`); this mirrors it.
     */
    private fun echo(frame: SmbFrame): SmbFrame {
        val sequence = if (frame.params.size >= 2) {
            ByteBuffer.wrap(frame.params).order(ByteOrder.LITTLE_ENDIAN).getShort(0)
        } else {
            1.toShort()
        }
        val params = ByteBuffer.allocate(2).order(ByteOrder.LITTLE_ENDIAN).apply { putShort(0, sequence) }.array()
        return FrameCodec.response(frame, NtStatus.SUCCESS, params = params, data = frame.data)
    }

    /**
     * SECURITY: every filesystem-touching handler below must gate on
     * `state.tid != 0` — a real TREE_CONNECT_ANDX (which is the only place
     * the share password is actually checked, see [treeConnect]) must have
     * succeeded first. Without this, a client can skip straight from
     * NEGOTIATE to NT_CREATE_ANDX/READ_ANDX/etc. and read or write the whole
     * library without ever supplying the correct password. Found via
     * security audit — none of these had the check.
     */
    private fun requireTreeConnected(frame: SmbFrame, state: SmbConnectionState): SmbFrame? =
        if (state.tid == 0) FrameCodec.response(frame, NtStatus.ACCESS_DENIED) else null

    private fun checkDirectory(frame: SmbFrame, state: SmbConnectionState): SmbFrame {
        requireTreeConnected(frame, state)?.let { return it }
        val path = OEM.decode(ByteBuffer.wrap(frame.data)).toString().stripTrailingNul()
        val exists = PathConfinement.listDirectory(tree, path) != null
        return FrameCodec.response(frame, if (exists) NtStatus.SUCCESS else NtStatus.OBJECT_NAME_NOT_FOUND)
    }

    private fun ntCreate(frame: SmbFrame, state: SmbConnectionState): SmbFrame {
        requireTreeConnected(frame, state)?.let { return it }
        // NameLength (MS-CIFS 2.2.4.64.1): AndXCommand(1)+AndXReserved(1)+
        // AndXOffset(2)+Reserved(1) = 5 bytes precede it — matches desktop's
        // handleNtCreate (readUInt16LE(5)). Was reading byte 4 (the Reserved
        // byte plus half of NameLength), corrupting the path length used to
        // slice the requested name out of every NT_CREATE_ANDX request.
        val nameLen = if (frame.params.size >= 7) {
            ByteBuffer.wrap(frame.params).order(ByteOrder.LITTLE_ENDIAN).getShort(5).toInt() and 0xFFFF
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
        val mtime = target.lastModified()
        // 68-byte NT_CREATE_ANDX response, MS-CIFS 2.2.4.64.2 — byte-for-byte
        // mirror of desktop's command-handlers.ts:handleNtCreate (including
        // where desktop's own layout deviates from strict field naming, e.g.
        // FileAttributes left 0 at offset 43 with the real value reported at
        // offset 63 instead). The previous version here used a shorter,
        // differently-laid-out response ("simplified layout for this scope")
        // that a strict client parsing at spec-correct offsets would read as
        // garbage FID/size/attributes — found by diffing against desktop
        // while chasing a persistent real-PS2 SMB failure.
        val buf = ByteBuffer.allocate(68).order(ByteOrder.LITTLE_ENDIAN)
        buf.put(0, 0xFF.toByte()) // AndXCommand
        buf.put(4, 0) // OplockLevel
        buf.putShort(5, fid.toShort()) // FID
        buf.putInt(7, 1) // CreateAction: FILE_OPENED
        writeFileTime(buf, 11, mtime) // CreationTime — SAF only exposes lastModified(), reused for all four
        writeFileTime(buf, 19, mtime) // LastAccessTime
        writeFileTime(buf, 27, mtime) // LastWriteTime
        writeFileTime(buf, 35, mtime) // LastChangeTime
        buf.putInt(43, 0) // FileAttributes — left 0, matches desktop (real value is at offset 63)
        buf.putLong(47, target.length()) // AllocationSize position — desktop writes the raw size here
        val roundedSize = ((target.length() + 511) / 512) * 512
        buf.putLong(55, roundedSize) // EndOfFile position — desktop writes the 512-rounded size here
        buf.putShort(63, (if (target.isDirectory) 0x10 else 0x80).toShort()) // FileType/ExtFileAttributes
        buf.put(65, if (target.isDirectory) 1 else 0) // Directory
        return FrameCodec.response(frame, NtStatus.SUCCESS, params = buf.array())
    }

    /**
     * SMB_COM_OPEN_ANDX (0x2D) — an older, simpler open call some real PS2
     * OPL clients use instead of (or alongside) NT_CREATE_ANDX. Mirrors
     * desktop's `command-handlers.ts:handleOpenAndx`, which this file was
     * missing entirely (falling through to NOT_SUPPORTED) — a real client
     * that opens a game file this way would never get past that point.
     */
    private fun openAndx(frame: SmbFrame, state: SmbConnectionState): SmbFrame {
        requireTreeConnected(frame, state)?.let { return it }
        // Some clients prefix the OEM filename with an 0x04 SMB_STRING buffer-format byte.
        val nameData = if (frame.data.isNotEmpty() && frame.data[0] == 0x04.toByte()) {
            frame.data.copyOfRange(1, frame.data.size)
        } else {
            frame.data
        }
        val rawPath = OEM.decode(ByteBuffer.wrap(nameData)).toString().stripTrailingNul()
        val target = PathConfinement.resolve(tree, rawPath)
        if (target == null || target.isDirectory) return FrameCodec.response(frame, NtStatus.OBJECT_NAME_NOT_FOUND)

        val pfd = try {
            context.contentResolver.openFileDescriptor(target.uri, "r")
        } catch (e: Exception) {
            null
        }
        val fid = state.openFile(target, pfd, false)

        val params = ByteBuffer.allocate(30).order(ByteOrder.LITTLE_ENDIAN).apply {
            put(0, 0xFF.toByte()) // AndXCommand: no chained response
            putShort(4, fid.toShort()) // Fid
            putShort(6, 0x0080) // FileAttributes: NORMAL
            putInt(8, (target.lastModified() / 1000).toInt()) // LastWriteTime
            putInt(12, target.length().toInt()) // FileSize (truncated to 32 bits, matches desktop)
            putShort(16, 0x0040) // GrantedAccess: read-only open mode
        }.array()
        return FrameCodec.response(frame, NtStatus.SUCCESS, params = params)
    }

    /**
     * SMB_COM_READ_ANDX request (MS-CIFS 2.2.4.42.1): AndXCommand(1)+
     * AndXReserved(1)+AndXOffset(2) = 4 bytes precede FID, so FID is at byte
     * 4, Offset at 6, MaxCountOfBytesToReturn at 10 — byte-for-byte mirror
     * of desktop's handleReadAndx. This previously read fid@2/offset@4/
     * maxCount@8 (each 2 bytes too early), so every real read request was
     * parsed against the wrong FID — found by diffing against desktop while
     * chasing a persistent real-PS2 SMB failure.
     */
    private fun readAndx(frame: SmbFrame, state: SmbConnectionState): SmbFrame {
        requireTreeConnected(frame, state)?.let { return it }
        if (frame.params.size < 12) return FrameCodec.response(frame, NtStatus.UNSUCCESSFUL)
        val buf = ByteBuffer.wrap(frame.params).order(ByteOrder.LITTLE_ENDIAN)
        val fid = buf.getShort(4).toInt() and 0xFFFF
        val offset = buf.getInt(6).toLong() and 0xFFFFFFFFL
        val maxCount = buf.getShort(10).toInt() and 0xFFFF

        val open = state.get(fid) ?: return FrameCodec.response(frame, NtStatus.INVALID_HANDLE)
        val pfd = open.pfd ?: return FrameCodec.response(frame, NtStatus.ACCESS_DENIED)

        // Never buffers a full file (FR-026/SC-008) — reads exactly the requested,
        // OPL-bounded chunk directly from the seekable descriptor. Goes through
        // FileChannel (not FileInputStream.read(ByteArray)) specifically because
        // it's interruptible — withIoTimeout relies on that to actually cancel a
        // stalled USB-OTG read rather than just abandoning it in the background.
        val readStart = System.currentTimeMillis()
        val bytesRead = try {
            withIoTimeout {
                java.io.FileInputStream(pfd.fileDescriptor).channel.use { channel ->
                    channel.position(offset)
                    val buf = ByteBuffer.allocate(maxCount)
                    val n = channel.read(buf)
                    if (n <= 0) ByteArray(0) else buf.array().copyOf(n)
                }
            }
        } catch (e: SmbIoTimeoutException) {
            android.util.Log.w(
                "OplForgeSmb",
                "Read timed out fid=$fid offset=$offset maxCount=$maxCount after ${System.currentTimeMillis() - readStart}ms — likely a stalled USB-OTG/slow-media read"
            )
            return FrameCodec.response(frame, NtStatus.UNSUCCESSFUL)
        }

        // 24-byte READ_ANDX response, MS-CIFS 2.2.4.42.2 — byte-for-byte
        // mirror of desktop's handleReadAndx, including a real (not
        // hardcoded-0) DataOffset; a client that actually honors DataOffset
        // (rather than assuming data immediately follows the words block,
        // as this file's prior comment here assumed) would misread every file.
        val responseParams = ByteBuffer.allocate(24).order(ByteOrder.LITTLE_ENDIAN).apply {
            put(0, 0xFF.toByte()) // AndXCommand
            putShort(4, 0xFFFF.toShort()) // Remaining (unknown/not tracked)
            putShort(6, 0) // DataCompactionMode
            putShort(8, 0) // Reserved1
            putShort(10, bytesRead.size.toShort()) // DataLength (low)
            putShort(12, (SmbFrame.HEADER_SIZE + 1 + 24 + 2).toShort()) // DataOffset from SMB header start
            putShort(14, 0) // DataLength (high) — 0 for our sub-64KB reads
        }.array()

        return FrameCodec.response(frame, NtStatus.SUCCESS, params = responseParams, data = bytesRead)
    }

    /**
     * SMB_COM_WRITE_ANDX request (MS-CIFS 2.2.4.43.1): same 4-byte AndX
     * preamble as READ_ANDX, so FID@4, Offset@6, DataLength@20, DataOffset@22
     * — byte-for-byte mirror of desktop's handleWriteAndx. This previously
     * read fid@2/offset@4/dataLength@10, all wrong.
     */
    private fun writeAndx(frame: SmbFrame, state: SmbConnectionState): SmbFrame {
        requireTreeConnected(frame, state)?.let { return it }
        if (!isWriteAccessAcknowledged()) return FrameCodec.response(frame, NtStatus.ACCESS_DENIED)
        if (frame.params.size < 22) return FrameCodec.response(frame, NtStatus.UNSUCCESSFUL)
        val buf = ByteBuffer.wrap(frame.params).order(ByteOrder.LITTLE_ENDIAN)
        val fid = buf.getShort(4).toInt() and 0xFFFF
        val offset = buf.getInt(6).toLong() and 0xFFFFFFFFL
        val dataLength = buf.getShort(20).toInt() and 0xFFFF

        val open = state.get(fid) ?: return FrameCodec.response(frame, NtStatus.INVALID_HANDLE)
        val writeData = frame.data.copyOf(minOf(dataLength, frame.data.size))

        val (written, wasConflict) = kotlinx.coroutines.runBlocking { writeLock.withWriteLock(open.documentFile.uri.toString()) {
            try {
                context.contentResolver.openFileDescriptor(open.documentFile.uri, "rw")?.use { writePfd ->
                    // FileChannel (not FileOutputStream.write(ByteArray)) so a
                    // stalled write to slow USB-OTG storage is interruptible —
                    // see withIoTimeout/readAndx for why this matters.
                    withIoTimeout {
                        java.io.FileOutputStream(writePfd.fileDescriptor).channel.use { channel ->
                            channel.position(offset)
                            channel.write(ByteBuffer.wrap(writeData))
                        }
                    }
                }
                writeData.size
            } catch (e: Exception) {
                0
            }
        } }
        // wasConflict is surfaced to SharingSessionModule via its own write-observer, not here —
        // CommandHandlers stays protocol-focused, event emission is the module's responsibility.

        // 12-byte WRITE_ANDX response, MS-CIFS 2.2.4.43.2 — byte-for-byte
        // mirror of desktop's handleWriteAndx (Count + Available + two
        // reserved words); the previous 6-byte version here was missing
        // Available entirely, which a strict client reading a fixed-size
        // words block would misparse as whatever comes after in the frame.
        val responseParams = ByteBuffer.allocate(12).order(ByteOrder.LITTLE_ENDIAN).apply {
            put(0, 0xFF.toByte()) // AndXCommand
            putShort(4, written.toShort()) // Count
            putShort(6, 0xFFFF.toShort()) // Available
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

    /**
     * SMB_COM_TRANSACTION2 request (MS-CIFS 2.2.4.46.1): TotalParameterCount(2)+
     * TotalDataCount(2)+MaxParameterCount(2)+MaxDataCount(2)+MaxSetupCount(1)+
     * Reserved1(1)+Flags(2)+Timeout(4)+Reserved2(2) = 18 bytes precede
     * ParameterCount, then ParameterOffset@20, SetupCount@26, Setup[0]
     * (the subcommand)@28 — byte-for-byte mirror of desktop's
     * handleTransaction2. This previously read the subcommand from byte 0
     * (TotalParameterCount's position), so FIND_FIRST2 was essentially never
     * actually recognized for a real client's TotalParameterCount value —
     * and even when it coincidentally matched, the "search path" was read
     * from the raw top-level frame.data instead of the Trans2_Parameters
     * sub-blob a real TRANSACTION2 request carries it in.
     */
    private fun transaction2(frame: SmbFrame, state: SmbConnectionState): SmbFrame {
        requireTreeConnected(frame, state)?.let { return it }
        if (frame.params.size < 29) return FrameCodec.response(frame, NtStatus.NOT_SUPPORTED)
        val reqBuf = ByteBuffer.wrap(frame.params).order(ByteOrder.LITTLE_ENDIAN)
        val paramCount = reqBuf.getShort(18).toInt() and 0xFFFF
        val paramOffset = reqBuf.getShort(20).toInt() and 0xFFFF
        val setupCount = frame.params[26].toInt() and 0xFF
        val subcommand = if (setupCount > 0) reqBuf.getShort(28).toInt() and 0xFFFF else 0

        // Offsets are absolute from the start of the SMB header; frame.data
        // already excludes header+wordcount+params+bytecount, so translate back.
        val dataStart = SmbFrame.HEADER_SIZE + 1 + frame.params.size + 2
        val trans2ParamsStart = paramOffset - dataStart
        if (trans2ParamsStart < 0 || trans2ParamsStart + paramCount > frame.data.size) {
            return FrameCodec.response(frame, NtStatus.NOT_SUPPORTED)
        }
        val trans2Params = frame.data.copyOfRange(trans2ParamsStart, trans2ParamsStart + paramCount)

        return when (subcommand) {
            Trans2Subcommand.FIND_FIRST2 -> findFirst2(frame, trans2Params, state)
            Trans2Subcommand.FIND_NEXT2 -> findNext2(frame, trans2Params, state)
            Trans2Subcommand.QUERY_PATH_INFORMATION -> queryPathInformation(frame, trans2Params)
            else -> FrameCodec.response(frame, NtStatus.NOT_SUPPORTED)
        }
    }

    /**
     * TRANS2_QUERY_PATH_INFORMATION (MS-CIFS 2.2.4.46.2) — byte-for-byte
     * mirror of desktop's handleQueryPathInformation. A real PS2 OPL client
     * queries this for the root and for `ul.cfg` (its optional USBExtreme
     * config) before ever sending FIND_FIRST2 — without this, OPL sees every
     * such query answered NOT_SUPPORTED and never lists any games at all,
     * even though the folder structure and FIND_FIRST2 itself are both
     * correct (found chasing a real-PS2 "games don't list" report).
     */
    private fun queryPathInformation(frame: SmbFrame, trans2Params: ByteArray): SmbFrame {
        // LevelOfInterest(2)+Reserved(4) precede the OEM path, MS-CIFS 2.2.4.46.2.
        if (trans2Params.size < 7) return FrameCodec.response(frame, NtStatus.UNSUCCESSFUL)
        val informationLevel = ByteBuffer.wrap(trans2Params).order(ByteOrder.LITTLE_ENDIAN).getShort(0).toInt() and 0xFFFF
        val fileName = OEM.decode(ByteBuffer.wrap(trans2Params, 6, trans2Params.size - 6)).toString().stripTrailingNul()

        val target = if (fileName.isBlank()) tree.root else PathConfinement.resolve(tree, fileName)
        if (target == null) return FrameCodec.response(frame, NtStatus.OBJECT_NAME_NOT_FOUND)

        val mtime = target.lastModified()
        val data = when (informationLevel) {
            InfoLevel.QUERY_FILE_BASIC_INFO -> {
                // SMB_QUERY_FILE_BASIC_INFO: four FILETIMEs + ExtFileAttributes.
                val buf = ByteBuffer.allocate(36).order(ByteOrder.LITTLE_ENDIAN)
                writeFileTime(buf, 0, mtime) // CreationTime — SAF only exposes lastModified(), reused for all four
                writeFileTime(buf, 8, mtime) // LastAccessTime
                writeFileTime(buf, 16, mtime) // LastWriteTime
                writeFileTime(buf, 24, mtime) // LastChangeTime
                buf.putInt(32, if (target.isDirectory) 0x10 else 0x80)
                buf.array()
            }
            InfoLevel.QUERY_FILE_STANDARD_INFO -> {
                // SMB_QUERY_FILE_STANDARD_INFO: alloc/end size, links, two flags.
                val buf = ByteBuffer.allocate(22).order(ByteOrder.LITTLE_ENDIAN)
                val size = if (target.isDirectory) 0L else target.length()
                val roundedSize = ((size + 511) / 512) * 512
                buf.putLong(0, roundedSize)
                buf.putLong(8, size)
                buf.putInt(16, 1) // NumberOfLinks
                buf.put(20, 0) // DeletePending
                buf.put(21, if (target.isDirectory) 1 else 0) // Directory
                buf.array()
            }
            else -> return FrameCodec.response(frame, NtStatus.NOT_SUPPORTED)
        }
        return buildTrans2Response(frame, ByteArray(2), data)
    }

    /**
     * Wraps Trans2_Parameters/Trans2_Data in the real SMB_COM_TRANSACTION2
     * response envelope (10-word header, absolute ParameterOffset/DataOffset
     * from the SMB header start) — byte-for-byte mirror of desktop's
     * buildTrans2Response. The previous version here sent FIND_FIRST2's
     * inner Trans2_Parameters directly as the *outer* SMB response's params,
     * skipping this envelope entirely — a real client parsing the real
     * 20-byte TRANSACTION2 response header would read garbage offsets.
     */
    private fun buildTrans2Response(frame: SmbFrame, trans2Parameters: ByteArray, trans2Data: ByteArray): SmbFrame {
        val pad = 1
        val paramsStart = SmbFrame.HEADER_SIZE + 1 + 20 + 2 + pad
        val dataStart = paramsStart + trans2Parameters.size

        val params = ByteBuffer.allocate(20).order(ByteOrder.LITTLE_ENDIAN).apply {
            putShort(0, trans2Parameters.size.toShort()) // TotalParameterCount
            putShort(2, trans2Data.size.toShort()) // TotalDataCount
            putShort(4, 0) // Reserved
            putShort(6, trans2Parameters.size.toShort()) // ParameterCount
            putShort(8, paramsStart.toShort()) // ParameterOffset
            putShort(10, 0) // ParameterDisplacement
            putShort(12, trans2Data.size.toShort()) // DataCount
            putShort(14, dataStart.toShort()) // DataOffset
            putShort(16, 0) // DataDisplacement
            put(18, 0) // SetupCount
            put(19, 0) // Reserved2
        }.array()

        val bytes = ByteArray(pad + trans2Parameters.size + trans2Data.size)
        trans2Parameters.copyInto(bytes, pad)
        trans2Data.copyInto(bytes, pad + trans2Parameters.size)
        return FrameCodec.response(frame, NtStatus.SUCCESS, params = params, data = bytes)
    }

    /**
     * SMB_FIND_FILE_BOTH_DIRECTORY_INFO entry (MS-CIFS 2.2.8.1.7) —
     * byte-for-byte mirror of desktop's encodeBothDirectoryEntry, the real
     * binary directory-entry format a strict client expects. The previous
     * version here sent an ad-hoc "name|isDir|size" pipe-delimited string
     * instead — meaningless to any real SMB1 client.
     */
    private fun encodeDirectoryEntry(name: String, isDirectory: Boolean, size: Long, lastModifiedMs: Long, isLast: Boolean): ByteArray {
        val nameBytes = OEM.encode(name).array() // FileName is NOT null-terminated at this info level
        val fixed = ByteArray(94)
        val entryLength = fixed.size + nameBytes.size
        val padding = (4 - (entryLength % 4)) % 4
        val buf = ByteBuffer.wrap(fixed).order(ByteOrder.LITTLE_ENDIAN)
        buf.putInt(0, if (isLast) 0 else entryLength + padding) // NextEntryOffset
        buf.putInt(4, 0) // FileIndex
        writeFileTime(buf, 8, lastModifiedMs) // CreationTime — SAF exposes only lastModified()
        writeFileTime(buf, 16, lastModifiedMs) // LastAccessTime
        writeFileTime(buf, 24, lastModifiedMs) // LastWriteTime
        writeFileTime(buf, 32, lastModifiedMs) // LastChangeTime
        val endOfFile = if (isDirectory) 0L else size
        buf.putLong(40, endOfFile) // EndOfFile
        buf.putLong(48, ((size + 511) / 512) * 512) // AllocationSize
        buf.putInt(56, if (isDirectory) 0x10 else 0x80) // ExtFileAttributes
        buf.putInt(60, nameBytes.size) // FileNameLength
        buf.putInt(64, 0) // EaSize
        buf.put(68, 0) // ShortNameLength
        buf.put(69, 0) // Reserved
        // ShortName[12 WCHARs] left zeroed (70..93) — no 8.3 short name provided.
        val out = ByteArray(fixed.size + nameBytes.size + padding)
        fixed.copyInto(out)
        nameBytes.copyInto(out, fixed.size)
        return out
    }

    /**
     * fileName is a search pattern like "\DVD\*" — this server only supports
     * "list everything in this directory" (the '*'/'*.*' wildcard case),
     * matching OPL's directory-browsing use; arbitrary glob matching is out
     * of scope. Single-response, no FIND_NEXT2 continuation (searchCount
     * still caps the page and sets EndOfSearch correctly for a directory
     * larger than one page, matching desktop's per-call behavior).
     */
    private fun findFirst2(frame: SmbFrame, trans2Params: ByteArray, state: SmbConnectionState): SmbFrame {
        if (trans2Params.size < 12) return FrameCodec.response(frame, NtStatus.NOT_SUPPORTED)
        val buf = ByteBuffer.wrap(trans2Params).order(ByteOrder.LITTLE_ENDIAN)
        val searchCount = buf.getShort(2).toInt() and 0xFFFF
        val informationLevel = buf.getShort(6).toInt() and 0xFFFF
        if (informationLevel != InfoLevel.FIND_FILE_BOTH_DIRECTORY_INFO) {
            return FrameCodec.response(frame, NtStatus.NOT_SUPPORTED)
        }

        var nameEnd = 12
        while (nameEnd < trans2Params.size && trans2Params[nameEnd] != 0.toByte()) nameEnd++
        val fileName = OEM.decode(ByteBuffer.wrap(trans2Params, 12, nameEnd - 12)).toString()
        val dirPath = fileName.substringBeforeLast('\\', "")

        val listed = PathConfinement.listDirectory(tree, dirPath) ?: emptyList()
        val entries = listOf(
            DirEntry(".", true, 0, System.currentTimeMillis()),
            DirEntry("..", true, 0, System.currentTimeMillis())
        ) + listed.map { DirEntry(it.name ?: "", it.isDirectory, it.length(), it.lastModified()) }

        val sid = state.allocateSid()
        val searchState = SearchState(entries, 0)
        state.searches[sid] = searchState

        val page = entries.take(if (searchCount > 0) searchCount else entries.size)
        searchState.nextIndex = page.size
        val endOfSearch = searchState.nextIndex >= entries.size
        if (endOfSearch) state.searches.remove(sid)

        val dataBuffer = encodeDirEntries(page)
        val trans2ResponseParams = ByteBuffer.allocate(10).order(ByteOrder.LITTLE_ENDIAN).apply {
            putShort(0, sid.toShort())
            putShort(2, page.size.toShort())
            putShort(4, if (endOfSearch) 1 else 0)
            putShort(6, 0) // EaErrorOffset
            putShort(8, lastNameOffset(page, dataBuffer)) // LastNameOffset
        }.array()

        return buildTrans2Response(frame, trans2ResponseParams, dataBuffer)
    }

    /**
     * TRANS2_FIND_NEXT2 (MS-CIFS 2.2.4.47) — continues a search started by
     * FIND_FIRST2. A real PS2 OPL client always sends this after
     * FIND_FIRST2 regardless of the EndOfSearch flag; an unknown/exhausted
     * SID (this server never paginates beyond one page today, so the SID is
     * always already removed) mirrors desktop's real behavior: an empty,
     * successful, EndOfSearch page rather than an error — a real client
     * reads that as "no more files," not a failure.
     */
    private fun findNext2(frame: SmbFrame, trans2Params: ByteArray, state: SmbConnectionState): SmbFrame {
        if (trans2Params.size < 4) return FrameCodec.response(frame, NtStatus.NOT_SUPPORTED)
        val buf = ByteBuffer.wrap(trans2Params).order(ByteOrder.LITTLE_ENDIAN)
        val sid = buf.getShort(0).toInt() and 0xFFFF
        val searchCount = buf.getShort(2).toInt() and 0xFFFF

        val searchState = state.searches[sid]
        val page: List<DirEntry>
        val endOfSearch: Boolean
        if (searchState == null) {
            page = emptyList()
            endOfSearch = true
        } else {
            page = searchState.entries.drop(searchState.nextIndex).take(if (searchCount > 0) searchCount else Int.MAX_VALUE)
            searchState.nextIndex += page.size
            endOfSearch = searchState.nextIndex >= searchState.entries.size
            if (endOfSearch) state.searches.remove(sid)
        }

        val dataBuffer = encodeDirEntries(page)
        val trans2ResponseParams = ByteBuffer.allocate(8).order(ByteOrder.LITTLE_ENDIAN).apply {
            putShort(0, page.size.toShort())
            putShort(2, if (endOfSearch) 1 else 0)
            putShort(4, 0) // EaErrorOffset
            putShort(6, lastNameOffset(page, dataBuffer)) // LastNameOffset
        }.array()

        return buildTrans2Response(frame, trans2ResponseParams, dataBuffer)
    }

    private fun encodeDirEntries(page: List<DirEntry>): ByteArray {
        val entryBuffers = page.mapIndexed { index, entry ->
            encodeDirectoryEntry(entry.name, entry.isDirectory, entry.size, entry.lastModified, index == page.size - 1)
        }
        val dataBuffer = ByteArray(entryBuffers.sumOf { it.size })
        var pos = 0
        entryBuffers.forEach { it.copyInto(dataBuffer, pos); pos += it.size }
        return dataBuffer
    }

    private fun lastNameOffset(page: List<DirEntry>, dataBuffer: ByteArray): Short {
        if (page.isEmpty()) return 0
        val lastEntryBuffer = encodeDirectoryEntry(
            page.last().name, page.last().isDirectory, page.last().size, page.last().lastModified, true
        )
        return (dataBuffer.size - lastEntryBuffer.size).toShort()
    }
}
