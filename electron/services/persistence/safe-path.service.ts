import { lstat, realpath } from 'node:fs/promises'
import path from 'node:path'

/**
 * True if `target` is `root` or a descendant of it. Uses `path.relative`
 * instead of `startsWith(root + sep)` because on Windows a drive-root path
 * (e.g. `D:\`) already ends in a separator, which made the old prefix check
 * reject every legitimate subpath.
 */
function isInsideRoot(root: string, target: string): boolean {
  if (target === root) return true
  const relative = path.relative(root, target)
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}

export interface SafeRoot {
  requested: string
  real: string
  device: bigint
  inode: bigint
}

export async function captureSafeRoot(root: string): Promise<SafeRoot> {
  const real = await realpath(root)
  const stat = await lstat(real, { bigint: true })
  if (!stat.isDirectory())
    throw Object.assign(new Error('Device root is not a directory'), {
      code: 'INVALID_DEVICE_ROOT'
    })
  return { requested: path.resolve(root), real, device: stat.dev, inode: stat.ino }
}

export async function resolveInside(
  root: SafeRoot,
  candidate: string,
  allowMissing = false
): Promise<string> {
  const currentRoot = await lstat(root.real, { bigint: true })
  if (currentRoot.dev !== root.device || currentRoot.ino !== root.inode)
    throw Object.assign(new Error('Selected device mount changed'), { code: 'DEVICE_CHANGED' })
  const resolved = path.resolve(root.real, candidate)
  if (!isInsideRoot(root.real, resolved)) {
    throw Object.assign(new Error('Path escapes the selected device'), { code: 'PATH_ESCAPE' })
  }
  let actual: string
  try {
    actual = await realpath(resolved)
  } catch (error) {
    if (!allowMissing || (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    const parent = await realpath(path.dirname(resolved))
    actual = path.join(parent, path.basename(resolved))
  }
  if (!isInsideRoot(root.real, actual)) {
    throw Object.assign(new Error('Symbolic link escapes the selected device'), {
      code: 'PATH_ESCAPE'
    })
  }
  const existing = await lstat(allowMissing ? path.dirname(actual) : actual, { bigint: true })
  if (existing.dev !== root.device)
    throw Object.assign(new Error('Device mount changed'), { code: 'DEVICE_CHANGED' })
  return actual
}
