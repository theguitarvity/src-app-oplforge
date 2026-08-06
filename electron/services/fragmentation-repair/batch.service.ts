import { statfs } from 'node:fs/promises'
import type { RepairItemResult, RepairPlan, SerializableError } from '../../../src/types/opl'
import type { FragmentationTransactionService } from './transaction.service'

export interface BatchExecutionResult {
  items: RepairItemResult[]
  modifiedFiles: Record<string, string[]>
}
type FreeBytes = (deviceRoot: string) => Promise<number>
const defaultFreeBytes: FreeBytes = async (root) => {
  const value = await statfs(root, { bigint: true })
  return Number(value.bavail * value.bsize)
}
const SAFE_CONTINUATION = new Set([
  'FILE_LOCKED',
  'SOURCE_CHANGED',
  'INSUFFICIENT_SPACE',
  'STILL_FRAGMENTED',
  'HASH_MISMATCH',
  'STRUCTURE_INVALID'
])

export class FragmentationBatchService {
  private readonly cancelled = new Set<string>()
  constructor(
    private readonly transaction: Pick<FragmentationTransactionService, 'execute' | 'cancel'>,
    private readonly freeBytes: FreeBytes = defaultFreeBytes
  ) {}

  cancel(operationId: string) {
    this.cancelled.add(operationId)
    this.transaction.cancel(operationId)
  }

  async execute(
    operationId: string,
    plan: RepairPlan,
    deviceRoot: string,
    onItem?: (index: number, result?: RepairItemResult) => void
  ): Promise<BatchExecutionResult> {
    const ordered = [...plan.items].sort(
      (left, right) =>
        left.order - right.order ||
        left.installation.installationId.localeCompare(right.installation.installationId)
    )
    const items: RepairItemResult[] = []
    const modifiedFiles: Record<string, string[]> = {}
    let unsafe = false
    for (let index = 0; index < ordered.length; index += 1) {
      const item = ordered[index]
      const installationId = item.installation.installationId
      if (this.cancelled.has(operationId)) {
        items.push({ installationId, outcome: 'cancelled' })
        continue
      }
      if (unsafe) {
        items.push({ installationId, outcome: 'skipped' })
        continue
      }
      onItem?.(index)
      if ((await this.freeBytes(deviceRoot)) < item.temporaryBytes) {
        const error: SerializableError = {
          code: 'INSUFFICIENT_SPACE',
          message: 'Espaço livre insuficiente na revalidação do item.',
          retryable: true
        }
        const result = { installationId, outcome: 'failed' as const, error }
        items.push(result)
        onItem?.(index, result)
        continue
      }
      try {
        const transaction = await this.transaction.execute(operationId, plan, item, deviceRoot)
        const outcome =
          transaction.journal.state === 'aborted-unchanged'
            ? ('cancelled' as const)
            : ('corrected' as const)
        modifiedFiles[installationId] = transaction.modifiedFiles
        const result = { installationId, outcome }
        items.push(result)
        onItem?.(index, result)
      } catch (caught) {
        const value = caught as { code?: string; message?: string }
        const code = value.code ?? 'INTERNAL_ERROR'
        const safe = SAFE_CONTINUATION.has(code)
        const error: SerializableError = {
          code,
          message: value.message ?? 'Falha no item do lote.',
          retryable: safe
        }
        const result = {
          installationId,
          outcome: safe ? ('failed' as const) : ('recovery-pending' as const),
          error
        }
        items.push(result)
        onItem?.(index, result)
        unsafe = !safe
      }
    }
    this.cancelled.delete(operationId)
    return { items, modifiedFiles }
  }
}
