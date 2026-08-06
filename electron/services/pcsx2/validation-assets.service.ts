import { copyFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import type { BiosIdentity } from '../../../src/types/opl'
import { sha256File } from '../installation/installation-planner.service'

export class ValidationAssetsService {
  async identifyBios(biosPath: string): Promise<BiosIdentity> {
    const bytes = await readFile(biosPath)
    if (bytes.length < 512 * 1024 || bytes.length > 8 * 1024 * 1024)
      throw Object.assign(new Error('Selected BIOS size is not recognized'), {
        code: 'INVALID_BIOS'
      })
    const text = bytes.toString('latin1')
    const region = /Japan|JAP/i.test(text)
      ? 'JAP'
      : /Europe|EUR/i.test(text)
        ? 'EUR'
        : /America|USA/i.test(text)
          ? 'USA'
          : 'unknown'
    return {
      sha256: createHash('sha256').update(bytes).digest('hex'),
      region,
      sizeBytes: bytes.length
    }
  }
  async cloneMemoryCard(sourcePath: string, isolatedDirectory: string) {
    await mkdir(isolatedDirectory, { recursive: true })
    const destination = path.join(isolatedDirectory, 'opl-validation.ps2')
    const sourceHash = await sha256File(sourcePath)
    await copyFile(sourcePath, destination)
    const cloneHash = await sha256File(destination)
    if (cloneHash !== sourceHash)
      throw Object.assign(new Error('Memory-card clone hash mismatch'), { code: 'HASH_MISMATCH' })
    return { path: destination, sha256: cloneHash }
  }
}
