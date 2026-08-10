import type { TurboModule } from 'react-native'
import { TurboModuleRegistry } from 'react-native'

/**
 * Codegen wire boundary for library selection (FR-001–FR-005).
 * Deliberately loosely-typed (Object) — the real typed contract for the rest
 * of the app is `src/native/LibraryModule.ts`, per contracts/native-modules.md.
 */
/* eslint-disable @typescript-eslint/no-wrapper-object-types -- Codegen requires the literal `Object` type */
export interface Spec extends TurboModule {
  selectLibrary(): Promise<Object>
  getActiveLibrary(): Promise<Object>
  revalidateAccess(): Promise<Object>
}
/* eslint-enable @typescript-eslint/no-wrapper-object-types */

export default TurboModuleRegistry.getEnforcing<Spec>('LibraryModule')
