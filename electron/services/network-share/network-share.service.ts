import { EventEmitter } from 'node:events'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type {
  ConnectedClient,
  NetworkShareClientActivity,
  NetworkShareConfig,
  NetworkShareEvent,
  NetworkShareProtocol,
  NetworkShareStatus,
  ProtocolStatus,
  SaveNetworkShareConfigInput,
  SerializableError,
  SetupInstructions
} from '../../../src/types/opl'
import { OPL_DIRS } from '../device.service'
import { getGameLibrary } from '../games/game-id.service'
import { addHistory } from '../history.service'
import * as configStoreModule from './config-store'
import { isLocalNetworkAddress } from './local-network-guard'
import { listLocalNetworkAddresses } from './network-interfaces'

/** Matches PS2 serial codes like "SLUS_202.46" — the raw CFG-style filename OPL sometimes opens a game by, never a friendly title. */
const SERIAL_PATTERN = /^[A-Z]{4}[-_]\d{3}\.\d{2}$/

export interface ProtocolServerContext {
  libraryRootPath: string
  address: string
  port: number
  username: string
  password: string
  isLocalAddress: (remoteAddress: string) => boolean
  onListening: () => void
  onBindError: (error: SerializableError) => void
  onClientConnected: (client: ConnectedClient) => void
  onClientDisconnected: (clientId: string) => void
  onClientActivity: (
    clientId: string,
    activity: NetworkShareClientActivity,
    relativePath?: string
  ) => void
  onWriteConflict: (message: string) => void
}

export interface ProtocolServer {
  start(context: ProtocolServerContext): Promise<void>
  stop(): Promise<void>
}

/** Matches config-store.ts's exports — injectable so tests avoid Electron's `app`/`safeStorage` (DI over mocking, see DeviceLockService). */
export interface NetworkShareConfigStore {
  getConfig(): Promise<NetworkShareConfig>
  saveConfig(input: SaveNetworkShareConfigInput): Promise<NetworkShareConfig>
  acknowledgeWriteAccess(): Promise<NetworkShareConfig>
  getPassword(): Promise<string | undefined>
}

export interface NetworkShareHistorySink {
  record(input: {
    operation: string
    result: 'success' | 'error' | 'warning'
    message: string
  }): Promise<void>
}

const defaultHistorySink: NetworkShareHistorySink = {
  record: async (input) => {
    await addHistory(input)
  }
}

export class NetworkShareServiceError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

const emptyProtocolStatus = (): ProtocolStatus => ({ state: 'off', boundAddresses: [] })

async function libraryStructureValid(libraryRootPath: string): Promise<boolean> {
  for (const dir of OPL_DIRS) {
    try {
      const stat = await fs.stat(path.join(libraryRootPath, dir))
      if (stat.isDirectory()) return true
    } catch {
      // try next OPL folder
    }
  }
  return false
}

/**
 * Orchestrates the SMB1-minimal and FTP servers (research.md R3): shared
 * config, unified status, local-network-only binding, and event fan-out.
 * SMB/FTP protocol code lives in ./smb and ./ftp — this class only wires
 * lifecycle, auth, and the FR-013/FR-014/FR-015 safeguards that apply to
 * both protocols identically.
 */
export class NetworkShareService {
  private readonly emitter = new EventEmitter()
  private readonly clients = new Map<string, ConnectedClient>()
  private readonly lastActivityPaths = new Map<string, string>()
  private smbStatus: ProtocolStatus = emptyProtocolStatus()
  private ftpStatus: ProtocolStatus = emptyProtocolStatus()

  constructor(
    private readonly smbServer: ProtocolServer,
    private readonly ftpServer: ProtocolServer,
    // Injectable so tests avoid Electron's `app`/`safeStorage` (this
    // codebase prefers DI over module mocking — see e.g. DeviceLockService).
    private readonly configStore: NetworkShareConfigStore = configStoreModule,
    private readonly historySink: NetworkShareHistorySink = defaultHistorySink
  ) {}

  async getConfig(): Promise<NetworkShareConfig> {
    return this.configStore.getConfig()
  }

  async saveConfig(input: SaveNetworkShareConfigInput): Promise<NetworkShareConfig> {
    return this.configStore.saveConfig(input)
  }

  async acknowledgeWriteAccess(): Promise<NetworkShareConfig> {
    return this.configStore.acknowledgeWriteAccess()
  }

  getStatus(): NetworkShareStatus {
    return {
      smb: this.smbStatus,
      ftp: this.ftpStatus,
      connectedClients: [...this.clients.values()]
    }
  }

