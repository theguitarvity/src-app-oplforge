import { randomUUID } from 'node:crypto'
import type {
  IdentityEvidence,
  NamingAudit,
  NamingAuditItem
} from '../../../src/types/opl-finalization'
import { canonicalGameName, normalizeGameId, sanitizeOplTitle } from '../images/game-naming.service'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { inspectIso, inspectIsoReader } from '../images/iso9660.service'
import { createZsoReader } from '../images/zso.service'

export interface NamingCandidate {
  currentRelativePath: string
  gameId?: string
  title: string
  extension: string
  evidence?: IdentityEvidence[]
}

export function classifyNamingCandidates(
  deviceId: string,
  candidates: NamingCandidate[]
): NamingAudit {
  const provisional = candidates.map((candidate, index): NamingAuditItem => {
    const extension = candidate.extension.toLowerCase()
    const gameId = candidate.gameId ? normalizeGameId(candidate.gameId) : null
    const identity = {
      gameId: gameId ?? undefined,
      authoritativeSource: gameId ? ('system-cnf' as const) : undefined,
      title: sanitizeOplTitle(candidate.title, 32),
      titleBytes: Buffer.byteLength(sanitizeOplTitle(candidate.title, 32), 'ascii'),
      evidence: candidate.evidence ?? [],
      conflicts: []
    }
    if (extension !== 'iso' && extension !== 'zso')
      return {
        itemId: `naming-${index}`,
        currentRelativePath: candidate.currentRelativePath,
        identity,
        classification: 'unsupported',
        findings: [
          { code: 'UNSUPPORTED_FORMAT', message: 'Only ISO and ZSO names can be adjusted' }
        ]
      }
    if (!gameId)
      return {
        itemId: `naming-${index}`,
        currentRelativePath: candidate.currentRelativePath,
        identity,
        classification: 'missing-id',
        findings: [{ code: 'GAME_ID_REQUIRED', message: 'No authoritative Game ID was found' }]
      }
    const directory = candidate.currentRelativePath
      .replace(/\\/g, '/')
      .split('/')
      .slice(0, -1)
      .join('/')
    const canonicalRelativePath = `${directory}/${canonicalGameName(gameId, candidate.title, extension)}`
    return {
      itemId: `naming-${index}`,
      currentRelativePath: candidate.currentRelativePath,
      canonicalRelativePath,
      identity,
      classification:
        canonicalRelativePath === candidate.currentRelativePath ? 'canonical' : 'correctable',
      findings: []
    }
  })
  const targets = new Map<string, NamingAuditItem[]>()
  for (const item of provisional)
    if (item.canonicalRelativePath) {
      const key = item.canonicalRelativePath.toLowerCase()
      targets.set(key, [...(targets.get(key) ?? []), item])
    }
  for (const group of targets.values())
    if (group.length > 1)
      for (const item of group) {
        item.classification = 'collision'
        item.findings.push({
          code: 'DESTINATION_COLLISION',
          message: 'More than one image resolves to the same canonical name'
        })
      }
  return {
    auditId: randomUUID(),
    revision: 0,
    deviceId,
    items: provisional,
    createdAt: new Date().toISOString()
  }
}

export class NamingAuditService {
  private readonly audits = new Map<string, NamingAudit>()
  async audit(devicePath: string, deviceId: string): Promise<NamingAudit> {
    const candidates: NamingCandidate[] = []
    for (const media of ['CD', 'DVD'])
      for (const entry of await readdir(path.join(devicePath, media), {
        withFileTypes: true
      }).catch(() => [])) {
        if (!entry.isFile()) continue
        const extension = path.extname(entry.name).slice(1).toLowerCase()
        const filePath = path.join(devicePath, media, entry.name)
        let gameId: string | undefined
        if (extension === 'iso') gameId = (await inspectIso(filePath)).gameId ?? undefined
        if (extension === 'zso') {
          const reader = await createZsoReader(filePath)
          try {
            gameId = (await inspectIsoReader(reader)).gameId ?? undefined
          } finally {
            await reader.close?.()
          }
        }
        const title =
          path
            .basename(entry.name, path.extname(entry.name))
            .replace(/^[A-Za-z]{4}[_-]?\d{3}\.\d{2}[. _-]*/, '') || 'Untitled'
        candidates.push({
          currentRelativePath: `${media}/${entry.name}`,
          gameId,
          title,
          extension,
          evidence: gameId ? [{ source: 'system-cnf', value: gameId, authoritative: true }] : []
        })
      }
    const audit = classifyNamingCandidates(deviceId, candidates)
    this.audits.set(audit.auditId, audit)
    return structuredClone(audit)
  }
  get(auditId: string): NamingAudit | undefined {
    const audit = this.audits.get(auditId)
    return audit ? structuredClone(audit) : undefined
  }
}
