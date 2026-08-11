import type { TurboModule } from 'react-native'
import { TurboModuleRegistry } from 'react-native'

/**
 * Codegen wire boundary for SMB sharing (FR-013–FR-024, FR-033, FR-034).
 * Deliberately loosely-typed (Object) — the real typed contract for the rest
 * of the app is `src/native/SharingModule.ts`, per contracts/native-modules.md.
 */
/* eslint-disable @typescript-eslint/no-wrapper-object-types -- Codegen requires the literal `Object` type */
export interface Spec extends TurboModule {
  getSession(): Promise<Object>
  saveCredentials(input: Object): Promise<Object>
  acknowledgeWriteAccess(): Promise<Object>
  startSharing(shareName: string): Promise<Object>
  stopSharing(): Promise<Object>
  getConnectionInstructions(): Promise<Object>
  getRecentConnections(): Promise<Object[]>
  addListener(eventName: string): void
  removeListeners(count: number): void
}
/* eslint-enable @typescript-eslint/no-wrapper-object-types */

export default TurboModuleRegistry.getEnforcing<Spec>('SharingModule')
