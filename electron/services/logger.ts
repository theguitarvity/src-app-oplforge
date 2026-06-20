import { BrowserWindow } from 'electron'
import type { LogEntry, LogLevel, OperationProgress } from '../../src/types/opl'

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`

export const sendLog = (level: LogLevel, message: string) => {
  const entry: LogEntry = {
    id: createId(),
    timestamp: new Date().toISOString(),
    level,
    message
  }

  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('logs:entry', entry)
  }
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
}
