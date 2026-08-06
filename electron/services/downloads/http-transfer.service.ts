import { createWriteStream } from 'node:fs'
import { mkdir, open, stat } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

export interface HttpTransferInput {
  url: string
  partPath: string
  checkpoint?: { bytesConfirmed: number; etag?: string; lastModified?: string }
  timeoutMs?: number
  signal?: AbortSignal
  onProgress?: (bytesConfirmed: number, totalBytes?: number) => void
}

export interface HttpTransferResult {
  bytesConfirmed: number
  totalBytes?: number
  resumedBytes: number
  etag?: string
  lastModified?: string
}

export class HttpTransferService {
  async transfer(input: HttpTransferInput): Promise<HttpTransferResult> {
    await mkdir(path.dirname(input.partPath), { recursive: true })
    const existing = await stat(input.partPath).then(
      (value) => value.size,
      () => 0
    )
    const requestedOffset = Math.min(existing, input.checkpoint?.bytesConfirmed ?? existing)
    const controller = new AbortController()
    const timeoutMs = input.timeoutMs ?? 120_000
    let timeout: ReturnType<typeof setTimeout> | undefined
    const armInactivityTimeout = () => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(
        () =>
          controller.abort(
            Object.assign(new Error('HTTP transfer timed out due to inactivity'), {
              code: 'TRANSFER_TIMEOUT'
            })
          ),
        timeoutMs
      )
    }
    armInactivityTimeout()
    const abort = () => controller.abort(input.signal?.reason)
    input.signal?.addEventListener('abort', abort, { once: true })
    try {
      const headers: Record<string, string> = {}
      if (requestedOffset > 0) {
        headers.Range = `bytes=${requestedOffset}-`
        const validator = input.checkpoint?.etag ?? input.checkpoint?.lastModified
        if (validator) headers['If-Range'] = validator
      }
      const response = await fetch(input.url, { headers, signal: controller.signal })
      if (response.status === 416 && requestedOffset > 0) {
        const total = Number(
          /bytes \*\/(\d+)/i.exec(response.headers.get('content-range') ?? '')?.[1]
        )
        if (Number.isFinite(total) && total === requestedOffset && existing === requestedOffset)
          return {
            bytesConfirmed: existing,
            totalBytes: total,
            resumedBytes: existing,
            etag: input.checkpoint?.etag,
            lastModified: input.checkpoint?.lastModified
          }
      }
      if (!response.ok || !response.body)
        throw Object.assign(new Error(`HTTP transfer failed with ${response.status}`), {
          code: 'HTTP_ERROR',
          status: response.status
        })
      const resumed = response.status === 206
      if (
        resumed &&
        !response.headers.get('content-range')?.startsWith(`bytes ${requestedOffset}-`)
      )
        throw Object.assign(new Error('HTTP Range response is incoherent'), {
          code: 'INVALID_RANGE_RESPONSE'
        })
      const resumedBytes = resumed ? requestedOffset : 0
      const contentBytes = Number(response.headers.get('content-length') ?? 0) || undefined
      const totalBytes = resumed && contentBytes ? resumedBytes + contentBytes : contentBytes
      let confirmed = resumedBytes
      let lastProgressAt = 0
      let lastReportedBytes = resumedBytes
      const body = Readable.fromWeb(
        response.body as unknown as Parameters<typeof Readable.fromWeb>[0]
      )
      body.on('data', (chunk: Buffer) => {
        confirmed += chunk.length
        armInactivityTimeout()
        const now = Date.now()
        if (now - lastProgressAt >= 250) {
          lastProgressAt = now
          lastReportedBytes = confirmed
          input.onProgress?.(confirmed, totalBytes)
        }
      })
      await pipeline(
        body,
        createWriteStream(input.partPath, {
          flags: resumed ? 'a' : 'w',
          mode: 0o600,
          start: resumed ? undefined : 0
        })
      )
      if (confirmed !== lastReportedBytes) input.onProgress?.(confirmed, totalBytes)
      const handle = await open(input.partPath, 'r+')
      try {
        await handle.sync()
      } finally {
        await handle.close()
      }
      return {
        bytesConfirmed: confirmed,
        totalBytes,
        resumedBytes,
        etag: response.headers.get('etag') ?? undefined,
        lastModified: response.headers.get('last-modified') ?? undefined
      }
    } catch (error) {
      if (controller.signal.aborted && !input.signal?.aborted)
        throw Object.assign(new Error('HTTP transfer timed out'), {
          code: 'TRANSFER_TIMEOUT',
          cause: error
        })
      if (input.signal?.aborted)
        throw Object.assign(new Error('HTTP transfer aborted'), {
          code: 'TRANSFER_ABORTED',
          cause: error
        })
      throw error
    } finally {
      if (timeout) clearTimeout(timeout)
      input.signal?.removeEventListener('abort', abort)
    }
  }
}
