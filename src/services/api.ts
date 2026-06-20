import type { OplApi } from '@/types/opl'

const unsupported = async () => {
  throw new Error('API Electron indisponivel. Abra o app via pnpm electron:dev.')
}

const fallbackApi: OplApi = {
  listDevices: async () => [],
  getDeviceSummary: async () => ({ device: null, ps2Games: 0, ps1Games: 0, apps: 0, recentHistory: [] }),
  prepareDevice: unsupported,
  copyGame: unsupported,
  copyPs1Game: unsupported,
  installApp: unsupported,
  removeApp: unsupported,
  listSourceFiles: async () => [],
  importFromSource: unsupported,
  listManagedSources: async () => [],
  saveManagedSource: unsupported,
  removeManagedSource: unsupported,
  searchRemoteSource: async () => [],
  getRemoteItemDetails: unsupported,
  listRemoteFiles: async () => [],
  addP2PDownload: unsupported,
  addCatalogGamesToQueue: unsupported,
  pauseDownload: unsupported,
  resumeDownload: unsupported,
  cancelDownload: unsupported,
  getDownloadQueue: async () => [],
  getDownloadProgress: unsupported,
  listEssentialsCatalog: async () => [],
  refreshEssentialsSourceLinks: unsupported,
  createSmartFillPlan: unsupported,
  listTorrentFiles: async () => [],
  selectTorrentFiles: unsupported,
  startTorrentDownload: unsupported,
  indexOplmArt: async () => [],
  installArtForGame: unsupported,
  syncDvdArts: unsupported,
  detectGameId: async () => null,
  saveGameLibraryEntry: unsupported,
  getGameLibrary: async () => ({ games: [] }),
  openFolder: unsupported,
  getHistory: async () => [],
  clearHistory: async () => undefined,
  openPathDialog: async () => [],
  onLog: () => () => undefined,
  onProgress: () => () => undefined,
  onDownloadProgress: () => () => undefined,
  onDownloadCompleted: () => () => undefined,
  onDownloadFailed: () => () => undefined
}

export const oplApi: OplApi = typeof window !== 'undefined' && window.oplApi ? window.oplApi : fallbackApi
