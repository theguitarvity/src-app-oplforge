/**
 * SMB1 command handlers — negotiate, session setup, tree connect, directory
 * listing (TRANS2/FIND_FIRST2/FIND_NEXT2), file open/read/write/close.
 *
 * Scope note (research.md R3, Option C): this implements only the dialect
 * and command subset OPL's IOP-side SMB client is documented to use, not a
 * general-purpose SMB server. AndX command chaining is accepted on the wire
 * but never batched in the response (AndXCommand is always echoed back as
 * 0xFF) — simpler and, for a single-client home LAN share, low-cost; a
 * strictly conformant client sends the next command as a separate request
 * when it doesn't get a chained reply.
 *
 * Unicode (SMB_FLAGS2_UNICODE) is deliberately not advertised in
 * capabilities, so every string on the wire is single-byte OEM — this is
 * the biggest scope-reduction decision in this file and the reason no
 * UTF-16LE codec exists here.
 */
import { promises as fs } from 'node:fs'
import type { Stats } from 'node:fs'
import path from 'node:path'
import type { NetworkShareClientActivity } from '../../../../src/types/opl'
import { releaseWriteLock, tryAcquireWriteLock } from '../write-lock'
import { SMB_HEADER_SIZE, type SmbMessage } from './frame-codec'
import {
  FILE_ATTRIBUTE,
  INFO_LEVEL,
  NT_STATUS,
  SMB_COMMAND,
  SMB_FLAGS,
  SMB_FLAGS2,
  TRANS2_SUBCOMMAND
} from './protocol-constants'
import {
  readOemString,
  resolveSharePath,
  toRelativeKey,
  writeFileTime,
  writeOemString
} from './wire-helpers'

export interface SmbAuthContext {
  username: string
  password: string
}

export interface SmbSessionCallbacks {
  onActivity: (activity: NetworkShareClientActivity) => void
  onWriteConflict: (message: string) => void
}

interface OpenHandle {
  absolutePath: string
  relativePath: string
  isDirectory: boolean
  writeLocked: boolean
}

interface SearchState {
  entries: Array<{ name: string; stats: Stats }>
  nextIndex: number
}

let nextFid = 1
let nextSid = 1

/** Per-connection SMB session state: authentication, tree, open handles, active searches. */
export class SmbSession {
  authenticated = false
  treeConnected = false
  uid = 1
  tid = 1
  libraryRootPath = ''
  readonly handles = new Map<number, OpenHandle>()
  readonly searches = new Map<number, SearchState>()

  constructor(
    private readonly auth: SmbAuthContext,
    private readonly callbacks: SmbSessionCallbacks
  ) {}

  checkCredentials(username: string, password: string): boolean {
    // FR-015: single generic pass/fail, no per-field detail leaked to callers.
    return username === this.auth.username && password === this.auth.password
  }

  markActivity(activity: NetworkShareClientActivity): void {
    this.callbacks.onActivity(activity)
  }

  reportWriteConflict(message: string): void {
    this.callbacks.onWriteConflict(message)
  }

  async closeAllHandles(): Promise<void> {
    for (const [fid, handle] of this.handles) {
      if (handle.writeLocked) releaseWriteLock(handle.relativePath)
      this.handles.delete(fid)
    }
    this.searches.clear()
  }
}

function statAttributes(stats: Stats): number {
  return stats.isDirectory() ? FILE_ATTRIBUTE.DIRECTORY : FILE_ATTRIBUTE.NORMAL
}

function errorResponse(request: SmbMessage, status: number): SmbMessage {
  return {
    header: {
      ...request.header,
      status,
      flags: request.header.flags | SMB_FLAGS.REPLY,
      flags2: request.header.flags2 | SMB_FLAGS2.NT_STATUS
    },
    params: Buffer.alloc(0),
    data: Buffer.alloc(0)
  }
}

function successHeader(request: SmbMessage) {
  return {
    ...request.header,
    status: NT_STATUS.SUCCESS,
    flags: request.header.flags | SMB_FLAGS.REPLY,
    flags2: request.header.flags2 | SMB_FLAGS2.NT_STATUS
  }
}

