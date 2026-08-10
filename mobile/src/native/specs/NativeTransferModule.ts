import type { TurboModule } from 'react-native'
import { TurboModuleRegistry } from 'react-native'

/**
 * Codegen wire boundary for the durable transfer queue (spec 008 FR-005–FR-013).
 * Deliberately loosely-typed (Object) — the real typed contract for the rest
 * of the app is `src/native/TransferModule.ts`, per contracts/native-modules.md.
 */
/* eslint-disable @typescript-eslint/no-wrapper-object-types -- Codegen requires the literal `Object` type */
export interface Spec extends TurboModule {
  enqueueImport(sourceUri: string, destinationHint: string): Promise<Object>
  getQueue(): Promise<Object>
  cancel(transferId: string): Promise<Object>
  retry(transferId: string): Promise<Object>
  addListener(eventName: string): void
  removeListeners(count: number): void
}
/* eslint-enable @typescript-eslint/no-wrapper-object-types */

export default TurboModuleRegistry.getEnforcing<Spec>('TransferModule')
