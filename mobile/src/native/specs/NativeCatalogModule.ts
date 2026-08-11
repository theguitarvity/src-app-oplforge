import type { TurboModule } from 'react-native'
import { TurboModuleRegistry } from 'react-native'

/**
 * Codegen wire boundary for catalog scanning (FR-006–FR-010).
 * Deliberately loosely-typed (Object) — the real typed contract for the rest
 * of the app is `src/native/CatalogModule.ts`, per contracts/native-modules.md.
 */
/* eslint-disable @typescript-eslint/no-wrapper-object-types -- Codegen requires the literal `Object` type */
export interface Spec extends TurboModule {
  startScan(): Promise<Object>
  cancelScan(): Promise<void>
  getLatestSnapshot(): Promise<Object>
  getCatalogEntries(page: number, pageSize: number, typeFilter: string): Promise<Object>
  getArtUri(gameId: string): Promise<Object>
  deleteEntry(entryId: string): Promise<Object>
  addListener(eventName: string): void
  removeListeners(count: number): void
}
/* eslint-enable @typescript-eslint/no-wrapper-object-types */

export default TurboModuleRegistry.getEnforcing<Spec>('CatalogModule')
