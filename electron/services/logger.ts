import { app, BrowserWindow } from 'electron'
import { appendFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import type {
  LogEntry,
  LogLevel,
  OperationEvent,
  OperationProgress,
  OperationState
} from '../../src/types/opl'
import { redact, redactOperationalText } from './persistence/audit-log.service'

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`
const persist = async (kind: string, value: unknown) => {
  const file = path.join(app.getPath('userData'), 'audit', 'operations.jsonl')
  await mkdir(path.dirname(file), { recursive: true })
  await appendFile(file, `${JSON.stringify(redact({ kind, value }))}\n`, {
    encoding: 'utf8',
    mode: 0o600
  })
}

export const sendLog = (level: LogLevel, message: string) => {
  const entry: LogEntry = {
    id: createId(),
    timestamp: new Date().toISOString(),
    level,
    message: redactOperationalText(message)
  }

  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('logs:entry', entry)
  }
  void persist('log', entry)
}

export const sendProgress = (progress: Omit<OperationProgress, 'id'> & { id?: string }) => {
  const payload: OperationProgress = {
    id: progress.id ?? createId(),
    label: progress.label,
    value: progress.value,
    detail: progress.detail
  }

  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('operations:progress', payload)
  }
  void persist('progress', payload)
}

const operationSequences = new Map<string, number>()

export const sendOperationEvent = (event: Omit<OperationEvent, 'sequence' | 'timestamp'>) => {
  const sequence = (operationSequences.get(event.operationId) ?? 0) + 1
  operationSequences.set(event.operationId, sequence)
  const payload: OperationEvent = redact({
    ...event,
    sequence,
    timestamp: new Date().toISOString()
  }) as OperationEvent
  for (const window of BrowserWindow.getAllWindows())
    window.webContents.send('operations:event', payload)
  void persist('operation', payload)
  if (event.state === 'completed' || event.state === 'failed' || event.state === 'cancelled')
    operationSequences.delete(event.operationId)
  return payload
}

export function operationState(state: OperationState): OperationState {
  return state
}
