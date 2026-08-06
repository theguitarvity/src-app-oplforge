import { createHash } from 'node:crypto'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { RepairPlan, RepairPlanItem } from '../../src/types/opl'
import { FragmentationCandidateService } from '../../electron/services/fragmentation-repair/candidate.service'
import { TransactionJournalStore } from '../../electron/services/fragmentation-repair/journal.store'
import { FragmentationTransactionService } from '../../electron/services/fragmentation-repair/transaction.service'
import { createFragmentationRepairStores } from '../../electron/services/fragmentation-repair/store'

describe('USBExtreme multipart fault boundaries', () => {
  it('rolls back the exact complete set when a rename boundary fails', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'usb-fault-'))
    const data = await mkdtemp(path.join(tmpdir(), 'usb-fault-data-'))
    const paths = ['ul.a.SLUS_123.45.00', 'ul.a.SLUS_123.45.01']
    const contents = ['original-zero', 'original-one']
    await Promise.all(
      paths.map((relative, index) => writeFile(path.join(root, relative), contents[index]))
    )
    const fingerprints = paths.map((relativePath, index) => ({
      relativePath,
      sizeBytes: Buffer.byteLength(contents[index]),
      sha256: createHash('sha256').update(contents[index]).digest('hex')
    }))
    const item: RepairPlanItem = {
      installation: {
        installationId: 'installation',
        deviceId: 'device',
        format: 'USBExtreme',
        relativePaths: paths,
        gameId: 'SLUS_123.45',
        title: 'Game',
        media: 'DVD'
      },
      sourceFingerprints: fingerprints,
      filesToRewrite: paths,
      ulCfgAction: 'none',
      candidateBytes: 10,
      operationalMarginBytes: 1,
      temporaryBytes: 1,
      risks: [],
      order: 0
    }
    const plan = {
      planId: 'plan',
      revision: 0,
      diagnosticId: 'diagnostic',
      diagnosticRevision: 1,
      deviceId: 'device',
      mode: 'single',
      status: 'awaiting-confirmation',
      items: [item],
      exclusions: [],
      peakTemporaryBytes: 1,
      freeBytesObserved: 1e9,
      confirmationText: 'CORRIGIR FRAGMENTAÇÃO',
      recoveryStrategy: 'rollback',
      createdAt: new Date().toISOString()
    } as RepairPlan
    const adapter = {
      platform: 'linux' as const,
      inspect: async () => ({
        state: 'contiguous' as const,
        verification: 'verified' as const,
        extents: 1,
        method: 'fake',
        detail: 'one'
      })
    }
    let promoted = 0
    const transaction = new FragmentationTransactionService(
      adapter,
      new FragmentationCandidateService(adapter),
      new TransactionJournalStore(createFragmentationRepairStores(data).journals),
      () => 'journal',
      () => new Date(),
      async (boundary) => {
        if (boundary === 'after-candidate-rename' && ++promoted === 2)
          throw new Error('simulated unplug')
      }
    )
    await expect(transaction.execute('operation', plan, item, root)).rejects.toThrow(
      'simulated unplug'
    )
    expect(
      await Promise.all(paths.map((relative) => readFile(path.join(root, relative), 'utf8')))
    ).toEqual(contents)
  })
})
