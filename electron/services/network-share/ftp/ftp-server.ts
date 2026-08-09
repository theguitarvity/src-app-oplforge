import { FileSystem, FtpSrv } from 'ftp-srv'
import type { NetworkShareClientActivity } from '../../../../src/types/opl'
import type { ProtocolServer, ProtocolServerContext } from '../network-share.service'
import { friendlyBindError } from '../bind-error'
import { resolveAdvertisedAddress } from '../network-interfaces'
import { releaseWriteLock, tryAcquireWriteLock } from '../write-lock'

type ActivityCallback = (activity: NetworkShareClientActivity) => void
type WriteConflictCallback = (message: string) => void

/**
 * Scopes every FTP operation to the shared library root (via the base
 * FileSystem's own chroot-style path resolution — no traversal outside
 * `root` is possible) and layers in FR-013 write-conflict protection plus
 * best-effort activity classification for User Story 2.
 */
class ScopedActivityFileSystem extends FileSystem {
  constructor(
    connection: ConstructorParameters<typeof FileSystem>[0],
    options: ConstructorParameters<typeof FileSystem>[1],
    private readonly onActivity: ActivityCallback,
    private readonly onWriteConflict: WriteConflictCallback
  ) {
    super(connection, options)
  }

  list(path?: string) {
    this.onActivity('browsing')
    return super.list(path)
  }

  get(fileName: string) {
    this.onActivity('browsing')
    return super.get(fileName)
  }

  chdir(path?: string) {
    this.onActivity('browsing')
    return super.chdir(path)
  }

  read(fileName: string, options?: { start?: number }) {
    this.onActivity('transferring')
    return super.read(fileName, options).then((result) => {
      result.stream.once('close', () => this.onActivity('idle'))
      result.stream.once('error', () => this.onActivity('idle'))
      return result
    })
  }

  write(fileName: string, options?: { append?: boolean; start?: number }) {
    if (!tryAcquireWriteLock(fileName)) {
      this.onWriteConflict(`Conflito de escrita: ${fileName} já está sendo modificado`)
      const error = new Error(`${fileName} is being written by another connection`)
      Object.assign(error, { code: 450 })
      throw error
    }
    this.onActivity('transferring')
    const result = super.write(fileName, options)
    const release = () => {
      releaseWriteLock(fileName)
      this.onActivity('idle')
    }
    result.stream.once('close', release)
    result.stream.once('error', release)
    return result
  }
}

export class FtpProtocolServer implements ProtocolServer {
  private server: FtpSrv | undefined

  async start(context: ProtocolServerContext): Promise<void> {
    const server = new FtpSrv({
      url: `ftp://${context.address}:${context.port}`,
      // ftp-srv's own .d.ts only declares `pasv_url` as a string, but the
      // package's README documents (and the JS implementation supports) a
      // per-connection resolver function — needed here because this host
      // can have more than one active local subnet, and passive-mode data
      // connections must advertise back an address on the *same* subnet
      // the client connected from, not just any local address.
      pasv_url: ((remoteAddress: string) => resolveAdvertisedAddress(remoteAddress)) as unknown as string,
      anonymous: false,
      greeting: 'OPL Forge network share'
    })
    this.server = server

    server.on('login', ({ connection, username, password }, resolve, reject) => {
      // Reject anything outside the local network before granting any
      // filesystem access (FR-006/R5) — ftp-srv doesn't expose a pre-login
      // socket hook, so this is the earliest point access can be denied.
      if (!context.isLocalAddress(connection.ip ?? '')) {
        reject(new Error('Connections outside the local network are not allowed'))
        return
      }
      // FR-015: single generic message, never reveals which field was wrong.
      if (username !== context.username || password !== context.password) {
        reject(new Error('Invalid username or password'))
        return
      }

      const clientId = connection.id
      context.onClientConnected({
        id: clientId,
        protocol: 'ftp',
        remoteAddress: connection.ip ?? 'unknown',
        connectedAt: new Date().toISOString(),
        activity: 'idle',
        lastActivityAt: new Date().toISOString()
      })

      resolve({
        fs: new ScopedActivityFileSystem(
          connection,
          { root: context.libraryRootPath, cwd: '/' },
          (activity) => context.onClientActivity(clientId, activity),
          (message) => context.onWriteConflict(message)
        )
      })
    })

    server.on('disconnect', ({ id }) => context.onClientDisconnected(id))

    try {
      await server.listen()
      context.onListening()
    } catch (error) {
      const friendly = friendlyBindError(error as NodeJS.ErrnoException, context.port)
      context.onBindError({ ...friendly, retryable: true })
      throw Object.assign(new Error(friendly.message), { code: friendly.code })
    }
  }

  async stop(): Promise<void> {
    if (!this.server) return
    await this.server.close()
    this.server = undefined
  }
}
