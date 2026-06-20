import { ipcMain } from 'electron'
import type { CatalogDownloadInput, CatalogQuery } from '../../src/types/opl'
import {
  addCatalogGamesToQueue,
  createSmartFillPlan,
  listEssentialsCatalog,
  refreshEssentialsSourceLinks
} from '../services/catalog/essentials-catalog.service'

export function registerCatalogIpc() {
  ipcMain.handle('catalog:essentials:list', (_event, query?: CatalogQuery) => listEssentialsCatalog(query))
  ipcMain.handle('catalog:essentials:refresh-links', () => refreshEssentialsSourceLinks())
  ipcMain.handle('catalog:smart-fill', (_event, devicePath: string, targetBytes?: number) =>
    createSmartFillPlan(devicePath, targetBytes)
  )
  ipcMain.handle('catalog:add-to-queue', (_event, input: CatalogDownloadInput) =>
    addCatalogGamesToQueue(input)
  )
}
