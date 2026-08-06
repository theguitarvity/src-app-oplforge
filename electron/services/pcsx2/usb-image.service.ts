import { copyFile, mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { CatalogItem } from '../../../src/types/opl'
import { sha256File } from '../installation/installation-planner.service'

type Executor = (command: string, args: string[]) => Promise<void>
const execute: Executor = async (command, args) => {
  await promisify(execFile)(command, args, { timeout: 120_000 })
}
export class UsbImageService {
  constructor(private readonly run: Executor = execute) {}
  async build(
    devicePath: string,
    item: CatalogItem,
    workspace: string
  ): Promise<{ imagePath: string; sha256: string; sourceRoot: string }> {
    const root = path.join(workspace, 'usb-root')
    await mkdir(root, { recursive: true })
    const targetDir = item.mediaType === 'CD' ? 'CD' : 'DVD'
    await mkdir(path.join(root, targetDir), { recursive: true })
    await mkdir(path.join(root, 'ART'), { recursive: true })
    for (const file of item.files) {
      const source = path.join(devicePath, file.relativePath)
      const destination =
        item.installFormat === 'USBExtreme'
          ? path.join(root, path.basename(source))
          : path.join(root, targetDir, path.basename(source))
      await copyFile(source, destination)
    }
    if (item.installFormat === 'USBExtreme')
      await copyFile(path.join(devicePath, 'ul.cfg'), path.join(root, 'ul.cfg'))
    if (item.gameId)
      for (const name of await readdir(path.join(devicePath, 'ART')).catch(() => []))
        if (name.startsWith(`${item.gameId}_`) && /\.png$/i.test(name))
          await copyFile(path.join(devicePath, 'ART', name), path.join(root, 'ART', name))
    const total = await this.directoryBytes(root)
    const imagePath = path.join(workspace, 'opl-usb.img')
    const kib = Math.max(65536, Math.ceil((total * 1.2) / 1024))
    await this.run('mkfs.fat', ['--invariant', '-F', '32', '-C', imagePath, String(kib)])
    for (const name of await readdir(root))
      await this.run('mcopy', ['-s', '-o', '-i', imagePath, path.join(root, name), '::/'])
    await writeFile(
      path.join(workspace, 'usb-image-manifest.json'),
      JSON.stringify({ itemId: item.itemId, sourceFiles: item.files, imagePath }, null, 2)
    )
    return { imagePath, sha256: await sha256File(imagePath), sourceRoot: root }
  }
  private async directoryBytes(directory: string): Promise<number> {
    let total = 0
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name)
      total += entry.isDirectory() ? await this.directoryBytes(target) : (await stat(target)).size
    }
    return total
  }
}
