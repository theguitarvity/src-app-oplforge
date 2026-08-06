import { app } from 'electron'
import path from 'node:path'
import { LinuxFragmentationAdapter } from '../fragmentation/linux.adapter'
import { MacOsFragmentationAdapter } from '../fragmentation/macos.adapter'
import { CatalogScannerService } from './catalog-scanner.service'
import { CatalogService } from './catalog.service'
import { CatalogStoreService } from './catalog-store.service'

let runtime: CatalogService | undefined
export function getCatalogService(): CatalogService {
  return (runtime ??= new CatalogService(
    new CatalogStoreService(path.join(app.getPath('userData'), 'device-catalog.json')),
    new CatalogScannerService(
      process.platform === 'linux'
        ? new LinuxFragmentationAdapter()
        : new MacOsFragmentationAdapter()
    )
  ))
}
