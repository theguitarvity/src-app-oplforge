import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export interface TempLocalLibrary {
  root: string
  source: string
  destination: string
  cleanup(): Promise<void>
}

export async function createTempLocalLibrary(prefix = 'opl-forge-006-'): Promise<TempLocalLibrary> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), prefix))
  const source = path.join(root, 'source')
  const destination = path.join(root, 'destination')
  await Promise.all([fs.mkdir(source), fs.mkdir(destination)])
  return { root, source, destination, cleanup: () => fs.rm(root, { recursive: true, force: true }) }
}