// --- SMB_COM_NEGOTIATE (0x72) ---------------------------------------------

function parseOfferedDialects(data: Buffer): string[] {
  const dialects: string[] = []
  let offset = 0
  while (offset < data.length) {
    if (data.readUInt8(offset) !== 0x02) break // Dialect buffer format marker
    offset += 1
    const { value, nextOffset } = readOemString(data, offset)
    dialects.push(value)
    offset = nextOffset
  }
  return dialects
}

function handleNegotiate(request: SmbMessage): SmbMessage {
  const dialects = parseOfferedDialects(request.data)
  const dialectIndex = dialects.indexOf('NT LM 0.12')
  if (dialectIndex === -1) {
    // No mutually supported dialect — DialectIndex 0xFFFF per MS-CIFS 2.2.4.52.2.
    const params = Buffer.alloc(2)
    params.writeUInt16LE(0xffff, 0)
    return { header: successHeader(request), params, data: Buffer.alloc(0) }
  }

  // 17-word (34-byte) NT LM 0.12 negotiate response, MS-CIFS 2.2.4.52.2.
  const params = Buffer.alloc(34)
  params.writeUInt16LE(dialectIndex, 0) // DialectIndex
  params.writeUInt8(0x00, 2) // SecurityMode: share-level, plaintext passwords (this is a minimal single-user share, no NTLM challenge/response)
  params.writeUInt16LE(1, 3) // MaxMpxCount
  params.writeUInt16LE(1, 5) // MaxNumberVcs
  params.writeUInt32LE(0x00010000, 7) // MaxBufferSize (64KB — generous for a modern host, small for the wire format's own limits)
  params.writeUInt32LE(0, 11) // MaxRawSize (raw mode not supported)
  params.writeUInt32LE(0, 15) // SessionKey
  // Capabilities: NT SMBs + NT FIND + STATUS32. Deliberately no CAP_UNICODE
  // (keeps every string OEM/single-byte) and no CAP_RAW_MODE/CAP_MPX_MODE.
  params.writeUInt32LE(0x00000010 | 0x00000200 | 0x00000040, 19)
  writeFileTime(params, 23, new Date())
  params.writeInt16LE(0, 31) // ServerTimeZone (UTC)
  params.writeUInt8(0, 33) // ChallengeLength: 0 (plaintext auth, no challenge)

  const domain = writeOemString('WORKGROUP')
  return {
    header: successHeader(request),
    params,
    data: domain
  }
}

// --- SMB_COM_SESSION_SETUP_ANDX (0x73) ------------------------------------

function handleSessionSetup(request: SmbMessage, session: SmbSession): SmbMessage {
  const ansiPasswordLength = request.params.readUInt16LE(15)
  let offset = 0
  const ansiPassword = request.data.subarray(offset, offset + ansiPasswordLength)
  offset += ansiPasswordLength
  const unicodePasswordLength = request.params.readUInt16LE(17)
  offset += unicodePasswordLength // Unicode not negotiated; ignored if a client sends it anyway.
  const account = readOemString(request.data, offset)

  const password = ansiPassword.toString('latin1').replace(/\0+$/, '')
  if (!session.checkCredentials(account.value, password)) {
    return errorResponse(request, NT_STATUS.LOGON_FAILURE)
  }
  session.authenticated = true

  const params = Buffer.alloc(6)
  params.writeUInt8(0xff, 0) // AndXCommand: no chained response
  params.writeUInt8(0, 1) // AndXReserved
  params.writeUInt16LE(0, 2) // AndXOffset
  params.writeUInt16LE(0, 4) // Action: not a guest login

  const nativeOs = writeOemString('OPL Forge')
  const nativeLanMan = writeOemString('OPL Forge Network Share')
  return {
    header: { ...successHeader(request), uid: session.uid },
    params,
    data: Buffer.concat([nativeOs, nativeLanMan])
  }
}

