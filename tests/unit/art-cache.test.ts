import { access, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ArtCacheService } from '@electron/services/art/art-cache.service'
import { startFixtureHttpServer } from '../fixtures/http/server'

const roots: string[] = []
const close: Array<() => Promise<void>> = []
afterEach(async () => {
  await Promise.all(close.splice(0).map((fn) => fn()))
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('ArtCacheService', () => {
  it('streams through .part and single-flights concurrent consumers', async () => {
    const server = await startFixtureHttpServer({
      body: Buffer.alloc(64 * 1024, 7),
      etag: '"art-v1"'
    })
    close.push(server.close)
    const root = await mkdtemp(path.join(os.tmpdir(), 'art-cache-'))
    roots.push(root)
    const cache = new ArtCacheService(root, 1024 * 1024)
    const [first, second] = await Promise.all([
      cache.get('shared', server.url),
      cache.get('shared', server.url)
    ])
    expect(first).toBe(second)
    expect(server.requests).toHaveLength(1)
    await expect(access(`${first}.part`)).rejects.toBeTruthy()
  })

  it('evicts least-recent inactive entries to respect quota', async () => {
    const one = await startFixtureHttpServer({ body: Buffer.alloc(700, 1) })
    const two = await startFixtureHttpServer({ body: Buffer.alloc(700, 2) })
    close.push(one.close, two.close)
    const root = await mkdtemp(path.join(os.tmpdir(), 'art-lru-'))
    roots.push(root)
    const cache = new ArtCacheService(root, 1000)
    const oldPath = await cache.get('old', one.url)
    await cache.get('new', two.url)
    await expect(access(oldPath)).rejects.toBeTruthy()
    expect(cache.totalBytes()).toBeLessThanOrEqual(1000)
  })
})
