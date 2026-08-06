import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { RepairReport } from '@/types/opl'
import { AuditLogService } from '@electron/services/persistence/audit-log.service'
import { FragmentationRepairAuditService } from '@electron/services/fragmentation-repair/audit.service'

describe('fragmentation audit', () => {
  it('records safe identifiers/outcomes and relative modifications without sensitive device paths', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'fragmentation-audit-'))
    const file = path.join(root, 'audit.jsonl')
    const history = vi.fn(async () => undefined)
    const audit = new FragmentationRepairAuditService(new AuditLogService(file), history)
    const report = {
      reportId: 'report',
      operationId: 'operation',
      planId: 'plan',
      result: 'completed',
      games: [{ modifiedFiles: ['DVD/game.iso'] }],
      counts: {
        corrected: 1,
        unchanged: 0,
        skipped: 0,
        failed: 0,
        cancelled: 0,
        'recovery-pending': 0
      }
    } as RepairReport
    await audit.outcome(report)
    const persisted = await readFile(file, 'utf8')
    expect(persisted).toContain('DVD/game.iso')
    expect(persisted).not.toContain('/media/private')
    expect(persisted).not.toMatch(/sourceFingerprint|mountPath|realPath/)
    expect(history).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'Correção de fragmentação', result: 'success' })
    )
  })
})
