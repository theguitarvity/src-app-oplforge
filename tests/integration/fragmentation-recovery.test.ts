import { createHash } from 'node:crypto'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createFragmentationRepairStores } from '../../electron/services/fragmentation-repair/store'
import { TransactionJournalStore } from '../../electron/services/fragmentation-repair/journal.store'
import { FragmentationRecoveryService } from '../../electron/services/fragmentation-repair/recovery.service'

describe('fragmentation recovery integration', () => {
  it('restores the verified original after interruption during promotion and never promotes the candidate', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'recovery-device-'))
    const data = await mkdtemp(path.join(tmpdir(), 'recovery-data-'))
    const relativePath = 'game.iso'
    const source = path.join(root, relativePath)
    const backup = `${source}.operation.backup`
    const original = Buffer.from('verified original')
    const candidate = Buffer.from('untrusted candidate')
    await writeFile(source, candidate)
    await writeFile(backup, original)
    const journals = new TransactionJournalStore(createFragmentationRepairStores(data).journals)
    let journal = await journals.create({
      journalId: 'journal',
      operationId: 'operation',
      installationId: 'installation',
      deviceId: 'device',
      state: 'planned',
      sourceFingerprints: [{ relativePath, sizeBytes: original.length, sha256: hash(original) }],
      candidates: [
        {
          relativePath: '.game.candidate',
          sizeBytes: candidate.length,
          sha256: hash(candidate),
          extentState: 'contiguous'
        }
      ],
      backups: [
        {
          relativePath: path.basename(backup),
          sizeBytes: original.length,
          sha256: hash(original),
          extentState: 'not-applicable'
        }
      ],
      ulCfgAction: 'none',
      intents: [],
      outcomes: [],
      recoveryInstructions: []
    })
    for (const state of [
      'preflight-validated',
      'staging',
      'candidate-verified',
      'commit-intent',
      'promoting'
    ] as const)
      journal = await journals.transition(journal.journalId, journal.revision, state)
    const recovered = await new FragmentationRecoveryService(journals).recover(
      journal.journalId,
      root
    )
    expect(recovered.state).toBe('restored')
    expect(await readFile(source)).toEqual(original)
  })

  it('preserves journal authority as recovery-pending while the device is absent', async () => {
    const data = await mkdtemp(path.join(tmpdir(), 'recovery-data-'))
    const journals = new TransactionJournalStore(createFragmentationRepairStores(data).journals)
    let journal = await journals.create({
      journalId: 'absent',
      operationId: 'operation',
      installationId: 'installation',
      deviceId: 'device',
      state: 'planned',
      sourceFingerprints: [
        { relativePath: 'game.iso', sizeBytes: 1, sha256: hash(Buffer.from('x')) }
      ],
      candidates: [],
      backups: [],
      ulCfgAction: 'none',
      intents: [],
      outcomes: [],
      recoveryInstructions: []
    })
    for (const state of [
      'preflight-validated',
      'staging',
      'candidate-verified',
      'commit-intent'
    ] as const)
      journal = await journals.transition(journal.journalId, journal.revision, state)
    const recovered = await new FragmentationRecoveryService(journals).recover(
      journal.journalId,
      path.join(tmpdir(), 'missing-device-for-recovery')
    )
    expect(recovered).toMatchObject({ state: 'recovery-pending', revision: journal.revision + 1 })
    expect(recovered.instructions[0]).toContain('Reconnect')
  })
})

function hash(value: Buffer) {
  return createHash('sha256').update(value).digest('hex')
}
