import { describe, expect, it } from 'vitest'
import {
  internalToPublic,
  publicToInternal,
  validateReleaseManifest
} from '../../scripts/release-version'

describe('release version mapping', () => {
  it.each([
    ['1.0.0.0', '1.0.0'],
    ['1.2.3.4', '1.2.3004'],
    ['1.999.999.999', '1.999.999999']
  ])('maps %s reversibly to %s', (publicVersion, internalVersion) => {
    expect(publicToInternal(publicVersion)).toBe(internalVersion)
    expect(internalToPublic(internalVersion)).toBe(publicVersion)
  })

  it.each(['2.1.2.3', '1.1000.0.0', '1.1.1000.0', '1.1.1', 'v1.1.1.1'])(
    'rejects invalid public version %s',
    (version) => expect(() => publicToInternal(version)).toThrow()
  )

  it('validates all identity surfaces', () => {
    expect(() =>
      validateReleaseManifest({
        schemaVersion: 1,
        publicVersion: '1.2.3.4',
        internalVersion: '1.2.3005',
        channel: 'stable',
        tag: 'v1.2.3.4',
        artifactVersion: '1.2.3.4'
      })
    ).toThrow('mapping mismatch')
  })
})
