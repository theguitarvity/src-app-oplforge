export type DeviceStatus = 'ready' | 'missing-structure' | 'readonly' | 'unknown'
export type GameMediaType = 'DVD' | 'CD'
export type LogLevel = 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS'
export type HistoryResult = 'success' | 'error' | 'warning'
export type RemoteFileKind = 'iso' | 'bin' | 'cue' | 'archive' | 'torrent' | 'other'
export type SourceType =
  | 'internet-archive'
  | 'internet-archive-directory'
  | 'internet-archive-art-pack'
  | 'local-folder'
  | 'direct-url'
  | 'torrent'
  | 'magnet'
export type SourceLegalMode =
  | 'user-owned-backup-required'
  | 'metadata-assets'
  | 'user-configured'
export type DownloadStatus =
  | 'queued'
  | 'downloading'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
export type ArchiveMediaType = 'ps2-dvd' | 'ps2-cd' | 'ps1' | 'torrent' | 'archive' | 'unknown'
export type GameScoreTier = 'S' | 'A' | 'B' | 'C' | 'Unrated'
export type GamePriority = 'must-have' | 'recommended' | 'optional' | 'unrated'
export type CatalogDownloadMode = 'torrent-selective' | 'direct-http'
export type ArtAssetType = 'ICO' | 'SCR' | 'SCR2' | 'BG' | 'LGO' | 'COV' | 'LAB' | 'COV2'
export type GameArtStatus = 'missing' | 'partial' | 'complete'

export interface DeviceInfo {
  id: string
  name: string
  path: string
  total: number
  free: number
  used: number
  fileSystem: string
  status: DeviceStatus
}

export interface DeviceSummary {
  device: DeviceInfo | null
  ps2Games: number
  ps1Games: number
  apps: number
  recentHistory: HistoryEntry[]
}

export interface OperationProgress {
  id: string
  label: string
  value: number
  detail?: string
}

export interface LogEntry {
  id: string
  timestamp: string
  level: LogLevel
  message: string
}

export interface HistoryEntry {
  id: string
  timestamp: string
  operation: string
  origin?: string
  destination?: string
  result: HistoryResult
  message?: string
}

export interface PrepareDeviceInput {
  devicePath: string
}

export interface GameImportInput {
  sourcePaths: string[]
  devicePath: string
  name: string
  mediaType: GameMediaType
  region?: string
  code?: string
}

export interface Ps1ImportInput {
  sourcePaths: string[]
  devicePath: string
  name?: string
}

export interface AppInstallInput {
  sourcePath: string
  devicePath: string
  appName: string
}

export interface SourceFile {
  id: string
  name: string
  path: string
  size: number
  extension: string
  provider: string
}

export interface SourceProviderConfig {
  provider: 'local-folder' | 'url' | 'google-drive' | 'mega'
  rootPath?: string
  url?: string
}

export interface ImportFromSourceInput {
  file: SourceFile
  destination: string
}

export interface InternetArchiveSourceConfig {
  enabled: boolean
  baseUrl: string
  defaultQuery?: string
  creator?: string
  collection?: string
  mediaType?: string
}

export interface RemoteSearchParams {
  query?: string
  creator?: string
  collection?: string
  page?: number
  limit?: number
}

export interface RemoteSearchResult {
  id: string
  title: string
  creator?: string
  year?: string
  description?: string
  source: string
  url: string
  thumbnailUrl?: string
}

export interface RemoteItemDetails {
  id: string
  title: string
  description?: string
  files: RemoteFile[]
  metadata: Record<string, unknown>
}

export interface RemoteFile {
  name: string
  size?: number
  format?: string
  url?: string
  torrentUrl?: string
  magnetUri?: string
  kind: RemoteFileKind
}

export interface RemoteSearchProvider {
  id: string
  name: string
  search(params: RemoteSearchParams): Promise<RemoteSearchResult[]>
  getItemDetails(id: string): Promise<RemoteItemDetails>
  listFiles(id: string): Promise<RemoteFile[]>
}

