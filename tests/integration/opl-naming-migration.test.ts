import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { NamingAuditService } from '@electron/services/naming/naming-audit.service'
import { NamingPlanService } from '@electron/services/naming/naming-plan.service'
import { NamingTransactionService } from '@electron/services/naming/naming-transaction.service'
import { NamingRecoveryService } from '@electron/services/naming/naming-recovery.service'
import { structuredIso } from '../fixtures/images/generate-fixtures'

const roots: string[] = []
afterEach(async () =>
  Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
)
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

describe('existing OPL naming migration', () => {
  it('audits and renames while preserving hash and inode/extents identity', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'opl-naming-'))
    roots.push(root)
    await Promise.all([mkdir(path.join(root, 'DVD')), mkdir(path.join(root, 'CD'))])
    const bytes = structuredIso('SLUS_321.00', 'BOOT2 = cdrom0:\\SLUS_321.00;1\r\n', 40)
    const source = path.join(root, 'DVD', 'My Game.iso')
    await writeFile(source, bytes)
    const inode = (await stat(source)).ino
    const audit = await new NamingAuditService().audit(root, 'd1')
    expect(audit.items[0].classification).toBe('correctable')
    const plans = new NamingPlanService()
    const plan = plans.create(audit, audit.revision)
    const result = await new NamingTransactionService().execute(
      root,
      'o1',
      plans.steps(plan.planId)
    )
    const destination = path.join(root, audit.items[0].canonicalRelativePath!)
    expect(result.items[0].state).toBe('renamed')
    expect(digest(await readFile(destination))).toBe(digest(bytes))
    expect((await stat(destination)).ino).toBe(inode)
  })

  it('recovers a crash between destination rename and journal completion', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'opl-naming-recovery-'))
    roots.push(root)
    await mkdir(path.join(root, 'DVD'))
    await mkdir(path.join(root, '.oplforge-staging'))
    const from = 'DVD/old.iso'
    const to = 'DVD/SLUS_123.45.Game.iso'
    const temporary = 'DVD/.oplforge-rename-i1.tmp'
    await writeFile(path.join(root, from), 'bytes')
    await rename(path.join(root, from), path.join(root, to))
    await writeFile(
      path.join(root, '.oplforge-staging', 'naming-crash.json'),
      JSON.stringify({
        state: 'recovery-pending',
        completed: ['i1'],
        steps: [
          {
            itemId: 'i1',
            fromRelativePath: from,
            temporaryRelativePath: temporary,
            toRelativePath: to
          }
        ]
      })
    )
    expect(await new NamingRecoveryService().reconcile(root)).toBe(1)
    expect(await readFile(path.join(root, from), 'utf8')).toBe('bytes')
  })

  it('concludes a stale running journal when the canonical destination is already proven', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'opl-naming-running-'))
    roots.push(root)
    await mkdir(path.join(root, 'DVD'))
    await mkdir(path.join(root, '.oplforge-staging'))
    const from = 'DVD/old.iso'
    const to = 'DVD/SLUS_123.45.Game.iso'
    await writeFile(path.join(root, to), 'bytes')
    const journal = path.join(root, '.oplforge-staging', 'naming-running.json')
    await writeFile(
      journal,
      JSON.stringify({
        state: 'running',
        completed: [],
        steps: [
          {
            itemId: 'i1',
            fromRelativePath: from,
            temporaryRelativePath: 'DVD/.tmp',
            toRelativePath: to
          }
        ]
      })
    )
    expect(await new NamingRecoveryService().reconcile(root)).toBe(1)
    expect(await readFile(path.join(root, to), 'utf8')).toBe('bytes')
    await expect(stat(journal)).rejects.toBeTruthy()
  })
})