// --- SMB_COM_TREE_CONNECT_ANDX (0x75) -------------------------------------

function handleTreeConnect(
  request: SmbMessage,
  session: SmbSession,
  libraryRootPath: string
): SmbMessage {
  if (!session.authenticated) return errorResponse(request, NT_STATUS.ACCESS_DENIED)

  const passwordLength = request.params.readUInt16LE(6)
  let offset = passwordLength
  const pathResult = readOemString(request.data, offset)
  offset = pathResult.nextOffset
  readOemString(request.data, offset) // Service — accepted, not further validated

  session.treeConnected = true
  session.libraryRootPath = libraryRootPath

  const params = Buffer.alloc(4)
  params.writeUInt8(0xff, 0)
  params.writeUInt8(0, 1)
  params.writeUInt16LE(0, 2)

  const service = writeOemString('A:')
  const fileSystem = writeOemString('OPLFS')
  return {
    header: { ...successHeader(request), tid: session.tid },
    params,
    data: Buffer.concat([service, fileSystem])
  }
}

// --- SMB_COM_TREE_DISCONNECT (0x71) / LOGOFF_ANDX (0x74) ------------------

async function handleTreeDisconnect(request: SmbMessage, session: SmbSession): Promise<SmbMessage> {
  await session.closeAllHandles()
  session.treeConnected = false
  return { header: successHeader(request), params: Buffer.alloc(0), data: Buffer.alloc(0) }
}

async function handleLogoff(request: SmbMessage, session: SmbSession): Promise<SmbMessage> {
  await session.closeAllHandles()
  session.authenticated = false
  const params = Buffer.alloc(2)
  params.writeUInt8(0xff, 0)
  params.writeUInt8(0, 1)
  return { header: successHeader(request), params, data: Buffer.alloc(0) }
}

// --- SMB_COM_NT_CREATE_ANDX (0xA2) ----------------------------------------

async function handleNtCreate(request: SmbMessage, session: SmbSession): Promise<SmbMessage> {
  if (!session.treeConnected) return errorResponse(request, NT_STATUS.ACCESS_DENIED)

  const nameLength = request.params.readUInt16LE(5)
  const disposition = request.params.readUInt32LE(35)
  const nameOffset = 0 // Pad(0..1) handled by caller trimming; NameLength counts the path bytes only.
  const rawName = request.data.subarray(nameOffset, nameOffset + nameLength).toString('latin1')

  let absolutePath: string
  try {
    absolutePath = resolveSharePath(session.libraryRootPath, rawName)
  } catch {
    return errorResponse(request, NT_STATUS.OBJECT_NAME_NOT_FOUND)
  }

  let stats: Stats | undefined
  try {
    stats = await fs.stat(absolutePath)
  } catch {
    stats = undefined
  }

  // FILE_CREATE(2)/FILE_OVERWRITE_IF(5)/FILE_SUPERSEDE(0) may create; anything else requires the file to exist.
  const mayCreate = disposition === 0 || disposition === 2 || disposition === 5
  if (!stats && !mayCreate) return errorResponse(request, NT_STATUS.OBJECT_NAME_NOT_FOUND)
  if (!stats && mayCreate) {
    await fs.mkdir(path.dirname(absolutePath), { recursive: true })
    await fs.writeFile(absolutePath, Buffer.alloc(0), { flag: 'wx' }).catch(() => undefined)
    stats = await fs.stat(absolutePath)
  }

  const fid = nextFid++
  const relativePath = toRelativeKey(session.libraryRootPath, absolutePath)
  session.handles.set(fid, {
    absolutePath,
    relativePath,
    isDirectory: stats!.isDirectory(),
    writeLocked: false
  })
  session.markActivity('browsing')

  const params = Buffer.alloc(68)
  params.writeUInt8(0xff, 0) // AndXCommand
  params.writeUInt8(0, 1)
  params.writeUInt16LE(0, 2)
  params.writeUInt8(0, 4) // OplockLevel
  params.writeUInt16LE(fid, 5) // FID
  params.writeUInt32LE(1, 7) // CreateAction: FILE_OPENED (best-effort; not distinguishing created vs opened)
  writeFileTime(params, 11, stats!.birthtime ?? new Date())
  writeFileTime(params, 19, stats!.atime)
  writeFileTime(params, 27, stats!.mtime)
  writeFileTime(params, 35, stats!.ctime)
  params.writeUInt32LE(0, 43) // FileAttributes (low 32 of ext attr, reported below too)
  params.writeBigUInt64LE(BigInt(stats!.size), 47)
  params.writeBigUInt64LE(BigInt(Math.ceil(stats!.size / 512) * 512), 55)
  params.writeUInt16LE(stats!.isDirectory() ? FILE_ATTRIBUTE.DIRECTORY : FILE_ATTRIBUTE.NORMAL, 63)
  params.writeUInt8(stats!.isDirectory() ? 1 : 0, 65) // Directory flag
  // Remaining bytes reserved/zero (guard/structure/volume — not used by this minimal server).

  return { header: { ...successHeader(request), tid: session.tid }, params, data: Buffer.alloc(0) }
}

