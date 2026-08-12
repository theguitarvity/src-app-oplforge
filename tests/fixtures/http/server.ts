import { createServer, type Server } from 'node:http'
import { once } from 'node:events'

export interface FixtureHttpServerOptions {
  body: Buffer
  etag?: string
  lastModified?: string
  supportRange?: boolean
  disconnectAfterBytes?: number
  delayMs?: number
  chunkBytes?: number
  chunkDelayMs?: number
}

export interface FixtureHttpServer {
  url: string
  requests: Array<{ range?: string; ifRange?: string }>
  close(): Promise<void>
}

export async function startFixtureHttpServer(
  options: FixtureHttpServerOptions
): Promise<FixtureHttpServer> {
  const requests: FixtureHttpServer['requests'] = []
  const server: Server = createServer(async (request, response) => {
    const range = request.headers.range
    const rawIfRange = request.headers['if-range']
    const ifRange = Array.isArray(rawIfRange) ? rawIfRange[0] : rawIfRange
    requests.push({ range, ifRange })
    if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs))

    const headers: Record<string, string> = {
      'Accept-Ranges': options.supportRange === false ? 'none' : 'bytes',
      'Content-Type': 'application/octet-stream',
      ETag: options.etag ?? '"fixture-v1"',
      'Last-Modified': options.lastModified ?? 'Wed, 01 Jan 2025 00:00:00 GMT'
    }
    let body = options.body
    const validator = options.etag ?? '"fixture-v1"'
    if (
      options.supportRange !== false &&
      range &&
      (!ifRange || ifRange === validator || ifRange === options.lastModified)
    ) {
      const match = /^bytes=(\d+)-$/.exec(range)
      if (!match || Number(match[1]) >= body.length) {
        response.writeHead(416, { ...headers, 'Content-Range': `bytes */${body.length}` })
        response.end()
        return
      }
      const start = Number(match[1])
      body = body.subarray(start)
      headers['Content-Range'] = `bytes ${start}-${options.body.length - 1}/${options.body.length}`
      headers['Content-Length'] = String(body.length)
      response.writeHead(206, headers)
    } else {
      if (options.disconnectAfterBytes === undefined) {
        headers['Content-Length'] = String(body.length)
      }
      response.writeHead(200, headers)
    }

    if (options.disconnectAfterBytes !== undefined) {
      const partialBody = body.subarray(0, options.disconnectAfterBytes)
      response.write(partialBody, () => {
        // Close only after Node has flushed the partial response. Destroying on a
        // short timer races with busy CI runners and can reset the connection
        // before the client receives any resumable bytes.
        response.socket?.end()
      })
      return
    }
    if (options.chunkBytes && options.chunkDelayMs) {
      for (let offset = 0; offset < body.length; offset += options.chunkBytes) {
        response.write(body.subarray(offset, offset + options.chunkBytes))
        await new Promise((resolve) => setTimeout(resolve, options.chunkDelayMs))
      }
      response.end()
      return
    }
    response.end(body)
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Fixture HTTP server did not bind a TCP port')
  return {
    url: `http://127.0.0.1:${address.port}/payload.iso`,
    requests,
    close: async () => {
      server.close()
      await once(server, 'close')
    }
  }
}
