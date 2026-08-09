const ipv4ToInt = (address: string): number | undefined => {
  const parts = address.split('.')
  if (parts.length !== 4) return undefined
  const octets = parts.map((part) => Number(part))
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return undefined
  return octets.reduce((acc, octet) => (acc << 8) + octet, 0) >>> 0
}

const RFC1918_RANGES: Array<{ base: string; maskBits: number }> = [
  { base: '10.0.0.0', maskBits: 8 },
  { base: '172.16.0.0', maskBits: 12 },
  { base: '192.168.0.0', maskBits: 16 }
]

const inRange = (address: number, base: number, maskBits: number): boolean => {
  const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0
  return (address & mask) === (base & mask)
}

/**
 * True for RFC1918 private IPv4 ranges (10/8, 172.16/12, 192.168/16) and IPv4
 * loopback, per FR-006/R5. Anything else (including link-local 169.254/16 and
 * public addresses) is rejected before protocol negotiation.
 */
export function isLocalNetworkAddress(address: string): boolean {
  const normalized = address.startsWith('::ffff:') ? address.slice(7) : address
  if (normalized === '127.0.0.1' || normalized === '::1') return true
  const value = ipv4ToInt(normalized)
  if (value === undefined) return false
  return RFC1918_RANGES.some((range) => inRange(value, ipv4ToInt(range.base)!, range.maskBits))
}
