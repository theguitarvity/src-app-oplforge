import { describe, expect, it } from 'vitest'
import {
  canonicalizeRelativePath,
  createInstallationIdentity,
  findDuplicateGameIds
} from '@electron/services/fragmentation-repair/identity'

const identity = (relativePaths: string[], gameId?: string) =>
  createInstallationIdentity({
    deviceId: 'volume-1',
    format: 'USBExtreme',
    relativePaths,
    gameId,
    title: 'Game',
    media: 'DVD'
  })

describe('fragmentation installation identity', () => {
  it('normalizes separators and dot segments into confined relative paths', () => {
    expect(canonicalizeRelativePath('DVD\\folder\\..\\GAME.iso')).toBe('DVD/GAME.iso')
    expect(() => canonicalizeRelativePath('../GAME.iso')).toThrow(/escapes/)
    expect(() => canonicalizeRelativePath('/media/usb/GAME.iso')).toThrow(/relative/)
    expect(() => canonicalizeRelativePath('C:\\GAME.iso')).toThrow(/relative/)
  })

  it('derives stable identity from device, format and sorted unique paths', () => {
    const first = identity(['ul.002', 'ul.001', 'ul.001'])
    const second = identity(['ul.001', 'ul.002'])
    expect(first.relativePaths).toEqual(['ul.001', 'ul.002'])
    expect(first.installationId).toBe(second.installationId)
    expect(first.installationId).toMatch(/^[a-f0-9]{64}$/)
    expect(identity(['ul.001']).installationId).not.toBe(first.installationId)
  })

  it('reports duplicate Game IDs without using them as identity', () => {
    const one = identity(['DVD/one.iso'], 'SLUS_123.45')
    const two = identity(['DVD/two.iso'], 'SLUS_123.45')
    expect(one.installationId).not.toBe(two.installationId)
    expect(findDuplicateGameIds([one, two])).toEqual(
      new Map([['SLUS_123.45', [one.installationId, two.installationId].sort()]])
    )
  })
})
