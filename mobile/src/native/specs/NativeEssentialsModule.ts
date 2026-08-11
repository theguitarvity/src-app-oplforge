import type { TurboModule } from 'react-native'
import { TurboModuleRegistry } from 'react-native'

/**
 * Codegen wire boundary for the Essentials catalog (spec 008 FR-001–FR-004).
 * Deliberately loosely-typed (Object) — the real typed contract for the rest
 * of the app is `src/native/EssentialsModule.ts`, per contracts/native-modules.md.
 */
/* eslint-disable @typescript-eslint/no-wrapper-object-types -- Codegen requires the literal `Object` type */
export interface Spec extends TurboModule {
  listCatalog(query: Object): Promise<Object>
  refreshCatalog(): Promise<Object>
  createSmartFillPlan(targetBytes: number, mode: string): Promise<Object>
  confirmAndEnqueue(items: Object[], legalConfirmationText: string, overwriteFileNames: string[]): Promise<Object>
  getAvailableSpace(): Promise<Object>
}
/* eslint-enable @typescript-eslint/no-wrapper-object-types */

export default TurboModuleRegistry.getEnforcing<Spec>('EssentialsModule')
