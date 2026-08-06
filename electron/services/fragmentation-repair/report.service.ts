import type {
  DiagnosticState,
  FragmentationDiagnostic,
  RepairOperation,
  RepairOutcome,
  RepairPlan,
  RepairReport,
  SerializableError
} from '../../../src/types/opl'
import type { FragmentationDiagnosticService } from './diagnostic.service'
import type { AtomicEntityStore } from './store'

export class FragmentationRepairReportService {
  constructor(
    private readonly diagnostic: FragmentationDiagnosticService,
    private readonly reports: AtomicEntityStore<RepairReport>,
    private readonly createId: () => string,
    private readonly now: () => Date
  ) {}

  async terminal(
    plan: RepairPlan,
    operation: RepairOperation,
    original: FragmentationDiagnostic,
    outcome: RepairOutcome,
    modifiedFiles: string[],
    error?: SerializableError
  ): Promise<RepairReport> {
    let final: FragmentationDiagnostic | undefined
    const limitations: string[] = []
    try {
      final = await this.diagnostic.diagnose({ devicePath: original.device.mountPath })
    } catch (diagnosticError) {
      limitations.push(`Final diagnosis unavailable: ${(diagnosticError as Error).message}`)
    }
    const item = plan.items[0]
    const finalGame = final?.installations.find(
      ({ identity }) => identity.installationId === item.installation.installationId
    )
    const effectiveOutcome =
      outcome === 'corrected' && finalGame?.state !== 'contiguous' ? 'failed' : outcome
    if (outcome === 'corrected' && !finalGame)
      limitations.push('Corrected outcome could not be confirmed by terminal diagnosis')
    const counts = emptyCounts()
    counts[effectiveOutcome] = 1
    const { mountPath: _mountPath, realPath: _realPath, ...device } = original.device
    void _mountPath
    void _realPath
    const report: RepairReport = {
      reportId: this.createId(),
      operationId: operation.operationId,
      planId: plan.planId,
      diagnosticId: plan.diagnosticId,
      device,
      result:
        effectiveOutcome === 'corrected'
          ? 'completed'
          : effectiveOutcome === 'cancelled'
            ? 'cancelled'
            : effectiveOutcome === 'recovery-pending'
              ? 'recovery-pending'
              : 'failed',
      games: [
        {
          installation: item.installation,
          previousState:
            original.installations.find(
              ({ identity }) => identity.installationId === item.installation.installationId
            )?.state ?? 'unverifiable',
          finalState: finalGame?.state as DiagnosticState | undefined,
          outcome: effectiveOutcome,
          sourceFingerprints: item.sourceFingerprints,
          candidateFingerprints: effectiveOutcome === 'corrected' ? item.sourceFingerprints : [],
          finalFingerprints:
            finalGame?.files
              .filter(({ sha256, sizeBytes }) => sha256 && sizeBytes !== undefined)
              .map((file) => ({
                relativePath: file.relativePath,
                sizeBytes: file.sizeBytes!,
                modifiedAt: file.modifiedAt,
                sha256: file.sha256!
              })) ?? [],
          modifiedFiles,
          failures: error ? [error] : [],
          rollbackDecisions:
            effectiveOutcome === 'corrected' ? [] : ['Original preserved or restored'],
          recoveryInstructions:
            effectiveOutcome === 'recovery-pending'
              ? ['Manual recovery is required; do not delete any candidate or backup.']
              : []
        }
      ],
      counts,
      startedAt: operation.startedAt,
      completedAt: this.now().toISOString(),
      limitations
    }
    await this.reports.put(report)
    return report
  }

  async terminalBatch(
    plan: RepairPlan,
    operation: RepairOperation,
    original: FragmentationDiagnostic,
    modifiedFiles: Record<string, string[]>
  ): Promise<RepairReport> {
    let final: FragmentationDiagnostic | undefined
    const limitations: string[] = []
    try {
      final = await this.diagnostic.diagnose({ devicePath: original.device.mountPath })
    } catch (error) {
      limitations.push(`Final diagnosis unavailable: ${(error as Error).message}`)
    }
    const counts = emptyCounts()
    const games = plan.items.map((item) => {
      const result = operation.items.find(
        ({ installationId }) => installationId === item.installation.installationId
      )!
      const previous = original.installations.find(
        ({ identity }) => identity.installationId === item.installation.installationId
      )
      const finalGame = final?.installations.find(
        ({ identity }) => identity.installationId === item.installation.installationId
      )
      const outcome: RepairOutcome =
        result.outcome === 'corrected' && finalGame?.state !== 'contiguous'
          ? 'failed'
          : result.outcome
      counts[outcome]++
      return {
        installation: item.installation,
        previousState: previous?.state ?? ('unverifiable' as const),
        finalState: finalGame?.state,
        outcome,
        sourceFingerprints: item.sourceFingerprints,
        candidateFingerprints: outcome === 'corrected' ? item.sourceFingerprints : [],
        finalFingerprints:
          finalGame?.files
            .filter(({ sha256, sizeBytes }) => sha256 && sizeBytes !== undefined)
            .map((file) => ({
              relativePath: file.relativePath,
              sizeBytes: file.sizeBytes!,
              modifiedAt: file.modifiedAt,
              sha256: file.sha256!
            })) ?? [],
        modifiedFiles: modifiedFiles[item.installation.installationId] ?? [],
        failures: result.error ? [result.error] : [],
        rollbackDecisions:
          outcome === 'corrected' || outcome === 'skipped'
            ? []
            : ['Original preserved or restored'],
        recoveryInstructions:
          outcome === 'recovery-pending'
            ? ['Manual recovery is required; do not continue the batch.']
            : []
      }
    })
    for (const excluded of plan.exclusions) {
      const previous = original.installations.find(
        ({ identity }) => identity.installationId === excluded.installation.installationId
      )
      counts.skipped++
      games.push({
        installation: excluded.installation,
        previousState: previous?.state ?? 'unverifiable',
        finalState: undefined,
        outcome: 'skipped',
        sourceFingerprints: [],
        candidateFingerprints: [],
        finalFingerprints: [],
        modifiedFiles: [],
        failures: [],
        rollbackDecisions: [],
        recoveryInstructions: []
      })
    }
    const outcomes = games.map(({ outcome }) => outcome)
    const result: RepairReport['result'] = outcomes.includes('recovery-pending')
      ? 'recovery-pending'
      : outcomes.every((outcome) => outcome === 'corrected' || outcome === 'skipped')
        ? 'completed'
        : outcomes.includes('corrected')
          ? 'partial'
          : outcomes.includes('cancelled')
            ? 'cancelled'
            : 'failed'
    const { mountPath: _mountPath, realPath: _realPath, ...device } = original.device
    void _mountPath
    void _realPath
    const report: RepairReport = {
      reportId: this.createId(),
      operationId: operation.operationId,
      planId: plan.planId,
      diagnosticId: plan.diagnosticId,
      device,
      result,
      games,
      counts,
      startedAt: operation.startedAt,
      completedAt: this.now().toISOString(),
      limitations
    }
    await this.reports.put(report)
    return report
  }

  get(reportId: string) {
    return this.reports.get(reportId)
  }
  async byOperation(operationId: string) {
    return (await this.reports.list()).find((report) => report.operationId === operationId)
  }
}

function emptyCounts(): Record<RepairOutcome, number> {
  return { corrected: 0, unchanged: 0, skipped: 0, failed: 0, cancelled: 0, 'recovery-pending': 0 }
}
