import path from 'node:path'

/** Windows FILETIME epoch (1601-01-01T00:00:00Z) offset from the Unix epoch, in milliseconds. */
const FILETIME_UNIX_EPOCH_OFFSET_MS = 11644473600000n

export function toFileTime(date: Date): bigint {
  return (BigInt(date.getTime()) + FILETIME_UNIX_EPOCH_OFFSET_MS) * 10000n
}

export function writeFileTime(buffer: Buffer, offset: number, date: Date): void {
  buffer.writeBigUInt64LE(toFileTime(date), offset)
}

/** Reads a null-terminated OEM (byte) string starting at `offset`. Unicode is not negotiated by this server (see negotiate.ts), so all strings on the wire are single-byte OEM/ASCII. */
export function readOemString(
  buffer: Buffer,
  offset: number
): { value: string; nextOffset: number } {
  const terminator = buffer.indexOf(0x00, offset)
  const end = terminator === -1 ? buffer.length : terminator
  return { value: buffer.toString('latin1', offset, end), nextOffset: end + 1 }
}

export function writeOemString(value: string): Buffer {
  return Buffer.concat([Buffer.from(value, 'latin1'), Buffer.from([0x00])])
}

/**
 * Maps an SMB path (backslash-separated, relative to the share root) to a
 * path confined to `libraryRootPath` — mirrors the confinement guarantee the
 * rest of this codebase applies to every device-relative path (Constitution
 * Principle II). Throws if the resolved path would escape the root.
 */
export function resolveSharePath(libraryRootPath: string, smbPath: string): string {
  const relativeSmbPath = smbPath.replace(/\\/g, '/').replace(/^\/+/, '')
  const resolved = path.resolve(libraryRootPath, relativeSmbPath)
  const root = path.resolve(libraryRootPath)
  // Uses path.relative rather than startsWith(root + sep): on Windows a
  // drive-root path (e.g. `D:\`) already ends in a separator, so the old
  // prefix check rejected every legitimate subpath under it.
  const relativeToRoot = path.relative(root, resolved)
  const isInsideRoot =
    resolved === root ||
    (relativeToRoot !== '' && !relativeToRoot.startsWith('..') && !path.isAbsolute(relativeToRoot))
  if (!isInsideRoot) {
    throw Object.assign(new Error('Path escapes the shared library root'), {
      code: 'PATH_TRAVERSAL'
    })
  }
  return resolved
}

/** The library-relative path (forward slashes) used as the write-lock key — stable across SMB/FTP. */
export function toRelativeKey(libraryRootPath: string, absolutePath: string): string {
  return path.relative(libraryRootPath, absolutePath).replace(/\\/g, '/')
}