  async getSetupInstructions(protocol: NetworkShareProtocol): Promise<SetupInstructions> {
    const status = protocol === 'smb' ? this.smbStatus : this.ftpStatus
    if (status.state !== 'running' || status.boundAddresses.length === 0 || !status.port) {
      throw new NetworkShareServiceError('SERVICE_NOT_RUNNING', 'Sharing is not running yet')
    }
    const config = await this.getConfig()
    // This host may have more than one local subnet active at once (e.g. a
    // secondary router) — list every address as its own step rather than
    // guessing which one the PS2 can actually reach; the user tries them in
    // order if the first doesn't connect.
    const addressSteps = status.boundAddresses.map((address, index) => ({
      label: status.boundAddresses.length > 1 ? `Endereço (opção ${index + 1})` : 'Endereço',
      value: address
    }))
    const steps = [
      ...addressSteps,
      { label: 'Porta', value: String(status.port) },
      { label: 'Compartilhamento', value: config.shareName },
      { label: 'Usuário', value: config.username }
    ]
    return {
      protocol,
      steps,
      oplMenuPath:
        protocol === 'smb'
          ? ['Configurações', 'Configurações de Rede', 'Servidor SMB']
          : ['Configurações', 'Configurações de Rede', 'Servidor FTP']
    }
  }

  async start(): Promise<NetworkShareStatus> {
    if (this.smbStatus.state === 'running' || this.ftpStatus.state === 'running') {
      throw new NetworkShareServiceError('ALREADY_RUNNING', 'Sharing is already running')
    }

    const config = await this.getConfig()
    if (!config.libraryRootPath) {
      throw new NetworkShareServiceError(
        'DEVICE_NOT_SELECTED',
        'No device selected to share — pick a device on this screen first'
      )
    }
    if (!config.writeAccessAcknowledgedAt) {
      throw new NetworkShareServiceError(
        'WRITE_ACCESS_NOT_ACKNOWLEDGED',
        'Write-access acknowledgment required before starting sharing'
      )
    }

    const libraryRootPath = config.libraryRootPath
    if (!(await libraryStructureValid(libraryRootPath))) {
      throw new NetworkShareServiceError(
        'LIBRARY_STRUCTURE_INVALID',
        'The selected device no longer has a valid OPL folder structure — reconnect it or prepare it first'
      )
    }

    // Advertised (displayed) addresses vs. bind address are deliberately
    // different: this host can have more than one active local subnet (a
    // real, observed case for this project — see network-interfaces.ts), so
    // servers bind every interface (0.0.0.0) and the local-network guard is
    // what actually enforces FR-006, while every locally-relevant address is
    // shown to the user since only they know which subnet the PS2 is on.
    const advertisedAddresses = listLocalNetworkAddresses()
    if (advertisedAddresses.length === 0) {
      throw new NetworkShareServiceError(
        'BIND_FAILED',
        'No local network interface is available to bind to'
      )
    }
    const bindAddress = '0.0.0.0'

    const password = await this.configStore.getPassword()
    if (!password) {
      throw new NetworkShareServiceError(
        'WRITE_ACCESS_NOT_ACKNOWLEDGED',
        'A sharing password must be set before starting sharing'
      )
    }

    if (config.enabledProtocols.includes('smb')) {
      await this.startProtocol('smb', this.smbServer, {
        libraryRootPath,
        address: bindAddress,
        advertisedAddresses,
        port: config.smbPort,
        username: config.username,
        password
      })
    }
    if (config.enabledProtocols.includes('ftp')) {
      await this.startProtocol('ftp', this.ftpServer, {
        libraryRootPath,
        address: bindAddress,
        advertisedAddresses,
        port: config.ftpPort,
        username: config.username,
        password
      })
    }

    await this.historySink.record({
      operation: 'network-share-start',
      result: 'success',
      message: `Compartilhamento de rede iniciado (${config.enabledProtocols.join(', ')}) em ${advertisedAddresses.join(', ')}`
    })

    return this.getStatus()
  }

  private async startProtocol(
    protocol: NetworkShareProtocol,
    server: ProtocolServer,
    params: {
      libraryRootPath: string
      address: string
      advertisedAddresses: string[]
      port: number
      username: string
      password: string
    }
  ): Promise<void> {
    this.setProtocolStatus(protocol, { state: 'starting', boundAddresses: [] })
    try {
      const { advertisedAddresses, ...serverParams } = params
      await server.start({
        ...serverParams,
        isLocalAddress: isLocalNetworkAddress,
        onListening: () => {
          this.setProtocolStatus(protocol, {
            state: 'running',
            boundAddresses: advertisedAddresses,
            port: params.port,
            startedAt: new Date().toISOString()
          })
        },
        onBindError: (error) => {
          this.setProtocolStatus(protocol, { state: 'error', error, boundAddresses: [] })
        },
        onClientConnected: (client) => this.handleClientConnected(client),
        onClientDisconnected: (clientId) => this.handleClientDisconnected(clientId),
        onClientActivity: (clientId, activity, relativePath) =>
          this.handleClientActivity(clientId, activity, relativePath),
        onWriteConflict: (message) => this.handleWriteConflict(message)
      })
    } catch (error) {
      const candidateCode =
        error instanceof NetworkShareServiceError
          ? error.code
          : error &&
              typeof error === 'object' &&
              typeof (error as { code?: unknown }).code === 'string'
            ? (error as { code: string }).code
            : undefined
      const serialized: SerializableError = {
        code: candidateCode === 'PORT_IN_USE' ? 'PORT_IN_USE' : 'BIND_FAILED',
        message: error instanceof Error ? error.message : 'Failed to start server',
        retryable: true
      }
      this.setProtocolStatus(protocol, { state: 'error', error: serialized, boundAddresses: [] })
      throw new NetworkShareServiceError(
        serialized.code === 'PORT_IN_USE' ? 'PORT_IN_USE' : 'BIND_FAILED',
        serialized.message
      )
    }
  }

