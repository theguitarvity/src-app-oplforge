import type {
  FinalizationGameIdentity,
  IdentityEvidence
} from '../../../src/types/opl-finalization'
import { normalizeGameId, sanitizeOplTitle } from './game-naming.service'

export class GameIdentityService {
  resolve(title: string, evidence: IdentityEvidence[]): FinalizationGameIdentity {
    const normalized = evidence
      .map((item) => ({ ...item, value: normalizeGameId(item.value) }))
      .filter((item): item is IdentityEvidence => Boolean(item.value))
    const authoritative = normalized.filter((item) => item.authoritative)
    const authoritativeIds = new Set(authoritative.map((item) => item.value))
    if (authoritativeIds.size > 1)
      throw Object.assign(new Error('Authoritative Game ID evidence conflicts'), {
        code: 'IDENTITY_CONFLICT',
        evidence: authoritative
      })
    const selected = authoritative[0] ?? normalized[0]
    const safeTitle = sanitizeOplTitle(title, 32)
    return {
      gameId: selected?.value,
      authoritativeSource: authoritative[0]?.source,
      title: safeTitle,
      titleBytes: Buffer.byteLength(safeTitle, 'ascii'),
      evidence: normalized,
      conflicts: selected
        ? normalized
            .filter((item) => item.value !== selected.value)
            .map((item) => ({ expected: selected.value, actual: item.value, source: item.source }))
        : []
    }
  }
}
