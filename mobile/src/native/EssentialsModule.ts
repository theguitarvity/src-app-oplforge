import NativeEssentialsModule from './specs/NativeEssentialsModule'
import type { CatalogListing, SerializableError, SmartFillPlan, TransferItem } from '../types'

/**
 * Typed wrapper over the Codegen'd EssentialsModule TurboModule
 * (specs/008-android-forge-essentials/contracts/native-modules.md).
 */

export class EssentialsModuleError extends Error {
  code: string
  constructor(error: SerializableError) {
    super(error.message)
    this.code = error.code
  }
}

function toEssentialsModuleError(error: unknown): EssentialsModuleError {
  if (error instanceof Error && 'code' in error) {
    return new EssentialsModuleError({
      code: String((error as { code?: string }).code ?? 'UNKNOWN_ERROR'),
      message: error.message
    })
  }
  return new EssentialsModuleError({ code: 'UNKNOWN_ERROR', message: String(error) })
}

export interface CatalogQuery {
  search?: string
  tier?: string
  mediaType?: string
}

export async function listCatalog(query: CatalogQuery = {}): Promise<CatalogListing[]> {
  try {
    return (await NativeEssentialsModule.listCatalog(query)) as CatalogListing[]
  } catch (error) {
    throw toEssentialsModuleError(error)
  }
}

export async function refreshCatalog(): Promise<CatalogListing[]> {
  try {
    return (await NativeEssentialsModule.refreshCatalog()) as CatalogListing[]
  } catch (error) {
    throw toEssentialsModuleError(error)
  }
}

export type SmartFillMode = 'rating' | 'random'

export async function createSmartFillPlan(targetBytes: number, mode: SmartFillMode): Promise<SmartFillPlan> {
  try {
    return (await NativeEssentialsModule.createSmartFillPlan(targetBytes, mode)) as SmartFillPlan
  } catch (error) {
    throw toEssentialsModuleError(error)
  }
}

export async function getAvailableSpace(): Promise<number> {
  try {
    const result = (await NativeEssentialsModule.getAvailableSpace()) as { availableBytes: number }
    return result.availableBytes
  } catch (error) {
    throw toEssentialsModuleError(error)
  }
}

/** The exact legal confirmation text required — must match `EssentialsModule.kt`'s `LEGAL_CONFIRMATION_TEXT` byte-for-byte. */
export const LEGAL_CONFIRMATION_TEXT =
  'Confirmo que possuo este jogo fisicamente/digitalmente ou tenho autorização legal para baixar este backup.'

export interface DuplicateItem {
  fileName: string
  existingEntryId: string
}

export interface ConfirmAndEnqueueResult {
  created: TransferItem[]
  duplicates: DuplicateItem[]
}

/**
 * Duplicates found against the already-cataloged library are returned (not
 * thrown) in `duplicates`, alongside whatever was legitimately enqueued in
 * `created` — the caller prompts once for the whole batch and re-calls with
 * `overwriteFileNames` set to proceed with the ones the user confirms.
 */
export async function confirmAndEnqueue(
  items: CatalogListing[],
  legalConfirmationText: string,
  overwriteFileNames: string[] = []
): Promise<ConfirmAndEnqueueResult> {
  try {
    return (await NativeEssentialsModule.confirmAndEnqueue(
      items,
      legalConfirmationText,
      overwriteFileNames
    )) as ConfirmAndEnqueueResult
  } catch (error) {
    throw toEssentialsModuleError(error)
  }
}
