import path from 'node:path'
import { JsonStore, type VersionedDocument } from '../persistence/json-store.service'
import type {
  FragmentationDiagnostic,
  RepairOperation,
  RepairPlan,
  RepairReport,
  TransactionJournal
} from '../../../src/types/opl'

export const FRAGMENTATION_REPAIR_STORE_VERSION = 1

export class AtomicEntityStore<T extends object> {
  private readonly store: JsonStore<Record<string, T>>
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(
    filePath: string,
    private readonly idKey: keyof T
  ) {
    this.store = new JsonStore(filePath, FRAGMENTATION_REPAIR_STORE_VERSION, () => ({}))
  }

  async get(id: string): Promise<T | undefined> {
    return (await this.store.read()).data[id]
  }

  async list(): Promise<T[]> {
    return Object.values((await this.store.read()).data)
  }

  async put(
    entity: T,
    expectedStoreRevision?: number
  ): Promise<VersionedDocument<Record<string, T>>> {
    const id = entity[this.idKey] as unknown
    if (typeof id !== 'string' || id.length === 0)
      throw new TypeError(`Missing entity key ${String(this.idKey)}`)
    const write = this.writeQueue.then(async () => {
      const current = await this.store.read()
      return this.store.write(
        { ...current.data, [id]: entity },
        expectedStoreRevision ?? current.revision
      )
    })
    this.writeQueue = write.then(
      () => undefined,
      () => undefined
    )
    return write
  }
}

export interface FragmentationRepairStores {
  diagnostics: AtomicEntityStore<FragmentationDiagnostic>
  plans: AtomicEntityStore<RepairPlan>
  operations: AtomicEntityStore<RepairOperation>
  journals: AtomicEntityStore<TransactionJournal>
  reports: AtomicEntityStore<RepairReport>
}

export function createFragmentationRepairStores(userDataPath: string): FragmentationRepairStores {
  const root = path.join(userDataPath, 'fragmentation-repair')
  return {
    diagnostics: new AtomicEntityStore<FragmentationDiagnostic>(
      path.join(root, 'diagnostics.json'),
      'diagnosticId'
    ),
    plans: new AtomicEntityStore<RepairPlan>(path.join(root, 'plans.json'), 'planId'),
    operations: new AtomicEntityStore<RepairOperation>(
      path.join(root, 'operations.json'),
      'operationId'
    ),
    journals: new AtomicEntityStore<TransactionJournal>(
      path.join(root, 'journals.json'),
      'journalId'
    ),
    reports: new AtomicEntityStore<RepairReport>(path.join(root, 'reports.json'), 'reportId')
  }
}