export interface ManagedSourceConfig {
  id: string
  name: string
  type: SourceType
  enabled: boolean
  baseUrl?: string
  detailsUrl?: string
  defaultQuery?: string
  creator?: string
  collection?: string
  legalMode?: SourceLegalMode
}

export interface ArchiveDirectoryFile {
  id: string
  name: string
  url: string
  sizeBytes?: number
  modifiedAt?: string
  extension: string
  mediaType: ArchiveMediaType
}

export interface GameRatingSeed {
  normalizedTitle: string
  score: number
  tier: Exclude<GameScoreTier, 'Unrated'>
  genres: string[]
  priority: Exclude<GamePriority, 'unrated'>
  popularity?: number
  historicalRelevance?: number
  franchise?: string
  oplCompatibility?: number
}

export interface CatalogGame {
  id: string
  title: string
  normalizedTitle: string
  fileName: string
  url: string
  torrentUrl?: string
  sizeBytes?: number
  mediaType: ArchiveMediaType
  score?: number
  scoreTier: GameScoreTier
  genres: string[]
  priority: GamePriority
  matchedSeed?: string
  sourceId: string
  legalMode: SourceLegalMode
}

export interface SmartFillPlan {
  targetDevice: string
  availableBytes: number
  selectedGames: CatalogGame[]
  estimatedTotalBytes: number
  remainingBytes: number
  warnings: string[]
}

export interface CatalogQuery {
  search?: string
  tier?: GameScoreTier | 'all'
  mediaType?: ArchiveMediaType | 'all'
  priority?: GamePriority | 'all'
}

export interface CatalogDownloadInput {
  devicePath: string
  games: CatalogGame[]
  legalConfirmationText: string
}

export interface CatalogSourceLink {
  id: string
  title: string
  fileName: string
  url: string
  sizeBytes?: number
  mediaType: ArchiveMediaType
  accessible: boolean
  checkedAt: string
  statusCode?: number
}

export interface CatalogSourceLinkIndex {
  sourceId: string
  generatedAt: string
  links: CatalogSourceLink[]
}

export interface TorrentFileEntry {
  name: string
  path: string
  sizeBytes: number
  selected: boolean
}

export interface ArtAsset {
  gameId: string
  type: ArtAssetType
  name: string
  url: string
  sizeBytes?: number
}

export interface ArtInstallResult {
  gameId: string
  copied: ArtAsset[]
  status: GameArtStatus
}

export interface DvdArtSyncEntry {
  title: string
  path: string
  gameId?: string
  status: GameArtStatus
  existingArtCount: number
  downloadedArtCount: number
  message?: string
}

export interface DvdArtSyncResult {
  devicePath: string
  scannedGames: number
  updatedGames: number
  missingGameIds: number
  entries: DvdArtSyncEntry[]
}

export interface GameLibraryEntry {
  title: string
  gameId: string
  media: GameMediaType
  path: string
  artStatus: GameArtStatus
}

export interface GameLibrary {
  games: GameLibraryEntry[]
}

export interface TorrentInput {
  source: 'torrent-url' | 'torrent-file' | 'magnet' | 'direct-url'
  value: string
  destinationPath: string
  selectedFiles?: string[]
  finalizeTo?: 'DVD' | 'CD' | 'PS1' | 'APPS' | 'STAGING'
  title?: string
  fileName?: string
  expectedSizeBytes?: number
}

export interface DownloadTask {
  id: string
  input: TorrentInput
  destinationPath: string
  stagingPath: string
  status: DownloadStatus
  createdAt: string
  name: string
  selectedFiles: string[]
}

export interface DownloadProgress {
  taskId: string
  status: DownloadStatus
  progress: number
  downloadedBytes: number
  totalBytes: number
  downloadSpeed: number
  uploadSpeed: number
  peers: number
  etaSeconds?: number
  error?: string
}

