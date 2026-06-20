import { promises as fs } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import type { HistoryEntry, HistoryResult } from '../../src/types/opl'

const historyPath = () => path.join(app.getPath('userData'), 'history.json')
const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`

async function ensureHistoryFile() {
  const file = historyPath()
  await fs.mkdir(path.dirname(file), { recursive: true })
  try {
    await fs.access(file)
  } catch {
    await fs.writeFile(file, '[]', 'utf-8')
  }
}

export async function getHistory(): Promise<HistoryEntry[]> {
  await ensureHistoryFile()
  const raw = await fs.readFile(historyPath(), 'utf-8')
  try {
    return JSON.parse(raw) as HistoryEntry[]
  } catch {
    return []
  }
}

export async function addHistory(input: Omit<HistoryEntry, 'id' | 'timestamp'>): Promise<HistoryEntry> {
  const entries = await getHistory()
  const entry: HistoryEntry = {
    id: createId(),
    timestamp: new Date().toISOString(),
    ...input
  }
  entries.unshift(entry)
  await fs.writeFile(historyPath(), JSON.stringify(entries.slice(0, 500), null, 2), 'utf-8')
  return entry
}

export async function clearHistory(): Promise<void> {
  await ensureHistoryFile()
  await fs.writeFile(historyPath(), '[]', 'utf-8')
}

export async function recordFailure(
  operation: string,
  error: unknown,
  origin?: string,
  destination?: string
): Promise<HistoryEntry> {
  const message = error instanceof Error ? error.message : String(error)
  return addHistory({ operation, origin, destination, result: 'error' as HistoryResult, message })
}
