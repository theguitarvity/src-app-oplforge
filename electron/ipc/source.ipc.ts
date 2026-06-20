import { ipcMain } from 'electron'
import type {
  ImportFromSourceInput,
  ManagedSourceConfig,
  RemoteSearchParams,
  SourceProviderConfig
} from '../../src/types/opl'
import {
  getRemoteItemDetails,
  importFromSource,
  listManagedSources,
  listRemoteFiles,
  listSourceFiles,
  removeManagedSource,
  saveManagedSource,
  searchRemoteSource
} from '../services/source.service'

export function registerSourceIpc() {
  ipcMain.handle('sources:list-files', (_event, config: SourceProviderConfig) => listSourceFiles(config))
  ipcMain.handle('sources:import-file', (_event, input: ImportFromSourceInput) => importFromSource(input))
  ipcMain.handle('sources:managed:list', () => listManagedSources())
  ipcMain.handle('sources:managed:save', (_event, config: ManagedSourceConfig) => saveManagedSource(config))
  ipcMain.handle('sources:managed:remove', (_event, id: string) => removeManagedSource(id))
  ipcMain.handle('sources:remote:search', (_event, params: RemoteSearchParams) => searchRemoteSource(params))
  ipcMain.handle('sources:remote:details', (_event, id: string) => getRemoteItemDetails(id))
  ipcMain.handle('sources:remote:files', (_event, id: string) => listRemoteFiles(id))
}
