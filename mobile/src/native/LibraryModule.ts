import NativeLibraryModule from './specs/NativeLibraryModule'
import type { LibrarySelection, LibrarySourceKind, SerializableError } from '../types'

/**
 * Typed wrapper over the Codegen'd LibraryModule TurboModule
 * (contracts/native-modules.md). The rest of the app imports from here, never
 * from `./specs/NativeLibraryModule` directly (Constitution Principle III).
 */

interface RawLibrarySelection {
  treeUri: string
  displayName: string
  sourceKind: string
  accessGrantedAt: string
  accessValid: boolean
  lastValidatedAt: string
}

function toLibrarySelection(raw: RawLibrarySelection): LibrarySelection {
  return {
    treeUri: raw.treeUri,
    displayName: raw.displayName,
    sourceKind: raw.sourceKind as LibrarySourceKind,
    accessGrantedAt: raw.accessGrantedAt,
    accessValid: raw.accessValid,
    lastValidatedAt: raw.lastValidatedAt
  }
}

export class LibraryModuleError extends Error {
  code: string
  constructor(error: SerializableError) {
    super(error.message)
    this.code = error.code
  }
}

function toLibraryModuleError(error: unknown): LibraryModuleError {
  if (error instanceof Error && 'code' in error) {
    return new LibraryModuleError({
      code: String((error as { code?: string }).code ?? 'UNKNOWN_ERROR'),
      message: error.message
    })
  }
  return new LibraryModuleError({ code: 'UNKNOWN_ERROR', message: String(error) })
}

/**
 * Launches the system folder picker (FR-001/FR-005). Resolves with the
 * selected library, or rejects with `SELECTION_CANCELLED` if the user backed
 * out — callers should treat that specific code as a no-op, not a failure.
 */
export async function selectLibrary(): Promise<LibrarySelection> {
  try {
    const raw = (await NativeLibraryModule.selectLibrary()) as RawLibrarySelection
    return toLibrarySelection(raw)
  } catch (error) {
    throw toLibraryModuleError(error)
  }
}

/** Returns the currently active library, or `undefined` if none is set (US1 AS1). */
export async function getActiveLibrary(): Promise<LibrarySelection | undefined> {
  try {
    const raw = (await NativeLibraryModule.getActiveLibrary()) as RawLibrarySelection & { exists: boolean }
    if (!raw.exists) return undefined
    return toLibrarySelection(raw)
  } catch (error) {
    throw toLibraryModuleError(error)
  }
}

/**
 * Cross-checks the stored library against the OS-level grant (FR-004).
 * Never throws for "access lost" — that is a normal, displayable result
 * (`accessValid: false`), not an exceptional one.
 */
export async function revalidateAccess(): Promise<LibrarySelection | undefined> {
  try {
    const raw = (await NativeLibraryModule.revalidateAccess()) as RawLibrarySelection & { exists: boolean }
    if (!raw.exists) return undefined
    return toLibrarySelection(raw)
  } catch (error) {
    throw toLibraryModuleError(error)
  }
}

/**
 * Full app-data reset — library selection, credentials, catalog cache,
 * transfer queue, everything (equivalent to Settings > Apps > Clear Data).
 * On success the app process is killed and restarted by the OS itself, so
 * this call never actually resolves true from the caller's perspective —
 * only a failure to even attempt the wipe resolves `false`.
 */
export async function clearAppData(): Promise<boolean> {
  try {
    return await NativeLibraryModule.clearAppData()
  } catch (error) {
    throw toLibraryModuleError(error)
  }
}
