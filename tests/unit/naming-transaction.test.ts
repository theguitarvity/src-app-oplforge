import { createHash } from 'node:crypto'
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { NamingTransactionService } from '@electron/services/naming/naming-transaction.service'

const roots: string[] = []
afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
)
describe('NamingTransactionService', () => {
  it('journals a temp rename and preserves content hash', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'naming-tx-'))
    roots.push(root)
    const { mkdir } = await import('node:fs/promises')
    await mkdir(path.join(root, 'DVD'))
    await mkdir(path.join(root, '.oplforge-staging'))
    const bytes = Buffer.from('game-image')
    const from = 'DVD/wrong.iso'
    const to = 'DVD/SLUS_123.45.Game.iso'
    await writeFile(path.join(root, from), bytes)
    const result = await new NamingTransactionService().execute(root, 'operation-1', [
      {
        itemId: 'i1',
        fromRelativePath: from,
        temporaryRelativePath: 'DVD/.oplforge-rename-i1.tmp',
        toRelativePath: to,
        expectedSha256: createHash('sha256').update(bytes).digest('hex')
      }
    ])
    expect(result.items[0].state).toBe('renamed')
    expect(await readFile(path.join(root, to))).toEqual(bytes)
    await expect(access(path.join(root, from))).rejects.toBeTruthy()
  })

  it('rejects a stale fingerprint without changing the source', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'naming-stale-'))
    roots.push(root)
    const { mkdir } = await import('node:fs/promises')
    await mkdir(path.join(root, 'DVD'))
    await writeFile(path.join(root, 'DVD/wrong.iso'), 'changed')
    await expect(
      new NamingTransactionService().execute(root, 'operation-2', [
        {
          itemId: 'i1',
          fromRelativePath: 'DVD/wrong.iso',
          temporaryRelativePath: 'DVD/.oplforge-rename-i1.tmp',
          toRelativePath: 'DVD/new.iso',
          expectedSha256: '0'.repeat(64)
        }
      ])
    ).rejects.toMatchObject({ code: 'STALE_FINGERPRINT' })
    expect(await readFile(path.join(root, 'DVD/wrong.iso'), 'utf8')).toBe('changed')
  })

  it('reports progress and renames without hashing when the plan has no fingerprint', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'naming-progress-'))
    roots.push(root)
    const { mkdir } = await import('node:fs/promises')
    await mkdir(path.join(root, 'DVD'))
    await writeFile(path.join(root, 'DVD/Game.iso'), 'image')
    const reports: Array<{ level: string; message: string; value: number }> = []
    const service = new NamingTransactionService((progress) => reports.push(progress))
    await service.execute(root, 'operation-3', [
      {
        itemId: 'i1',
        fromRelativePath: 'DVD/Game.iso',
        temporaryRelativePath: 'DVD/.oplforge-rename-i1.tmp',
        toRelativePath: 'DVD/SLUS_123.45.Game.iso'
      }
    ])
    expect(reports.some((item) => item.message.includes('Game.iso → SLUS_123.45.Game.iso'))).toBe(
      true
    )
    expect(reports.at(-1)).toMatchObject({ level: 'SUCCESS', value: 100 })
  })
})
