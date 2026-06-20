import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppInstallInput,
  CatalogDownloadInput,
  CatalogQuery,
  DownloadProgress,
  GameImportInput,
  GameLibraryEntry,
  ImportFromSourceInput,
  LogEntry,
  ManagedSourceConfig,
  OpenPathDialogOptions,
  OperationProgress,
  OplApi,
  PrepareDeviceInput,
  Ps1ImportInput,
  RemoteSearchParams,
  SourceProviderConfig,
  TorrentInput
} from '../src/types/opl'

const api: OplApi = {
  listDevices: () => ipcRenderer.invoke('devices:list'),
  getDeviceSummary: (devicePath?: string) => ipcRenderer.invoke('devices:summary', devicePath),
  prepareDevice: (input: PrepareDeviceInput) => ipcRenderer.invoke('files:prepare-device', input),
  copyGame: (input: GameImportInput) => ipcRenderer.invoke('files:copy-game', input),
  copyPs1Game: (input: Ps1ImportInput) => ipcRenderer.invoke('files:copy-ps1-game', input),
  installApp: (input: AppInstallInput) => ipcRenderer.invoke('files:install-app', input),
  removeApp: (devicePath: string, appName: string) => ipcRenderer.invoke('files:remove-app', devicePath, appName),
  listSourceFiles: (config: SourceProviderConfig) => ipcRenderer.invoke('sources:list-files', config),
  importFromSource: (input: ImportFromSourceInput) => ipcRenderer.invoke('sources:import-file', input),
  listManagedSources: () => ipcRenderer.invoke('sources:managed:list'),
  saveManagedSource: (config: ManagedSourceConfig) => ipcRenderer.invoke('sources:managed:save', config),
  removeManagedSource: (id: string) => ipcRenderer.invoke('sources:managed:remove', id),
  searchRemoteSource: (params: RemoteSearchParams) => ipcRenderer.invoke('sources:remote:search', params),
  getRemoteItemDetails: (id: string) => ipcRenderer.invoke('sources:remote:details', id),
  listRemoteFiles: (id: string) => ipcRenderer.invoke('sources:remote:files', id),
  addP2PDownload: (input: TorrentInput) => ipcRenderer.invoke('downloads:add-p2p', input),
  addCatalogGamesToQueue: (input: CatalogDownloadInput) => ipcRenderer.invoke('catalog:add-to-queue', input),
  pauseDownload: (taskId: string) => ipcRenderer.invoke('downloads:pause', taskId),
  resumeDownload: (taskId: string) => ipcRenderer.invoke('downloads:resume', taskId),
  cancelDownload: (taskId: string) => ipcRenderer.invoke('downloads:cancel', taskId),
  getDownloadQueue: () => ipcRenderer.invoke('downloads:queue'),
  getDownloadProgress: (taskId: string) => ipcRenderer.invoke('downloads:progress', taskId),
  listEssentialsCatalog: (query?: CatalogQuery) => ipcRenderer.invoke('catalog:essentials:list', query),
  refreshEssentialsSourceLinks: () => ipcRenderer.invoke('catalog:essentials:refresh-links'),
  createSmartFillPlan: (devicePath: string, targetBytes?: number) => ipcRenderer.invoke('catalog:smart-fill', devicePath, targetBytes),
  listTorrentFiles: (taskId: string) => ipcRenderer.invoke('downloads:torrent-files', taskId),
  selectTorrentFiles: (taskId: string, fileNames: string[]) => ipcRenderer.invoke('downloads:select-files', taskId, fileNames),
  startTorrentDownload: (taskId: string, destinationPath: string) => ipcRenderer.invoke('downloads:start', taskId, destinationPath),
  indexOplmArt: () => ipcRenderer.invoke('art:index-oplm'),
  installArtForGame: (devicePath: string, gameId: string, title?: string) => ipcRenderer.invoke('art:install-for-game', devicePath, gameId, title),
  syncDvdArts: (devicePath: string) => ipcRenderer.invoke('art:sync-dvd', devicePath),
  detectGameId: (filePathOrName: string) => ipcRenderer.invoke('games:detect-id', filePathOrName),
  saveGameLibraryEntry: (entry: GameLibraryEntry) => ipcRenderer.invoke('games:library:save-entry', entry),
  getGameLibrary: () => ipcRenderer.invoke('games:library:get'),
  openFolder: (folderPath: string) => ipcRenderer.invoke('shell:open-folder', folderPath),
  getHistory: () => ipcRenderer.invoke('history:get'),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  openPathDialog: (options?: OpenPathDialogOptions) => ipcRenderer.invoke('dialog:open-path', options),
  onLog: (callback: (entry: LogEntry) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, entry: LogEntry) => callback(entry)
    ipcRenderer.on('logs:entry', listener)
    return () => ipcRenderer.removeListener('logs:entry', listener)
  },
  onProgress: (callback: (progress: OperationProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: OperationProgress) => callback(progress)
    ipcRenderer.on('operations:progress', listener)
    return () => ipcRenderer.removeListener('operations:progress', listener)
  },
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: DownloadProgress) => callback(progress)
    ipcRenderer.on('download:progress', listener)
    return () => ipcRenderer.removeListener('download:progress', listener)
  },
  onDownloadCompleted: (callback: (progress: DownloadProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: DownloadProgress) => callback(progress)
    ipcRenderer.on('download:completed', listener)
    return () => ipcRenderer.removeListener('download:completed', listener)
  },
  onDownloadFailed: (callback: (progress: DownloadProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: DownloadProgress) => callback(progress)
    ipcRenderer.on('download:failed', listener)
    return () => ipcRenderer.removeListener('download:failed', listener)
  }
}

contextBridge.exposeInMainWorld('oplApi', api)
