import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { access, open, rename, rm, stat, statfs } from 'node:fs/promises'
import path from 'node:path'
import type {
  RepairPlan,
  RepairPlanItem,
  SerializableError,
  TransactionJournal
} from '../../../src/types/opl'
import type { FragmentationAdapter } from '../fragmentation/fragmentation-adapter'
import { captureSafeRoot, resolveInside } from '../persistence/safe-path.service'
import { FragmentationCandidateService } from './candidate.service'
import { TransactionJournalStore } from './journal.store'

export interface TransactionResult {
  journal: TransactionJournal
  modifiedFiles: string[]
  backupPath?: string
}

export class FragmentationTransactionService {
  private readonly cancelled = new Set<string>()
  constructor(
    private readonly adapter: FragmentationAdapter,
    private readonly candidates: FragmentationCandidateService,
    private readonly journals: TransactionJournalStore,
    private readonly createId: () => string = randomUUID,
    private readonly now: () => Date = () => new Date(),
    private readonly onBoundary: (
      boundary: string,
      relativePath: string
    ) => Promise<void> = async () => undefined
  ) {}

  cancel(operationId: string) {
    this.cancelled.add(operationId)
  }

  async execute(
    operationId: string,
    plan: RepairPlan,
    item: RepairPlanItem,
    deviceRoot: string
  ): Promise<TransactionResult> {
    const journalBase = {
      journalId: this.createId(),
      operationId,
      installationId: item.installation.installationId,
      deviceId: item.installation.deviceId,
      state: 'planned' as const,
      sourceFingerprints: item.sourceFingerprints,
      candidates: [],
      backups: [],
      ulCfgAction: item.ulCfgAction,
      intents: [],
      outcomes: [],
      recoveryInstructions: []
    }
    let journal = await this.journals.create(journalBase)
    const root = await captureSafeRoot(deviceRoot)
    if (plan.deviceId !== item.installation.deviceId)
      throw Object.assign(new Error('Plan device identity differs'), { code: 'DEVICE_CHANGED' })
    const observedRootId = createHash('sha256').update(`${root.device}:${root.inode}`).digest('hex')
    if (/^[a-f0-9]{64}$/i.test(plan.deviceId) && observedRootId !== plan.deviceId)
      throw Object.assign(new Error('Selected device root identity changed'), {
        code: 'DEVICE_CHANGED'
      })
    if (item.installation.format === 'USBExtreme')
      return this.executeMultipart(operationId, item, root, journal)
    if (!['ISO', 'ZSO'].includes(item.installation.format) || item.filesToRewrite.length !== 1)
      throw Object.assign(new Error('Single repair requires one ISO/ZSO file'), {
        code: 'INVALID_SELECTION'
      })
    const relativePath = item.filesToRewrite[0]
    const expected = item.sourceFingerprints.find(
      (fingerprint) => fingerprint.relativePath === relativePath
    )
    if (!expected)
      throw Object.assign(new Error('Source fingerprint is absent from plan'), {
        code: 'SOURCE_CHANGED'
      })
    const sourcePath = await resolveInside(root, relativePath)
    await access(sourcePath, 6)
    const info = await stat(sourcePath)
    if (
      info.size !== expected.sizeBytes ||
      (expected.modifiedAt && info.mtime.toISOString() !== expected.modifiedAt) ||
      (await sha256File(sourcePath)) !== expected.sha256
    )
      throw Object.assign(new Error('Source changed since diagnosis'), { code: 'SOURCE_CHANGED' })
    const free = await statfs(root.real, { bigint: true })
    const freeBytes = Number(free.bavail * free.bsize)
    if (freeBytes < item.temporaryBytes)
      throw Object.assign(new Error('Insufficient free space for candidate and margin'), {
        code: 'INSUFFICIENT_SPACE'
      })
    journal = await this.journals.transition(
      journal.journalId,
      journal.revision,
      'preflight-validated'
    )
    if (this.cancelled.has(operationId))
      return {
        journal: await this.journals.transition(
          journal.journalId,
          journal.revision,
          'aborted-unchanged'
        ),
        modifiedFiles: []
      }
    journal = await this.journals.transition(journal.journalId, journal.revision, 'staging')
    let candidate
    try {
      candidate = await this.candidates.create(
        sourcePath,
        operationId,
        expected,
        item.installation.format
      )
    } catch (error) {
      await this.journals.transition(journal.journalId, journal.revision, 'aborted-unchanged', {
        recoveryInstructions: [(error as Error).message]
      })
      throw error
    }
    journal = await this.journals.transition(
      journal.journalId,
      journal.revision,
      'candidate-verified',
      { candidates: [candidate.file] }
    )
    if (this.cancelled.has(operationId)) {
      await rm(candidate.absolutePath, { force: true })
      return {
        journal: await this.journals.transition(
          journal.journalId,
          journal.revision,
          'aborted-unchanged'
        ),
        modifiedFiles: []
      }
    }
    const backupPath = `${sourcePath}.${operationId}.backup`
    journal = await this.journals.transition(journal.journalId, journal.revision, 'commit-intent', {
      intents: [
        ...journal.intents,
        { step: 'promote', relativePath, timestamp: this.now().toISOString() }
      ]
    })
    let originalRenamed = false
    let candidatePromoted = false
    try {
      journal = await this.journals.transition(journal.journalId, journal.revision, 'promoting')
      await rename(sourcePath, backupPath)
      await syncDirectory(path.dirname(sourcePath))
      originalRenamed = true
      await rename(candidate.absolutePath, sourcePath)
      await syncDirectory(path.dirname(sourcePath))
      candidatePromoted = true
      journal = await this.journals.transition(
        journal.journalId,
        journal.revision,
        'active-validating',
        {
          backups: [
            {
              relativePath: path.basename(backupPath),
              sizeBytes: expected.sizeBytes,
              sha256: expected.sha256,
              extentState: 'not-applicable'
            }
          ]
        }
      )
      if (this.cancelled.has(operationId))
        throw Object.assign(new Error('Operation cancelled after commit intent'), {
          code: 'CANCELLED'
        })
      const activeHash = await sha256File(sourcePath)
      const evidence = await this.adapter.inspect(sourcePath)
      if (activeHash !== expected.sha256)
        throw Object.assign(new Error('Promoted file hash mismatch'), { code: 'HASH_MISMATCH' })
      if (evidence.state !== 'contiguous' || evidence.verification !== 'verified')
        throw Object.assign(new Error('Promoted file is still fragmented'), {
          code: 'STILL_FRAGMENTED'
        })
      journal = await this.journals.transition(journal.journalId, journal.revision, 'committed')
      journal = await this.journals.transition(
        journal.journalId,
        journal.revision,
        'cleanup-pending'
      )
      await rm(backupPath, { force: true })
      await syncDirectory(path.dirname(sourcePath))
      journal = await this.journals.transition(
        journal.journalId,
        journal.revision,
        'cleanup-complete'
      )
      return { journal, modifiedFiles: [relativePath] }
    } catch (error) {
      journal = await this.journals.transition(
        journal.journalId,
        journal.revision,
        'rollback-required',
        { recoveryInstructions: ['Restore the verified original backup before retrying.'] }
      )
      journal = await this.journals.transition(journal.journalId, journal.revision, 'rolling-back')
      try {
        if (originalRenamed) {
          if (candidatePromoted) await rm(sourcePath, { force: true })
          await rename(backupPath, sourcePath)
          await syncDirectory(path.dirname(sourcePath))
        }
        if ((await sha256File(sourcePath)) !== expected.sha256)
          throw new Error('Restored hash mismatch', { cause: error })
        journal = await this.journals.transition(journal.journalId, journal.revision, 'restored')
      } catch (rollbackError) {
        const safe: SerializableError = {
          code: 'ROLLBACK_FAILED',
          message: (rollbackError as Error).message,
          retryable: false
        }
        await this.journals.transition(journal.journalId, journal.revision, 'recovery-pending', {
          recoveryInstructions: [safe.message]
        })
      }
      throw error
    } finally {
      this.cancelled.delete(operationId)
    }
  }

