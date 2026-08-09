import os from 'node:os'
import { sendLog } from '../logger'
import { isLocalNetworkAddress } from './local-network-guard'

// Diagnostic-only: must never be able to break interface discovery (e.g. no
// BrowserWindow yet, or running outside a real Electron app in tests).
function debugLog(level: Parameters<typeof sendLog>[0], message: string): void {
  try {
    sendLog(level, message)
  } catch {
    // ignored — logging is best-effort
  }
}

/**
 * Local (RFC1918) IPv4 addresses this host can bind to, one per non-internal
 * interface. Used both for server binding (R5 — never 0.0.0.0) and for
 * displaying the address a user must enter on their PS2 (FR-004).
 */
export function listLocalNetworkAddresses(): string[] {
  const interfaces = os.networkInterfaces()
  const addresses: string[] = []
  const seen: string[] = []
  for (const [name, entries] of Object.entries(interfaces)) {
    if (!entries) continue
    for (const entry of entries) {
      seen.push(`${name}: ${entry.address} (${entry.family}${entry.internal ? ', internal' : ''})`)
      if (entry.internal) continue
      if (entry.family !== 'IPv4') continue
      if (!isLocalNetworkAddress(entry.address)) continue
      addresses.push(entry.address)
    }
  }
  debugLog(
    'INFO',
    `[network-interfaces] raw: ${seen.join(', ') || '(none)'} | advertised: ${addresses.join(', ') || '(none)'}`
  )
  return addresses
}

/** The single address servers bind to. `undefined` when no local-network interface is up. */
export function primaryLocalNetworkAddress(): string | undefined {
  return listLocalNetworkAddresses()[0]
}

function ipv4ToInt(address: string): number | undefined {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255))
    return undefined
  return parts.reduce((acc, part) => (acc << 8) + part, 0) >>> 0
}

function sameSubnet(address: string, netmask: string, candidate: string): boolean {
  const addressInt = ipv4ToInt(address)
  const maskInt = ipv4ToInt(netmask)
  const candidateInt = ipv4ToInt(candidate)
  if (addressInt === undefined || maskInt === undefined || candidateInt === undefined) return false
  return (addressInt & maskInt) === (candidateInt & maskInt)
}

/**
 * On a multi-homed host (this app's own dev machine has two active LAN
 * subnets at once — Vivo 192.168.15.0/24 and a secondary router's
 * 192.168.100.0/24), a single hardcoded bind address is frequently the
 * wrong one for whichever subnet the PS2 actually landed on. Both SMB and
 * FTP now bind `0.0.0.0` (all interfaces) instead, with the local-network
 * guard doing the actual access-control enforcement (FR-006) — so this
 * function's only job is figuring out which *specific* local address to
 * hand back to a given client, e.g. for FTP passive-mode data connections,
 * by matching the client's source subnet against this host's interfaces.
 */
export function resolveAdvertisedAddress(remoteAddress: string): string {
  const interfaces = os.networkInterfaces()
  for (const entries of Object.values(interfaces)) {
    if (!entries) continue
    for (const entry of entries) {
      if (entry.internal || entry.family !== 'IPv4') continue
      if (!isLocalNetworkAddress(entry.address)) continue
      if (sameSubnet(entry.address, entry.netmask, remoteAddress)) return entry.address
    }
  }
  return listLocalNetworkAddresses()[0] ?? '127.0.0.1'
}
