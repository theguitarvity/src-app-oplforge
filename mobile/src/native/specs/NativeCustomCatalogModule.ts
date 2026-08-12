import type { TurboModule } from 'react-native'
import { TurboModuleRegistry } from 'react-native'

/**
 * Codegen wire boundary for the user-supplied Essentials catalog (CSV
 * import / manual entry). Deliberately loosely-typed (Object) — the real
 * typed contract for the rest of the app is `src/native/CustomCatalogModule.ts`.
 */
/* eslint-disable @typescript-eslint/no-wrapper-object-types -- Codegen requires the literal `Object` type */
export interface Spec extends TurboModule {
  listCustomCatalog(query: Object): Promise<Object>
  addCustomCatalogEntry(input: Object): Promise<Object>
  removeCustomCatalogEntry(id: string): Promise<null>
  importCustomCatalogCsv(uri: string): Promise<Object>
}
/* eslint-enable @typescript-eslint/no-wrapper-object-types */

export default TurboModuleRegistry.getEnforcing<Spec>('CustomCatalogModule')
