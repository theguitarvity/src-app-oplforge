import { createHash } from 'node:crypto'
import path from 'node:path'
import type { InstallationFormat, InstallationIdentity } from '../../../src/types/opl'

export interface InstallationIdentityInput {
  deviceId: string
  format: InstallationFormat
  relativePaths: string[]
  gameId?: string
  title: string
  media: 'CD' | 'DVD'
}

/** Canonical persisted path form, independent of host path separators. */
export function canonicalizeRelativePath(value: string): string {
  if (
    !value ||
    value.includes('\0') ||
    path.posix.isAbsolute(value) ||
    path.win32.isAbsolute(value)
  ) {
    throw Object.assign(new Error('Installation path must be relative'), {
      code: 'INVALID_RELATIVE_PATH'
    })
  }
  const canonical = path.posix.normalize(value.replaceAll('\\', '/'))
  if (canonical === '.' || canonical === '..' || canonical.startsWith('../')) {
    throw Object.assign(new Error('Installation path escapes the device root'), {
      code: 'INVALID_RELATIVE_PATH'
    })
  }
  return canonical
}

export function canonicalizeRelativePaths(values: string[]): string[] {
  const normalized = values.map(canonicalizeRelativePath)
  return [...new Set(normalized)].sort((left, right) => left.localeCompare(right, 'en'))
}

export function deriveInstallationId(
  deviceId: string,
  format: InstallationFormat,
  relativePaths: string[]
): string {
  if (!deviceId) throw new Error('deviceId is required')
  const canonical = canonicalizeRelativePaths(relativePaths)
  if (canonical.length === 0) throw new Error('At least one installation path is required')
  return createHash('sha256')
    .update(JSON.stringify([deviceId, format, canonical]))
    .digest('hex')
}

export function createInstallationIdentity(input: InstallationIdentityInput): InstallationIdentity {
  const relativePaths = canonicalizeRelativePaths(input.relativePaths)
  return {
    ...input,
    relativePaths,
    installationId: deriveInstallationId(input.deviceId, input.format, relativePaths)
  }
}

/** Returns only non-empty Game IDs shared by distinct canonical installations. */
export function findDuplicateGameIds(
  installations: readonly Pick<InstallationIdentity, 'installationId' | 'gameId'>[]
): Map<string, string[]> {
  const grouped = new Map<string, Set<string>>()
  for (const installation of installations) {
    if (!installation.gameId) continue
    const ids = grouped.get(installation.gameId) ?? new Set<string>()
    ids.add(installation.installationId)
    grouped.set(installation.gameId, ids)
  }
  return new Map(
    [...grouped].filter(([, ids]) => ids.size > 1).map(([gameId, ids]) => [gameId, [...ids].sort()])
  )
}

export const normalizeRelativePath = canonicalizeRelativePath
export const buildInstallationIdentity = createInstallationIdentity
export const canonicalInstallationIdentity = deriveInstallationId
export const duplicateGameIds = findDuplicateGameIds
