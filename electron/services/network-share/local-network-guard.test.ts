import { describe, expect, it } from 'vitest'
import { isLocalNetworkAddress } from './local-network-guard'

describe('isLocalNetworkAddress (FR-006/R5)', () => {
  it.each([
    '10.0.0.1',
    '10.255.255.254',
    '172.16.0.1',
    '172.31.255.254',
    '192.168.0.1',
    '192.168.15.20',
    '192.168.255.254',
    '127.0.0.1',
    '::ffff:192.168.1.5'
  ])('accepts %s as local', (address) => {
    expect(isLocalNetworkAddress(address)).toBe(true)
  })

  it.each([
    '8.8.8.8',
    '1.1.1.1',
    '172.15.255.255', // just below the 172.16/12 range
    '172.32.0.0', // just above the 172.16/12 range
    '169.254.1.1', // link-local, deliberately not treated as local
    '11.0.0.1', // outside 10/8
    'not-an-ip',
    ''
  ])('rejects %s as non-local', (address) => {
    expect(isLocalNetworkAddress(address)).toBe(false)
  })
})
