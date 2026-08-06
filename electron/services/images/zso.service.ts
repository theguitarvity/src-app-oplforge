import { open, type FileHandle } from 'node:fs/promises'
import type { RandomAccessReader } from './iso9660.service'

export interface ZsoHeader {
  headerSize: number
  totalBytes: bigint
  blockSize: number
  align: number
  blocks: number
}

export async function readZsoHeader(filePath: string): Promise<ZsoHeader> {
  const handle = await open(filePath, 'r')
  try {
    const header = Buffer.alloc(24)
    if (
      (await handle.read(header, 0, 24, 0)).bytesRead !== 24 ||
      header.toString('ascii', 0, 4) !== 'ZISO'
    )
      throw Object.assign(new Error('Invalid ZSO header'), { code: 'INVALID_ZSO' })
    const parsed = {
      headerSize: header.readUInt32LE(4),
      totalBytes: header.readBigUInt64LE(8),
      blockSize: header.readUInt32LE(16),
      align: header[20],
      blocks: 0
    }
    if (
      parsed.headerSize < 24 ||
      parsed.blockSize < 512 ||
      parsed.blockSize > 1024 * 1024 ||
      parsed.totalBytes === 0n
    )
      throw Object.assign(new Error('Invalid ZSO geometry'), { code: 'INVALID_ZSO' })
    parsed.blocks = Number(
      (parsed.totalBytes + BigInt(parsed.blockSize) - 1n) / BigInt(parsed.blockSize)
    )
    const stat = await handle.stat()
    if (stat.size < parsed.headerSize + (parsed.blocks + 1) * 4)
      throw Object.assign(new Error('Truncated ZSO index'), { code: 'INCOMPLETE_ZSO' })
    return parsed
  } finally {
    await handle.close()
  }
}

function decodeLz4(source: Buffer, expectedBytes: number): Buffer {
  const output = Buffer.alloc(expectedBytes)
  let input = 0
  let written = 0
  while (input < source.length && written < expectedBytes) {
    const token = source[input++]
    let literals = token >>> 4
    if (literals === 15) {
      let value = 255
      while (value === 255) {
        value = source[input++]
        literals += value
      }
    }
    source.copy(output, written, input, input + literals)
    input += literals
    written += literals
    if (input >= source.length) break
    const offset = source.readUInt16LE(input)
    input += 2
    if (!offset || offset > written)
      throw Object.assign(new Error('Invalid LZ4 offset'), { code: 'INVALID_ZSO' })
    let match = token & 15
    if (match === 15) {
      let value = 255
      while (value === 255) {
        value = source[input++]
        match += value
      }
    }
    match += 4
    for (let index = 0; index < match && written < expectedBytes; index++)
      output[written] = output[written++ - offset]
  }
  if (written !== expectedBytes)
    throw Object.assign(new Error('Truncated LZ4 block'), { code: 'INCOMPLETE_ZSO' })
  return output
}

export async function readZsoBlock(filePath: string, block: number): Promise<Buffer> {
  const header = await readZsoHeader(filePath)
  if (block < 0 || block >= header.blocks) throw new RangeError('ZSO block outside image')
  const handle = await open(filePath, 'r')
  try {
    const index = Buffer.alloc(8)
    await handle.read(index, 0, 8, header.headerSize + block * 4)
    const current = index.readUInt32LE(0)
    const next = index.readUInt32LE(4)
    const offset = (current & 0x7fffffff) * (1 << header.align)
    const length = Math.min(header.blockSize, (next & 0x7fffffff) * (1 << header.align) - offset)
    if (length <= 0)
      throw Object.assign(new Error('Invalid ZSO block index'), { code: 'INVALID_ZSO' })
    const buffer = Buffer.alloc(length)
    await handle.read(buffer, 0, length, offset)
    if ((current & 0x80000000) !== 0) return buffer
    return decodeLz4(
      buffer,
      Math.min(header.blockSize, Number(header.totalBytes) - block * header.blockSize)
    )
  } finally {
    await handle.close()
  }
}

class ZsoRandomAccessReader implements RandomAccessReader {
  readonly size: number
  private readonly cache = new Map<number, Buffer>()

  constructor(
    private readonly handle: FileHandle,
    private readonly header: ZsoHeader
  ) {
    this.size = Number(header.totalBytes)
    if (!Number.isSafeInteger(this.size))
      throw Object.assign(new Error('ZSO logical size is not safely addressable'), {
        code: 'INVALID_ZSO'
      })
  }

  async read(offset: number, length: number): Promise<Buffer> {
    if (!Number.isInteger(offset) || !Number.isInteger(length) || offset < 0 || length < 0)
      throw new RangeError('Invalid ZSO read range')
    const end = Math.min(this.size, offset + length)
    if (offset >= end) return Buffer.alloc(0)
    const output = Buffer.alloc(end - offset)
    let outputOffset = 0
    let position = offset
    while (position < end) {
      const blockIndex = Math.floor(position / this.header.blockSize)
      const block = await this.block(blockIndex)
      const within = position % this.header.blockSize
      const bytes = Math.min(block.length - within, end - position)
      if (bytes <= 0)
        throw Object.assign(new Error('Truncated ZSO logical block'), { code: 'INCOMPLETE_ZSO' })
      block.copy(output, outputOffset, within, within + bytes)
      outputOffset += bytes
      position += bytes
    }
    return output
  }

  async close(): Promise<void> {
    this.cache.clear()
    await this.handle.close()
  }

  private async block(index: number): Promise<Buffer> {
    const cached = this.cache.get(index)
    if (cached) return cached
    const table = Buffer.alloc(8)
    const tableRead = await this.handle.read(table, 0, 8, this.header.headerSize + index * 4)
    if (tableRead.bytesRead !== 8)
      throw Object.assign(new Error('Truncated ZSO index'), { code: 'INCOMPLETE_ZSO' })
    const current = table.readUInt32LE(0)
    const next = table.readUInt32LE(4)
    const multiplier = 2 ** this.header.align
    const physicalOffset = (current & 0x7fffffff) * multiplier
    const nextOffset = (next & 0x7fffffff) * multiplier
    const physicalBytes = nextOffset - physicalOffset
    if (physicalBytes <= 0 || physicalBytes > this.header.blockSize + 64 * 1024)
      throw Object.assign(new Error('Invalid ZSO block index'), { code: 'INVALID_ZSO' })
    const encoded = Buffer.alloc(physicalBytes)
    const result = await this.handle.read(encoded, 0, physicalBytes, physicalOffset)
    if (result.bytesRead !== physicalBytes)
      throw Object.assign(new Error('Truncated ZSO block'), { code: 'INCOMPLETE_ZSO' })
    const expected = Math.min(this.header.blockSize, this.size - index * this.header.blockSize)
    const decoded =
      (current & 0x80000000) !== 0 ? encoded.subarray(0, expected) : decodeLz4(encoded, expected)
    if (this.cache.size >= 8) this.cache.delete(this.cache.keys().next().value!)
    this.cache.set(index, decoded)
    return decoded
  }
}

export async function createZsoReader(filePath: string): Promise<RandomAccessReader> {
  const header = await readZsoHeader(filePath)
  const handle = await open(filePath, 'r')
  return new ZsoRandomAccessReader(handle, header)
}
