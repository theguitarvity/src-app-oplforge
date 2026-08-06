import { createHash } from 'node:crypto'
import { access, mkdir, rename, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { HttpTransferService } from '../downloads/http-transfer.service'

interface CacheEntry {
  path: string
  bytes: number
  lastUsed: number
  references: number
}

export class ArtCacheService {
  private readonly entries = new Map<string, CacheEntry>()
  private readonly flights = new Map<string, Promise<string>>()
  private readonly transfer = new HttpTransferService()

  constructor(
    private readonly root: string,
    private readonly quotaBytes: number
  ) {}

  async get(key: string, url: string): Promise<string> {
    const existing = this.entries.get(key)
    if (
      existing &&
      (await access(existing.path).then(
        () => true,
        () => false
      ))
    ) {
      existing.lastUsed = Date.now()
      return existing.path
    }
    const flight = this.flights.get(key)
    if (flight) return flight
    const started = this.download(key, url).finally(() => this.flights.delete(key))
    this.flights.set(key, started)
    return started
  }

  async withReference<T>(
    key: string,
    url: string,
    consume: (filePath: string) => Promise<T>
  ): Promise<T> {
    const filePath = await this.get(key, url)
    const entry = this.entries.get(key)!
    entry.references += 1
    try {
      return await consume(filePath)
    } finally {
      entry.references -= 1
      entry.lastUsed = Date.now()
    }
  }

  totalBytes(): number {
    return [...this.entries.values()].reduce((sum, entry) => sum + entry.bytes, 0)
  }

  private async download(key: string, url: string): Promise<string> {
    await mkdir(this.root, { recursive: true })
    const safeKey = createHash('sha256').update(key).digest('hex')
    const finalPath = path.join(this.root, safeKey)
    const partialPath = `${finalPath}.part`
    await this.transfer.transfer({ url, partPath: partialPath })
    await rename(partialPath, finalPath)
    const bytes = (await stat(finalPath)).size
    this.entries.set(key, { path: finalPath, bytes, lastUsed: Date.now(), references: 0 })
    await this.evict(key)
    return finalPath
  }

  private async evict(protectedKey: string): Promise<void> {
    const candidates = [...this.entries.entries()]
      .filter(([key, entry]) => key !== protectedKey && entry.references === 0)
      .sort((left, right) => left[1].lastUsed - right[1].lastUsed)
    while (this.totalBytes() > this.quotaBytes && candidates.length) {
      const [key, entry] = candidates.shift()!
      await rm(entry.path, { force: true })
      this.entries.delete(key)
    }
  }
}