export interface P2PDownloadService {
  addTorrent(input: TorrentInput): Promise<DownloadTask>
  pause(taskId: string): Promise<void>
  resume(taskId: string): Promise<void>
  cancel(taskId: string): Promise<void>
  getProgress(taskId: string): Promise<DownloadProgress>
}

export interface OplApi {
  listDevices(): Promise<DeviceInfo[]>
  getDeviceSummary(devicePath?: string): Promise<DeviceSummary>
  prepareDevice(input: PrepareDeviceInput): Promise<HistoryEntry>
  copyGame(input: GameImportInput): Promise<HistoryEntry[]>
  copyPs1Game(input: Ps1ImportInput): Promise<HistoryEntry[]>
  installApp(input: AppInstallInput): Promise<HistoryEntry>
  removeApp(devicePath: string, appName: string): Promise<HistoryEntry>
  listSourceFiles(config: SourceProviderConfig): Promise<SourceFile[]>
  importFromSource(input: ImportFromSourceInput): Promise<HistoryEntry>
  listManagedSources(): Promise<ManagedSourceConfig[]>
  saveManagedSource(config: ManagedSourceConfig): Promise<ManagedSourceConfig>
  removeManagedSource(id: string): Promise<void>
  searchRemoteSource(params: RemoteSearchParams): Promise<RemoteSearchResult[]>
  getRemoteItemDetails(id: string): Promise<RemoteItemDetails>
  listRemoteFiles(id: string): Promise<RemoteFile[]>
  addP2PDownload(input: TorrentInput): Promise<DownloadTask>
  addCatalogGamesToQueue(input: CatalogDownloadInput): Promise<DownloadTask[]>
  pauseDownload(taskId: string): Promise<void>
  resumeDownload(taskId: string): Promise<void>
  cancelDownload(taskId: string): Promise<void>
  getDownloadQueue(): Promise<DownloadTask[]>
  getDownloadProgress(taskId: string): Promise<DownloadProgress>
  listEssentialsCatalog(query?: CatalogQuery): Promise<CatalogGame[]>
  refreshEssentialsSourceLinks(): Promise<CatalogSourceLinkIndex>
  createSmartFillPlan(devicePath: string, targetBytes?: number): Promise<SmartFillPlan>
  listTorrentFiles(taskId: string): Promise<TorrentFileEntry[]>
  selectTorrentFiles(taskId: string, fileNames: string[]): Promise<void>
  startTorrentDownload(taskId: string, destinationPath: string): Promise<void>
  indexOplmArt(): Promise<ArtAsset[]>
  installArtForGame(devicePath: string, gameId: string, title?: string): Promise<ArtInstallResult>
  syncDvdArts(devicePath: string): Promise<DvdArtSyncResult>
  detectGameId(filePathOrName: string): Promise<string | null>
  saveGameLibraryEntry(entry: GameLibraryEntry): Promise<GameLibraryEntry>
  getGameLibrary(): Promise<GameLibrary>
  openFolder(folderPath: string): Promise<void>
  getHistory(): Promise<HistoryEntry[]>
  clearHistory(): Promise<void>
  openPathDialog(options?: OpenPathDialogOptions): Promise<string[]>
  onLog(callback: (entry: LogEntry) => void): () => void
  onProgress(callback: (progress: OperationProgress) => void): () => void
  onDownloadProgress(callback: (progress: DownloadProgress) => void): () => void
  onDownloadCompleted(callback: (progress: DownloadProgress) => void): () => void
  onDownloadFailed(callback: (progress: DownloadProgress) => void): () => void
}

export interface OpenPathDialogOptions {
  mode?: 'file' | 'folder' | 'multiFile'
  filters?: Array<{ name: string; extensions: string[] }>
}

declare global {
  interface Window {
    oplApi: OplApi
  }
}
