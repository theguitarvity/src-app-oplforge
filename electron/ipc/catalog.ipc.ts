import { BrowserWindow, ipcMain } from 'electron'
import type {
  CatalogDownloadInput,
  CatalogHashInput,
  CatalogOverrideInput,
  CatalogQuery,
  CatalogScanInput
} from '../../src/types/opl'
import {
  addCatalogGamesToQueue,
  createSmartFillPlan,
  listEssentialsCatalog,
  refreshEssentialsSourceLinks
} from '../services/catalog/essentials-catalog.service'
import {
  addCustomCatalogEntry,
  importCustomCatalogCsv,
  listCustomCatalog,
  removeCustomCatalogEntry,
  type CustomCatalogEntryInput
} from '../services/catalog/custom-catalog.service'
import { getCatalogService } from '../services/catalog/catalog-runtime'
import { CatalogHashService } from '../services/catalog/catalog-hash.service'
import { getOplProfileService } from './opl.ipc'
import { parseInput } from './schemas'

const hashes = new CatalogHashService()

export function registerCatalogIpc() {
  ipcMain.handle('catalog:essentials:list', (_event, query?: CatalogQuery) =>
    listEssentialsCatalog(query)
  )
  ipcMain.handle('catalog:essentials:refresh-links', () => refreshEssentialsSourceLinks())
  ipcMain.handle('catalog:smart-fill', (_event, devicePath: string, targetBytes?: number) =>
    createSmartFillPlan(devicePath, targetBytes)
  )
  ipcMain.handle('catalog:add-to-queue', (_event, input: CatalogDownloadInput) =>
    addCatalogGamesToQueue(input)
  )
  ipcMain.handle('catalog:custom:list', (_event, query?: CatalogQuery) => listCustomCatalog(query))
  ipcMain.handle('catalog:custom:add', (_event, input: CustomCatalogEntryInput) =>
    addCustomCatalogEntry(input)
  )
  ipcMain.handle('catalog:custom:remove', (_event, id: string) => removeCustomCatalogEntry(id))
  ipcMain.handle('catalog:custom:import-csv', (_event, filePath: string) =>
    importCustomCatalogCsv(filePath)
  )
  ipcMain.handle('catalog:scan', async (_event, input: CatalogScanInput) => {
    const parsed = parseInput('catalogScan', input)
    const profile = parsed.oplProfileId
      ? await getOplProfileService().get(parsed.oplProfileId)
      : undefined
    return getCatalogService().scan(parsed.devicePath, profile, (snapshot) => {
      for (const window of BrowserWindow.getAllWindows())
        window.webContents.send('catalog:event', snapshot)
    })
  })
  ipcMain.handle('catalog:cancel', (_event, input: { operationId: string }) =>
    getCatalogService().cancel(parseInput('operationCancel', input).operationId)
  )
  ipcMain.handle('catalog:snapshot', (_event, input: { deviceId: string }) =>
    getCatalogService().snapshot(parseInput('catalogSnapshot', input).deviceId)
  )
  ipcMain.handle('catalog:override', async (_event, input: CatalogOverrideInput) =>
    getCatalogService().override(parseInput('catalogOverride', input))
  )
  ipcMain.handle('catalog:hash', async (_event, input: CatalogHashInput) => {
    const parsed = parseInput('catalogHash', input)
    const snapshot = await getCatalogService().snapshot(parsed.deviceId)
    const mount = getCatalogService().mount(parsed.deviceId)
    if (!snapshot || !mount)
      throw Object.assign(new Error('Catalog device is not connected'), { code: 'DEVICE_REMOVED' })
    return hashes.hash(mount, snapshot, parsed.relativePath)
  })
}
