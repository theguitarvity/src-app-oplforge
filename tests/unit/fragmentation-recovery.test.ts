import { createHash } from 'node:crypto'
import { access, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { TransactionJournal } from '@/types/opl'
import { TransactionJournalStore } from '@electron/services/fragmentation-repair/journal.store'
import { FragmentationRecoveryService } from '@electron/services/fragmentation-repair/recovery.service'

const hash = (value: string) => createHash('sha256').update(value).digest('hex')

function setupJournal(state: TransactionJournal['state'], originalHash = hash('original')) {
  let current: TransactionJournal = {
    journalId: 'journal-1',
    schemaVersion: 1,
    revision: 10,
    operationId: 'operation-1',
    installationId: 'installation-1',
    deviceId: 'device-1',
    state,
    sourceFingerprints: [{ relativePath: 'DVD/game.iso', sizeBytes: 8, sha256: originalHash }],
    candidates: [],
    backups: [
      {
        relativePath: 'DVD/game.iso.operation-1.backup',
        sizeBytes: 8,
        sha256: originalHash,
        extentState: 'not-applicable'
      }
    ],
    ulCfgAction: 'none',
    intents: [],
    outcomes: [],
    recoveryInstructions: [],
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
  const backing = {
    get: vi.fn(async () => current),
    put: vi.fn(async (next: TransactionJournal) => {
      current = next
      return {}
    })
  }
  return { journals: new TransactionJournalStore(backing as never), current: () => current }
}

async function rootFiles(active: string, backup: string) {
  const root = await mkdtemp(path.join(tmpdir(), 'fragmentation-recovery-'))
  await mkdir(path.join(root, 'DVD'))
  await writeFile(path.join(root, 'DVD/game.iso'), active)
  await writeFile(path.join(root, 'DVD/game.iso.operation-1.backup'), backup)
  return root
}

describe('fragmentation recovery authority', () => {
  it('rolls back to the verified original idempotently', async () => {
    const root = await rootFiles('candidate', 'original')
    const setup = setupJournal('rolling-back')
    const recovery = new FragmentationRecoveryService(setup.journals)
    await expect(recovery.recover('journal-1', root)).resolves.toMatchObject({ state: 'restored' })
    expect(await readFile(path.join(root, 'DVD/game.iso'), 'utf8')).toBe('original')
    await expect(access(path.join(root, 'DVD/game.iso.operation-1.backup'))).rejects.toBeTruthy()
    await expect(recovery.recover('journal-1', root)).resolves.toMatchObject({ state: 'restored' })
    expect(await readFile(path.join(root, 'DVD/game.iso'), 'utf8')).toBe('original')
  })

  it('cleans only verified post-commit backup residue', async () => {
    const root = await rootFiles('original', 'original')
    const setup = setupJournal('cleanup-pending')
    const result = await new FragmentationRecoveryService(setup.journals).recover('journal-1', root)
    expect(result.state).toBe('restored')
    expect(setup.current().state).toBe('cleanup-complete')
    expect(await readFile(path.join(root, 'DVD/game.iso'), 'utf8')).toBe('original')
    await expect(access(path.join(root, 'DVD/game.iso.operation-1.backup'))).rejects.toBeTruthy()
  })

  it('preserves every file and requires manual recovery when authority is ambiguous', async () => {
    const root = await rootFiles('candidate', 'unknown-backup')
    const setup = setupJournal('rolling-back')
    const result = await new FragmentationRecoveryService(setup.journals).recover('journal-1', root)
    expect(result).toMatchObject({ state: 'recovery-pending' })
    expect(result.instructions.join(' ')).toMatch(/manual|ambígu|fingerprint/i)
    expect(await readFile(path.join(root, 'DVD/game.iso'), 'utf8')).toBe('candidate')
    expect(await readFile(path.join(root, 'DVD/game.iso.operation-1.backup'), 'utf8')).toBe(
      'unknown-backup'
    )
  })
})
