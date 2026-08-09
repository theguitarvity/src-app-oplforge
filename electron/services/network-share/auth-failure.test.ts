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
  NBSS_TYPE,
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
  // MS-CIFS 2.2.4.53.1: AndXCommand(1)+AndXReserved(1)+AndXOffset(2)+
  // MaxBufferSize(2)+MaxMpxCount(2)+VcNumber(2)+SessionKey(4) = 14 bytes
  // precede the ANSI/Unicode password length fields.
  const params = Buffer.alloc(26)
  params.writeUInt16LE(password.length, 14)
  params.writeUInt16LE(0, 16)
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

function treeConnectRequest(uid: number, password: string) {
  const params = Buffer.alloc(8)
  params.writeUInt8(0xff, 0)
  params.writeUInt16LE(password.length, 6)
  return encodeSmbMessage({
    header: {
      command: SMB_COMMAND.TREE_CONNECT_ANDX,
      status: 0,
      flags: 0x18,
      flags2: 0,
      pidHigh: 0,
      securityFeatures: defaultSecurityFeatures(),
      tid: 0,
      pidLow: 1,
      uid,
      mid: 3
    },
    params,
    data: Buffer.concat([
      Buffer.from(password, 'latin1'),
      Buffer.from('\\\\127.0.0.1\\OPL Forge Test\0A:\0', 'latin1')
    ])
  })
}

async function sendAndReceive(
  socket: net.Socket,
  reader: NbssFrameReader,
  payload: Buffer
): Promise<Buffer> {
  return new Promise((resolve) => {
    const onData = (chunk: Buffer) => {
      const frames = reader.push(chunk)
      if (frames.length > 0) {
        socket.off('data', onData)
        resolve(frames[0].payload)
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

  it('accepts share-level session setup but rejects an invalid tree password generically', async () => {
    const socket = net.connect({
      port: SMB_TEST_PORT,
      host: service.getStatus().smb.boundAddresses[0]
    })
    const reader = new NbssFrameReader()
    await new Promise((resolve) => socket.once('connect', resolve))

    await sendAndReceive(socket, reader, negotiateRequest())
    const sessionSetupResponse = await sendAndReceive(
      socket,
      reader,
      sessionSetupRequest('tester', 'totally-wrong-password')
    )
    const decoded = decodeSmbMessage(sessionSetupResponse)
    expect(decoded.header.status >>> 0).toBe(NT_STATUS.SUCCESS)
    const treeResponse = await sendAndReceive(
      socket,
      reader,
      treeConnectRequest(decoded.header.uid, 'totally-wrong-password')
    )
    expect(decodeSmbMessage(treeResponse).header.status >>> 0).toBe(NT_STATUS.LOGON_FAILURE)

    expect(service.getStatus().connectedClients).toHaveLength(0)
    socket.destroy()
  })

  it('completes the classic NBT SESSION_REQUEST handshake before SMB traffic (real PS2/OPL clients send this unconditionally)', async () => {
    const socket = net.connect({
      port: SMB_TEST_PORT,
      host: service.getStatus().smb.boundAddresses[0]
    })
    const reader = new NbssFrameReader()
    await new Promise((resolve) => socket.once('connect', resolve))

    // RFC 1002 4.3.1: type(1)=0x81 + length(3) + encoded called/calling
    // NetBIOS names. The exact name encoding doesn't matter to this server —
    // only that a POSITIVE_SESSION_RESPONSE (type 0x82) comes back before
    // any SMB traffic is accepted.
    const sessionRequestBody = Buffer.alloc(68, 0x20)
    const sessionRequest = Buffer.concat([
      Buffer.from([NBSS_TYPE.SESSION_REQUEST, 0x00, 0x00, sessionRequestBody.length]),
      sessionRequestBody
    ])
    const [sessionResponseFrame] = await new Promise<Awaited<ReturnType<NbssFrameReader['push']>>>(
      (resolve) => {
        socket.once('data', (chunk: Buffer) => resolve(reader.push(chunk)))
        socket.write(sessionRequest)
      }
    )
    expect(sessionResponseFrame.type).toBe(NBSS_TYPE.POSITIVE_SESSION_RESPONSE)
    expect(sessionResponseFrame.payload).toHaveLength(0)

    // The rest of the exchange proceeds exactly as the no-handshake path.
    const negotiateResponse = await sendAndReceive(socket, reader, negotiateRequest())
    expect(decodeSmbMessage(negotiateResponse).header.status).toBe(NT_STATUS.SUCCESS)
    const sessionSetupResponse = decodeSmbMessage(
      await sendAndReceive(socket, reader, sessionSetupRequest('tester', ''))
    )
    expect(sessionSetupResponse.header.status >>> 0).toBe(NT_STATUS.SUCCESS)
    const treeResponse = await sendAndReceive(
      socket,
      reader,
      treeConnectRequest(sessionSetupResponse.header.uid, CORRECT_PASSWORD)
    )
    expect(decodeSmbMessage(treeResponse).header.status >>> 0).toBe(NT_STATUS.SUCCESS)
    socket.destroy()
  })

  it('SMB authenticates the correct password at TREE_CONNECT_ANDX', async () => {
    const socket = net.connect({
      port: SMB_TEST_PORT,
      host: service.getStatus().smb.boundAddresses[0]
    })
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
    const treeResponse = await sendAndReceive(
      socket,
      reader,
      treeConnectRequest(decoded.header.uid, CORRECT_PASSWORD)
    )
    expect(decodeSmbMessage(treeResponse).header.status >>> 0).toBe(NT_STATUS.SUCCESS)
    socket.destroy()
  })

  it('FTP rejects an invalid password without revealing which field was wrong, creating no connected client', async () => {
    const socket = net.connect({
      port: FTP_TEST_PORT,
      host: service.getStatus().ftp.boundAddresses[0]
    })
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
