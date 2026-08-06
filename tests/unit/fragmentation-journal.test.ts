import { describe, expect, it, vi } from 'vitest'
import type { TransactionJournal } from '@/types/opl'
import { TransactionJournalStore } from '@electron/services/fragmentation-repair/journal.store'

const journal = (patch: Partial<TransactionJournal> = {}): TransactionJournal => ({
  journalId: 'journal-1',
  schemaVersion: 1,
  revision: 4,
  operationId: 'operation-1',
  installationId: 'installation-1',
  deviceId: 'device-1',
  state: 'staging',
  sourceFingerprints: [{ relativePath: 'DVD/game.iso', sizeBytes: 8, sha256: 'a'.repeat(64) }],
  candidates: [],
  backups: [],
  ulCfgAction: 'none',
  intents: [],
  outcomes: [],
  recoveryInstructions: [],
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...patch
})

function backing(value: unknown, failure?: Error) {
  let current = value
  return {
    get: vi.fn(async () => {
      if (failure) throw failure
      return current as TransactionJournal
    }),
    put: vi.fn(async (next: TransactionJournal) => {
      current = next
      return {}
    })
  }
}

describe('transaction journal validation and migration', () => {
  it('loads a valid current journal without rewriting it', async () => {
    const store = backing(journal())
    await expect(
      new TransactionJournalStore(store as never).loadValidated('journal-1')
    ).resolves.toEqual(journal())
    expect(store.put).not.toHaveBeenCalled()
  })

  it('maps torn JSON reads and structurally corrupt journals to JOURNAL_CORRUPT', async () => {
    const torn = backing(undefined, new SyntaxError('Unexpected end of JSON input'))
    await expect(
      new TransactionJournalStore(torn as never).loadValidated('journal-1')
    ).rejects.toMatchObject({ code: 'JOURNAL_CORRUPT' })
    const corrupt = backing({
      journalId: 'journal-1',
      schemaVersion: 1,
      revision: 2,
      state: 'staging'
    })
    await expect(
      new TransactionJournalStore(corrupt as never).loadValidated('journal-1')
    ).rejects.toMatchObject({ code: 'JOURNAL_CORRUPT' })
  })

  it('migrates v0 monotonically and rejects unknown future schemas', async () => {
    const legacy = journal({ schemaVersion: 0, revision: 7, state: 'commit-intent' })
    const store = backing(legacy)
    const migrated = await new TransactionJournalStore(store as never).loadValidated('journal-1')
    expect(migrated).toMatchObject({ schemaVersion: 1, revision: 8, state: 'commit-intent' })
    expect(store.put).toHaveBeenCalledWith(migrated)
    await expect(
      new TransactionJournalStore(backing(journal({ schemaVersion: 99 })) as never).loadValidated(
        'journal-1'
      )
    ).rejects.toMatchObject({ code: 'JOURNAL_VERSION_UNSUPPORTED' })
  })

  it('enforces monotonic state and revision transitions', async () => {
    const store = backing(journal())
    const journals = new TransactionJournalStore(store as never)
    const next = await journals.transition('journal-1', 4, 'candidate-verified')
    expect(next.revision).toBe(5)
    await expect(journals.transition('journal-1', 5, 'planned')).rejects.toMatchObject({
      code: 'INVALID_JOURNAL_TRANSITION'
    })
    await expect(journals.transition('journal-1', 4, 'commit-intent')).rejects.toMatchObject({
      code: 'STALE_REVISION'
    })
  })
})
