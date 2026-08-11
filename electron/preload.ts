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
  NetworkShareEvent,
  NetworkShareProtocol,
  OpenPathDialogOptions,
  OperationProgress,
  OperationEvent,
  RepairEvent,
  CatalogSnapshot,
  OplApi,
  PrepareDeviceInput,
  Ps1ImportInput,
  RemoteSearchParams,
  SaveNetworkShareConfigInput,
  SourceProviderConfig,
  TorrentInput
} from '../src/types/opl'
import type { PipelineEvent } from '../src/types/opl-finalization'

const api: OplApi = {
  createImportJob: (input) => ipcRenderer.invoke('imports:create', input),
  getImportJob: (jobId) => ipcRenderer.invoke('imports:get', { jobId }),
  listImportJobs: () => ipcRenderer.invoke('imports:list', {}),
  cancelImportJob: (input) => ipcRenderer.invoke('imports:cancel', input),
  getUpdateSession: () => ipcRenderer.invoke('updates:get'),
  getUpdatePolicy: () => ipcRenderer.invoke('updates:get-policy'),
  setUpdatePolicy: (mode, expectedRevision) =>
    ipcRenderer.invoke('updates:set-policy', { mode, expectedRevision }),
  checkForUpdates: () => ipcRenderer.invoke('updates:check', {}),
  downloadUpdate: (input) => ipcRenderer.invoke('updates:download', input),
  installUpdate: (input) => ipcRenderer.invoke('updates:install', input),
  onUpdateEvent: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, session: Parameters<typeof callback>[0]) =>
      callback(session)
    ipcRenderer.on('updates:event', listener)
    return () => ipcRenderer.removeListener('updates:event', listener)
  },
  enqueueDownload: (input) => ipcRenderer.invoke('downloads:enqueue', input),
  listDownloads: (input = {}) => ipcRenderer.invoke('downloads:list', input),
  getDurableDownload: (taskId) => ipcRenderer.invoke('downloads:get', { taskId }),
  pauseDurableDownload: (input) => ipcRenderer.invoke('downloads:pause-v2', input),
  resumeDurableDownload: (input) => ipcRenderer.invoke('downloads:resume-v2', input),
  retryDurableDownload: (input) => ipcRenderer.invoke('downloads:retry', input),
  cancelDurableDownload: (input) => ipcRenderer.invoke('downloads:cancel-v2', input),
  resolveDownloadCollision: (taskId: string, action: 'overwrite' | 'cancel') =>
    ipcRenderer.invoke('downloads:resolve-collision', { taskId, action }),
  retryFailedDownloads: (input) => ipcRenderer.invoke('downloads:retry-failed', input),
  clearTerminalDownloads: (input) => ipcRenderer.invoke('downloads:clear-terminal', input),
  getFinalizationPlan: (planId) => ipcRenderer.invoke('finalization:get-plan', { planId }),
  confirmFinalization: (input) => ipcRenderer.invoke('finalization:confirm', input),
  setFinalizationGameId: (input) => ipcRenderer.invoke('finalization:set-game-id', input),
  cancelFinalization: (input) => ipcRenderer.invoke('finalization:cancel', input),
  refreshArtIndex: (force) => ipcRenderer.invoke('art:index:refresh', { force }),
  queryArtIndex: (input) => ipcRenderer.invoke('art:index:query', input),
  createArtSyncPlan: (input) => ipcRenderer.invoke('art:sync:plan', input),
  startArtSync: (input) => ipcRenderer.invoke('art:sync:start', input),
  getArtSyncJob: (jobId) => ipcRenderer.invoke('art:sync:get', { jobId }),
  listArtSyncJobs: (input = {}) => ipcRenderer.invoke('art:sync:list', input),
  pauseArtSync: (input) => ipcRenderer.invoke('art:sync:pause', input),
  resumeArtSync: (input) => ipcRenderer.invoke('art:sync:resume', input),
  cancelArtSync: (input) => ipcRenderer.invoke('art:sync:cancel', input),
  retryFailedArtSync: (input) => ipcRenderer.invoke('art:sync:retry-failed', input),
  onOplPipelineEvent: (callback: (event: PipelineEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: PipelineEvent) =>
      callback(payload)
    ipcRenderer.on('opl-pipeline:event', listener)
    return () => ipcRenderer.removeListener('opl-pipeline:event', listener)
  },
  auditOplNaming: (input) => ipcRenderer.invoke('naming:audit', input),
  createOplNamingPlan: (input) => ipcRenderer.invoke('naming:plan', input),
  confirmOplNaming: (input) => ipcRenderer.invoke('naming:confirm', input),
  getOplNamingOperation: (operationId) =>
    ipcRenderer.invoke('naming:get-operation', { operationId }),
  listFragmentationGames: (devicePath) =>
    ipcRenderer.invoke('fragmentation-repair:inventory', { devicePath }),
  diagnoseFragmentation: (input) => ipcRenderer.invoke('fragmentation-repair:diagnose', input),
  getCurrentFragmentationDiagnosis: (devicePath) =>
    ipcRenderer.invoke('fragmentation-repair:get-current-diagnosis', { devicePath }),
  cancelFragmentationDiagnosis: (operationId) =>
    ipcRenderer.invoke('fragmentation-repair:cancel-diagnosis', { operationId }),
  planFragmentationRepair: (input) => ipcRenderer.invoke('fragmentation-repair:plan', input),
  confirmFragmentationRepair: (input) => ipcRenderer.invoke('fragmentation-repair:confirm', input),
  cancelFragmentationRepair: (operationId) =>
    ipcRenderer.invoke('fragmentation-repair:cancel', { operationId }),
  getFragmentationRepairOperation: (operationId) =>
    ipcRenderer.invoke('fragmentation-repair:get-operation', { operationId }),
  getFragmentationRepairReport: (reportId) =>
    ipcRenderer.invoke('fragmentation-repair:get-report', { reportId }),
  getFragmentationRepairReportByOperation: (operationId) =>
    ipcRenderer.invoke('fragmentation-repair:get-report-by-operation', { operationId }),
  listFragmentationRecovery: (deviceId) =>
    ipcRenderer.invoke('fragmentation-repair:list-recovery', deviceId ? { deviceId } : {}),
  resolveFragmentationRecovery: (input) =>
    ipcRenderer.invoke('fragmentation-repair:resolve-recovery', input),
  listOplProfiles: () => ipcRenderer.invoke('opl:profiles:list'),
  getOplProfile: (id) => ipcRenderer.invoke('opl:profiles:get', id),
  registerOfficialOpl: (input) => ipcRenderer.invoke('opl:profiles:register-official', input),
  planOplUpdate: (input) => ipcRenderer.invoke('opl:profiles:update-plan', input),
  confirmOplUpdate: (input) => ipcRenderer.invoke('opl:profiles:update-confirm', input),
  planInstallation: (input) => ipcRenderer.invoke('installation:plan', input),
  confirmInstallation: (input) => ipcRenderer.invoke('installation:confirm', input),
  cancelInstallation: (operationId) => ipcRenderer.invoke('installation:cancel', { operationId }),
  scanCatalog: (input) => ipcRenderer.invoke('catalog:scan', input),
  cancelCatalogScan: (operationId) => ipcRenderer.invoke('catalog:cancel', { operationId }),
  getCatalogSnapshot: (deviceId) => ipcRenderer.invoke('catalog:snapshot', { deviceId }),
  setCatalogGameId: (input) => ipcRenderer.invoke('catalog:override', input),
  hashCatalogFile: (input) => ipcRenderer.invoke('catalog:hash', input),
  runDiagnostics: (input) => ipcRenderer.invoke('diagnostics:run', input),
  indexArt: () => ipcRenderer.invoke('art:index'),
  planArtSync: (input) => ipcRenderer.invoke('art:plan', input),
  confirmArtSync: (operationId) => ipcRenderer.invoke('art:confirm', { operationId }),
  detectPcsx2: (executablePath) => ipcRenderer.invoke('pcsx2:detect', executablePath),
  planValidation: (input) => ipcRenderer.invoke('validation:plan', input),
  startValidation: (operationId) => ipcRenderer.invoke('validation:start', { operationId }),
  confirmValidationCheckpoint: (input) => ipcRenderer.invoke('validation:checkpoint', input),
  stopValidation: (runId) => ipcRenderer.invoke('validation:stop', { operationId: runId }),
  planReorganization: (input) => ipcRenderer.invoke('reorganization:plan', input),
  confirmReorganization: (input) => ipcRenderer.invoke('reorganization:confirm', input),
  cancelReorganization: (operationId) =>
    ipcRenderer.invoke('reorganization:cancel', { operationId }),
  generateReadinessReport: (input) => ipcRenderer.invoke('reports:generate', input),
  getReadinessReport: (reportId) => ipcRenderer.invoke('reports:get', reportId),
  recordHardwareSmoke: (input) => ipcRenderer.invoke('reports:record-hardware-smoke', input),
  exportReadinessReport: (reportId, destinationPath) =>
    ipcRenderer.invoke('reports:export', { reportId, destinationPath }),
  getNetworkShareConfig: () => ipcRenderer.invoke('network-share:get-config'),
  saveNetworkShareConfig: (input: SaveNetworkShareConfigInput) =>
    ipcRenderer.invoke('network-share:save-config', input),
  acknowledgeNetworkShareWriteAccess: () =>
    ipcRenderer.invoke('network-share:acknowledge-write-access'),
  startNetworkShare: () => ipcRenderer.invoke('network-share:start'),
  stopNetworkShare: () => ipcRenderer.invoke('network-share:stop'),
  getNetworkShareStatus: () => ipcRenderer.invoke('network-share:get-status'),
  getNetworkShareSetupInstructions: (protocol: NetworkShareProtocol) =>
    ipcRenderer.invoke('network-share:get-setup-instructions', { protocol }),
  onNetworkShareEvent: (callback: (event: NetworkShareEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: NetworkShareEvent) =>
      callback(payload)
    ipcRenderer.on('network-share:event', listener)
    return () => ipcRenderer.removeListener('network-share:event', listener)
  },
  listDevices: () => ipcRenderer.invoke('devices:list'),
  getDeviceSummary: (devicePath?: string) => ipcRenderer.invoke('devices:summary', devicePath),
  prepareDevice: (input: PrepareDeviceInput) => ipcRenderer.invoke('files:prepare-device', input),
  copyGame: (input: GameImportInput) => ipcRenderer.invoke('files:copy-game', input),
  copyPs1Game: (input: Ps1ImportInput) => ipcRenderer.invoke('files:copy-ps1-game', input),
  installApp: (input: AppInstallInput) => ipcRenderer.invoke('files:install-app', input),
  listInstalledApps: (devicePath) => ipcRenderer.invoke('files:list-apps', devicePath),
  removeApp: (devicePath: string, appName: string) =>
    ipcRenderer.invoke('files:remove-app', devicePath, appName),
  deleteGame: (devicePath: string, relativePath: string, gameId?: string) =>
    ipcRenderer.invoke('files:delete-game', devicePath, relativePath, gameId),
  listSourceFiles: (config: SourceProviderConfig) =>
    ipcRenderer.invoke('sources:list-files', config),
  importFromSource: (input: ImportFromSourceInput) =>
    ipcRenderer.invoke('sources:import-file', input),
  listManagedSources: () => ipcRenderer.invoke('sources:managed:list'),
  saveManagedSource: (config: ManagedSourceConfig) =>
    ipcRenderer.invoke('sources:managed:save', config),
  removeManagedSource: (id: string) => ipcRenderer.invoke('sources:managed:remove', id),
  searchRemoteSource: (params: RemoteSearchParams) =>
    ipcRenderer.invoke('sources:remote:search', params),
  getRemoteItemDetails: (id: string) => ipcRenderer.invoke('sources:remote:details', id),
  listRemoteFiles: (id: string) => ipcRenderer.invoke('sources:remote:files', id),
  addP2PDownload: (input: TorrentInput) => ipcRenderer.invoke('downloads:add-p2p', input),
  addCatalogGamesToQueue: (input: CatalogDownloadInput) =>
    ipcRenderer.invoke('catalog:add-to-queue', input),
  pauseDownload: (taskId: string) => ipcRenderer.invoke('downloads:pause', taskId),
  resumeDownload: (taskId: string) => ipcRenderer.invoke('downloads:resume', taskId),
  cancelDownload: (taskId: string) => ipcRenderer.invoke('downloads:cancel', taskId),
  getDownloadQueue: () => ipcRenderer.invoke('downloads:queue'),
  getDownloadProgress: (taskId: string) => ipcRenderer.invoke('downloads:progress', taskId),
  listEssentialsCatalog: (query?: CatalogQuery) =>
    ipcRenderer.invoke('catalog:essentials:list', query),
  refreshEssentialsSourceLinks: () => ipcRenderer.invoke('catalog:essentials:refresh-links'),
  createSmartFillPlan: (devicePath: string, targetBytes?: number) =>
    ipcRenderer.invoke('catalog:smart-fill', devicePath, targetBytes),
  listTorrentFiles: (taskId: string) => ipcRenderer.invoke('downloads:torrent-files', taskId),
  selectTorrentFiles: (taskId: string, fileNames: string[]) =>
    ipcRenderer.invoke('downloads:select-files', taskId, fileNames),
  startTorrentDownload: (taskId: string, destinationPath: string) =>
    ipcRenderer.invoke('downloads:start', taskId, destinationPath),
  detectGameId: (filePathOrName: string) => ipcRenderer.invoke('games:detect-id', filePathOrName),
  saveGameLibraryEntry: (entry: GameLibraryEntry) =>
    ipcRenderer.invoke('games:library:save-entry', entry),
  getGameLibrary: () => ipcRenderer.invoke('games:library:get'),
  openFolder: (folderPath: string) => ipcRenderer.invoke('shell:open-folder', folderPath),
  openExternalUrl: (url: string) => ipcRenderer.invoke('shell:open-external', url),
  getHistory: () => ipcRenderer.invoke('history:get'),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  openPathDialog: (options?: OpenPathDialogOptions) =>
    ipcRenderer.invoke('dialog:open-path', options),
  authorizeLocalFolder: (selectedPath: string) =>
    ipcRenderer.invoke('dialog:authorize-local-folder', { selectedPath }),
  createLocalFolder: (input) => ipcRenderer.invoke('dialog:create-local-folder', input),
  listActiveOperations: () => ipcRenderer.invoke('operations:list', {}),
  onLog: (callback: (entry: LogEntry) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, entry: LogEntry) => callback(entry)
    ipcRenderer.on('logs:entry', listener)
    return () => ipcRenderer.removeListener('logs:entry', listener)
  },
  onProgress: (callback: (progress: OperationProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: OperationProgress) =>
      callback(progress)
    ipcRenderer.on('operations:progress', listener)
    return () => ipcRenderer.removeListener('operations:progress', listener)
  },
  onOperationEvent: (callback: (event: OperationEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: OperationEvent) =>
      callback(payload)
    ipcRenderer.on('operations:event', listener)
    return () => ipcRenderer.removeListener('operations:event', listener)
  },
  onFragmentationRepairEvent: (callback: (event: RepairEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: RepairEvent) => callback(payload)
    ipcRenderer.on('fragmentation-repair:event', listener)
    return () => ipcRenderer.removeListener('fragmentation-repair:event', listener)
  },
  onCatalogEvent: (callback: (snapshot: CatalogSnapshot) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, snapshot: CatalogSnapshot) =>
      callback(snapshot)
    ipcRenderer.on('catalog:event', listener)
    return () => ipcRenderer.removeListener('catalog:event', listener)
  },
  onValidationEvent: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: Parameters<typeof callback>[0]) =>
      callback(payload)
    ipcRenderer.on('validation:event', listener)
    return () => ipcRenderer.removeListener('validation:event', listener)
  },
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: DownloadProgress) =>
      callback(progress)
    ipcRenderer.on('download:progress', listener)
    return () => ipcRenderer.removeListener('download:progress', listener)
  },
  onDownloadCompleted: (callback: (progress: DownloadProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: DownloadProgress) =>
      callback(progress)
    ipcRenderer.on('download:completed', listener)
    return () => ipcRenderer.removeListener('download:completed', listener)
  },
  onDownloadFailed: (callback: (progress: DownloadProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: DownloadProgress) =>
      callback(progress)
    ipcRenderer.on('download:failed', listener)
    return () => ipcRenderer.removeListener('download:failed', listener)
  }
}

contextBridge.exposeInMainWorld('oplApi', api)
