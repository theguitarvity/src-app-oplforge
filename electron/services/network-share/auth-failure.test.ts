import net from 'node:net'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  NetworkShareService,
  type NetworkShareConfigStore,
  type NetworkShareHistorySink
} from './network-share.service'
import { SmbProtocolServer } from './smb/smb-server'
import { FtpProtocolServer } from './ftp/ftp-server'
import {
  decodeSmbMessage,
  defaultSecurityFeatures,
  encodeNbssFrame,
  encodeSmbMessage,
  NbssFrameReader
} from './smb/frame-codec'
import { NT_STATUS, SMB_COMMAND } from './smb/protocol-constants'
import type { NetworkShareConfig } from '../../../src/types/opl'

const SMB_TEST_PORT = 14446
const FTP_TEST_PORT = 14422
const CORRECT_PASSWORD = 'correct-horse-battery-staple'

class FixedConfigStore implements NetworkShareConfigStore {
  constructor(private readonly libraryRootPath: string) {}

  async getConfig(): Promise<NetworkShareConfig> {
    return {
      libraryRootPath: this.libraryRootPath,
      enabledProtocols: ['smb', 'ftp'],
      shareName: 'OPL Forge Test',
      username: 'tester',
      smbPort: SMB_TEST_PORT,
      ftpPort: FTP_TEST_PORT,
      autoStartOnLaunch: false,
      writeAccessAcknowledgedAt: new Date().toISOString()
    }
  }
  async saveConfig() {
    return this.getConfig()
  }
  async acknowledgeWriteAccess() {
    return this.getConfig()
  }
  async getPassword(): Promise<string | undefined> {
    return CORRECT_PASSWORD
  }
}

const noopHistorySink: NetworkShareHistorySink = { record: async () => undefined }

function negotiateRequest() {
  const dialect = Buffer.concat([Buffer.from([0x02]), Buffer.from('NT LM 0.12\0', 'latin1')])
  return encodeSmbMessage({
    header: {
      command: SMB_COMMAND.NEGOTIATE,
      status: 0,
      flags: 0x18,
      flags2: 0,
      pidHigh: 0,
      securityFeatures: defaultSecurityFeatures(),
      tid: 0,
      pidLow: 1,
      uid: 0,
      mid: 1
    },
    params: Buffer.alloc(0),
    data: dialect
  })
}

function sessionSetupRequest(username: string, password: string) {
  const params = Buffer.alloc(26)
  params.writeUInt16LE(password.length, 15)
  params.writeUInt16LE(0, 17)
  const data = Buffer.concat([
    Buffer.from(password, 'latin1'),
    Buffer.from(`${username}\0`, 'latin1')
  ])
  return encodeSmbMessage({
    header: {
      command: SMB_COMMAND.SESSION_SETUP_ANDX,
      status: 0,
      flags: 0x18,
      flags2: 0,
      pidHigh: 0,
      securityFeatures: defaultSecurityFeatures(),
      tid: 0,
      pidLow: 1,
      uid: 0,
      mid: 2
    },
    params,
    data
  })
}

async function sendAndReceive(
  socket: net.Socket,
  reader: NbssFrameReader,
  payload: Buffer
): Promise<Buffer> {
  return new Promise((resolve) => {
    const onData = (chunk: Buffer) => {
      const packets = reader.push(chunk)
      if (packets.length > 0) {
        socket.off('data', onData)
        resolve(packets[0])
      }
    }
    socket.on('data', onData)
    socket.write(encodeNbssFrame(payload))
  })
}

describe('Authentication failure handling (FR-015)', () => {
  let libraryRoot: string
  let service: NetworkShareService

  beforeEach(async () => {
    libraryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'opl-forge-auth-'))
    await fs.mkdir(path.join(libraryRoot, 'DVD'), { recursive: true })
    service = new NetworkShareService(
      new SmbProtocolServer(),
      new FtpProtocolServer(),
      new FixedConfigStore(libraryRoot),
      noopHistorySink
    )
    await service.start()
  })

  afterEach(async () => {
    await service.stop()
    await fs.rm(libraryRoot, { recursive: true, force: true })
  })

  it('SMB rejects an invalid password with LOGON_FAILURE and creates no connected client', async () => {
    const socket = net.connect({ port: SMB_TEST_PORT, host: service.getStatus().smb.boundAddress })
    const reader = new NbssFrameReader()
    await new Promise((resolve) => socket.once('connect', resolve))

    await sendAndReceive(socket, reader, negotiateRequest())
    const sessionSetupResponse = await sendAndReceive(
      socket,
      reader,
      sessionSetupRequest('tester', 'totally-wrong-password')
    )
    const decoded = decodeSmbMessage(sessionSetupResponse)
    expect(decoded.header.status >>> 0).toBe(NT_STATUS.LOGON_FAILURE)

    expect(service.getStatus().connectedClients).toHaveLength(0)
    socket.destroy()
  })

  it('SMB accepts the correct password with SUCCESS status', async () => {
    const socket = net.connect({ port: SMB_TEST_PORT, host: service.getStatus().smb.boundAddress })
    const reader = new NbssFrameReader()
    await new Promise((resolve) => socket.once('connect', resolve))

    await sendAndReceive(socket, reader, negotiateRequest())
    const sessionSetupResponse = await sendAndReceive(
      socket,
      reader,
      sessionSetupRequest('tester', CORRECT_PASSWORD)
    )
    const decoded = decodeSmbMessage(sessionSetupResponse)
    expect(decoded.header.status >>> 0).toBe(NT_STATUS.SUCCESS)
    socket.destroy()
  })

  it('FTP rejects an invalid password without revealing which field was wrong, creating no connected client', async () => {
    const socket = net.connect({ port: FTP_TEST_PORT, host: service.getStatus().ftp.boundAddress })
    const lines: string[] = []
    socket.on('data', (chunk) => lines.push(chunk.toString('utf-8')))
    await new Promise((resolve) => socket.once('connect', resolve))
    await new Promise((resolve) => setTimeout(resolve, 100)) // greeting

    socket.write('USER tester\r\n')
    await new Promise((resolve) => setTimeout(resolve, 100))
    socket.write('PASS wrong-password\r\n')
    await new Promise((resolve) => setTimeout(resolve, 200))

    const transcript = lines.join('')
    // The 331 "awaiting password" prompt is normal FTP flow, not a leak; the
    // one line that matters is the final failure response.
    const finalLine = transcript.trim().split('\n').at(-1) ?? ''
    expect(finalLine).toMatch(/530/) // generic "Invalid username or password"
    expect(finalLine.toLowerCase()).not.toMatch(
      /username incorrect|password incorrect|wrong username|wrong password/
    )

    expect(service.getStatus().connectedClients).toHaveLength(0)
    socket.destroy()
  })
})
