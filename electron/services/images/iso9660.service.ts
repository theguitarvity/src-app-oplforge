import { open, type FileHandle } from 'node:fs/promises'
import { normalizeGameId } from './game-naming.service'

const SECTOR_BYTES = 2048

export interface RandomAccessReader {
  readonly size: number
  read(offset: number, length: number): Promise<Buffer>
  close?(): Promise<void>
}

export interface IsoInspection {
  valid: boolean
  gameId: string | null
  media: 'CD' | 'DVD' | null
  logicalBytes: number
  evidence: string[]
}

class FileRandomAccessReader implements RandomAccessReader {
  constructor(
    private readonly handle: FileHandle,
    readonly size: number
  ) {}
  async read(offset: number, length: number): Promise<Buffer> {
    const available = Math.max(0, Math.min(length, this.size - offset))
    const buffer = Buffer.alloc(available)
    const { bytesRead } = await this.handle.read(buffer, 0, available, offset)
    return buffer.subarray(0, bytesRead)
  }
  async close(): Promise<void> {
    await this.handle.close()
  }
}

interface DirectoryEntry {
  name: string
  extent: number
  bytes: number
  directory: boolean
}

function parseDirectory(buffer: Buffer): DirectoryEntry[] {
  const entries: DirectoryEntry[] = []
  let offset = 0
  while (offset < buffer.length) {
    const length = buffer[offset]
    if (!length) {
      offset = Math.ceil((offset + 1) / SECTOR_BYTES) * SECTOR_BYTES
      continue
    }
    if (length < 34 || offset + length > buffer.length) break
    const nameLength = buffer[offset + 32]
    const rawName = buffer.subarray(offset + 33, offset + 33 + nameLength)
    const special = nameLength === 1 && (rawName[0] === 0 || rawName[0] === 1)
    if (!special)
      entries.push({
        name: rawName.toString('ascii').replace(/;\d+$/, '').toUpperCase(),
        extent: buffer.readUInt32LE(offset + 2),
        bytes: buffer.readUInt32LE(offset + 10),
        directory: (buffer[offset + 25] & 2) !== 0
      })
    offset += length
  }
  return entries
}

async function findSystemCnf(
  reader: RandomAccessReader,
  root: DirectoryEntry
): Promise<Buffer | undefined> {
  const pending = [root]
  const visited = new Set<number>()
  while (pending.length) {
    const directory = pending.shift()!
    if (visited.has(directory.extent) || visited.size > 1024) continue
    visited.add(directory.extent)
    const bytes = await reader.read(
      directory.extent * SECTOR_BYTES,
      Math.min(directory.bytes, 16 * 1024 * 1024)
    )
    for (const entry of parseDirectory(bytes)) {
      if (entry.name === 'SYSTEM.CNF' && !entry.directory)
        return reader.read(entry.extent * SECTOR_BYTES, Math.min(entry.bytes, 64 * 1024))
      if (entry.directory) pending.push(entry)
    }
  }
  return undefined
}

function bootGameId(systemCnf: Buffer | undefined): string | null {
  if (!systemCnf) return null
  const text = systemCnf.toString('latin1')
  const boot = text.match(/^\s*BOOT2?\s*=\s*cdrom0:\\+([^;\r\n]+)(?:;\d+)?/im)
  return normalizeGameId(boot?.[1] ?? '')
}

export async function inspectIsoReader(reader: RandomAccessReader): Promise<IsoInspection> {
  const pvd = await reader.read(16 * SECTOR_BYTES, SECTOR_BYTES)
  if (pvd.length !== SECTOR_BYTES || pvd[0] !== 1 || pvd.toString('ascii', 1, 6) !== 'CD001') {
    return {
      valid: false,
      gameId: null,
      media: null,
      logicalBytes: reader.size,
      evidence: ['missing ISO9660 primary volume descriptor']
    }
  }
  const sectors = pvd.readUInt32LE(80)
  const logicalBytes = sectors > 0 ? sectors * SECTOR_BYTES : reader.size
  const rootLength = pvd[156]
  let systemCnf: Buffer | undefined
  if (rootLength >= 34) {
    const root: DirectoryEntry = {
      name: '/',
      extent: pvd.readUInt32LE(158),
      bytes: pvd.readUInt32LE(166),
      directory: true
    }
    systemCnf = await findSystemCnf(reader, root)
  }
  if (!systemCnf) {
    const legacyProbe = await reader.read(0, Math.min(reader.size, 4 * 1024 * 1024))
    const match = legacyProbe
      .toString('latin1')
      .match(/BOOT2?\s*=\s*cdrom0:\\+([^;\r\n]+)(?:;\d+)?/i)
    if (match) systemCnf = Buffer.from(match[0], 'latin1')
  }
  const gameId = bootGameId(systemCnf)
  return {
    valid: true,
    gameId,
    media: logicalBytes <= 900 * 1024 * 1024 ? 'CD' : 'DVD',
    logicalBytes,
    evidence: [
      'ISO9660 PVD valid',
      systemCnf ? 'SYSTEM.CNF read by ISO9660 extent' : 'SYSTEM.CNF not found',
      gameId ? 'SYSTEM.CNF boot identifier found' : 'Game ID not found'
    ]
  }
}

export async function inspectIso(filePath: string): Promise<IsoInspection> {
  const handle = await open(filePath, 'r')
  const stat = await handle.stat()
  if (!stat.isFile()) {
    await handle.close()
    throw Object.assign(new Error('Source is not a regular file'), { code: 'INVALID_SOURCE' })
  }
  const reader = new FileRandomAccessReader(handle, stat.size)
  try {
    return await inspectIsoReader(reader)
  } finally {
    await reader.close()
  }
}
