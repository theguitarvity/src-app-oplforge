import type { TurboModule } from 'react-native'
import { TurboModuleRegistry } from 'react-native'

/**
 * Codegen wire boundary for Art Sync (box-art download for the local
 * library, matching desktop's Art Manager). Deliberately loosely-typed
 * (Object) — the real typed contract is `src/native/ArtSyncModule.ts`.
 */
/* eslint-disable @typescript-eslint/no-wrapper-object-types -- Codegen requires the literal `Object` type */
export interface Spec extends TurboModule {
  planArtSync(): Promise<Object>
  startArtSync(): Promise<Object>
}
/* eslint-enable @typescript-eslint/no-wrapper-object-types */

export default TurboModuleRegistry.getEnforcing<Spec>('ArtSyncModule')