// --- SMB_COM_CLOSE (0x04) --------------------------------------------------

function handleClose(request: SmbMessage, session: SmbSession): SmbMessage {
  const fid = request.params.readUInt16LE(0)
  const handle = session.handles.get(fid)
  if (handle?.writeLocked) releaseWriteLock(handle.relativePath)
  session.handles.delete(fid)
  session.markActivity('idle')
  return { header: successHeader(request), params: Buffer.alloc(0), data: Buffer.alloc(0) }
}

// --- SMB_COM_READ_ANDX (0x2E) ----------------------------------------------

async function handleReadAndx(request: SmbMessage, session: SmbSession): Promise<SmbMessage> {
  const fid = request.params.readUInt16LE(2)
  const offsetLow = request.params.readUInt32LE(4)
  const maxCountLow = request.params.readUInt16LE(10)
  const handle = session.handles.get(fid)
  if (!handle) return errorResponse(request, NT_STATUS.INVALID_HANDLE)

  session.markActivity('transferring')
  const buffer = Buffer.alloc(maxCountLow)
  const fileHandle = await fs.open(handle.absolutePath, 'r')
  const { bytesRead } = await fileHandle
    .read(buffer, 0, maxCountLow, offsetLow)
    .finally(() => fileHandle.close())

  const params = Buffer.alloc(24)
  params.writeUInt8(0xff, 0)
  params.writeUInt8(0, 1)
  params.writeUInt16LE(0, 2)
  params.writeUInt16LE(0xffff, 4) // Remaining (unknown/not tracked)
  params.writeUInt16LE(0, 6) // DataCompactionMode
  params.writeUInt16LE(0, 8) // Reserved1
  params.writeUInt16LE(bytesRead, 10) // DataLength (low)
  params.writeUInt16LE(SMB_HEADER_SIZE + 1 + params.length + 2, 12) // DataOffset from start of SMB header
  params.writeUInt16LE(0, 14) // DataLength (high) — 0 for our sub-64KB reads

  return {
    header: { ...successHeader(request), tid: session.tid },
    params,
    data: buffer.subarray(0, bytesRead)
  }
}

// --- SMB_COM_WRITE_ANDX (0x2F) ---------------------------------------------

