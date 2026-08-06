import { appendFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const SENSITIVE = /(bios|password|token|secret|authorization|cookie)/i
const URL = /https?:\/\/[^\s]+/gi
const WINDOWS_PATH = /(?:[A-Za-z]:\\|\\\\)[^\s]+/g
const POSIX_PATH = /(?:^|\s)\/(?:[^\s/]+\/)*[^\s]*/g

export function redactOperationalText(value: string): string {
  return value
    .replace(URL, '[REDACTED_URL]')
    .replace(WINDOWS_PATH, '[REDACTED_PATH]')
    .replace(POSIX_PATH, (match) => `${match.startsWith(' ') ? ' ' : ''}[REDACTED_PATH]`)
}

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SENSITIVE.test(key) ? '[REDACTED]' : redact(item)
      ])
    )
  return typeof value === 'string' ? redactOperationalText(value) : value
}

export class AuditLogService {
  constructor(private readonly filePath: string) {}
  async record(event: Record<string, unknown>): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true })
    await appendFile(
      this.filePath,
      `${JSON.stringify(redact({ timestamp: new Date().toISOString(), ...event }))}\n`,
      { encoding: 'utf8', mode: 0o600 }
    )
  }
}
