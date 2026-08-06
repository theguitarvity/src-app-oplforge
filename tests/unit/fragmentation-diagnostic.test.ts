import { describe, expect, it } from 'vitest'
import type { EvaluatedFile, GameDiagnostic } from '../../src/types/opl'
import {
  classifyDiagnosticFiles,
  summarizeDiagnostics
} from '../../electron/services/fragmentation-repair/diagnostic-classifier'

const file = (
  extentState: EvaluatedFile['extentState'],
  structuralState: EvaluatedFile['structuralState'] = 'valid'
): EvaluatedFile => ({
  relativePath: `DVD/${extentState}.iso`,
  role: 'game',
  sizeBytes: 10,
  structuralState,
  extentState,
  findings: []
})

describe('fragmentation diagnostic classification', () => {
  it('applies invalid, incomplete and unverifiable precedence', () => {
    expect(
      classifyDiagnosticFiles([file('fragmented'), file('contiguous', 'invalid')], false)
    ).toBe('invalid')
    expect(
      classifyDiagnosticFiles([file('fragmented'), file('contiguous', 'incomplete')], true)
    ).toBe('incomplete')
    expect(classifyDiagnosticFiles([file('fragmented'), file('unverifiable')], true)).toBe(
      'unverifiable'
    )
  })

  it('uses partial only for multipart installations', () => {
    expect(classifyDiagnosticFiles([file('fragmented'), file('contiguous')], true)).toBe(
      'partially-fragmented'
    )
    expect(classifyDiagnosticFiles([file('fragmented')], false)).toBe('fragmented')
    expect(classifyDiagnosticFiles([file('contiguous')], false)).toBe('contiguous')
  })

  it('reconciles all six states and repair counters', () => {
    const states = [
      'contiguous',
      'fragmented',
      'partially-fragmented',
      'incomplete',
      'invalid',
      'unverifiable'
    ] as const
    const games = states.map((state, index) => ({
      identity: {
        installationId: String(index),
        deviceId: 'd',
        format: state === 'partially-fragmented' ? 'USBExtreme' : 'ISO',
        relativePaths: ['x'],
        title: 'x',
        media: 'DVD'
      },
      files:
        state === 'partially-fragmented'
          ? [file('fragmented'), file('contiguous')]
          : [
              file(
                state === 'fragmented'
                  ? 'fragmented'
                  : state === 'contiguous'
                    ? 'contiguous'
                    : 'unverifiable'
              )
            ],
      state,
      totalBytes: 10,
      temporaryBytes: index + 1,
      findings: []
    })) as GameDiagnostic[]
    expect(summarizeDiagnostics(games, 999)).toEqual({
      total: 6,
      byState: {
        contiguous: 1,
        fragmented: 1,
        'partially-fragmented': 1,
        incomplete: 1,
        invalid: 1,
        unverifiable: 1
      },
      eligibleGames: 2,
      affectedFiles: 2,
      freeBytes: 999,
      peakTemporaryBytes: 3
    })
  })
})
