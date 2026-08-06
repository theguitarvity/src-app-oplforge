import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { HttpTransferService } from '@electron/services/downloads/http-transfer.service'
import { startFixtureHttpServer, type FixtureHttpServer } from '../fixtures/http/server'

const roots: string[] = []
const servers: FixtureHttpServer[] = []
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()))
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function target(prefix = Buffer.alloc(0)) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'http-resume-'))
  roots.push(root)
  const partPath = path.join(root, 'payload.part')
  await writeFile(partPath, prefix)
  return partPath
}

describe('HttpTransferService', () => {
  it('resumes a valid partial with Range and If-Range', async () => {
    const body = Buffer.alloc(64 * 1024, 7)
    const server = await startFixtureHttpServer({ body, etag: '"v1"' })
    servers.push(server)
    const partPath = await target(body.subarray(0, 4096))
    const result = await new HttpTransferService().transfer({
      url: server.url,
      partPath,
      checkpoint: { bytesConfirmed: 4096, etag: '"v1"' }
    })
    expect(await readFile(partPath)).toEqual(body)
    expect(server.requests[0]).toEqual({ range: 'bytes=4096-', ifRange: '"v1"' })
    expect(result.resumedBytes).toBe(4096)
  })

  it('restarts safely when Range is ignored or the validator changed', async () => {
    const body = Buffer.alloc(8192, 3)
    const server = await startFixtureHttpServer({ body, etag: '"v2"', supportRange: false })
    servers.push(server)
    const partPath = await target(Buffer.alloc(1000, 9))
    const result = await new HttpTransferService().transfer({
      url: server.url,
      partPath,
      checkpoint: { bytesConfirmed: 1000, etag: '"v1"' }
    })
    expect(await readFile(partPath)).toEqual(body)
    expect(result.resumedBytes).toBe(0)
  })

  it('accepts HTTP 416 when the cached file is already complete', async () => {
    const body = Buffer.alloc(4096, 4)
    const server = await startFixtureHttpServer({ body, etag: '"v1"' })
    servers.push(server)
    const partPath = await target(body)
    const result = await new HttpTransferService().transfer({
      url: server.url,
      partPath,
      checkpoint: { bytesConfirmed: body.length, etag: '"v1"' }
    })
    expect(result).toMatchObject({
      bytesConfirmed: body.length,
      totalBytes: body.length,
      resumedBytes: body.length
    })
    expect(await readFile(partPath)).toEqual(body)
  })

  it('aborts delayed transfers with an actionable timeout', async () => {
    const server = await startFixtureHttpServer({ body: Buffer.alloc(1024), delayMs: 100 })
    servers.push(server)
    await expect(
      new HttpTransferService().transfer({
        url: server.url,
        partPath: await target(),
        timeoutMs: 10
      })
    ).rejects.toMatchObject({ code: 'TRANSFER_TIMEOUT' })
  })

  it('does not time out a long transfer while bytes keep arriving', async () => {
    const body = Buffer.alloc(8 * 1024, 5)
    const server = await startFixtureHttpServer({ body, chunkBytes: 1024, chunkDelayMs: 10 })
    servers.push(server)
    const partPath = await target()
    const result = await new HttpTransferService().transfer({
      url: server.url,
      partPath,
      timeoutMs: 30
    })
    expect(result.bytesConfirmed).toBe(body.length)
    expect(await readFile(partPath)).toEqual(body)
  })
})
