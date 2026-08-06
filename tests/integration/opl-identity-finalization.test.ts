import { describe, expect, it } from 'vitest'
import { GameIdentityService } from '@electron/services/images/game-identity.service'

describe('OPL identity finalization', () => {
  it('prefers internal SYSTEM.CNF and preserves filename/catalog disagreements as conflicts', () => {
    const identity = new GameIdentityService().resolve('Game', [
      { source: 'filename-hint', value: 'SLUS_000.01', authoritative: false },
      { source: 'catalog-hint', value: 'SLES_222.33', authoritative: false },
      { source: 'system-cnf', value: 'SCUS_111.22', authoritative: true }
    ])
    expect(identity.gameId).toBe('SCUS_111.22')
    expect(identity.authoritativeSource).toBe('system-cnf')
    expect(identity.conflicts).toHaveLength(2)
  })

  it('blocks conflicting authoritative evidence', () => {
    expect(() =>
      new GameIdentityService().resolve('Game', [
        { source: 'system-cnf', value: 'SCUS_111.22', authoritative: true },
        { source: 'user-override', value: 'SLUS_000.01', authoritative: true }
      ])
    ).toThrowError(expect.objectContaining({ code: 'IDENTITY_CONFLICT' }))
  })
})
