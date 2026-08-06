import type {
  FragmentationDiagnostic,
  FragmentationRepairConfirmation,
  RepairEvent,
  RepairOperation,
  RepairPlan,
  SerializableError
} from '../../../src/types/opl'
import type { FragmentationRepairReportService } from './report.service'
import type { AtomicEntityStore } from './store'
import type { FragmentationTransactionService } from './transaction.service'
import type { FragmentationBatchService } from './batch.service'
import type { FragmentationRepairAuditService } from './audit.service'

export class FragmentationRepairService {
  private sequence = new Map<string, number>()
  private confirming = new Set<string>()
  constructor(
    private readonly plans: AtomicEntityStore<RepairPlan>,
    private readonly operations: AtomicEntityStore<RepairOperation>,
    private readonly diagnostics: FragmentationRepairReportService,
    private readonly transaction: FragmentationTransactionService,
    private readonly getDiagnostic: (id: string) => Promise<FragmentationDiagnostic | undefined>,
    private readonly createId: () => string,
    private readonly now: () => Date,
    private readonly batch?: FragmentationBatchService,
    private readonly audit?: FragmentationRepairAuditService
  ) {}

  async confirm(
    input: FragmentationRepairConfirmation,
    publish: (event: RepairEvent) => void
  ): Promise<RepairOperation> {
    if (this.confirming.has(input.planId))
      throw Object.assign(new Error('Repair plan was already used'), { code: 'PLAN_ALREADY_USED' })
    this.confirming.add(input.planId)
    try {
      const plan = await this.plans.get(input.planId)
      if (!plan) throw Object.assign(new Error('Repair plan not found'), { code: 'PLAN_NOT_FOUND' })
      if (input.confirmation !== 'CORRIGIR FRAGMENTAÇÃO')
        throw Object.assign(new Error('Explicit confirmation is required'), {
          code: 'CONFIRMATION_REQUIRED'
        })
      if (plan.revision !== input.expectedRevision)
        throw Object.assign(new Error('Repair plan revision changed'), { code: 'STALE_REVISION' })
      if (plan.status !== 'awaiting-confirmation')
        throw Object.assign(new Error('Repair plan was already used'), {
          code: 'PLAN_ALREADY_USED'
        })
      if (plan.mode === 'single' && plan.items.length !== 1)
        throw Object.assign(new Error('Single repair requires exactly one item'), {
          code: 'INVALID_SELECTION'
        })
      if (plan.mode === 'batch' && (!this.batch || plan.items.length === 0))
        throw Object.assign(new Error('Batch repair is unavailable'), { code: 'INVALID_SELECTION' })
      await this.plans.put({ ...plan, revision: plan.revision + 1, status: 'consumed' })
      const operation: RepairOperation = {
        operationId: this.createId(),
        planId: plan.planId,
        expectedDeviceRevision: plan.diagnosticRevision,
        status: 'running',
        currentItemIndex: 0,
        items: plan.items.map(({ installation }) => ({
          installationId: installation.installationId,
          outcome: 'unchanged'
        })),
        lastSequence: 0,
        startedAt: this.now().toISOString()
      }
      await this.operations.put(operation)
      await this.audit?.confirmation(plan.planId, operation)
      void this.run(operation, plan, publish)
      return operation
    } finally {
      this.confirming.delete(input.planId)
    }
  }

  cancel(operationId: string) {
    this.transaction.cancel(operationId)
    this.batch?.cancel(operationId)
  }
  getOperation(operationId: string) {
    return this.operations.get(operationId)
  }
  getReport(reportId: string) {
    return this.diagnostics.get(reportId)
  }
  getReportByOperation(operationId: string) {
    return this.diagnostics.byOperation(operationId)
  }

