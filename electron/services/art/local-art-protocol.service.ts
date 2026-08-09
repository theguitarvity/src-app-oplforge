import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { protocol } from 'electron'
import { localArtIndex } from '../catalog/local-art-index.service'
import { captureSafeRoot, resolveInside } from '../persistence/safe-path.service'

export function registerLocalArtProtocol(): void {
  protocol.handle('opl-art', async (request) => {
    try {
      const url = new URL(request.url)
      const parts = url.pathname.split('/').filter(Boolean)
      if (url.hostname !== 'device' || parts.length !== 2)
        return new Response(null, { status: 404 })
      const record = localArtIndex.resolve(parts[1])
      if (!record || record.asset.validity !== 'valid') return new Response(null, { status: 404 })
      const expected = createHash('sha256')
        .update(record.snapshot.deviceId)
        .digest('hex')
        .slice(0, 16)
      if (parts[0] !== expected || Number(url.searchParams.get('rev')) !== record.snapshot.revision)
        return new Response(null, { status: 404 })
      const current = await captureSafeRoot(record.snapshot.root.real)
      if (
        current.device !== record.snapshot.root.device ||
        current.inode !== record.snapshot.root.inode
      )
        return new Response(null, { status: 410 })
      const bytes = await readFile(await resolveInside(current, record.asset.relativePath))
      return new Response(bytes, {
        headers: {
          'Content-Type': 'image/png',
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'private, max-age=3600'
        }
      })
    } catch {
      return new Response(null, { status: 404 })
    }
  })
}
