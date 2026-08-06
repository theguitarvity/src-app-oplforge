import { promises as fs } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import type { HistoryEntry, HistoryResult } from '../../src/types/opl'
import { redact } from './persistence/audit-log.service'

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

async function writeHistory(entries: HistoryEntry[]) {
  const target = historyPath()
  const temporary = `${target}.${process.pid}.tmp`
  const handle = await fs.open(temporary, 'w', 0o600)
  try {
    await handle.writeFile(`${JSON.stringify(entries, null, 2)}\n`, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  await fs.rename(temporary, target)
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

export async function addHistory(
  input: Omit<HistoryEntry, 'id' | 'timestamp'>
): Promise<HistoryEntry> {
  const entries = await getHistory()
  const entry: HistoryEntry = {
    id: createId(),
    timestamp: new Date().toISOString(),
    ...(redact(input) as Omit<HistoryEntry, 'id' | 'timestamp'>)
  }
  entries.unshift(entry)
  await writeHistory(entries.slice(0, 500))
  return entry
}

export async function clearHistory(): Promise<void> {
  await ensureHistoryFile()
  await writeHistory([])
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
