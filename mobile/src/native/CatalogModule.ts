import { NativeEventEmitter } from 'react-native'
import NativeCatalogModule from './specs/NativeCatalogModule'
import type { CatalogContentType, CatalogEntry, CatalogSnapshot, SerializableError } from '../types'

/**
 * Typed wrapper over the Codegen'd CatalogModule TurboModule
 * (contracts/native-modules.md). The rest of the app imports from here.
 */

interface RawSnapshot {
  id: string
  state: string
  startedAt: string
  completedAt?: string
  countsByType: Record<CatalogContentType, number>
  issueCount: number
  error?: SerializableError
}

function toSnapshot(raw: RawSnapshot): CatalogSnapshot {
  return {
    id: raw.id,
    state: raw.state as CatalogSnapshot['state'],
    startedAt: raw.startedAt,
    completedAt: raw.completedAt,
    countsByType: raw.countsByType,
    issueCount: raw.issueCount,
    error: raw.error
  }
}

export class CatalogModuleError extends Error {
  code: string
  constructor(error: SerializableError) {
    super(error.message)
    this.code = error.code
  }
}

function toCatalogModuleError(error: unknown): CatalogModuleError {
  if (error instanceof Error && 'code' in error) {
    return new CatalogModuleError({
      code: String((error as { code?: string }).code ?? 'UNKNOWN_ERROR'),
      message: error.message
    })
  }
  return new CatalogModuleError({ code: 'UNKNOWN_ERROR', message: String(error) })
}

/** Starts a read-only scan (FR-006–FR-010). Progress arrives via onCatalogScanEvent. */
export async function startScan(): Promise<CatalogSnapshot> {
  try {
    const raw = (await NativeCatalogModule.startScan()) as RawSnapshot
    return toSnapshot(raw)
  } catch (error) {
    throw toCatalogModuleError(error)
  }
}

/** Cancels the in-progress scan (FR-010) without corrupting the prior completed snapshot. */
export async function cancelScan(): Promise<void> {
  try {
    await NativeCatalogModule.cancelScan()
  } catch (error) {
    throw toCatalogModuleError(error)
  }
}

export async function getLatestSnapshot(): Promise<CatalogSnapshot | undefined> {
  try {
    const raw = (await NativeCatalogModule.getLatestSnapshot()) as RawSnapshot & { exists: boolean }
    if (!raw.exists) return undefined
    return toSnapshot(raw)
  } catch (error) {
    throw toCatalogModuleError(error)
  }
}

/**
 * Windowed catalog browsing (US6) — always reads the latest completed
 * snapshot; `typeFilter` is `''` for "all types" or a `CatalogContentType`.
 */
export async function getCatalogEntries(
  page: number,
  pageSize: number,
  typeFilter: CatalogContentType | ''
): Promise<CatalogEntry[]> {
  try {
    const raw = (await NativeCatalogModule.getCatalogEntries(page, pageSize, typeFilter)) as CatalogEntry[]
    return raw
  } catch (error) {
    throw toCatalogModuleError(error)
  }
}

/** Resolves a displayable `content://` URI for a game's cover art, or `undefined` when there's none. */
export async function getArtUri(gameId: string): Promise<string | undefined> {
  try {
    const result = (await NativeCatalogModule.getArtUri(gameId)) as { uri?: string | null }
    return result.uri ?? undefined
  } catch (error) {
    throw toCatalogModuleError(error)
  }
}

export interface DeleteEntryResult {
  deleted: string[]
  failed: { path: string; error: string }[]
}

/** Deletes a cataloged title's main file plus its associated ART/CFG files, and drops it from the cached catalog. */
export async function deleteEntry(entryId: string): Promise<DeleteEntryResult> {
  try {
    return (await NativeCatalogModule.deleteEntry(entryId)) as DeleteEntryResult
  } catch (error) {
    throw toCatalogModuleError(error)
  }
}

export interface CatalogScanEventPayload {
  snapshot: CatalogSnapshot
  message: string
  timestamp: string
}

/** Subscribes to scan progress/completion/error/cancellation events. Returns an unsubscribe function. */
export function onCatalogScanEvent(callback: (event: CatalogScanEventPayload) => void): () => void {
  const emitter = new NativeEventEmitter(NativeCatalogModule as never)
  const subscription = emitter.addListener('onCatalogScanEvent', (raw: { snapshot: RawSnapshot; message: string; timestamp: string }) => {
    callback({ snapshot: toSnapshot(raw.snapshot), message: raw.message, timestamp: raw.timestamp })
  })
  return () => subscription.remove()
}
