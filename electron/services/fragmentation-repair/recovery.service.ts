import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { access, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import type {
  FragmentationDiagnostic,
  RecoveryItem,
  ResolveRecoveryInput,
  TransactionJournal
} from '../../../src/types/opl'
import { captureSafeRoot, resolveInside } from '../persistence/safe-path.service'
import type { AtomicEntityStore } from './store'
import type { TransactionJournalStore } from './journal.store'
import type { FragmentationRepairAuditService } from './audit.service'

export class FragmentationRecoveryService {
  constructor(
    private readonly journals: TransactionJournalStore,
    private readonly diagnostics?: AtomicEntityStore<FragmentationDiagnostic>,
    private readonly audit?: FragmentationRepairAuditService
  ) {}

  async recover(journalId: string, deviceRoot: string): Promise<RecoveryItem> {
    const journal = await this.journals.loadValidated(journalId)
    const recovered =
      journal.state === 'committed' || journal.state === 'cleanup-pending'
        ? await this.cleanupCommitted(journal, deviceRoot)
        : await this.restoreSafely(journal, false, deviceRoot)
    return toRecoveryItem(recovered)
  }

  async reconcile(deviceId?: string): Promise<RecoveryItem[]> {
    let journals: TransactionJournal[]
    try {
      journals = await this.journals.list()
    } catch {
      return []
    }
    const selected = journals.filter((journal) => !deviceId || journal.deviceId === deviceId)
    for (const journal of selected) {
      if (
        [
          'commit-intent',
          'promoting',
          'active-validating',
          'rollback-required',
          'rolling-back'
        ].includes(journal.state)
      )
        await this.restoreSafely(journal)
      else if (journal.state === 'committed' || journal.state === 'cleanup-pending')
        await this.cleanupCommitted(journal)
    }
    const items = await this.list(deviceId)
    await this.audit?.recovery('automatic', items)
    return items
  }

  async list(deviceId?: string): Promise<RecoveryItem[]> {
    try {
      return (await this.journals.list())
        .filter((journal) => !deviceId || journal.deviceId === deviceId)
        .filter((journal) =>
          ['restored', 'recovery-pending', 'cleanup-pending'].includes(journal.state)
        )
        .map(toRecoveryItem)
    } catch {
      return []
    }
  }

  async resolve(input: ResolveRecoveryInput): Promise<RecoveryItem> {
    if (input.confirmation !== 'RECUPERAR JOGO')
      throw Object.assign(new Error('Explicit recovery confirmation is required'), {
        code: 'CONFIRMATION_REQUIRED'
      })
    const journal = await this.journals.get(input.journalId)
    if (!journal)
      throw Object.assign(new Error('Recovery journal not found'), { code: 'JOURNAL_NOT_FOUND' })
    if (journal.revision !== input.expectedRevision)
      throw Object.assign(new Error('Recovery revision changed'), { code: 'STALE_REVISION' })
    const item =
      input.action === 'restore-original'
        ? toRecoveryItem(await this.restoreSafely(journal, true))
        : toRecoveryItem(await this.cleanupVerifiedResidue(journal))
    await this.audit?.recovery('authorized', [item])
    return item
  }

  private async restoreSafely(
    journal: TransactionJournal,
    authorized = false,
    deviceRoot?: string
  ): Promise<TransactionJournal> {
    if (journal.sourceFingerprints.length > 1) return this.restoreMultipart(journal, deviceRoot)
    const location = await this.location(journal, deviceRoot)
    if (!location)
      return this.journals.markRecoveryPending(journal.journalId, journal.revision, [
        'Reconnect the original device and retry recovery.'
      ])
    const { root, sourcePath, backupPath } = location
    void root
    try {
      const backupExists = await exists(backupPath)
      const sourceExists = await exists(sourcePath)
      const expected = journal.sourceFingerprints[0]
      if (!expected || !backupExists) {
        if (sourceExists && expected && (await sha256File(sourcePath)) === expected.sha256)
          return this.toRestored(journal)
        return this.journals.markRecoveryPending(journal.journalId, journal.revision, [
          'Original authority is ambiguous; preserve all files for manual recovery.'
        ])
      }
      if ((await sha256File(backupPath)) !== expected.sha256)
        return this.journals.markRecoveryPending(journal.journalId, journal.revision, [
          'Backup fingerprint does not match the recorded original.'
        ])
      if (sourceExists) {
        if (!authorized && (await sha256File(sourcePath)) === expected.sha256) {
          await rm(backupPath, { force: true })
          return this.toRestored(journal)
        }
        await rm(sourcePath, { force: true })
      }
      await rename(backupPath, sourcePath)
      return this.toRestored(journal)
    } catch {
      return this.journals.markRecoveryPending(journal.journalId, journal.revision, [
        'Automatic rollback failed; preserve all files for manual recovery.'
      ])
    }
  }

  private async restoreMultipart(
    journal: TransactionJournal,
    explicitRoot?: string
  ): Promise<TransactionJournal> {
    const mountPath = explicitRoot ?? (await this.mountFor(journal.deviceId))
    if (!mountPath)
      return this.journals.markRecoveryPending(journal.journalId, journal.revision, [
        'Reconnect the complete USBExtreme device and retry recovery.'
      ])
    try {
      const root = await captureSafeRoot(mountPath)
      const affectedPaths = new Set(
        journal.intents
          .map(({ relativePath }) => relativePath)
          .filter((value): value is string => Boolean(value))
      )
      const affected = journal.sourceFingerprints.filter(
        ({ relativePath }) => affectedPaths.size === 0 || affectedPaths.has(relativePath)
      )
      const files = await Promise.all(
        affected.map(async (expected, index) => {
          const sourcePath = await resolveInside(root, expected.relativePath, true)
          const recorded = journal.backups[index]?.relativePath
          const backupPath = path.join(
            path.dirname(sourcePath),
            path.basename(recorded ?? `${path.basename(sourcePath)}.${journal.operationId}.backup`)
          )
          return { expected, sourcePath, backupPath }
        })
      )
      const activeOriginal = await Promise.all(
        files.map(
          async ({ expected, sourcePath }) =>
            (await exists(sourcePath)) && (await sha256File(sourcePath)) === expected.sha256
        )
      )
      if (activeOriginal.every(Boolean)) return this.toRestored(journal)
      const backupsValid = await Promise.all(
        files.map(
          async ({ expected, backupPath }) =>
            (await exists(backupPath)) && (await sha256File(backupPath)) === expected.sha256
        )
      )
      if (!backupsValid.every(Boolean))
        return this.journals.markRecoveryPending(journal.journalId, journal.revision, [
          'Multipart backup authority is incomplete or ambiguous; preserve the complete set.'
        ])
      for (const file of [...files].reverse()) {
        await rm(file.sourcePath, { force: true })
        await rename(file.backupPath, file.sourcePath)
      }
      const restored = await Promise.all(
        files.map(
          async ({ expected, sourcePath }) => (await sha256File(sourcePath)) === expected.sha256
        )
      )
      if (!restored.every(Boolean))
        return this.journals.markRecoveryPending(journal.journalId, journal.revision, [
          'Multipart rollback did not restore the exact original set.'
        ])
      return this.toRestored(journal)
    } catch {
      return this.journals.markRecoveryPending(journal.journalId, journal.revision, [
        'Multipart rollback failed; preserve the complete set for manual recovery.'
      ])
    }
  }

  private async cleanupCommitted(
    journal: TransactionJournal,
    deviceRoot?: string
  ): Promise<TransactionJournal> {
    const location = await this.location(journal, deviceRoot)
    if (!location)
      return this.journals.markRecoveryPending(journal.journalId, journal.revision, [
        'Reconnect device to verify committed file before cleanup.'
      ])
    const expected = journal.sourceFingerprints[0]
    if (
      !expected ||
      !(await exists(location.sourcePath)) ||
      (await sha256File(location.sourcePath)) !== expected.sha256
    )
      return this.journals.markRecoveryPending(journal.journalId, journal.revision, [
        'Active file cannot be proven valid; residue was preserved.'
      ])
    if (
      (await exists(location.backupPath)) &&
      (await sha256File(location.backupPath)) !== expected.sha256
    )
      return this.journals.markRecoveryPending(journal.journalId, journal.revision, [
        'Backup residue has an unexpected fingerprint and was preserved.'
      ])
    await rm(location.backupPath, { force: true })
    const pending =
      journal.state === 'committed'
        ? await this.journals.transition(journal.journalId, journal.revision, 'cleanup-pending')
        : journal
    return this.journals.transition(pending.journalId, pending.revision, 'cleanup-complete')
  }

  private async cleanupVerifiedResidue(journal: TransactionJournal): Promise<TransactionJournal> {
    const location = await this.location(journal)
    if (!location)
      throw Object.assign(new Error('Device is unavailable'), { code: 'DEVICE_INACCESSIBLE' })
    const expected = journal.sourceFingerprints[0]
    if (
      !expected ||
      !(await exists(location.sourcePath)) ||
      (await sha256File(location.sourcePath)) !== expected.sha256
    )
      throw Object.assign(new Error('Active original cannot be proven'), {
        code: 'MANUAL_RECOVERY_REQUIRED'
      })
    for (const candidate of journal.candidates)
      await rm(
        path.join(path.dirname(location.sourcePath), path.basename(candidate.relativePath)),
        { force: true }
      )
    await rm(location.backupPath, { force: true })
    return journal.state === 'cleanup-pending'
      ? this.journals.transition(journal.journalId, journal.revision, 'cleanup-complete')
      : this.toRestored(journal)
  }

  private async toRestored(journal: TransactionJournal): Promise<TransactionJournal> {
    if (journal.state === 'restored') return journal
    if (journal.state === 'rolling-back')
      return this.journals.transition(journal.journalId, journal.revision, 'restored')
    if (['commit-intent', 'promoting', 'active-validating'].includes(journal.state)) {
      const required = await this.journals.transition(
        journal.journalId,
        journal.revision,
        'rollback-required'
      )
      const rolling = await this.journals.transition(
        required.journalId,
        required.revision,
        'rolling-back'
      )
      return this.journals.transition(rolling.journalId, rolling.revision, 'restored')
    }
    if (journal.state === 'rollback-required') {
      const rolling = await this.journals.transition(
        journal.journalId,
        journal.revision,
        'rolling-back'
      )
      return this.journals.transition(rolling.journalId, rolling.revision, 'restored')
    }
    if (journal.state === 'recovery-pending') {
      const rolling = await this.journals.transition(
        journal.journalId,
        journal.revision,
        'rolling-back'
      )
      return this.journals.transition(rolling.journalId, rolling.revision, 'restored')
    }
    return this.journals.markRecoveryPending(journal.journalId, journal.revision, [
      'Journal state requires manual recovery.'
    ])
  }

  private async location(journal: TransactionJournal, explicitRoot?: string) {
    const expected = journal.sourceFingerprints[0]
    const mountPath = explicitRoot ?? (await this.mountFor(journal.deviceId))
    if (!mountPath || !expected) return undefined
    try {
      await access(mountPath)
      const root = await captureSafeRoot(mountPath)
      const sourcePath = await resolveInside(root, expected.relativePath, true)
      const backupName =
        journal.backups[0]?.relativePath ??
        `${path.basename(sourcePath)}.${journal.operationId}.backup`
      return {
        root,
        sourcePath,
        backupPath: path.join(path.dirname(sourcePath), path.basename(backupName))
      }
    } catch {
      return undefined
    }
  }

  private async mountFor(deviceId: string): Promise<string | undefined> {
    const diagnostics = this.diagnostics ? await this.diagnostics.list() : []
    return diagnostics
      .filter(({ device }) => device.deviceId === deviceId)
      .sort((a, b) => b.revision - a.revision)[0]?.device.mountPath
  }
}

function toRecoveryItem(journal: TransactionJournal): RecoveryItem {
  const state =
    journal.state === 'restored' || journal.state === 'cleanup-complete'
      ? 'restored'
      : journal.state === 'cleanup-pending'
        ? 'cleanup-pending'
        : 'recovery-pending'
  return {
    journalId: journal.journalId,
    revision: journal.revision,
    operationId: journal.operationId,
    installationId: journal.installationId,
    deviceId: journal.deviceId,
    state,
    instructions: journal.recoveryInstructions,
    updatedAt: journal.updatedAt
  }
}
async function exists(filePath: string) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}
async function sha256File(filePath: string) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(filePath)) hash.update(chunk as Buffer)
  return hash.digest('hex')
}
