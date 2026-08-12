import type { TurboModule } from 'react-native'
import { TurboModuleRegistry } from 'react-native'

/**
 * Codegen wire boundary for the Google Drive source. Deliberately
 * loosely-typed (Object) — the real typed contract for the rest of the app
 * is `src/native/GoogleDriveModule.ts`.
 */
/* eslint-disable @typescript-eslint/no-wrapper-object-types -- Codegen requires the literal `Object` type */
export interface Spec extends TurboModule {
  getStatus(): Promise<Object>
  saveClientId(clientId: string): Promise<null>
  getAuthorizationUrl(): Promise<Object>
  completeAuthorization(code: string, state: string): Promise<null>
  disconnect(): Promise<null>
  listFiles(): Promise<Object[]>
  downloadFile(fileId: string, fileName: string): Promise<null>
}
/* eslint-enable @typescript-eslint/no-wrapper-object-types */

export default TurboModuleRegistry.getEnforcing<Spec>('GoogleDriveModule')