async function handleWriteAndx(request: SmbMessage, session: SmbSession): Promise<SmbMessage> {
  const fid = request.params.readUInt16LE(2)
  const offsetLow = request.params.readUInt32LE(4)
  const dataLength = request.params.readUInt16LE(20)
  const dataOffsetInPacket = request.params.readUInt16LE(22)
  const handle = session.handles.get(fid)
  if (!handle) return errorResponse(request, NT_STATUS.INVALID_HANDLE)

  if (!handle.writeLocked) {
    if (!tryAcquireWriteLock(handle.relativePath)) {
      session.reportWriteConflict(
        `Conflito de escrita: ${handle.relativePath} já está sendo modificado`
      )
      return errorResponse(request, NT_STATUS.SHARING_VIOLATION)
    }
    handle.writeLocked = true
  }
  session.markActivity('transferring')

  // dataOffsetInPacket is relative to the start of the SMB header; the raw
  // packet isn't available here, so the caller (dispatch) passes the
  // pre-sliced write payload as request.data instead of re-deriving offsets.
  const payload = request.data.subarray(0, dataLength)
  const fileHandle = await fs.open(handle.absolutePath, 'r+')
  try {
    await fileHandle.write(payload, 0, payload.length, offsetLow)
  } finally {
    await fileHandle.close()
  }
  void dataOffsetInPacket // documented above; unused once payload is pre-sliced

  const params = Buffer.alloc(12)
  params.writeUInt8(0xff, 0)
  params.writeUInt8(0, 1)
  params.writeUInt16LE(0, 2)
  params.writeUInt16LE(payload.length, 4) // Count
  params.writeUInt16LE(0xffff, 6) // Available
  params.writeUInt16LE(0, 8)
  params.writeUInt16LE(0, 10)

  return { header: { ...successHeader(request), tid: session.tid }, params, data: Buffer.alloc(0) }
}

// --- SMB_COM_TRANSACTION2 (0x32) / FIND_FIRST2 & FIND_NEXT2 ----------------

function encodeBothDirectoryEntry(name: string, stats: Stats, isLast: boolean): Buffer {
  const nameBytes = writeOemString(name).subarray(0, -1) // FileName is NOT null-terminated in this info level
  const fixed = Buffer.alloc(94) // fixed portion up to and including the 24-WCHAR ShortName field
  const entryLength = fixed.length + nameBytes.length
  const padding = (4 - (entryLength % 4)) % 4 // NextEntryOffset should keep entries 4-byte aligned
  fixed.writeUInt32LE(isLast ? 0 : entryLength + padding, 0) // NextEntryOffset
  fixed.writeUInt32LE(0, 4) // FileIndex
  writeFileTime(fixed, 8, stats.birthtime ?? new Date())
  writeFileTime(fixed, 16, stats.atime)
  writeFileTime(fixed, 24, stats.mtime)
  writeFileTime(fixed, 32, stats.ctime)
  fixed.writeBigUInt64LE(BigInt(stats.isDirectory() ? 0 : stats.size), 40) // EndOfFile
  fixed.writeBigUInt64LE(BigInt(Math.ceil(stats.size / 512) * 512), 48) // AllocationSize
  fixed.writeUInt32LE(statAttributes(stats), 56) // ExtFileAttributes
  fixed.writeUInt32LE(nameBytes.length, 60) // FileNameLength
  fixed.writeUInt32LE(0, 64) // EaSize
  fixed.writeUInt8(0, 68) // ShortNameLength
  fixed.writeUInt8(0, 69) // Reserved
  // ShortName[12 WCHARs] left zeroed (70..93) — no 8.3 short name provided.
  return Buffer.concat([fixed, nameBytes, Buffer.alloc(padding)])
}

async function listDirectoryEntries(
  absolutePath: string
): Promise<Array<{ name: string; stats: Stats }>> {
  const names = await fs.readdir(absolutePath)
  const entries: Array<{ name: string; stats: Stats }> = [
    { name: '.', stats: await fs.stat(absolutePath) },
    { name: '..', stats: await fs.stat(path.dirname(absolutePath)) }
  ]
  for (const name of names) {
    try {
      entries.push({ name, stats: await fs.stat(path.join(absolutePath, name)) })
    } catch {
      // Skip entries that vanish between readdir and stat (e.g. concurrent delete).
    }
  }
  return entries
}

