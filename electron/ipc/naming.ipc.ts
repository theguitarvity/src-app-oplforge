import type { IpcMain } from 'electron'
import { listDevices } from '../services/device.service'
import { NamingAuditService } from '../services/naming/naming-audit.service'
import { NamingPlanService } from '../services/naming/naming-plan.service'
import {
  NamingTransactionService,
  type NamingOperationResult
} from '../services/naming/naming-transaction.service'
import { deviceLocks } from '../services/persistence/device-lock.service'
import { parseInput } from './schemas'
import { sendLog, sendProgress } from '../services/logger'
import { NamingRecoveryService } from '../services/naming/naming-recovery.service'

export function registerNamingIpc(main: IpcMain): void {
  const audits = new NamingAuditService()
  const plans = new NamingPlanService()
  const operations = new Map<string, NamingOperationResult>()
  const resolve = async (deviceId: string) => {
    const device = (await listDevices()).find(
      (item) => item.id === deviceId || item.path === deviceId
    )
    if (!device) throw Object.assign(new Error('Device not found'), { code: 'DEVICE_NOT_FOUND' })
    return device
  }
  main.handle('naming:audit', async (_event, input: unknown) => {
    const parsed = parseInput('namingAudit', input)
    const device = await resolve(parsed.deviceId)
    const recovered = await new NamingRecoveryService().reconcile(device.path)
    if (recovered) sendLog('INFO', `${recovered} journal(is) antigo(s) de nomes reconciliado(s).`)
    return audits.audit(device.path, device.id)
  })
  main.handle('naming:plan', (_event, input: unknown) => {
    const parsed = parseInput('namingPlan', input)
    const audit = audits.get(parsed.auditId)
    if (!audit)
      throw Object.assign(new Error('Naming audit not found'), { code: 'AUDIT_NOT_FOUND' })
    return plans.create(audit, parsed.expectedRevision, parsed.itemIds)
  })
  main.handle('naming:confirm', async (_event, input: unknown) => {
    const parsed = parseInput('namingConfirm', input)
    const plan = plans.get(parsed.planId)
    if (
      !plan ||
      plan.revision !== parsed.expectedRevision ||
      plan.status !== 'awaiting-confirmation'
    )
      throw Object.assign(new Error('Naming plan is stale'), { code: 'STALE_REVISION' })
    const device = await resolve(plan.deviceId)
    const operationId = `naming-${plan.planId}`
    const transaction = new NamingTransactionService((progress) => {
      sendLog(progress.level, progress.message)
      sendProgress({
        id: operationId,
        label: 'Adequação de nomes OPL',
        value: progress.value,
        detail: progress.detail
      })
    })
    sendLog(
      'INFO',
      `Aguardando acesso exclusivo ao dispositivo para ${plan.itemIds.length} renome(s).`
    )
    const operation = await deviceLocks.withLock(device.id, undefined, () =>
      transaction.execute(device.path, operationId, plans.steps(plan.planId))
    )
    operations.set(operationId, operation)
    return operation
  })
  main.handle('naming:get-operation', (_event, input: unknown) =>
    operations.get(parseInput('namingGetOperation', input).operationId)
  )
}
