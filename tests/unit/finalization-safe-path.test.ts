import { mkdtemp, mkdir, rm, symlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createFinalizationPaths,
  resolveCachePath,
  resolveStagingPath
} from '@electron/services/persistence/finalization-paths.service'

const roots: string[] = []

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'opl-finalization-paths-'))
  roots.push(root)
  const userData = path.join(root, 'user-data')
  const device = path.join(root, 'device')
  await Promise.all([mkdir(userData), mkdir(device)])
  return { root, userData, device }
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('finalization paths', () => {
  it('confines cache and per-task device staging to their captured roots', async () => {
    const { userData, device } = await fixture()
    const paths = await createFinalizationPaths(userData, device)

    expect(await resolveCachePath(paths, 'task-1/payload.part')).toBe(
      path.join(userData, 'opl-finalization', 'cache', 'task-1', 'payload.part')
    )
    expect(await resolveStagingPath(paths, 'task-1', 'DVD/game.iso')).toBe(
      path.join(device, '.oplforge-staging', 'task-1', 'DVD', 'game.iso')
    )
  })

  it.each(['../escape', '/absolute/path', 'task/../../escape'])(
    'rejects unsafe relative path %s',
    async (candidate) => {
      const { userData, device } = await fixture()
      const paths = await createFinalizationPaths(userData, device)
      await expect(resolveCachePath(paths, candidate)).rejects.toMatchObject({
        code: 'PATH_ESCAPE'
      })
      await expect(resolveStagingPath(paths, 'task-1', candidate)).rejects.toMatchObject({
        code: 'PATH_ESCAPE'
      })
    }
  )

  it('rejects symlinks that escape cache or staging', async () => {
    const { root, userData, device } = await fixture()
    const outside = path.join(root, 'outside')
    await mkdir(outside)
    const paths = await createFinalizationPaths(userData, device)
    await symlink(outside, path.join(paths.cacheRoot.real, 'escape'))
    await symlink(outside, path.join(paths.stagingRoot.real, 'escape'))

    await expect(resolveCachePath(paths, 'escape/file.part')).rejects.toMatchObject({
      code: 'PATH_ESCAPE'
    })
    await expect(resolveStagingPath(paths, 'escape', 'file.iso')).rejects.toMatchObject({
      code: 'PATH_ESCAPE'
    })
  })
})
