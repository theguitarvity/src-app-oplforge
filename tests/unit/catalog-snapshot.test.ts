import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CatalogService, diffSnapshots } from '@electron/services/catalog/catalog.service'
import { CatalogStoreService } from '@electron/services/catalog/catalog-store.service'

describe('catalog snapshots', () => {
  it('publishes provisional then complete and preserves the last complete after failure', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'snap-'))
    const store = new CatalogStoreService(path.join(root, 'catalog.json'))
    let fail = false
    const scanner = {
      scan: async () => {
        if (fail) throw new Error('removed')
        return { items: [], findings: [] }
      }
    }
    const service = new CatalogService(store, scanner as never)
    const events: string[] = []
    const first = await service.scan(root, undefined, (snapshot) => events.push(snapshot.status))
    expect(events).toEqual(['provisional', 'complete'])
    fail = true
    await expect(service.scan(root)).rejects.toThrow('removed')
    expect((await service.snapshot(first.deviceId))?.snapshotId).toBe(first.snapshotId)
  })
  it('reports additions, removals and structural changes', () => {
    const item = (relativePath: string, structuralSignature: string) => ({
      relativePath,
      files: [{ structuralSignature }]
    })
    const diff = diffSnapshots(
      { items: [item('removed', 'a'), item('changed', 'a')] } as never,
      { items: [item('added', 'a'), item('changed', 'b')] } as never
    )
    expect(diff.added).toHaveLength(1)
    expect(diff.removed).toHaveLength(1)
    expect(diff.changed).toHaveLength(1)
  })
})
