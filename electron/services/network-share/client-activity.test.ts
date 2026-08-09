import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NetworkShareClientActivity } from '../../../src/types/opl'
import { SMB_HEADER_SIZE, defaultSecurityFeatures, type SmbMessage } from './smb/frame-codec'
import { dispatchSmbCommand, SmbSession } from './smb/command-handlers'
import { INFO_LEVEL, SMB_COMMAND, TRANS2_SUBCOMMAND } from './smb/protocol-constants'

function baseHeader(command: number) {
  return {
    command,
    status: 0,
    flags: 0x18,
    flags2: 0,
    pidHigh: 0,
    securityFeatures: defaultSecurityFeatures(),
    tid: 1,
    pidLow: 1,
    uid: 1,
    mid: 1
  }
}

function ntCreateRequest(fileName: string): SmbMessage {
  const params = Buffer.alloc(39)
  params.writeUInt16LE(fileName.length, 5) // NameLength
  params.writeUInt32LE(1, 35) // FILE_OPEN — do not create, must already exist
  return {
    header: baseHeader(SMB_COMMAND.NT_CREATE_ANDX),
    params,
    data: Buffer.from(fileName, 'latin1')
  }
}

function closeRequest(fid: number): SmbMessage {
  const params = Buffer.alloc(2)
  params.writeUInt16LE(fid, 0)
  return { header: baseHeader(SMB_COMMAND.CLOSE), params, data: Buffer.alloc(0) }
}

function readAndxRequest(fid: number, maxCount: number): SmbMessage {
  // AndXCommand(1)+AndXReserved(1)+AndXOffset(2) = 4 bytes precede FID.
  const params = Buffer.alloc(12)
  params.writeUInt16LE(fid, 4)
  params.writeUInt32LE(0, 6) // offset
  params.writeUInt16LE(maxCount, 10)
  return { header: baseHeader(SMB_COMMAND.READ_ANDX), params, data: Buffer.alloc(0) }
}

function findFirst2Request(searchPattern: string, searchCount: number): SmbMessage {
  const fileNameBytes = Buffer.from(`${searchPattern}\0`, 'latin1')
  const trans2Params = Buffer.alloc(12 + fileNameBytes.length)
  trans2Params.writeUInt16LE(0, 0) // SearchAttributes
  trans2Params.writeUInt16LE(searchCount, 2) // SearchCount
  trans2Params.writeUInt16LE(0, 4) // Flags
  trans2Params.writeUInt16LE(INFO_LEVEL.FIND_FILE_BOTH_DIRECTORY_INFO, 6) // InformationLevel
  trans2Params.writeUInt32LE(0, 8) // SearchStorageType
  fileNameBytes.copy(trans2Params, 12)

  // MS-CIFS 2.2.4.46.1 request words (15 words / 30 bytes for SetupCount=1).
  const params = Buffer.alloc(30)
  params.writeUInt16LE(trans2Params.length, 0) // TotalParameterCount
  params.writeUInt16LE(0, 2) // TotalDataCount
  params.writeUInt16LE(4096, 4) // MaxParameterCount
  params.writeUInt16LE(8192, 6) // MaxDataCount
  params.writeUInt8(0, 8) // MaxSetupCount
  params.writeUInt8(0, 9) // Reserved1
  params.writeUInt16LE(0, 10) // Flags
  params.writeUInt32LE(0, 12) // Timeout
  params.writeUInt16LE(0, 16) // Reserved2
  params.writeUInt16LE(trans2Params.length, 18) // ParameterCount
  const dataStart = SMB_HEADER_SIZE + 1 + params.length + 2
  const nameByte = Buffer.from([0x00]) // empty pipe Name for SMB_COM_TRANSACTION2
  params.writeUInt16LE(dataStart + nameByte.length, 20) // ParameterOffset
  params.writeUInt16LE(0, 22) // DataCount
  params.writeUInt16LE(dataStart + nameByte.length + trans2Params.length, 24) // DataOffset
  params.writeUInt8(1, 26) // SetupCount
  params.writeUInt8(0, 27) // Reserved3
  params.writeUInt16LE(TRANS2_SUBCOMMAND.FIND_FIRST2, 28) // Setup[0]

  return {
    header: baseHeader(SMB_COMMAND.TRANSACTION2),
    params,
    data: Buffer.concat([nameByte, trans2Params])
  }
}

function queryPathInformationRequest(fileName: string, informationLevel: number): SmbMessage {
  const fileNameBytes = Buffer.from(`${fileName}\0`, 'latin1')
  const trans2Params = Buffer.alloc(6 + fileNameBytes.length)
  trans2Params.writeUInt16LE(informationLevel, 0)
  trans2Params.writeUInt32LE(0, 2)
  fileNameBytes.copy(trans2Params, 6)

  const params = Buffer.alloc(30)
  params.writeUInt16LE(trans2Params.length, 0)
  params.writeUInt16LE(0, 2)
  params.writeUInt16LE(256, 4)
  params.writeUInt16LE(8192, 6)
  params.writeUInt16LE(trans2Params.length, 18)
  const dataStart = SMB_HEADER_SIZE + 1 + params.length + 2
  const pad = Buffer.alloc(3)
  params.writeUInt16LE(dataStart + pad.length, 20)
  params.writeUInt16LE(dataStart + pad.length + trans2Params.length, 24)
  params.writeUInt8(1, 26)
  params.writeUInt16LE(TRANS2_SUBCOMMAND.QUERY_PATH_INFORMATION, 28)
  return {
    header: baseHeader(SMB_COMMAND.TRANSACTION2),
    params,
    data: Buffer.concat([pad, trans2Params])
  }
}

