import { describe, expect, it } from 'vitest'
import { schemas } from '../../electron/ipc/schemas'

describe('Feature 006 strict IPC foundation', () => {
  it('accepts either an OPL or authorized local download target', () => {
    const source = { kind: 'http' as const, url: 'https://example.test/game.iso' }
    expect(
      schemas.downloadEnqueue.parse({
        source,
        target: { kind: 'opl-device', deviceId: 'dev', profileId: 'opl' }
      }).target?.kind
    ).toBe('opl-device')
    expect(
      schemas.downloadEnqueue.parse({
        source,
        target: {
          kind: 'local-folder',
          authorizationId: 'auth',
          rootToken: 'token',
          collisionPolicy: 'fail'
        }
      }).target?.kind
    ).toBe('local-folder')
  })

  it('rejects unknown fields and renderer-controlled update URLs', () => {
    expect(() => schemas.updateCheck.parse({ feedUrl: 'https://evil.test' })).toThrow()
    expect(() =>
      schemas.localFolderAuthorize.parse({ selectedPath: 'relative/path', extra: true })
    ).toThrow()
  })

  it('rejects invalid revisions and requires explicit install confirmation', () => {
    expect(() =>
      schemas.updateSetPolicy.parse({ mode: 'manual-only', expectedRevision: -1 })
    ).toThrow()
    expect(() =>
      schemas.updateInstall.parse({ sessionId: 's', expectedRevision: 1, confirmation: 'yes' })
    ).toThrow()
  })
})
