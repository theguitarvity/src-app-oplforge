import { describe, expect, it } from 'vitest'
import { classifyNamingCandidates } from '@electron/services/naming/naming-audit.service'

describe('naming audit classification', () => {
  it('classifies canonical, correctable, collision, missing-id and unsupported items', () => {
    const audit = classifyNamingCandidates('d1', [
      {
        currentRelativePath: 'DVD/SLUS_123.45.Game.iso',
        gameId: 'SLUS_123.45',
        title: 'Game',
        extension: 'iso'
      },
      {
        currentRelativePath: 'DVD/wrong.iso',
        gameId: 'SLES_111.22',
        title: 'Wrong Name',
        extension: 'iso'
      },
      {
        currentRelativePath: 'DVD/duplicate.iso',
        gameId: 'SLES_111.22',
        title: 'Wrong Name',
        extension: 'iso'
      },
      { currentRelativePath: 'CD/no-id.iso', title: 'No ID', extension: 'iso' },
      { currentRelativePath: 'DVD/archive.zip', title: 'Archive', extension: 'zip' }
    ])
    expect(audit.items.map((item) => item.classification)).toEqual([
      'canonical',
      'collision',
      'collision',
      'missing-id',
      'unsupported'
    ])
  })
})