describe('SMB1 command-handler activity classification', () => {
  let libraryRoot: string
  let session: SmbSession
  let activities: NetworkShareClientActivity[]

  beforeEach(async () => {
    libraryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'opl-forge-activity-'))
    await fs.writeFile(path.join(libraryRoot, 'game.iso'), Buffer.from('PS2ISO'))
    await fs.mkdir(path.join(libraryRoot, 'CD'))
    await fs.writeFile(path.join(libraryRoot, 'CD', 'SLUS_000.00.Test.iso'), Buffer.alloc(2048))
    activities = []
    session = new SmbSession(
      { username: 'tester', password: 'secret' },
      {
        onActivity: (activity) => activities.push(activity),
        onWriteConflict: vi.fn()
      }
    )
    session.establishSession()
    session.connectTree('secret')
    session.libraryRootPath = libraryRoot
  })

  afterEach(async () => {
    await fs.rm(libraryRoot, { recursive: true, force: true })
  })

  it('marks NT_CREATE_ANDX as browsing, READ_ANDX as transferring, and CLOSE as idle', async () => {
    const create = ntCreateRequest('game.iso')
    create.header.uid = session.uid
    create.header.tid = session.tid
    const createResponse = await dispatchSmbCommand(create, session, libraryRoot)
    const fid = createResponse.params.readUInt16LE(5)
    expect(activities).toEqual(['browsing'])

    const read = readAndxRequest(fid, 4)
    read.header.uid = session.uid
    read.header.tid = session.tid
    await dispatchSmbCommand(read, session, libraryRoot)
    expect(activities).toEqual(['browsing', 'transferring'])

    const close = closeRequest(fid)
    close.header.uid = session.uid
    close.header.tid = session.tid
    await dispatchSmbCommand(close, session, libraryRoot)
    expect(activities).toEqual(['browsing', 'transferring', 'idle'])
  })

  it('lists directory entries via TRANSACTION2/FIND_FIRST2 (directory browsing)', async () => {
    const request = findFirst2Request('\\*', 100)
    request.header.uid = session.uid
    request.header.tid = session.tid
    const response = await dispatchSmbCommand(request, session, libraryRoot)

    expect(response.header.status).toBe(0)
    // response.params is the fixed TRANSACTION2 response envelope (10 words);
    // FIND_FIRST2's own SID/SearchCount/EndOfSearch live in response.data,
    // which buildTrans2Response lays out as [pad(1)][trans2Parameters(10)][entries].
    const sid = response.data.readUInt16LE(1)
    const searchCount = response.data.readUInt16LE(3)
    const endOfSearch = response.data.readUInt16LE(5)
    expect(sid).toBeGreaterThan(0)
    expect(searchCount).toBe(4) // '.', '..', 'game.iso', 'CD'
    expect(endOfSearch).toBe(1)
    expect(activities).toEqual(['browsing'])

    const entriesData = response.data.subarray(1 + 10)
    expect(entriesData.toString('latin1')).toContain('game.iso')
  })

  it('answers the two QUERY_PATH_INFORMATION levels used by OPL before listing CD/DVD', async () => {
    const basic = queryPathInformationRequest('\\CD', INFO_LEVEL.QUERY_FILE_BASIC_INFO)
    basic.header.uid = session.uid
    basic.header.tid = session.tid
    const basicResponse = await dispatchSmbCommand(basic, session, libraryRoot)
    expect(basicResponse.header.status).toBe(0)
    expect(basicResponse.data.readUInt32LE(3 + 32)).toBe(0x10)

    const standard = queryPathInformationRequest('\\CD', INFO_LEVEL.QUERY_FILE_STANDARD_INFO)
    standard.header.uid = session.uid
    standard.header.tid = session.tid
    const standardResponse = await dispatchSmbCommand(standard, session, libraryRoot)
    expect(standardResponse.header.status).toBe(0)
    expect(standardResponse.data.readBigUInt64LE(3 + 8)).toBe(0n)
    expect(standardResponse.data.readUInt8(3 + 21)).toBe(1)
  })

  it('checkCredentials only accepts the exact configured username/password (FR-015)', () => {
    expect(session.checkCredentials('tester', 'secret')).toBe(true)
    expect(session.checkCredentials('tester', 'wrong')).toBe(false)
    expect(session.checkCredentials('wrong', 'secret')).toBe(false)
  })

  it('accepts the OPL alive ECHO with UID 0 before the tree is connected', async () => {
    const echoData = Buffer.from('ALIVE ECHO TEST', 'latin1')
    const params = Buffer.alloc(2)
    params.writeUInt16LE(1, 0)
    const request: SmbMessage = {
      header: {
        ...baseHeader(SMB_COMMAND.ECHO),
        uid: 0,
        tid: 0xffff
      },
      params,
      data: echoData
    }

    // Match the point in OPL's startup sequence: session setup succeeded,
    // but TREE_CONNECT_ANDX has not happened yet.
    session.treeConnected = false
    session.tid = 0

    const response = await dispatchSmbCommand(request, session, libraryRoot)

    expect(response.header.status).toBe(0)
    expect(response.params.readUInt16LE(0)).toBe(1)
    expect(response.data).toEqual(echoData)
  })
})
