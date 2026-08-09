import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { UpdatePolicy, UpdatePolicyMode } from '../../../src/types/opl-finalization'
const initialPolicy = (): UpdatePolicy => ({
  revision: 0,
  mode: 'ask-before-download',
  channel: 'stable',
  updatedAt: new Date(0).toISOString()
})
export class UpdatePolicyStore {
  constructor(private readonly filePath: string) {}
  async get(): Promise<UpdatePolicy> {
    return readFile(this.filePath, 'utf8')
      .then((text) => JSON.parse(text) as UpdatePolicy)
      .catch(() => initialPolicy())
  }
  async set(mode: UpdatePolicyMode, expectedRevision: number): Promise<UpdatePolicy> {
    const current = await this.get()
    if (current.revision !== expectedRevision)
      throw Object.assign(new Error('Update policy revision is stale'), { code: 'STALE_REVISION' })
    const next = {
      ...current,
      mode,
      revision: current.revision + 1,
      updatedAt: new Date().toISOString()
    }
    await mkdir(path.dirname(this.filePath), { recursive: true })
    const temporary = `${this.filePath}.tmp`
    await writeFile(temporary, JSON.stringify(next, null, 2), { mode: 0o600 })
    await rename(temporary, this.filePath)
    return next
  }
}
