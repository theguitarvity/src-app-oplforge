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

export async function confirmAndEnqueue(items: CatalogListing[], legalConfirmationText: string): Promise<TransferItem[]> {
  try {
    return (await NativeEssentialsModule.confirmAndEnqueue(items, legalConfirmationText)) as TransferItem[]
  } catch (error) {
    throw toEssentialsModuleError(error)
  }
}
