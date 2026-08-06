import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

export interface TempDevice {
  root: string
  cleanup(): Promise<void>
}

export async function createTempDevice(): Promise<TempDevice> {
  const root = await mkdtemp(path.join(tmpdir(), 'oplforge-test-'))
  await Promise.all(
    ['DVD', 'CD', 'ART', 'CFG', 'VMC', 'APPS'].map((name) => mkdir(path.join(root, name)))
  )
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) }
}
