import net from 'node:net'
import { randomUUID } from 'node:crypto'
import type { ProtocolServer, ProtocolServerContext } from '../network-share.service'
import { friendlyBindError } from '../bind-error'
import { dispatchSmbCommand, SmbSession } from './command-handlers'
import { decodeSmbMessage, encodeNbssFrame, encodeSmbMessage, NbssFrameReader } from './frame-codec'

export class SmbProtocolServer implements ProtocolServer {
  private server: net.Server | undefined
  private readonly sockets = new Set<net.Socket>()

  async start(context: ProtocolServerContext): Promise<void> {
    const server = net.createServer((socket) => this.handleConnection(socket, context))
    this.server = server

    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: NodeJS.ErrnoException) => reject(error)
        server.once('error', onError)
        server.listen(context.port, context.address, () => {
          server.removeListener('error', onError)
          resolve()
        })
      })
    } catch (error) {
      const friendly = friendlyBindError(error as NodeJS.ErrnoException, context.port)
      context.onBindError({ ...friendly, retryable: true })
      throw Object.assign(new Error(friendly.message), { code: friendly.code })
    }

    // Only registered once actually listening — bind failures are handled
    // above; this covers post-start runtime socket errors.
    server.on('error', (error: NodeJS.ErrnoException) => {
      const friendly = friendlyBindError(error, context.port)
      context.onBindError({ ...friendly, retryable: true })
    })

    context.onListening()
  }

  async stop(): Promise<void> {
    if (!this.server) return
    const server = this.server
    this.server = undefined
    // FR-007 "stops immediately": net.Server#close only stops accepting new
    // connections and waits for existing ones to end on their own, which can
    // hang indefinitely on a client that never sends FIN. Force-close every
    // open connection so shutdown never depends on client behavior.
    for (const socket of this.sockets) socket.destroy()
    this.sockets.clear()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }

  private handleConnection(socket: net.Socket, context: ProtocolServerContext): void {
    const remoteAddress = socket.remoteAddress ?? ''
    // Rejected at raw-socket accept time, before a single byte of SMB
    // protocol is parsed — the strongest form of the FR-006/R5 guarantee.
    if (!context.isLocalAddress(remoteAddress)) {
      socket.destroy()
      return
    }

    this.sockets.add(socket)
    const clientId = randomUUID()
    const reader = new NbssFrameReader()
    const session = new SmbSession(
      { username: context.username, password: context.password },
      {
        onActivity: (activity) => context.onClientActivity(clientId, activity),
        onWriteConflict: (message) => context.onWriteConflict(message)
      }
    )
    let announced = false

    socket.on('data', (chunk: Buffer | string) => {
      void (async () => {
        let packets: Buffer[]
        try {
          packets = reader.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        } catch {
          socket.destroy()
          return
        }
        for (const packet of packets) {
          try {
            const request = decodeSmbMessage(packet)
            const response = await dispatchSmbCommand(request, session, context.libraryRootPath)
            socket.write(encodeNbssFrame(encodeSmbMessage(response)))
            // Only a session that actually authenticated counts as a
            // connected client (FR-015) — a NEGOTIATE or a failed
            // SESSION_SETUP_ANDX must never create a ConnectedClient record.
            if (!announced && session.authenticated) {
              announced = true
              context.onClientConnected({
                id: clientId,
                protocol: 'smb',
                remoteAddress,
                connectedAt: new Date().toISOString(),
                activity: 'idle',
                lastActivityAt: new Date().toISOString()
              })
            }
          } catch {
            // A malformed/unsupported message from this client shouldn't take
            // the whole server down — drop the connection for this client only.
            socket.destroy()
            return
          }
        }
      })()
    })

    socket.on('close', () => {
      this.sockets.delete(socket)
      void session.closeAllHandles()
      if (announced) context.onClientDisconnected(clientId)
    })

    socket.on('error', () => socket.destroy())
  }
}
