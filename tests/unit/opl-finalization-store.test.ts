import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { AtomicEntityStore } from '@electron/services/persistence/atomic-entity-store.service'

interface Entity {
  id: string
  value: number
}
const roots: string[] = []

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'opl-store-'))
  roots.push(root)
  return path.join(root, 'entities.json')
}

afterEach(async () => {
  const { rm } = await import('node:fs/promises')
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('AtomicEntityStore', () => {
  it('serializes concurrent writes and rejects stale revisions', async () => {
    const file = await fixture()
    const store = new AtomicEntityStore<Entity>(file, 'id', { schemaVersion: 1 })
    await Promise.all([store.put({ id: 'a', value: 1 }), store.put({ id: 'b', value: 2 })])
    expect(await store.list()).toEqual(
      expect.arrayContaining([
        { id: 'a', value: 1 },
        { id: 'b', value: 2 }
      ])
    )
    await expect(store.put({ id: 'c', value: 3 }, 0)).rejects.toMatchObject({
      code: 'STALE_REVISION'
    })
  })

  it('migrates a prior schema and fsync-style atomic output remains parseable', async () => {
    const file = await fixture()
    await writeFile(
      file,
      JSON.stringify({
        schemaVersion: 1,
        revision: 4,
        updatedAt: new Date(0).toISOString(),
        data: { a: { id: 'a', old: 7 } }
      })
    )
    const store = new AtomicEntityStore<Entity>(file, 'id', {
      schemaVersion: 2,
      migrations: {
        1: (document) => ({ ...document, schemaVersion: 2, data: { a: { id: 'a', value: 7 } } })
      }
    })
    expect(await store.get('a')).toEqual({ id: 'a', value: 7 })
    await store.put({ id: 'b', value: 8 })
    expect(JSON.parse(await readFile(file, 'utf8')).schemaVersion).toBe(2)
  })

  it('quarantines corrupted JSON instead of deleting evidence', async () => {
    const file = await fixture()
    await writeFile(file, '{broken')
    const store = new AtomicEntityStore<Entity>(file, 'id', { schemaVersion: 1 })
    expect(await store.list()).toEqual([])
    expect(
      (await readdir(path.dirname(file))).some((name) => name.startsWith('entities.json.corrupt-'))
    ).toBe(true)
  })
})
