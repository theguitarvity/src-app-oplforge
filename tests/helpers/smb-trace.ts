import { expect } from 'vitest'

const prohibited = [
  /password\s*=/i,
  /challengeResponse/i,
  /raw(?:Payload|Packet)/i,
  /SESSION_SETUP.*payload=/i
]

export function expectSanitizedSmbTrace(entries: string[]): void {
  const trace = entries.join('\n')
  for (const pattern of prohibited) expect(trace).not.toMatch(pattern)
}
