import NativeCustomCatalogModule from './specs/NativeCustomCatalogModule'
import type { CatalogListing, SerializableError } from '../types'

/** Typed wrapper over the Codegen'd CustomCatalogModule TurboModule. */

export class CustomCatalogModuleError extends Error {
  code: string
  constructor(error: SerializableError) {
    super(error.message)
    this.code = error.code
  }
}

function toCustomCatalogModuleError(error: unknown): CustomCatalogModuleError {
  if (error instanceof Error && 'code' in error) {
    return new CustomCatalogModuleError({
      code: String((error as { code?: string }).code ?? 'UNKNOWN_ERROR'),
      message: error.message
    })
  }
  return new CustomCatalogModuleError({ code: 'UNKNOWN_ERROR', message: String(error) })
}

export interface CustomCatalogQuery {
  search?: string
  mediaType?: string
}

export async function listCustomCatalog(query: CustomCatalogQuery = {}): Promise<CatalogListing[]> {
  try {
    return (await NativeCustomCatalogModule.listCustomCatalog(query)) as CatalogListing[]
  } catch (error) {
    throw toCustomCatalogModuleError(error)
  }
}

export interface CustomCatalogEntryInput {
  title: string
  fileName: string
  url: string
  sizeBytes?: number
  mediaType?: 'ps2-dvd' | 'ps2-cd' | 'ps1'
}

export async function addCustomCatalogEntry(input: CustomCatalogEntryInput): Promise<CatalogListing> {
  try {
    return (await NativeCustomCatalogModule.addCustomCatalogEntry(input)) as CatalogListing
  } catch (error) {
    throw toCustomCatalogModuleError(error)
  }
}

export async function removeCustomCatalogEntry(id: string): Promise<void> {
  try {
    await NativeCustomCatalogModule.removeCustomCatalogEntry(id)
  } catch (error) {
    throw toCustomCatalogModuleError(error)
  }
}

export interface ImportCustomCatalogCsvResult {
  added: CatalogListing[]
  errors: string[]
}

/** [uri] is the content:// URI from expo-document-picker's result — read natively via ContentResolver, never through the JS bridge. */
export async function importCustomCatalogCsv(uri: string): Promise<ImportCustomCatalogCsvResult> {
  try {
    return (await NativeCustomCatalogModule.importCustomCatalogCsv(uri)) as ImportCustomCatalogCsvResult
  } catch (error) {
    throw toCustomCatalogModuleError(error)
  }
}