  private async executeMultipart(
    operationId: string,
    item: RepairPlanItem,
    root: Awaited<ReturnType<typeof captureSafeRoot>>,
    initial: TransactionJournal
  ): Promise<TransactionResult> {
    if (
      item.filesToRewrite.length === 0 ||
      item.filesToRewrite.some(
        (file) => !item.installation.relativePaths.includes(file) && file !== 'ul.cfg'
      )
    )
      throw Object.assign(new Error('Multipart selection is not confined to the installation'), {
        code: 'INVALID_SELECTION'
      })
    const ordered = [...item.filesToRewrite].sort((left, right) =>
      left === 'ul.cfg' ? 1 : right === 'ul.cfg' ? -1 : left.localeCompare(right, 'en')
    )
    const sources = [] as Array<{
      relativePath: string
      sourcePath: string
      expected: RepairPlanItem['sourceFingerprints'][number]
    }>
    for (const relativePath of ordered) {
      const expected = item.sourceFingerprints.find(
        (fingerprint) => fingerprint.relativePath === relativePath
      )
      if (!expected)
        throw Object.assign(new Error(`Missing fingerprint for ${relativePath}`), {
          code: 'SOURCE_CHANGED'
        })
      const sourcePath = await resolveInside(root, relativePath)
      const info = await stat(sourcePath)
      if (info.size !== expected.sizeBytes || (await sha256File(sourcePath)) !== expected.sha256)
        throw Object.assign(new Error(`Source changed: ${relativePath}`), {
          code: 'SOURCE_CHANGED'
        })
      sources.push({ relativePath, sourcePath, expected })
    }
    const free = await statfs(root.real, { bigint: true })
    if (Number(free.bavail * free.bsize) < item.temporaryBytes)
      throw Object.assign(new Error('Insufficient free space for multipart candidates'), {
        code: 'INSUFFICIENT_SPACE'
      })
    let journal = await this.journals.transition(
      initial.journalId,
      initial.revision,
      'preflight-validated'
    )
    journal = await this.journals.transition(journal.journalId, journal.revision, 'staging')
    const candidates = [] as Array<{
      relativePath: string
      absolutePath: string
      file: TransactionJournal['candidates'][number]
    }>
    try {
      for (const source of sources) {
        const candidate = await this.candidates.create(
          source.sourcePath,
          operationId,
          source.expected,
          'USBExtreme'
        )
        candidates.push({ relativePath: source.relativePath, ...candidate })
        await this.onBoundary('candidate-verified', source.relativePath)
      }
    } catch (error) {
      await Promise.all(candidates.map((candidate) => rm(candidate.absolutePath, { force: true })))
      await this.journals.transition(journal.journalId, journal.revision, 'aborted-unchanged')
      throw error
    }
    journal = await this.journals.transition(
      journal.journalId,
      journal.revision,
      'candidate-verified',
      { candidates: candidates.map(({ file }) => file) }
    )
    if (this.cancelled.has(operationId)) {
      await Promise.all(candidates.map((candidate) => rm(candidate.absolutePath, { force: true })))
      return {
        journal: await this.journals.transition(
          journal.journalId,
          journal.revision,
          'aborted-unchanged'
        ),
        modifiedFiles: []
      }
    }
    journal = await this.journals.transition(journal.journalId, journal.revision, 'commit-intent', {
      intents: ordered.map((relativePath) => ({
        step: 'promote',
        relativePath,
        timestamp: this.now().toISOString()
      }))
    })
    journal = await this.journals.transition(journal.journalId, journal.revision, 'promoting')
    const promoted: Array<{
      relativePath: string
      sourcePath: string
      backupPath: string
      expected: RepairPlanItem['sourceFingerprints'][number]
    }> = []
    try {
      for (const source of sources) {
        const candidate = candidates.find((value) => value.relativePath === source.relativePath)!
        const backupPath = `${source.sourcePath}.${operationId}.backup`
        await this.onBoundary('before-backup-rename', source.relativePath)
        await rename(source.sourcePath, backupPath)
        await syncDirectory(path.dirname(source.sourcePath))
        promoted.push({ ...source, backupPath })
        await this.onBoundary('after-backup-rename', source.relativePath)
        await rename(candidate.absolutePath, source.sourcePath)
        await syncDirectory(path.dirname(source.sourcePath))
        await this.onBoundary('after-candidate-rename', source.relativePath)
      }
      journal = await this.journals.transition(
        journal.journalId,
        journal.revision,
        'active-validating',
        {
          backups: promoted.map(({ backupPath, expected }) => ({
            relativePath: path.basename(backupPath),
            sizeBytes: expected.sizeBytes,
            sha256: expected.sha256,
            extentState: 'not-applicable'
          }))
        }
      )
      if (this.cancelled.has(operationId))
        throw Object.assign(new Error('Multipart operation cancelled'), { code: 'CANCELLED' })
      for (const source of sources.filter(({ relativePath }) => relativePath !== 'ul.cfg')) {
        if (
          (await sha256File(source.sourcePath)) !== source.expected.sha256 ||
          (await this.adapter.inspect(source.sourcePath)).state !== 'contiguous'
        )
          throw Object.assign(
            new Error(`Promoted part failed validation: ${source.relativePath}`),
            { code: 'STILL_FRAGMENTED' }
          )
      }
      journal = await this.journals.transition(journal.journalId, journal.revision, 'committed')
      journal = await this.journals.transition(
        journal.journalId,
        journal.revision,
        'cleanup-pending'
      )
      for (const value of promoted) await rm(value.backupPath, { force: true })
      journal = await this.journals.transition(
        journal.journalId,
        journal.revision,
        'cleanup-complete'
      )
      return { journal, modifiedFiles: ordered }
    } catch (error) {
      journal = await this.journals.transition(
        journal.journalId,
        journal.revision,
        'rollback-required'
      )
      journal = await this.journals.transition(journal.journalId, journal.revision, 'rolling-back')
      try {
        for (const value of [...promoted].reverse()) {
          await rm(value.sourcePath, { force: true })
          await rename(value.backupPath, value.sourcePath)
          await syncDirectory(path.dirname(value.sourcePath))
        }
        for (const value of promoted)
          if ((await sha256File(value.sourcePath)) !== value.expected.sha256)
            throw new Error(`Rollback hash mismatch: ${value.relativePath}`, { cause: error })
        journal = await this.journals.transition(journal.journalId, journal.revision, 'restored')
      } catch (rollbackError) {
        await this.journals.transition(journal.journalId, journal.revision, 'recovery-pending', {
          recoveryInstructions: [(rollbackError as Error).message]
        })
      }
      throw error
    } finally {
      await Promise.all(candidates.map((candidate) => rm(candidate.absolutePath, { force: true })))
      this.cancelled.delete(operationId)
    }
  }
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(filePath)) hash.update(chunk as Buffer)
  return hash.digest('hex')
}

async function syncDirectory(directoryPath: string): Promise<void> {
  const directory = await open(directoryPath, 'r')
  try {
    await directory.sync()
  } finally {
    await directory.close()
  }
}
