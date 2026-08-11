package com.oplforge.mobile.sharing.smb

import android.content.Context
import android.util.Log
import com.oplforge.mobile.library.SafDocumentTree
import com.oplforge.mobile.sharing.CredentialStore
import com.oplforge.mobile.sharing.LocalNetworkGuard
import com.oplforge.mobile.shared.WriteLock
import java.io.EOFException
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketTimeoutException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

interface SmbServerListener {
    fun onServerBound(address: String?, port: Int)
    fun onClientConnected(remoteAddress: String, connectionId: String)
    fun onClientDisconnected(connectionId: String)
    fun onWriteConflict(path: String)
}

/**
 * Socket lifecycle for the SMB1 server (FR-013/FR-014/FR-015). Binds
 * LAN-only, accepts connections in a background thread, and rejects any
 * source address `LocalNetworkGuard` doesn't consider local (research.md R5,
 * contracts/native-modules.md "Shared constraints").
 */
class SmbServer(
    private val port: Int,
    private val context: Context,
    private val tree: SafDocumentTree,
    private val credentialStore: CredentialStore,
    private val shareName: String,
    private val writeLock: WriteLock,
    private val isWriteAccessAcknowledged: () -> Boolean,
    private val listener: SmbServerListener? = null,
    private val bindAddress: String? = null,
    // No TCP FIN/RST arrives when a PS2 drops off the network mid-session
    // (power loss, Wi-Fi association drop) — without this, `readFrame`
    // blocks forever and the connection (and "connected" UI state) lingers
    // indefinitely. Matches desktop's `SmbProtocolServer` idle timeout.
    private val idleTimeoutMs: Int = 45_000
) {
    private var serverSocket: ServerSocket? = null
    private var acceptThread: Thread? = null
    private val connectionExecutor = Executors.newCachedThreadPool()
    private val activeSockets = ConcurrentHashMap<String, Socket>()
    @Volatile private var running = false

    val boundPort: Int get() = serverSocket?.localPort ?: port

    fun start() {
        val handlers = CommandHandlers(context, tree, credentialStore, shareName, writeLock, isWriteAccessAcknowledged)
        val socket = ServerSocket()
        socket.reuseAddress = true
        val address = if (bindAddress != null) InetSocketAddress(bindAddress, port) else InetSocketAddress(port)
        socket.bind(address)
        serverSocket = socket
        running = true
        listener?.onServerBound(bindAddress, socket.localPort)

        acceptThread = Thread({
            while (running) {
                val client = try {
                    socket.accept()
                } catch (e: Exception) {
                    if (running) Log.e(TAG, "Accept loop failed", e)
                    break
                }
                val remote = client.inetAddress
                if (!LocalNetworkGuard.isLanAddress(remote)) {
                    client.close()
                    continue
                }
                val connectionId = "${remote.hostAddress}:${client.port}"
                activeSockets[connectionId] = client
                connectionExecutor.submit { handleConnection(client, connectionId, handlers) }
            }
        }, "SmbServer-accept").apply { isDaemon = true; start() }
    }

    private fun handleConnection(socket: Socket, connectionId: String, handlers: CommandHandlers) {
        listener?.onClientConnected(socket.inetAddress.hostAddress ?: "unknown", connectionId)
        socket.soTimeout = idleTimeoutMs
        val state = SmbConnectionState()
        try {
            val input = socket.getInputStream()
            val output = socket.getOutputStream()
            while (running && !socket.isClosed) {
                val nbss = FrameCodec.readNbssFrame(input)
                when (nbss.type) {
                    // Real PS2/OPL clients open with this regardless of port and
                    // wait for the reply before sending any SMB traffic at all —
                    // skipping it looks like an immediate connection failure to
                    // the client. Mirrors desktop's smb-server.ts exactly.
                    NbssType.SESSION_REQUEST -> FrameCodec.writePositiveSessionResponse(output)
                    NbssType.SESSION_MESSAGE -> {
                        val frame = FrameCodec.decodeSmb(nbss.payload)
                        val response = handlers.handle(frame, state)
                        FrameCodec.writeFrame(output, response)
                    }
                    else -> throw IllegalStateException("Unexpected NBSS frame type ${nbss.type}")
                }
            }
        } catch (e: EOFException) {
            // Clean disconnect — expected when the client (or its cable) goes away.
        } catch (e: SocketTimeoutException) {
            // Idle timeout — the PS2 went silent without a clean TCP close
            // (e.g. dropped off Wi-Fi). Treated the same as a clean disconnect.
        } catch (e: Exception) {
            Log.e(TAG, "Connection $connectionId failed", e)
        } finally {
            state.closeAll()
            activeSockets.remove(connectionId)
            runCatching { socket.close() }
            listener?.onClientDisconnected(connectionId)
        }
    }

    fun stop() {
        running = false
        runCatching { serverSocket?.close() }
        activeSockets.values.forEach { runCatching { it.close() } }
        activeSockets.clear()
        acceptThread?.join(2000)
        acceptThread = null
        serverSocket = null
    }

    companion object {
        private const val TAG = "OplForgeSmb"
    }
}
