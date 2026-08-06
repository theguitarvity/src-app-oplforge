import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TorrentTransferService } from '@electron/services/downloads/torrent-transfer.service'

const roots: string[] = []
afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
)

describe('durable torrent recovery', () => {
  it('persists metadata and selection and rechecks pieces after restart', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'torrent-recovery-'))
    roots.push(root)
    const file = path.join(root, 'torrents.json')
    const first = new TorrentTransferService(file)
    await first.remember({
      taskId: 't1',
      magnet: 'magnet:?xt=urn:btih:abc',
      infoHash: 'abc',
      selectedFiles: ['GAME.iso']
    })
    const recheck = vi.fn().mockResolvedValue({ verifiedBytes: 999 })
    const second = new TorrentTransferService(file)
    const recovered = await second.recover('t1', { recheck })
    expect(recheck).toHaveBeenCalledWith(
      expect.objectContaining({ infoHash: 'abc', selectedFiles: ['GAME.iso'] })
    )
    expect(recovered).toMatchObject({ verifiedBytes: 999, infoHash: 'abc' })
  })
})