  async stop(): Promise<NetworkShareStatus> {
    await Promise.all([this.smbServer.stop(), this.ftpServer.stop()])
    this.smbStatus = emptyProtocolStatus()
    this.ftpStatus = emptyProtocolStatus()
    this.clients.clear()
    await this.historySink.record({
      operation: 'network-share-stop',
      result: 'success',
      message: 'Compartilhamento de rede interrompido'
    })
    this.emitEvent('protocol-status-changed', 'Compartilhamento interrompido')
    return this.getStatus()
  }

  onEvent(listener: (event: NetworkShareEvent) => void): () => void {
    this.emitter.on('event', listener)
    return () => this.emitter.off('event', listener)
  }

  private setProtocolStatus(protocol: NetworkShareProtocol, status: ProtocolStatus): void {
    if (protocol === 'smb') this.smbStatus = status
    else this.ftpStatus = status
    this.emitEvent(
      'protocol-status-changed',
      `${protocol.toUpperCase()} ${status.state}${status.error ? `: ${status.error.message}` : ''}`
    )
  }

  private handleClientConnected(client: ConnectedClient): void {
    this.clients.set(client.id, client)
    this.emitEvent('client-connected', `Cliente conectado: ${client.remoteAddress}`, client)
  }

  private handleClientDisconnected(clientId: string): void {
    const client = this.clients.get(clientId)
    this.clients.delete(clientId)
    this.lastActivityPaths.delete(clientId)
    this.emitEvent(
      'client-disconnected',
      client ? `Cliente desconectado: ${client.remoteAddress}` : 'Cliente desconectado',
      client
    )
  }

  private handleClientActivity(
    clientId: string,
    activity: NetworkShareClientActivity,
    relativePath?: string
  ): void {
    const client = this.clients.get(clientId)
    if (!client) return
    // A game boot/read burst calls this dozens of times per second for the
    // same file — only resolve a title and emit an event once the active
    // file actually changes, not once per SMB read.
    if (relativePath && this.lastActivityPaths.get(clientId) === relativePath) return
    if (relativePath) this.lastActivityPaths.set(clientId, relativePath)
    else this.lastActivityPaths.delete(clientId)

    void (async () => {
      const currentFile = relativePath ? await this.resolveFriendlyTitle(relativePath) : null
      const updated: ConnectedClient = {
        ...client,
        activity,
        lastActivityAt: new Date().toISOString(),
        currentFile
      }
      this.clients.set(clientId, updated)
      this.emitEvent(
        'client-activity-changed',
        currentFile ? `Transmitindo: ${currentFile}` : `Atividade: ${activity}`,
        updated
      )
    })()
  }

  /**
   * Resolves the raw SMB-relative path (e.g. `DVD/Game.iso`) the PS2 is
   * currently reading to a friendly title: exact filename match against the
   * cataloged library first, falling back to a serial-code lookup (OPL
   * sometimes opens a title by its bare CFG-style serial, e.g.
   * "SLUS_202.46", which isn't a name any user would recognize) before
   * finally falling back to the raw filename.
   */
  private async resolveFriendlyTitle(relativePath: string): Promise<string> {
    const fileName = relativePath.split('/').pop() ?? relativePath
    const nameWithoutExt = fileName.replace(/\.[^./]+$/, '')
    const library = await getGameLibrary()
    const byPath = library.games.find((game) => game.path.endsWith(fileName))
    if (byPath) return byPath.title
    if (SERIAL_PATTERN.test(nameWithoutExt)) {
      const byGameId = library.games.find((game) => game.gameId === nameWithoutExt)
      if (byGameId) return byGameId.title
    }
    return nameWithoutExt
  }

  private handleWriteConflict(message: string): void {
    this.emitEvent('write-conflict', message)
  }

  private emitEvent(
    kind: NetworkShareEvent['kind'],
    message: string,
    client?: ConnectedClient
  ): void {
    const event: NetworkShareEvent = {
      kind,
      status: this.getStatus(),
      client,
      message,
      timestamp: new Date().toISOString()
    }
    this.emitter.emit('event', event)
  }
}
