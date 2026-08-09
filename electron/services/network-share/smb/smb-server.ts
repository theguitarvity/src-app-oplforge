import net from 'node:net'
import { randomUUID } from 'node:crypto'
import type { ProtocolServer, ProtocolServerContext } from '../network-share.service'
import { friendlyBindError } from '../bind-error'
import { sendLog } from '../../logger'
import { dispatchSmbCommand, SmbSession } from './command-handlers'
import { SMB_COMMAND } from './protocol-constants'
import {
  decodeSmbMessage,
  encodeNbssFrame,
  encodePositiveSessionResponse,
  encodeSmbMessage,
  NBSS_TYPE,
  NbssFrameReader,
  type NbssFrame
} from './frame-codec'

const SMB_COMMAND_NAME = new Map<number, string>(
  Object.entries(SMB_COMMAND).map(([name, code]) => [code, name])
)

function smbCommandName(command: number): string {
  return SMB_COMMAND_NAME.get(command) ?? `0x${command.toString(16)}`
}

// Diagnostic-only: must never be able to take the server down (e.g. no
// BrowserWindow yet, or running outside a real Electron app in tests).
function debugLog(level: Parameters<typeof sendLog>[0], message: string): void {
  try {
    sendLog(level, message)
  } catch {
    // ignored — logging is best-effort
  }
}

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
      debugLog('WARNING', `[SMB debug] rejected non-local connection from ${remoteAddress}`)
      socket.destroy()
      return
    }
    debugLog('INFO', `[SMB debug] connection accepted from ${remoteAddress}`)

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
        const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        let frames: NbssFrame[]
        try {
          frames = reader.push(bufferChunk)
        } catch (error) {
          debugLog(
            'ERROR',
            `[SMB debug] ${remoteAddress}: bad NBSS framing (${(error as Error).message}); ` +
              `first bytes=${bufferChunk.subarray(0, 16).toString('hex')}`
          )
          socket.destroy()
          return
        }
        for (const frame of frames) {
          // Real PS2/OPL SMB clients speak classic NetBIOS-over-TCP (RFC 1002)
          // regardless of the configured port: they open with a
          // SESSION_REQUEST and wait for a POSITIVE_SESSION_RESPONSE before
          // sending any SMB traffic. Clients doing "direct hosting of SMB
          // over TCP" (no NBT handshake) instead send a SESSION_MESSAGE
          // straight away, which falls through to the existing SMB dispatch.
          if (frame.type === NBSS_TYPE.SESSION_REQUEST) {
            debugLog(
              'INFO',
              `[SMB debug] ${remoteAddress}: NBT SESSION_REQUEST (${frame.payload.length} bytes) — replying POSITIVE_SESSION_RESPONSE`
            )
            socket.write(encodePositiveSessionResponse())
            continue
          }
          if (frame.type !== NBSS_TYPE.SESSION_MESSAGE) {
            debugLog(
              'ERROR',
              `[SMB debug] ${remoteAddress}: unexpected NBSS frame type 0x${frame.type.toString(16)}, dropping connection`
            )
            socket.destroy()
            return
          }
          try {
            const request = decodeSmbMessage(frame.payload)
            debugLog(
              'INFO',
              `[SMB debug] ${remoteAddress}: request ${smbCommandName(request.header.command)}`
            )
            const response = await dispatchSmbCommand(request, session, context.libraryRootPath)
            debugLog(
              'INFO',
              `[SMB debug] ${remoteAddress}: response ${smbCommandName(response.header.command)} status=0x${(response.header.status >>> 0).toString(16)}`
            )
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
          } catch (error) {
            // A malformed/unsupported message from this client shouldn't take
            // the whole server down — drop the connection for this client only.
            debugLog(
              'ERROR',
              `[SMB debug] ${remoteAddress}: failed to handle SMB message (${(error as Error).message}); ` +
                `payload=${frame.payload.subarray(0, 48).toString('hex')}`
            )
            socket.destroy()
            return
          }
        }
      })()
    })

    socket.on('close', () => {
      debugLog('INFO', `[SMB debug] ${remoteAddress}: connection closed`)
      this.sockets.delete(socket)
      void session.closeAllHandles()
      if (announced) context.onClientDisconnected(clientId)
    })

    socket.on('error', (error) => {
      debugLog('ERROR', `[SMB debug] ${remoteAddress}: socket error (${error.message})`)
      socket.destroy()
    })
  }
}
