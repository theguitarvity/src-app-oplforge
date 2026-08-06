import type {
  DiagnosticState,
  DiagnosticSummary,
  EvaluatedFile,
  GameDiagnostic
} from '../../../src/types/opl'

export function classifyDiagnosticFiles(
  files: readonly EvaluatedFile[],
  multipart: boolean
): DiagnosticState {
  if (files.some((file) => file.structuralState === 'invalid')) return 'invalid'
  if (files.some((file) => file.structuralState === 'incomplete')) return 'incomplete'
  const relevant = files.filter(
    (file) => file.role !== 'auxiliary' && file.extentState !== 'not-applicable'
  )
  if (
    relevant.length === 0 ||
    relevant.some(
      (file) => file.structuralState === 'unverifiable' || file.extentState === 'unverifiable'
    )
  )
    return 'unverifiable'
  const fragmented = relevant.filter((file) => file.extentState === 'fragmented').length
  const contiguous = relevant.filter((file) => file.extentState === 'contiguous').length
  if (multipart && fragmented > 0 && contiguous > 0) return 'partially-fragmented'
  if (fragmented > 0) return 'fragmented'
  return contiguous === relevant.length ? 'contiguous' : 'unverifiable'
}

export function summarizeDiagnostics(
  installations: readonly GameDiagnostic[],
  freeBytes: number
): DiagnosticSummary {
  const byState: Record<DiagnosticState, number> = {
    contiguous: 0,
    fragmented: 0,
    'partially-fragmented': 0,
    incomplete: 0,
    invalid: 0,
    unverifiable: 0
  }
  for (const installation of installations) byState[installation.state]++
  const eligible = installations.filter(
    ({ state }) => state === 'fragmented' || state === 'partially-fragmented'
  )
  return {
    total: installations.length,
    byState,
    eligibleGames: eligible.length,
    affectedFiles: eligible
      .flatMap(({ files }) => files)
      .filter(({ extentState }) => extentState === 'fragmented').length,
    freeBytes,
    peakTemporaryBytes: eligible.reduce((peak, game) => Math.max(peak, game.temporaryBytes), 0)
  }
}
