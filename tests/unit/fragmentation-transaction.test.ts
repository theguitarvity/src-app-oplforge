import { createHash } from 'node:crypto'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { FragmentationCandidateService } from '../../electron/services/fragmentation-repair/candidate.service'
import { createFragmentationRepairStores } from '../../electron/services/fragmentation-repair/store'
import { TransactionJournalStore } from '../../electron/services/fragmentation-repair/journal.store'
import { FragmentationTransactionService } from '../../electron/services/fragmentation-repair/transaction.service'
import type { RepairPlan, RepairPlanItem } from '../../src/types/opl'

describe('fragmentation candidate gates', () => {
  it('rejects a stale source fingerprint before promotion', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'candidate-'))
    const source = path.join(root, 'game.iso')
    const bytes = syntheticIso()
    await writeFile(source, bytes)
    const service = new FragmentationCandidateService({
      platform: 'linux',
      inspect: async () => ({
        state: 'contiguous',
        verification: 'verified',
        extents: 1,
        method: 'fake',
        detail: 'one'
      })
    })
    await expect(
      service.create(
        source,
        'op',
        { relativePath: 'game.iso', sizeBytes: bytes.length, sha256: '0'.repeat(64) },
        'ISO'
      )
    ).rejects.toMatchObject({ code: 'HASH_MISMATCH' })
    expect(await readFile(source)).toEqual(bytes)
  })

  it('rejects a candidate that remains fragmented and preserves the source', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'candidate-'))
    const source = path.join(root, 'game.iso')
    const bytes = syntheticIso()
    await writeFile(source, bytes)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const service = new FragmentationCandidateService({
      platform: 'linux',
      inspect: async () => ({
        state: 'fragmented',
        verification: 'verified',
        extents: 2,
        method: 'fake',
        detail: 'two'
      })
    })
    await expect(
      service.create(
        source,
        'op',
        { relativePath: 'game.iso', sizeBytes: bytes.length, sha256 },
        'ISO'
      )
    ).rejects.toMatchObject({ code: 'STILL_FRAGMENTED' })
    expect(await readFile(source)).toEqual(bytes)
  })

  it('validates every multipart candidate before the first rename and leaves contiguous parts untouched', async () => {
    const fixture = await multipartFixture()
    const boundaries: string[] = []
    const transaction = new FragmentationTransactionService(
      fixture.adapter,
      new FragmentationCandidateService(fixture.adapter),
      fixture.journals,
      () => 'journal',
      () => new Date(),
      async (boundary, relative) => {
        boundaries.push(`${boundary}:${relative}`)
      }
    )
    const result = await transaction.execute('operation', fixture.plan, fixture.item, fixture.root)
    expect(result.modifiedFiles).toEqual(['ul.a.SLUS_123.45.00', 'ul.a.SLUS_123.45.02'])
    expect(
      boundaries.findIndex((value) => value.startsWith('before-backup-rename'))
    ).toBeGreaterThan(
      boundaries.map((value) => value.startsWith('candidate-verified')).lastIndexOf(true)
    )
    expect(await readFile(path.join(fixture.root, 'ul.a.SLUS_123.45.01'), 'utf8')).toBe(
      'contiguous-one'
    )
  })
})

function syntheticIso(): Buffer {
  const buffer = Buffer.alloc(18 * 2048)
  const offset = 16 * 2048
  buffer[offset] = 1
  buffer.write('CD001', offset + 1)
  buffer.writeUInt32LE(18, offset + 80)
  return buffer
}

async function multipartFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'multipart-'))
  const data = await mkdtemp(path.join(tmpdir(), 'multipart-data-'))
  const values = ['fragmented-zero', 'contiguous-one', 'fragmented-two']
  const paths = values.map((_, index) => `ul.a.SLUS_123.45.0${index}`)
  await Promise.all(
    paths.map((relative, index) => writeFile(path.join(root, relative), values[index]))
  )
  const fingerprints = paths.map((relativePath, index) => ({
    relativePath,
    sizeBytes: Buffer.byteLength(values[index]),
    sha256: createHash('sha256').update(values[index]).digest('hex')
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
    filesToRewrite: [paths[0], paths[2]],
    ulCfgAction: 'none',
    candidateBytes: 1,
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
  return {
    root,
    plan,
    item,
    adapter,
    journals: new TransactionJournalStore(createFragmentationRepairStores(data).journals)
  }
}