  private async run(
    initial: RepairOperation,
    plan: RepairPlan,
    publish: (event: RepairEvent) => void
  ) {
    const original = await this.getDiagnostic(plan.diagnosticId)
    if (!original) return
    if (plan.mode === 'batch' && this.batch) {
      const batch = await this.batch.execute(
        initial.operationId,
        plan,
        original.device.mountPath,
        (index, result) => {
          const item = plan.items[index]
          this.emit(
            publish,
            initial.operationId,
            item.installation.installationId,
            result ? (result.outcome === 'corrected' ? 'cleanup-complete' : 'restored') : 'staging',
            result ? 1 : 0,
            result ? `Item ${result.outcome}` : 'Preparando item do lote'
          )
        }
      )
      const recoveryPending = batch.items.some(({ outcome }) => outcome === 'recovery-pending')
      const cancelled = batch.items.some(({ outcome }) => outcome === 'cancelled')
      const failed = batch.items.some(({ outcome }) => outcome === 'failed')
      const operation: RepairOperation = {
        ...initial,
        status: recoveryPending
          ? 'recovery-pending'
          : cancelled
            ? 'cancelled'
            : failed
              ? 'failed'
              : 'completed',
        currentItemIndex: undefined,
        items: batch.items,
        lastSequence: this.sequence.get(initial.operationId) ?? 0,
        completedAt: this.now().toISOString()
      }
      await this.operations.put(operation)
      const report = await this.diagnostics.terminalBatch(
        plan,
        operation,
        original,
        batch.modifiedFiles
      )
      await this.audit?.outcome(report)
      return
    }
    let operation = initial
    let modifiedFiles: string[] = []
    let error: SerializableError | undefined
    try {
      this.emit(
        publish,
        operation.operationId,
        plan.items[0].installation.installationId,
        'staging',
        0,
        'Preparando candidata'
      )
      const result = await this.transaction.execute(
        operation.operationId,
        plan,
        plan.items[0],
        original.device.mountPath
      )
      modifiedFiles = result.modifiedFiles
      const cancelled = result.journal.state === 'aborted-unchanged'
      operation = {
        ...operation,
        status: cancelled ? 'cancelled' : 'completed',
        currentItemIndex: undefined,
        items: [
          {
            installationId: plan.items[0].installation.installationId,
            outcome: cancelled ? 'cancelled' : 'corrected'
          }
        ],
        completedAt: this.now().toISOString()
      }
    } catch (caught) {
      error = safeError(caught)
      operation = {
        ...operation,
        status: error.code === 'CANCELLED' ? 'cancelled' : 'failed',
        currentItemIndex: undefined,
        items: [
          {
            installationId: plan.items[0].installation.installationId,
            outcome: error.code === 'CANCELLED' ? 'cancelled' : 'failed',
            error
          }
        ],
        completedAt: this.now().toISOString()
      }
    }
    operation.lastSequence = this.sequence.get(operation.operationId) ?? 0
    await this.operations.put(operation)
    const report = await this.diagnostics.terminal(
      plan,
      operation,
      original,
      operation.items[0].outcome,
      modifiedFiles,
      error
    )
    await this.audit?.outcome(report)
    this.emit(
      publish,
      operation.operationId,
      plan.items[0].installation.installationId,
      operation.status === 'completed' ? 'cleanup-complete' : 'restored',
      1,
      operation.status === 'completed' ? 'Correção concluída' : 'Correção encerrada'
    )
  }

  private emit(
    publish: (event: RepairEvent) => void,
    operationId: string,
    installationId: string,
    phase: RepairEvent['phase'],
    progress: number,
    message: string
  ) {
    const sequence = (this.sequence.get(operationId) ?? 0) + 1
    this.sequence.set(operationId, sequence)
    publish({
      operationId,
      installationId,
      sequence,
      phase,
      progress,
      message,
      timestamp: this.now().toISOString()
    })
  }
}

function safeError(error: unknown): SerializableError {
  const value = error as { code?: string; message?: string }
  return {
    code: value.code ?? 'INTERNAL_ERROR',
    message: value.code
      ? (value.message ?? 'Repair failed')
      : 'Fragmentation repair failed unexpectedly',
    retryable: [
      'SOURCE_CHANGED',
      'FILE_LOCKED',
      'INSUFFICIENT_SPACE',
      'STILL_FRAGMENTED',
      'CANCELLED'
    ].includes(value.code ?? '')
  }
}
