import type { TransactionJournal, TransactionState } from '../../../src/types/opl'
import type { AtomicEntityStore } from './store'

const NEXT: Partial<Record<TransactionState, readonly TransactionState[]>> = {
  planned: ['preflight-validated', 'aborted-unchanged'],
  'preflight-validated': ['staging', 'aborted-unchanged'],
  staging: ['candidate-verified', 'aborted-unchanged'],
  'candidate-verified': ['commit-intent', 'aborted-unchanged'],
  'commit-intent': ['promoting', 'rollback-required'],
  promoting: ['active-validating', 'rollback-required'],
  'active-validating': ['committed', 'rollback-required'],
  committed: ['cleanup-pending'],
  'cleanup-pending': ['cleanup-complete'],
  'rollback-required': ['rolling-back'],
  'rolling-back': ['restored', 'recovery-pending'],
  'recovery-pending': ['rolling-back']
}

export class TransactionJournalStore {
  constructor(
    private readonly store: AtomicEntityStore<TransactionJournal>,
    private readonly now: () => Date = () => new Date()
  ) {}

  async create(
    journal: Omit<TransactionJournal, 'schemaVersion' | 'revision' | 'updatedAt'>
  ): Promise<TransactionJournal> {
    const value: TransactionJournal = {
      ...journal,
      schemaVersion: 1,
      revision: 1,
      updatedAt: this.now().toISOString()
    }
    await this.store.put(value)
    return value
  }

  get(journalId: string) {
    return this.store.get(journalId)
  }
  list() {
    return this.store.list()
  }

  async loadValidated(journalId: string): Promise<TransactionJournal> {
    let value: unknown
    try {
      value = await this.store.get(journalId)
    } catch (error) {
      throw Object.assign(new Error('Journal cannot be parsed', { cause: error }), {
        code: 'JOURNAL_CORRUPT'
      })
    }
    if (!value || typeof value !== 'object')
      throw Object.assign(new Error('Journal is missing or malformed'), { code: 'JOURNAL_CORRUPT' })
    const candidate = value as Partial<TransactionJournal>
    if (typeof candidate.schemaVersion !== 'number')
      throw Object.assign(new Error('Journal schema version is missing'), {
        code: 'JOURNAL_CORRUPT'
      })
    if (candidate.schemaVersion > 1)
      throw Object.assign(new Error('Journal schema version is unsupported'), {
        code: 'JOURNAL_VERSION_UNSUPPORTED'
      })
    if (
      !candidate.journalId ||
      !candidate.operationId ||
      !candidate.installationId ||
      !candidate.deviceId ||
      !candidate.state ||
      !Number.isInteger(candidate.revision) ||
      !Array.isArray(candidate.sourceFingerprints) ||
      !Array.isArray(candidate.candidates) ||
      !Array.isArray(candidate.backups)
    )
      throw Object.assign(new Error('Journal fields are malformed'), { code: 'JOURNAL_CORRUPT' })
    if (candidate.schemaVersion === 0) {
      const migrated = {
        ...candidate,
        schemaVersion: 1,
        revision: candidate.revision! + 1,
        intents: candidate.intents ?? [],
        outcomes: candidate.outcomes ?? [],
        recoveryInstructions: candidate.recoveryInstructions ?? [],
        updatedAt: this.now().toISOString()
      } as TransactionJournal
      await this.store.put(migrated)
      return migrated
    }
    return candidate as TransactionJournal
  }

  async markRecoveryPending(
    journalId: string,
    expectedRevision: number,
    instructions: string[]
  ): Promise<TransactionJournal> {
    const current = await this.store.get(journalId)
    if (!current) throw Object.assign(new Error('Journal not found'), { code: 'JOURNAL_NOT_FOUND' })
    if (current.revision !== expectedRevision)
      throw Object.assign(new Error('Journal revision changed'), { code: 'STALE_REVISION' })
    const value = {
      ...current,
      revision: current.revision + 1,
      state: 'recovery-pending' as const,
      recoveryInstructions: instructions,
      updatedAt: this.now().toISOString()
    }
    await this.store.put(value)
    return value
  }

  async transition(
    journalId: string,
    expectedRevision: number,
    state: TransactionState,
    patch: Partial<TransactionJournal> = {}
  ): Promise<TransactionJournal> {
    const current = await this.store.get(journalId)
    if (!current) throw Object.assign(new Error('Journal not found'), { code: 'JOURNAL_NOT_FOUND' })
    if (current.revision !== expectedRevision)
      throw Object.assign(new Error('Journal revision changed'), { code: 'STALE_REVISION' })
    if (!NEXT[current.state]?.includes(state))
      throw Object.assign(new Error(`Invalid journal transition ${current.state} -> ${state}`), {
        code: 'INVALID_JOURNAL_TRANSITION'
      })
    const value = {
      ...current,
      ...patch,
      journalId: current.journalId,
      schemaVersion: current.schemaVersion,
      revision: current.revision + 1,
      state,
      updatedAt: this.now().toISOString()
    }
    await this.store.put(value)
    return value
  }
}
