import { createWriteStream } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import * as yauzl from 'yauzl'

export interface ArtArchiveLimits {
  maxEntries?: number
  maxEntryBytes?: number
  maxTotalBytes?: number
  maxCompressionRatio?: number
}

export class ArtArchiveService {
  private readonly limits: Required<ArtArchiveLimits>
  constructor(limits: ArtArchiveLimits = {}) {
    this.limits = {
      maxEntries: limits.maxEntries ?? 20_000,
      maxEntryBytes: limits.maxEntryBytes ?? 16 * 1024 * 1024,
      maxTotalBytes: limits.maxTotalBytes ?? 2 * 1024 * 1024 * 1024,
      maxCompressionRatio: limits.maxCompressionRatio ?? 200
    }
  }

  async list(archivePath: string): Promise<string[]> {
    const entries = await this.entries(archivePath)
    return entries.map((entry) => entry.fileName)
  }

  async extract(archivePath: string, wantedName: string, destination: string): Promise<void> {
    const zip = await this.open(archivePath)
    try {
      const entry = await this.findEntry(zip, wantedName)
      this.assertEntry(entry, 0)
      await mkdir(path.dirname(destination), { recursive: true })
      const temporary = `${destination}.part`
      const stream = await new Promise<NodeJS.ReadableStream>((resolve, reject) =>
        zip.openReadStream(entry, (error, opened) =>
          error || !opened ? reject(error ?? new Error('ZIP stream unavailable')) : resolve(opened)
        )
      )
      try {
        await pipeline(stream, createWriteStream(temporary, { flags: 'wx', mode: 0o600 }))
        const { rename } = await import('node:fs/promises')
        await rename(temporary, destination)
      } catch (error) {
        await rm(temporary, { force: true })
        throw error
      }
    } finally {
      zip.close()
    }
  }

  private async entries(archivePath: string): Promise<yauzl.Entry[]> {
    const zip = await this.open(archivePath)
    return new Promise((resolve, reject) => {
      const entries: yauzl.Entry[] = []
      let total = 0
      const fail = (error: unknown) => {
        zip.close()
        reject(this.unsafe(error))
      }
      zip.on('error', fail)
      zip.on('entry', (entry: yauzl.Entry) => {
        try {
          total += entry.uncompressedSize
          this.assertEntry(entry, total)
          entries.push(entry)
          zip.readEntry()
        } catch (error) {
          fail(error)
        }
      })
      zip.on('end', () => {
        zip.close()
        resolve(entries)
      })
      zip.readEntry()
    })
  }

  private open(archivePath: string): Promise<yauzl.ZipFile> {
    return new Promise((resolve, reject) =>
      yauzl.open(
        archivePath,
        { lazyEntries: true, decodeStrings: true, validateEntrySizes: true },
        (error, zip) => (error || !zip ? reject(this.unsafe(error)) : resolve(zip))
      )
    )
  }

  private findEntry(zip: yauzl.ZipFile, wantedName: string): Promise<yauzl.Entry> {
    return new Promise((resolve, reject) => {
      zip.on('error', (error) => reject(this.unsafe(error)))
      zip.on('entry', (entry: yauzl.Entry) => {
        if (entry.fileName === wantedName) resolve(entry)
        else zip.readEntry()
      })
      zip.on('end', () =>
        reject(
          Object.assign(new Error('Artwork entry missing from ZIP'), {
            code: 'ART_ARCHIVE_ENTRY_MISSING'
          })
        )
      )
      zip.readEntry()
    })
  }

  private assertEntry(entry: yauzl.Entry, total: number): void {
    const normalized = path.posix.normalize(entry.fileName.replace(/\\/g, '/'))
    const mode = entry.externalFileAttributes >>> 16
    if (
      path.posix.isAbsolute(normalized) ||
      normalized === '..' ||
      normalized.startsWith('../') ||
      (mode & 0o170000) === 0o120000
    )
      throw new Error('ZIP entry escapes destination or is a symlink')
    if (entry.uncompressedSize > this.limits.maxEntryBytes || total > this.limits.maxTotalBytes)
      throw new Error('ZIP entry exceeds size limits')
    if (
      entry.compressedSize > 0 &&
      entry.uncompressedSize / entry.compressedSize > this.limits.maxCompressionRatio
    )
      throw new Error('ZIP entry exceeds compression ratio')
  }

  private unsafe(cause: unknown): Error {
    return Object.assign(new Error('Unsafe artwork archive'), { code: 'UNSAFE_ART_ARCHIVE', cause })
  }
}
