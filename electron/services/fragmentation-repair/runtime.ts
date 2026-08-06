import crypto from 'node:crypto'
import * as fs from 'node:fs/promises'
import path from 'node:path'
import type { FragmentationAdapter } from '../fragmentation/fragmentation-adapter'
import { LinuxFragmentationAdapter } from '../fragmentation/linux.adapter'
import { MacOsFragmentationAdapter } from '../fragmentation/macos.adapter'
import { WindowsFragmentationAdapter } from '../fragmentation/windows.adapter'
import { createFragmentationRepairStores, type FragmentationRepairStores } from './store'
import {
  FragmentationDiagnosticService,
  probeBasicDeviceCapability,
  type DeviceCapabilityProbe
} from './diagnostic.service'
import { FragmentationCandidateService } from './candidate.service'
import { TransactionJournalStore } from './journal.store'
import { FragmentationRepairReportService } from './report.service'
import { FragmentationRepairService } from './repair.service'
import { FragmentationTransactionService } from './transaction.service'
import { FragmentationPlanService } from './plan.service'
import { FragmentationRecoveryService } from './recovery.service'
import { FragmentationBatchService } from './batch.service'
import { FragmentationRepairAuditService } from './audit.service'
import { AuditLogService } from '../persistence/audit-log.service'
import { addHistory } from '../history.service'

export interface FragmentationRepairClock {
  now(): Date
}
export interface FragmentationRepairIds {
  create(): string
}

export interface FragmentationRepairFileSystem {
  access: typeof fs.access
  lstat: typeof fs.lstat
  mkdir: typeof fs.mkdir
  open: typeof fs.open
  readFile: typeof fs.readFile
  realpath: typeof fs.realpath
  rename: typeof fs.rename
  rm: typeof fs.rm
  stat: typeof fs.stat
}

export interface FragmentationRepairRuntimeDependencies {
  adapter: FragmentationAdapter
  capabilityProbe: DeviceCapabilityProbe
  clock: FragmentationRepairClock
  diagnostic: FragmentationDiagnosticService
  plan: FragmentationPlanService
  repair: FragmentationRepairService
  recovery: FragmentationRecoveryService
  fileSystem: FragmentationRepairFileSystem
  ids: FragmentationRepairIds
  platform: NodeJS.Platform
  stores: FragmentationRepairStores
  audit: FragmentationRepairAuditService
}

export type FragmentationRepairRuntime = FragmentationRepairRuntimeDependencies

export function createPlatformFragmentationAdapter(
  platform: NodeJS.Platform = process.platform
): FragmentationAdapter {
  if (platform === 'win32') return new WindowsFragmentationAdapter()
  if (platform === 'linux') return new LinuxFragmentationAdapter()
  return new MacOsFragmentationAdapter()
}

export function createFragmentationRepairRuntime(
  userDataPath: string,
  overrides: Partial<FragmentationRepairRuntimeDependencies> = {}
): FragmentationRepairRuntime {
  const platform = overrides.platform ?? process.platform
  const adapter = overrides.adapter ?? createPlatformFragmentationAdapter(platform)
  const stores = overrides.stores ?? createFragmentationRepairStores(userDataPath)
  const clock = overrides.clock ?? { now: () => new Date() }
  const ids = overrides.ids ?? { create: () => crypto.randomUUID() }
  const capabilityProbe = overrides.capabilityProbe ?? {
    probe: (devicePath: string) => probeBasicDeviceCapability(devicePath, adapter)
  }
  const audit =
    overrides.audit ??
    new FragmentationRepairAuditService(
      new AuditLogService(path.join(userDataPath, 'fragmentation-repair', 'audit.jsonl')),
      async (entry) => {
        try {
          return await addHistory(entry)
        } catch {
          return undefined
        }
      }
    )
  const diagnostic =
    overrides.diagnostic ??
    new FragmentationDiagnosticService({
      adapter,
      diagnostics: stores.diagnostics,
      probe: capabilityProbe,
      createId: ids.create,
      now: clock.now,
      audit
    })
  const journals = new TransactionJournalStore(stores.journals, clock.now)
  const transaction = new FragmentationTransactionService(
    adapter,
    new FragmentationCandidateService(adapter),
    journals,
    ids.create,
    clock.now
  )
  const reports = new FragmentationRepairReportService(
    diagnostic,
    stores.reports,
    ids.create,
    clock.now
  )
  const recovery = new FragmentationRecoveryService(journals, stores.diagnostics, audit)
  const batch = new FragmentationBatchService(transaction)
  return {
    platform,
    adapter,
    capabilityProbe,
    clock,
    ids,
    fileSystem: overrides.fileSystem ?? fs,
    stores,
    audit,
    diagnostic,
    plan: overrides.plan ?? new FragmentationPlanService(stores, ids, clock),
    repair:
      overrides.repair ??
      new FragmentationRepairService(
        stores.plans,
        stores.operations,
        reports,
        transaction,
        (id) => stores.diagnostics.get(id),
        ids.create,
        clock.now,
        batch,
        audit
      ),
    recovery: overrides.recovery ?? recovery
  }
}
