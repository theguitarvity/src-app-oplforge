/**
 * Cross-protocol (SMB + FTP) write-lock keyed by library-relative path, so a
 * PS2 writing a save at the same moment the PC (or the other protocol)
 * touches the same file fails fast with a clear conflict instead of
 * producing a corrupted/partially-written file (FR-013).
 */
const activeWrites = new Set<string>()

const normalizeKey = (relativePath: string): string =>
  relativePath.replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase()

export function tryAcquireWriteLock(relativePath: string): boolean {
  const key = normalizeKey(relativePath)
  if (activeWrites.has(key)) return false
  activeWrites.add(key)
  return true
}

export function releaseWriteLock(relativePath: string): void {
  activeWrites.delete(normalizeKey(relativePath))
}