function buildTrans2Response(
  request: SmbMessage,
  trans2Parameters: Buffer,
  trans2Data: Buffer
): SmbMessage {
  // Layout mirrors MS-CIFS SMB_COM_TRANSACTION2 response: 10-word header,
  // then Bytes = [Pad][Parameters][Pad2][Data], with ParameterOffset/
  // DataOffset expressed as absolute offsets from the start of the SMB header.
  const pad = 1 // single alignment pad byte before Parameters (OEM strings only, no 2-byte alignment need)
  const paramsStart = SMB_HEADER_SIZE + 1 + 20 + pad // header + wordCount + 10 words*2 + pad
  const dataStart = paramsStart + trans2Parameters.length

  const params = Buffer.alloc(20)
  params.writeUInt16LE(trans2Parameters.length, 0) // TotalParameterCount
  params.writeUInt16LE(trans2Data.length, 2) // TotalDataCount
  params.writeUInt16LE(0, 4) // Reserved
  params.writeUInt16LE(trans2Parameters.length, 6) // ParameterCount
  params.writeUInt16LE(paramsStart, 8) // ParameterOffset
  params.writeUInt16LE(0, 10) // ParameterDisplacement
  params.writeUInt16LE(trans2Data.length, 12) // DataCount
  params.writeUInt16LE(dataStart, 14) // DataOffset
  params.writeUInt16LE(0, 16) // DataDisplacement
  params.writeUInt8(0, 18) // SetupCount
  params.writeUInt8(0, 19) // Reserved2

  const bytes = Buffer.concat([Buffer.alloc(pad), trans2Parameters, trans2Data])
  return { header: { ...successHeader(request), tid: request.header.tid }, params, data: bytes }
}

async function handleFindFirst2(
  request: SmbMessage,
  session: SmbSession,
  trans2Params: Buffer,
  trans2Data: Buffer
): Promise<SmbMessage> {
  const searchCount = trans2Params.readUInt16LE(2)
  const informationLevel = trans2Params.readUInt16LE(6)
  const fileName = readOemString(trans2Data, 12).value // SearchAttributes(2)+SearchCount(2)+Flags(2)+InfoLevel(2)+SearchStorageType(4)=12

  if (informationLevel !== INFO_LEVEL.FIND_FILE_BOTH_DIRECTORY_INFO) {
    return errorResponse(request, NT_STATUS.NOT_IMPLEMENTED)
  }

  // fileName is a search pattern like "\DVD\*" — this server only supports
  // "list everything in this directory" (the '*'/'*.*' wildcard case), which
  // covers OPL's directory-browsing use; arbitrary glob matching is out of scope.
  const dirPath = fileName.replace(/\\[^\\]*$/, '') || '\\'
  let absoluteDir: string
  try {
    absoluteDir = resolveSharePath(session.libraryRootPath, dirPath)
  } catch {
    return errorResponse(request, NT_STATUS.OBJECT_NAME_NOT_FOUND)
  }

  session.markActivity('browsing')
  const allEntries = await listDirectoryEntries(absoluteDir)
  const sid = nextSid++
  const state: SearchState = { entries: allEntries, nextIndex: 0 }
  session.searches.set(sid, state)

  const page = allEntries.slice(0, searchCount)
  state.nextIndex = page.length
  const endOfSearch = state.nextIndex >= allEntries.length

  const entryBuffers = page.map((entry, index) =>
    encodeBothDirectoryEntry(entry.name, entry.stats, index === page.length - 1)
  )
  const dataBuffer = Buffer.concat(entryBuffers)

  const params = Buffer.alloc(10)
  params.writeUInt16LE(sid, 0)
  params.writeUInt16LE(page.length, 2)
  params.writeUInt16LE(endOfSearch ? 1 : 0, 4)
  params.writeUInt16LE(0, 6) // EaErrorOffset
  params.writeUInt16LE(
    entryBuffers.length ? dataBuffer.length - entryBuffers[entryBuffers.length - 1].length : 0,
    8
  ) // LastNameOffset

  return buildTrans2Response(request, params, dataBuffer)
}

