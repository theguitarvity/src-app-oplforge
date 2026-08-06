import type {
  FragmentationDiagnostic,
  HistoryEntry,
  RecoveryItem,
  RepairOperation,
  RepairReport
} from '../../../src/types/opl'
import type { AuditLogService } from '../persistence/audit-log.service'

type HistoryWriter = (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => Promise<unknown>

export class FragmentationRepairAuditService {
  constructor(
    private readonly audit: Pick<AuditLogService, 'record'>,
    private readonly history?: HistoryWriter
  ) {}

  async diagnosis(value: FragmentationDiagnostic): Promise<void> {
    await this.persist(
      {
        feature: 'fragmentation-repair',
        action: 'diagnosis',
        diagnosticId: value.diagnosticId,
        deviceId: value.device.deviceId,
        status: value.status,
        total: value.summary.total,
        byState: value.summary.byState
      },
      {
        operation: 'Diagnóstico de fragmentação',
        result:
          value.status === 'complete'
            ? 'success'
            : value.status === 'cancelled'
              ? 'warning'
              : 'error',
        message: `${value.summary.total} instalação(ões); estado ${value.status}.`
      }
    )
  }

  async confirmation(planId: string, operation: RepairOperation): Promise<void> {
    await this.persist({
      feature: 'fragmentation-repair',
      action: 'confirmation',
      planId,
      operationId: operation.operationId,
      itemCount: operation.items.length
    })
  }

  async outcome(report: RepairReport): Promise<void> {
    await this.persist(
      {
        feature: 'fragmentation-repair',
        action: 'outcome',
        reportId: report.reportId,
        operationId: report.operationId,
        planId: report.planId,
        result: report.result,
        counts: report.counts,
        modifiedRelativePaths: report.games.flatMap(({ modifiedFiles }) => modifiedFiles)
      },
      {
        operation: 'Correção de fragmentação',
        result:
          report.result === 'completed'
            ? 'success'
            : report.result === 'partial' || report.result === 'cancelled'
              ? 'warning'
              : 'error',
        message: `Resultado ${report.result}; ${report.games.length} instalação(ões).`
      }
    )
  }

  async recovery(action: 'automatic' | 'authorized', items: RecoveryItem[]): Promise<void> {
    await this.persist({
      feature: 'fragmentation-repair',
      action: 'recovery',
      recoveryAction: action,
      items: items.map(({ journalId, operationId, installationId, deviceId, state, revision }) => ({
        journalId,
        operationId,
        installationId,
        deviceId,
        state,
        revision
      }))
    })
  }

  private async persist(
    event: Record<string, unknown>,
    history?: Omit<HistoryEntry, 'id' | 'timestamp'>
  ): Promise<void> {
    await Promise.allSettled([
      this.audit.record(event),
      ...(history && this.history ? [this.history(history)] : [])
    ])
  }
}
