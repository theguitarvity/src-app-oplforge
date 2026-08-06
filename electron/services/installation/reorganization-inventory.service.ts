import { lstat, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import type { ReorganizationInventoryEntry } from '../../../src/types/opl'
import { sha256File } from './installation-planner.service'

const ROOTS = ['DVD', 'CD', 'ART', 'CFG', 'VMC', 'APPS']
export class ReorganizationInventoryService {
  async create(devicePath: string): Promise<ReorganizationInventoryEntry[]> {
    const entries: ReorganizationInventoryEntry[] = []
    for (const root of ROOTS) await this.walk(devicePath, path.join(devicePath, root), entries)
    for (const name of await readdir(devicePath).catch(() => []))
      if (name === 'ul.cfg' || /^ul\..+\.\d{2}$/i.test(name))
        await this.add(devicePath, path.join(devicePath, name), entries)
    return entries.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
  }
  private async walk(
    root: string,
    directory: string,
    entries: ReorganizationInventoryEntry[]
  ): Promise<void> {
    let children
    try {
      children = await readdir(directory, { withFileTypes: true })
    } catch {
      return
    }
    for (const child of children) {
      const target = path.join(directory, child.name)
      const metadata = await lstat(target)
      if (metadata.isSymbolicLink()) continue
      if (child.isDirectory()) await this.walk(root, target, entries)
      else if (child.isFile()) await this.add(root, target, entries)
    }
  }
  private async add(root: string, file: string, entries: ReorganizationInventoryEntry[]) {
    const metadata = await stat(file)
    entries.push({
      relativePath: path.relative(root, file),
      sizeBytes: metadata.size,
      sha256: await sha256File(file)
    })
  }
}
