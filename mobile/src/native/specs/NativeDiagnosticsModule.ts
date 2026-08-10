import type { TurboModule } from 'react-native'
import { TurboModuleRegistry } from 'react-native'

/**
 * Codegen wire boundary for library diagnostics (spec 008 FR-010).
 * Deliberately loosely-typed (Object) — the real typed contract for the rest
 * of the app is `src/native/DiagnosticsModule.ts`, per contracts/native-modules.md.
 */
/* eslint-disable @typescript-eslint/no-wrapper-object-types -- Codegen requires the literal `Object` type */
export interface Spec extends TurboModule {
  runDiagnostics(): Promise<Object>
  getLatestDiagnosticsReport(): Promise<Object>
}
/* eslint-enable @typescript-eslint/no-wrapper-object-types */

export default TurboModuleRegistry.getEnforcing<Spec>('DiagnosticsModule')