async function handleFindNext2(
  request: SmbMessage,
  session: SmbSession,
  trans2Params: Buffer
): Promise<SmbMessage> {
  const sid = trans2Params.readUInt16LE(0)
  const searchCount = trans2Params.readUInt16LE(2)
  const state = session.searches.get(sid)
  if (!state) return errorResponse(request, NT_STATUS.INVALID_HANDLE)

  const page = state.entries.slice(state.nextIndex, state.nextIndex + searchCount)
  state.nextIndex += page.length
  const endOfSearch = state.nextIndex >= state.entries.length
  if (endOfSearch) session.searches.delete(sid)

  const entryBuffers = page.map((entry, index) =>
    encodeBothDirectoryEntry(entry.name, entry.stats, index === page.length - 1)
  )
  const dataBuffer = Buffer.concat(entryBuffers)

  const params = Buffer.alloc(8)
  params.writeUInt16LE(page.length, 0)
  params.writeUInt16LE(endOfSearch ? 1 : 0, 2)
  params.writeUInt16LE(0, 4)
  params.writeUInt16LE(
    entryBuffers.length ? dataBuffer.length - entryBuffers[entryBuffers.length - 1].length : 0,
    6
  )

  return buildTrans2Response(request, params, dataBuffer)
}

async function handleTransaction2(request: SmbMessage, session: SmbSession): Promise<SmbMessage> {
  const paramCount = request.params.readUInt16LE(9)
  const paramOffset = request.params.readUInt16LE(11)
  const dataCount = request.params.readUInt16LE(13)
  const dataOffset = request.params.readUInt16LE(15)
  const setupCount = request.params.readUInt8(19)
  const subcommand = setupCount > 0 ? request.params.readUInt16LE(22) : 0

  // Offsets are absolute from the start of the SMB header; request.data
  // already excludes header+wordcount+params+bytecount, so translate back.
  const dataStart = SMB_HEADER_SIZE + 1 + request.params.length + 2
  const trans2Params = request.data.subarray(
    paramOffset - dataStart,
    paramOffset - dataStart + paramCount
  )
  const trans2Data = request.data.subarray(
    dataOffset - dataStart,
    dataOffset - dataStart + dataCount
  )

  switch (subcommand) {
    case TRANS2_SUBCOMMAND.FIND_FIRST2:
      return handleFindFirst2(request, session, trans2Params, trans2Data)
    case TRANS2_SUBCOMMAND.FIND_NEXT2:
      return handleFindNext2(request, session, trans2Params)
    default:
      return errorResponse(request, NT_STATUS.NOT_IMPLEMENTED)
  }
}

// --- Dispatch ---------------------------------------------------------------

export async function dispatchSmbCommand(
  request: SmbMessage,
  session: SmbSession,
  libraryRootPath: string
): Promise<SmbMessage> {
  switch (request.header.command) {
    case SMB_COMMAND.NEGOTIATE:
      return handleNegotiate(request)
    case SMB_COMMAND.SESSION_SETUP_ANDX:
      return handleSessionSetup(request, session)
    case SMB_COMMAND.TREE_CONNECT_ANDX:
      return handleTreeConnect(request, session, libraryRootPath)
    case SMB_COMMAND.TREE_DISCONNECT:
      return handleTreeDisconnect(request, session)
    case SMB_COMMAND.LOGOFF_ANDX:
      return handleLogoff(request, session)
    case SMB_COMMAND.NT_CREATE_ANDX:
      return handleNtCreate(request, session)
    case SMB_COMMAND.CLOSE:
      return handleClose(request, session)
    case SMB_COMMAND.READ_ANDX:
      return handleReadAndx(request, session)
    case SMB_COMMAND.WRITE_ANDX:
      return handleWriteAndx(request, session)
    case SMB_COMMAND.TRANSACTION2:
      return handleTransaction2(request, session)
    case SMB_COMMAND.FIND_CLOSE2: {
      const sid = request.params.readUInt16LE(0)
      session.searches.delete(sid)
      return { header: successHeader(request), params: Buffer.alloc(0), data: Buffer.alloc(0) }
    }
    default:
      return errorResponse(request, NT_STATUS.NOT_IMPLEMENTED)
  }
}
