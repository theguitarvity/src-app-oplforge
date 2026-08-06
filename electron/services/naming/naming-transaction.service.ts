import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { access, mkdir, open, rename, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { captureSafeRoot, resolveInside } from '../persistence/safe-path.service'
import type { NamingRenameStep } from './naming-plan.service'

export interface NamingOperationResult {
  operationId: string
  items: Array<{ itemId: string; state: 'renamed' | 'failed'; error?: string }>
}
export interface NamingProgress {
  level: 'INFO' | 'SUCCESS' | 'ERROR'
  message: string
  value: number
  detail?: string
}

async function sha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

export class NamingTransactionService {
  constructor(private readonly report: (progress: NamingProgress) => void = () => undefined) {}

  async execute(
    devicePath: string,
    operationId: string,
    steps: NamingRenameStep[]
  ): Promise<NamingOperationResult> {
    const root = await captureSafeRoot(devicePath)
    await mkdir(path.join(root.real, '.oplforge-staging'), { recursive: true })
    const journalPath = await resolveInside(
      root,
      `.oplforge-staging/naming-${operationId}.json`,
      true
    )
    const completed: Array<{
      step: NamingRenameStep
      from: string
      temporary: string
      to: string
    }> = []
    const result: NamingOperationResult = { operationId, items: [] }
    const journal = {
      operationId,
      state: 'running',
      steps,
      completed: [] as string[],
      updatedAt: new Date().toISOString()
    }
    const writeJournal = async () => {
      const handle = await open(journalPath, 'w', 0o600)
      try {
        await handle.writeFile(JSON.stringify(journal))
        await handle.sync()
      } finally {
        await handle.close()
      }
    }
    await writeJournal()
    this.report({
      level: 'INFO',
      message: `Iniciando adequação de ${steps.length} nome(s).`,
      value: 0
    })
    try {
      for (const [index, step] of steps.entries()) {
        const from = await resolveInside(root, step.fromRelativePath)
        const temporary = await resolveInside(root, step.temporaryRelativePath, true)
        const to = await resolveInside(root, step.toRelativePath, true)
        const current = path.basename(step.fromRelativePath)
        const canonical = path.basename(step.toRelativePath)
        const startValue = Math.floor((index / Math.max(steps.length, 1)) * 100)
        this.report({
          level: 'INFO',
          message: `Adequando ${index + 1}/${steps.length}: ${current} → ${canonical}`,
          value: startValue,
          detail: canonical
        })
        const before = await stat(from)
        if (step.expectedSha256) {
          this.report({
            level: 'INFO',
            message: `Verificando fingerprint de ${current}.`,
            value: startValue,
            detail: current
          })
          if ((await sha256(from)) !== step.expectedSha256)
            throw Object.assign(new Error('Source fingerprint changed after audit'), {
              code: 'STALE_FINGERPRINT',
              itemId: step.itemId
            })
        }
        if (
          await access(to).then(
            () => true,
            () => false
          )
        )
          throw Object.assign(new Error(`Canonical destination already exists: ${canonical}`), {
            code: 'DESTINATION_EXISTS',
            itemId: step.itemId
          })
        await rename(from, temporary)
        await rename(temporary, to)
        const after = await stat(to)
        if (
          after.dev !== before.dev ||
          after.ino !== before.ino ||
          after.size !== before.size ||
          after.mtimeMs !== before.mtimeMs
        )
          throw Object.assign(new Error('Rename changed file identity'), {
            code: 'FILE_IDENTITY_MISMATCH',
            itemId: step.itemId
          })
        completed.push({ step, from, temporary, to })
        journal.completed.push(step.itemId)
        journal.updatedAt = new Date().toISOString()
        await writeJournal()
        result.items.push({ itemId: step.itemId, state: 'renamed' })
        this.report({
          level: 'SUCCESS',
          message: `Nome adequado: ${canonical}`,
          value: Math.floor(((index + 1) / Math.max(steps.length, 1)) * 100),
          detail: canonical
        })
      }
      journal.state = 'completed'
      await writeJournal()
      await rm(journalPath, { force: true })
      this.report({
        level: 'SUCCESS',
        message: `${steps.length} nome(s) adequado(s) com sucesso.`,
        value: 100
      })
      return result
    } catch (error) {
      this.report({
        level: 'ERROR',
        message: `Falha na adequação: ${(error as Error).message}`,
        value: 100
      })
      for (const item of completed.reverse()) {
        try {
          await rename(item.to, item.from)
        } catch {
          try {
            await rename(item.temporary, item.from)
          } catch {
            /* recovery journal remains */
          }
        }
      }
      journal.state = 'recovery-pending'
      journal.updatedAt = new Date().toISOString()
      await writeJournal()
      throw error
    }
  }
}
