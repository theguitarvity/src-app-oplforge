import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { HttpTransferService } from '@electron/services/downloads/http-transfer.service'
import { startFixtureHttpServer, type FixtureHttpServerOptions } from '../fixtures/http/server'

const roots: string[] = []
afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
)

describe('durable HTTP recovery', () => {
  it('reuses at least 99% confirmed bytes after a disconnect and service restart', async () => {
    const body = Buffer.alloc(100_000, 0x5a)
    const options: FixtureHttpServerOptions = {
      body,
      etag: '"stable"',
      disconnectAfterBytes: 99_000
    }
    const server = await startFixtureHttpServer(options)
    const root = await mkdtemp(path.join(os.tmpdir(), 'durable-http-'))
    roots.push(root)
    const partPath = path.join(root, 'payload.part')
    await expect(
      new HttpTransferService().transfer({ url: server.url, partPath })
    ).rejects.toBeTruthy()
    const confirmed = (await stat(partPath)).size
    expect(confirmed).toBeGreaterThanOrEqual(body.length * 0.99)
    options.disconnectAfterBytes = undefined
    const result = await new HttpTransferService().transfer({
      url: server.url,
      partPath,
      checkpoint: { bytesConfirmed: confirmed, etag: '"stable"' }
    })
    expect(result.resumedBytes).toBe(confirmed)
    expect(await readFile(partPath)).toEqual(body)
    await server.close()
  })
})
