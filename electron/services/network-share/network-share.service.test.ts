import net from 'node:net'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { NetworkShareConfig, SaveNetworkShareConfigInput } from '../../../src/types/opl'
import {
  NetworkShareService,
  type NetworkShareConfigStore,
  type NetworkShareHistorySink
} from './network-share.service'
import { SmbProtocolServer } from './smb/smb-server'
import { FtpProtocolServer } from './ftp/ftp-server'

// High, non-privileged ports so this test never needs root (production
// defaults are 445/21 — see README's note on privileged-port binding).
const SMB_TEST_PORT = 14445
const FTP_TEST_PORT = 14421

class FakeConfigStore implements NetworkShareConfigStore {
  private config: NetworkShareConfig
  private password: string | undefined

  constructor(
    libraryRootPath: string,
    overrides: Partial<NetworkShareConfig> & { password?: string } = {}
  ) {
    const { password, ...rest } = overrides
    this.password = password
    this.config = {
      libraryRootPath,
      enabledProtocols: ['smb', 'ftp'],
      shareName: 'OPL Forge Test',
      username: 'tester',
      smbPort: SMB_TEST_PORT,
      ftpPort: FTP_TEST_PORT,
      autoStartOnLaunch: false,
      writeAccessAcknowledgedAt: new Date().toISOString(),
      ...rest
    }
  }

  async getConfig(): Promise<NetworkShareConfig> {
    return this.config
  }

  async saveConfig(input: SaveNetworkShareConfigInput): Promise<NetworkShareConfig> {
    this.config = { ...this.config, ...input, password: undefined } as NetworkShareConfig
    if (input.password) this.password = input.password
    return this.config
  }

  async acknowledgeWriteAccess(): Promise<NetworkShareConfig> {
    this.config = { ...this.config, writeAccessAcknowledgedAt: new Date().toISOString() }
    return this.config
  }

  async getPassword(): Promise<string | undefined> {
    return this.password
  }
}

const noopHistorySink: NetworkShareHistorySink = { record: async () => undefined }

async function canConnect(port: number, address = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: address, timeout: 500 })
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => resolve(false))
    socket.once('timeout', () => {
      socket.destroy()
      resolve(false)
    })
  })
}

describe('NetworkShareService', () => {
  let libraryRoot: string

  beforeEach(async () => {
    libraryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'opl-forge-network-share-'))
    await fs.mkdir(path.join(libraryRoot, 'DVD'), { recursive: true })
  })

  afterEach(async () => {
    await fs.rm(libraryRoot, { recursive: true, force: true })
  })

  it('starts both protocols, reports running status, and stops cleanly', async () => {
    const service = new NetworkShareService(
      new SmbProtocolServer(),
      new FtpProtocolServer(),
      new FakeConfigStore(libraryRoot, { password: 'secret' }),
      noopHistorySink
    )

    const status = await service.start()
    expect(status.smb.state).toBe('running')
    expect(status.ftp.state).toBe('running')
    expect(status.smb.port).toBe(SMB_TEST_PORT)
    expect(status.ftp.port).toBe(FTP_TEST_PORT)

    expect(await canConnect(SMB_TEST_PORT, status.smb.boundAddresses[0])).toBe(true)
    expect(await canConnect(FTP_TEST_PORT, status.ftp.boundAddresses[0])).toBe(true)

    const stopped = await service.stop()
    expect(stopped.smb.state).toBe('off')
    expect(stopped.ftp.state).toBe('off')
    expect(await canConnect(SMB_TEST_PORT)).toBe(false)
  })

  it('rejects start when no device has been selected (empty libraryRootPath)', async () => {
    const service = new NetworkShareService(
      new SmbProtocolServer(),
      new FtpProtocolServer(),
      new FakeConfigStore('', { password: 'secret' }),
      noopHistorySink
    )
    await expect(service.start()).rejects.toMatchObject({ code: 'DEVICE_NOT_SELECTED' })
  })

  it('rejects start when write access has not been acknowledged (FR-014)', async () => {
    const service = new NetworkShareService(
      new SmbProtocolServer(),
      new FtpProtocolServer(),
      new FakeConfigStore(libraryRoot, {
        password: 'secret',
        writeAccessAcknowledgedAt: undefined
      }),
      noopHistorySink
    )
    await expect(service.start()).rejects.toMatchObject({ code: 'WRITE_ACCESS_NOT_ACKNOWLEDGED' })
  })

  it('rejects start when the selected device no longer has a valid OPL structure', async () => {
    const emptyDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opl-forge-empty-'))
    try {
      const service = new NetworkShareService(
        new SmbProtocolServer(),
        new FtpProtocolServer(),
        new FakeConfigStore(emptyDir, { password: 'secret' }),
        noopHistorySink
      )
      await expect(service.start()).rejects.toMatchObject({ code: 'LIBRARY_STRUCTURE_INVALID' })
    } finally {
      await fs.rm(emptyDir, { recursive: true, force: true })
    }
  })

  it('rejects a second start while already running (idempotent guard)', async () => {
    const service = new NetworkShareService(
      new SmbProtocolServer(),
      new FtpProtocolServer(),
      new FakeConfigStore(libraryRoot, { password: 'secret' }),
      noopHistorySink
    )
    await service.start()
    try {
      await expect(service.start()).rejects.toMatchObject({ code: 'ALREADY_RUNNING' })
    } finally {
      await service.stop()
    }
  })

  it('is off by default and stays off until start() is called (FR-007/SC-005)', () => {
    const service = new NetworkShareService(
      new SmbProtocolServer(),
      new FtpProtocolServer(),
      new FakeConfigStore(libraryRoot, { password: 'secret' }),
      noopHistorySink
    )
    const status = service.getStatus()
    expect(status.smb.state).toBe('off')
    expect(status.ftp.state).toBe('off')
    expect(status.connectedClients).toHaveLength(0)
  })
})
