import os from 'node:os'
import { isLocalNetworkAddress } from './local-network-guard'

/**
 * Local (RFC1918) IPv4 addresses this host can bind to, one per non-internal
 * interface. Used both for server binding (R5 — never 0.0.0.0) and for
 * displaying the address a user must enter on their PS2 (FR-004).
 */
export function listLocalNetworkAddresses(): string[] {
  const interfaces = os.networkInterfaces()
  const addresses: string[] = []
  for (const entries of Object.values(interfaces)) {
    if (!entries) continue
    for (const entry of entries) {
      if (entry.internal) continue
      if (entry.family !== 'IPv4') continue
      if (!isLocalNetworkAddress(entry.address)) continue
      addresses.push(entry.address)
    }
  }
  return addresses
}

/** The single address servers bind to. `undefined` when no local-network interface is up. */
export function primaryLocalNetworkAddress(): string | undefined {
  return listLocalNetworkAddresses()[0]
}
