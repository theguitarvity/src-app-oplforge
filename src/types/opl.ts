import type {
  ArtAssetRecord,
  ArtSyncJob,
  ArtSyncPlanSummary,
  ConfirmFinalizationInput,
  DurableDownloadTask,
  DurableDownloadTaskSummary,
  EnqueueDownloadInput,
  FinalizationPlan,
  ListDownloadsInput,
  Page,
  NamingAudit,
  NamingOperationResult,
  NamingPlan,
  OperationSummary,
  ImportJob,
  UpdatePolicy,
  UpdateSession,
  PipelineEvent,
  RevisionedJobRef,
  RevisionedTaskRef,
  SetFinalizationGameIdInput
} from './opl-finalization'

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
export type SourceLegalMode = 'user-owned-backup-required' | 'metadata-assets' | 'user-configured'
export type DownloadStatus =
  'queued' | 'downloading' | 'paused' | 'completed' | 'failed' | 'cancelled'
export type ArchiveMediaType = 'ps2-dvd' | 'ps2-cd' | 'ps1' | 'torrent' | 'archive' | 'unknown'
export type GameScoreTier = 'S' | 'A' | 'B' | 'C' | 'Unrated'
export type GamePriority = 'must-have' | 'recommended' | 'optional' | 'unrated'
export type CatalogDownloadMode = 'torrent-selective' | 'direct-http'
export type ArtAssetType = 'ICO' | 'SCR' | 'SCR2' | 'BG' | 'LGO' | 'COV' | 'LAB' | 'COV2'
export type GameArtStatus = 'missing' | 'cover-ready' | 'partial' | 'complete'
export type VerificationState = 'verified' | 'not-verified' | 'failed' | 'not-run'
export type ReadinessStatus =
  'ready' | 'ready-with-warnings' | 'requires-reorganization' | 'incompatible'
export type FindingSeverity = 'info' | 'warning' | 'error'
export type InstallationFormat = 'ISO' | 'ZSO' | 'USBExtreme'
export type FragmentationState = 'contiguous' | 'fragmented' | 'unknown' | 'not-applicable'
export type OperationState =
  'planned' | 'running' | 'awaiting-confirmation' | 'completed' | 'failed' | 'cancelled'

// Fragmentation-repair domain. These types deliberately keep persisted paths
// relative; absolute paths are resolved only by the privileged process.
export type DiagnosticState =
  'contiguous' | 'fragmented' | 'partially-fragmented' | 'incomplete' | 'invalid' | 'unverifiable'
export type VerificationCapability =
  | 'supported'
  | 'unsupported'
  | 'unavailable'
  | 'permission-denied'
  | 'unrecognized-output'
  | 'not-homologated'
export type RepairOutcome =
  'corrected' | 'unchanged' | 'skipped' | 'failed' | 'cancelled' | 'recovery-pending'
export type RepairOperationStatus =
  | 'planned'
  | 'awaiting-confirmation'
  | 'running'
  | 'cancelling'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'recovery-pending'
export type TransactionState =
  | 'planned'
  | 'preflight-validated'
  | 'staging'
  | 'candidate-verified'
  | 'commit-intent'
  | 'promoting'
  | 'active-validating'
  | 'committed'
  | 'cleanup-pending'
  | 'cleanup-complete'
  | 'aborted-unchanged'
  | 'rollback-required'
  | 'rolling-back'
  | 'restored'
  | 'recovery-pending'
export type EvaluatedFileRole = 'game' | 'usb-part' | 'ul-cfg' | 'auxiliary'
export type StructuralState = 'valid' | 'incomplete' | 'invalid' | 'unverifiable'
export type ExtentState = 'contiguous' | 'fragmented' | 'unverifiable' | 'not-applicable'

export interface PhysicalRange {
  logicalStart: number
  physicalStart: number
  length: number
}
export interface DeviceCapability {
  deviceId: string
  mountPath: string
  realPath: string
  volumeId?: string
  fileSystem: string
  totalBytes: number
  freeBytes: number
  extentVerification: VerificationCapability
  method: string
  homologated: boolean
  limitations: string[]
  observedAt: string
}
export interface InstallationIdentity {
  installationId: string
  deviceId: string
  format: InstallationFormat
  relativePaths: string[]
  gameId?: string
  title: string
  media: GameMediaType
}
export interface EvaluatedFile {
  relativePath: string
  role: EvaluatedFileRole
  sizeBytes?: number
  modifiedAt?: string
  sha256?: string
  structuralState: StructuralState
  extentState: ExtentState
  extentCount?: number
  physicalRanges?: PhysicalRange[]
  verificationMethod?: string
  findings: Finding[]
}
export interface GameDiagnostic {
  identity: InstallationIdentity
  files: EvaluatedFile[]
  state: DiagnosticState
  totalBytes: number
  temporaryBytes: number
  findings: Finding[]
}
export interface DiagnosticSummary {
  total: number
  byState: Record<DiagnosticState, number>
  eligibleGames: number
  affectedFiles: number
  freeBytes: number
  peakTemporaryBytes: number
}
export interface FragmentationDiagnostic {
  diagnosticId: string
  revision: number
  device: DeviceCapability
  status: 'running' | 'complete' | 'cancelled' | 'failed'
  installations: GameDiagnostic[]
  summary: DiagnosticSummary
  startedAt: string
  completedAt?: string
}
export interface FragmentationDiagnosisActivity {
  diagnosticId: string
  devicePath: string
  deviceId?: string
  status: 'running' | 'complete' | 'cancelled' | 'failed'
  processedItems: number
  totalItems: number
  progress: number
  currentItem?: string
  message: string
  startedAt: string
  completedAt?: string
  diagnostic?: FragmentationDiagnostic
}
export interface FragmentationInventoryItem {
  selectionKey: string
  format: InstallationFormat
  title: string
  gameId?: string
  media: GameMediaType
  relativePaths: string[]
  totalBytes: number
}
export interface FragmentationInventory {
  deviceId: string
  devicePath: string
  items: FragmentationInventoryItem[]
  capturedAt: string
}
export interface FileFingerprint {
  relativePath: string
  sizeBytes: number
  modifiedAt?: string
  sha256: string
}
export interface RepairPlanItem {
  installation: InstallationIdentity
  sourceFingerprints: FileFingerprint[]
  filesToRewrite: string[]
  ulCfgAction: 'none' | 'replace'
  ulCfgJustification?: string
  candidateBytes: number
  operationalMarginBytes: number
  temporaryBytes: number
  risks: string[]
  order: number
}
export interface PlanExclusion {
  installation: InstallationIdentity
  code: string
  explanation: string
}
export interface RepairPlan {
  planId: string
  revision: number
  diagnosticId: string
  diagnosticRevision: number
  deviceId: string
  mode: 'single' | 'batch'
  status: 'awaiting-confirmation' | 'confirmed' | 'stale' | 'cancelled' | 'consumed'
  items: RepairPlanItem[]
  exclusions: PlanExclusion[]
  peakTemporaryBytes: number
  freeBytesObserved: number
  confirmationText: 'CORRIGIR FRAGMENTAÇÃO'
  recoveryStrategy: string
  createdAt: string
}
export interface RepairItemResult {
  installationId: string
  outcome: RepairOutcome
  error?: SerializableError
}
export interface RepairOperation {
  operationId: string
  planId: string
  expectedDeviceRevision: number
  status: RepairOperationStatus
  currentItemIndex?: number
  items: RepairItemResult[]
  lastSequence: number
  startedAt: string
  completedAt?: string
}
export interface TransactionFile {
  relativePath: string
  sizeBytes: number
  sha256: string
  extentState: ExtentState
}
export interface JournalStep {
  step: string
  relativePath?: string
  timestamp: string
  error?: SerializableError
}
export interface TransactionJournal {
  journalId: string
  schemaVersion: number
  revision: number
  operationId: string
  installationId: string
  deviceId: string
  state: TransactionState
  sourceFingerprints: FileFingerprint[]
  candidates: TransactionFile[]
  backups: TransactionFile[]
  ulCfgAction: 'none' | 'replace'
  intents: JournalStep[]
  outcomes: JournalStep[]
  recoveryInstructions: string[]
  updatedAt: string
}
export interface RepairEvent {
  operationId: string
  sequence: number
  installationId?: string
  phase: TransactionState | 'diagnosing' | 'diagnosis-complete'
  progress?: number
  processedItems?: number
  totalItems?: number
  currentItem?: string
  message: string
  error?: SerializableError
  timestamp: string
}
export interface RepairGameReport {
  installation: InstallationIdentity
  previousState: DiagnosticState
  finalState?: DiagnosticState
  outcome: RepairOutcome
  sourceFingerprints: FileFingerprint[]
  candidateFingerprints: FileFingerprint[]
  finalFingerprints: FileFingerprint[]
  modifiedFiles: string[]
  failures: SerializableError[]
  rollbackDecisions: string[]
  recoveryInstructions: string[]
}
export interface RepairReport {
  reportId: string
  operationId: string
  planId: string
  diagnosticId: string
  device: Omit<DeviceCapability, 'mountPath' | 'realPath'>
  result: 'completed' | 'partial' | 'failed' | 'cancelled' | 'recovery-pending'
  games: RepairGameReport[]
  counts: Record<RepairOutcome, number>
  startedAt: string
  completedAt: string
  limitations: string[]
}
export interface RecoveryItem {
  journalId: string
  operationId: string
  installationId: string
  deviceId: string
  revision: number
  state: 'restored' | 'recovery-pending' | 'cleanup-pending'
  instructions: string[]
  updatedAt: string
}
export interface FragmentationDiagnoseInput {
  devicePath: string
  oplProfileId?: string
  selectionKeys?: string[]
}
export interface FragmentationRepairPlanInput {
  diagnosticId: string
  expectedRevision: number
  mode: 'single' | 'batch'
  installationIds?: string[]
}
export interface FragmentationRepairConfirmation {
  planId: string
  expectedRevision: number
  confirmation: 'CORRIGIR FRAGMENTAÇÃO'
}
export interface ResolveRecoveryInput {
  journalId: string
  expectedRevision: number
  action: 'restore-original' | 'clean-verified-residue'
  confirmation: 'RECUPERAR JOGO'
}

export interface SerializableError {
  code: string
  message: string
  details?: Record<string, unknown>
  retryable: boolean
}

export interface DeviceIdentity {
  deviceId: string
  mountPath: string
  realPath: string
  volumeId?: string
  fileSystem: string
  totalBytes: number
  freeBytes: number
  clusterBytes?: number
  supportsLargeFiles: VerificationState
  observedAt: string
}

export interface Finding {
  code: string
  severity: FindingSeverity
  state: VerificationState
  message: string
  evidence?: Record<string, unknown>
  remediation?: string
}

export interface OplCapabilities {
  iso: boolean
  zso: boolean
  usbExtreme: boolean
  fileSystems: string[]
}

export interface OplProfile {
  id: string
  version: string
  commit?: string
  variant: string
  officialUrl: string
  elfSha256: string
  obtainedAt: string
  capabilities: OplCapabilities
}

export interface OplProfileRegistration {
  profile: OplProfile
  elfPath: string
}
export interface OplUpdatePlanInput {
  profileId: string
  memoryCardPath: string
}
export interface OplUpdateConfirmation {
  planId: string
  confirmation: 'ATUALIZAR OPL'
  patchedImagePath: string
}

export interface OperationEvent {
  operationId: string
  sequence: number
  state: OperationState
  timestamp: string
  progress?: number
  message: string
  error?: SerializableError
}

export interface InstallationPlan {
  id: string
  sourcePath: string
  devicePath: string
  gameId: string
  title: string
  media: GameMediaType
  format: InstallationFormat
  destinationRelativePath: string
  sourceBytes: number
  requiredBytes: number
  sourceSha256: string
  expectedRevision: number
  replaces?: string
  warnings: string[]
}

export interface InstallationResult {
  operationId: string
  destinationPaths: string[]
  sourceSha256: string
  destinationSha256: string
  fragmentation: FragmentationState
  verification: VerificationState
}
export interface InstallationPlanInput {
  sourcePath: string
  devicePath: string
  oplProfileId: string
  title: string
  fileSystem?: string
}
export interface OperationConfirmation {
  operationId: string
  expectedRevision: number
  confirmation: string
}

export interface DeleteGameResult {
  deleted: string[]
  failed: { path: string; error: string }[]
}

export type CatalogItemClassification = 'ready' | 'warning' | 'invalid'
export type CatalogGameIdSource = 'iso' | 'zso' | 'filename' | 'ul-cfg' | 'manual' | 'none'
export interface FileIdentity {
  deviceId: string
  relativePath: string
  sizeBytes: number
  modifiedAt?: string
  structuralSignature?: string
  sha256?: string
}
export interface CatalogItem {
  itemId: string
  kind: 'game' | 'unknown'
  title?: string
  gameId?: string
  gameIdSource: CatalogGameIdSource
  mediaType: GameMediaType | 'not-verified'
  installFormat: InstallationFormat | 'unknown'
  relativePath: string
  files: FileIdentity[]
  totalBytes: number
  structuralIntegrity: VerificationState
  hashState: 'not-calculated' | 'verified' | 'failed' | 'stale'
  fragmentation: FragmentationState
  artStatus: GameArtStatus
  compatibility: VerificationState
  classification: CatalogItemClassification
  findings: Finding[]
  artView?: GameArtView
  health?: LibraryHealth
}

export interface LocalArtAsset {
  assetId: string
  deviceId: string
  gameId: string
  type: ArtAssetType
  relativePath: string
  sizeBytes: number
  modifiedAt?: string
  validity: 'valid' | 'invalid' | 'ambiguous-secondary'
  findingCodes: string[]
}
export interface GameArtView {
  primaryCoverAssetId?: string
  coverUrl?: string
  availableTypes: ArtAssetType[]
  completeness: 'complete' | 'partial' | 'missing' | 'invalid' | 'ambiguous'
  placeholderKind: 'ps2' | 'ps1' | 'app'
  findings: Finding[]
}
export interface LibraryHealth {
  readiness: 'ready' | 'needs-validation' | 'invalid-name' | 'fragmented' | 'incomplete' | 'unknown'
  readinessReasons: Finding[]
  artCompleteness: GameArtView['completeness']
  metadataCompleteness: 'complete' | 'missing' | 'unknown'
}

export interface LocalFolderAuthorization {
  authorizationId: string
  rootToken: string
  displayLabel: string
  state: 'valid' | 'missing' | 'changed' | 'revoked'
  createdAt: string
  lastValidatedAt: string
}
export interface CatalogSnapshot {
  snapshotId: string
  scanId: string
  deviceId: string
  profileId?: string
  status: 'provisional' | 'complete' | 'failed'
  capturedAt: string
  items: CatalogItem[]
  findings: Finding[]
  supersedesSnapshotId?: string
  revision: number
}
export interface CatalogScanInput {
  devicePath: string
  oplProfileId?: string
}
export interface CatalogOverrideInput {
  deviceId: string
  relativePath: string
  size: number
  fingerprint: string
  gameId: string
}
export interface CatalogHashInput {
  deviceId: string
  relativePath: string
}

export interface DeviceDiagnostic {
  device: DeviceIdentity
  readiness: ReadinessStatus
  findings: Finding[]
  catalog: CatalogSnapshot
  checkedAt: string
}
export interface Pcsx2Profile {
  id: string
  executablePath: string
  version: string
  architecture: string
  sha256: string
  adapterId: string
  supported: boolean
}
export interface BiosIdentity {
  sha256: string
  region: string
  sizeBytes: number
}
export type ValidationCheckpointResult = 'passed' | 'failed' | 'not-verified'
export interface ValidationCheckpoint {
  stage: number
  label: string
  result: ValidationCheckpointResult
  actor: 'automatic' | 'manual'
  timestamp: string
  reason?: string
  evidenceSha256?: string
}
export interface ValidationRun {
  id: string
  status: 'planned' | 'running' | 'passed' | 'failed' | 'stopped' | 'timeout'
  bootMode: 'memory-card' | 'elf-fallback'
  pcsx2: Pcsx2Profile
  bios: BiosIdentity
  datapath: string
  startedAt?: string
  completedAt?: string
  checkpoints: ValidationCheckpoint[]
  artifacts: Array<{ kind: string; path: string; sha256: string }>
}
export interface ValidationPlanInput {
  deviceId: string
  snapshotId: string
  itemId: string
  profileId: string
  pcsx2Path: string
  biosPath: string
  memoryCardPath: string
  bootMode: 'memory-card' | 'elf-fallback'
  elfPath?: string
}
export interface ReorganizationInventoryEntry {
  relativePath: string
  sizeBytes: number
  sha256: string
}
export interface ReorganizationPlan {
  id: string
  deviceId: string
  devicePath: string
  backupPath: string
  backupRoot: string
  requiredBytes: number
  availableBytes: number
  expectedRevision: number
  inventory: ReorganizationInventoryEntry[]
}
export interface ReorganizationResult {
  operationId: string
  restoredFiles: number
  fragmentation: FragmentationState
  audit: string[]
}
export type ReportResultState = 'passed' | 'failed' | 'not-verified' | 'not-run'
export interface HardwareSmokeTest {
  consoleModel: string
  adapter: string
  oplVersion: string
  detected: boolean
  artDisplayed: boolean
  noFragmentationError: boolean
  milestoneReached: boolean
  recordedAt: string
}
export interface ReadinessReport {
  id: string
  revision: number
  createdAt: string
  device: Omit<DeviceIdentity, 'mountPath' | 'realPath'>
  opl: OplProfile
  pcsx2?: Pcsx2Profile
  bios?: BiosIdentity
  games: Array<{
    gameId?: string
    title?: string
    format: InstallationFormat | 'unknown'
    sourceHashes: string[]
    fragmentation: FragmentationState
    art: GameArtStatus
    integrity: VerificationState
  }>
  evidence: Array<{ kind: string; sha256: string }>
  limitations: string[]
  results: { structural: ReportResultState; pcsx2: ReportResultState; hardware: ReportResultState }
  hardwareSmoke?: HardwareSmokeTest
}

export interface DeviceInfo {
  id: string
  name: string
  path: string
  total: number
  free: number
  used: number
  fileSystem: string
  status: DeviceStatus
  sourceKind?: 'opl-device' | 'local-folder'
  isOutsideHome?: boolean
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
  operationId?: string
  operation: string
  origin?: string
  destination?: string
  result: HistoryResult
  message?: string
}

export type NetworkShareProtocol = 'smb' | 'ftp'
export type NetworkShareProtocolState = 'off' | 'starting' | 'running' | 'error' | 'stopping'
export type NetworkShareClientActivity = 'idle' | 'browsing' | 'transferring'
export type NetworkShareEventKind =
  | 'protocol-status-changed'
  | 'client-connected'
  | 'client-disconnected'
  | 'client-activity-changed'
  | 'write-conflict'

export interface NetworkShareConfig {
  libraryRootPath: string
  enabledProtocols: NetworkShareProtocol[]
  shareName: string
  username: string
  smbPort: number
  ftpPort: number
  autoStartOnLaunch: boolean
  writeAccessAcknowledgedAt?: string
}

export interface SaveNetworkShareConfigInput {
  libraryRootPath: string
  enabledProtocols: NetworkShareProtocol[]
  shareName: string
  username: string
  password?: string
  smbPort?: number
  ftpPort?: number
  autoStartOnLaunch: boolean
}

export interface ProtocolStatus {
  state: NetworkShareProtocolState
  // Every address the server is reachable on — a multi-homed host (e.g. a
  // secondary router creating a second local subnet) can have more than
  // one; the PS2 may only be able to reach one of them.
  boundAddresses: string[]
  port?: number
  error?: SerializableError
  startedAt?: string
}

export interface ConnectedClient {
  id: string
  protocol: NetworkShareProtocol
  remoteAddress: string
  connectedAt: string
  activity: NetworkShareClientActivity
  lastActivityAt: string
  /** Friendly title (or raw filename fallback) of the game currently being read — null once idle. */
  currentFile?: string | null
}

export interface NetworkShareStatus {
  smb: ProtocolStatus
  ftp: ProtocolStatus
  connectedClients: ConnectedClient[]
}

export interface NetworkShareEvent {
  kind: NetworkShareEventKind
  status: NetworkShareStatus
  client?: ConnectedClient
  message: string
  timestamp: string
}

export interface SetupInstructions {
  protocol: NetworkShareProtocol
  steps: Array<{ label: string; value: string }>
  oplMenuPath: string[]
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
export interface InstalledApp {
  name: string
  elfName: string
  relativePath: string
  launchPath: string
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

export interface GoogleDriveStatus {
  /** Whether a Client ID has been saved — required before connect() can run. */
  configured: boolean
  connected: boolean
  clientId?: string
}

export interface ImportFromSourceInput {
  file: SourceFile
  destination: string
  overwrite?: boolean
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

export interface CustomCatalogEntryInput {
  title: string
  fileName: string
  url: string
  sizeBytes?: number
  mediaType?: ArchiveMediaType
}

export interface ImportCustomCatalogCsvResult {
  added: CatalogGame[]
  errors: string[]
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
export interface ArtPlanEntry {
  itemId: string
  gameId: string
  gameIdSource: CatalogGameIdSource
  title?: string
  available: ArtAsset[]
  existing: ArtAssetType[]
  destination: string
}
export interface ArtSyncPlan {
  id: string
  devicePath: string
  snapshotId: string
  entries: ArtPlanEntry[]
}
export interface ArtSyncEntryResult {
  gameId: string
  found: ArtAssetType[]
  downloaded: ArtAssetType[]
  existing: ArtAssetType[]
  errors: Array<{ type: ArtAssetType; message: string }>
  destination: string
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
  createImportJob(input: {
    sourcePaths: string[]
    devicePath: string
    mediaType: 'DVD' | 'CD'
    legalConfirmation: 'IMPORTAR BACKUP AUTORIZADO'
  }): Promise<ImportJob>
  getImportJob(jobId: string): Promise<ImportJob | undefined>
  listImportJobs(): Promise<ImportJob[]>
  cancelImportJob(input: {
    jobId: string
    expectedRevision: number
    partialPolicy: 'discard' | 'keep'
  }): Promise<ImportJob>
  getUpdateSession(): Promise<UpdateSession>
  getUpdatePolicy(): Promise<UpdatePolicy>
  setUpdatePolicy(mode: UpdatePolicy['mode'], expectedRevision: number): Promise<UpdatePolicy>
  checkForUpdates(): Promise<UpdateSession>
  downloadUpdate(input: { sessionId: string; expectedRevision: number }): Promise<UpdateSession>
  installUpdate(input: {
    sessionId: string
    expectedRevision: number
    confirmation: 'REINICIAR E ATUALIZAR'
  }): Promise<UpdateSession>
  onUpdateEvent(callback: (session: UpdateSession) => void): () => void
  enqueueDownload(input: EnqueueDownloadInput): Promise<DurableDownloadTask>
  listDownloads(input?: ListDownloadsInput): Promise<Page<DurableDownloadTaskSummary>>
  getDurableDownload(taskId: string): Promise<DurableDownloadTask | undefined>
  pauseDurableDownload(input: RevisionedTaskRef): Promise<DurableDownloadTask>
  resumeDurableDownload(input: RevisionedTaskRef): Promise<DurableDownloadTask>
  retryDurableDownload(input: RevisionedTaskRef): Promise<DurableDownloadTask>
  resolveDownloadCollision(taskId: string, action: 'overwrite' | 'cancel'): Promise<void>
  cancelDurableDownload(
    input: RevisionedTaskRef & {
      partialPolicy: 'keep-for-resume' | 'discard'
      confirmation?: 'DESCARTAR DOWNLOAD PARCIAL'
    }
  ): Promise<DurableDownloadTask>
  retryFailedDownloads(input: {
    deviceId?: string
    expectedQueueRevision: number
  }): Promise<{ queuedTaskIds: string[]; skippedTaskIds: string[] }>
  clearTerminalDownloads(input: {
    deviceId?: string
    expectedQueueRevision: number
  }): Promise<{ removedTaskIds: string[]; queueRevision: number }>
  getFinalizationPlan(planId: string): Promise<FinalizationPlan | undefined>
  confirmFinalization(input: ConfirmFinalizationInput): Promise<DurableDownloadTask>
  setFinalizationGameId(input: SetFinalizationGameIdInput): Promise<FinalizationPlan>
  cancelFinalization(input: RevisionedTaskRef): Promise<DurableDownloadTask>
  refreshArtIndex(force?: boolean): Promise<{ revision: number; itemCount: number; stale: boolean }>
  queryArtIndex(input: {
    gameIds?: string[]
    types?: ArtAssetRecord['type'][]
    cursor?: string
    limit?: number
  }): Promise<Page<ArtAssetRecord>>
  createArtSyncPlan(input: {
    deviceId: string
    catalogSnapshotId: string
    scope: 'single' | 'selected' | 'missing' | 'library'
    gameIds?: string[]
    types: ArtAssetRecord['type'][]
    replacePolicy: 'missing-only' | 'replace-invalid' | 'replace-all'
  }): Promise<ArtSyncPlanSummary>
  startArtSync(input: {
    planId: string
    expectedRevision: number
    confirmation?: 'SUBSTITUIR ARTES EXISTENTES'
  }): Promise<ArtSyncJob>
  getArtSyncJob(jobId: string): Promise<ArtSyncJob | undefined>
  listArtSyncJobs(input?: {
    deviceId?: string
    states?: ArtSyncJob['state'][]
    cursor?: string
    limit?: number
  }): Promise<Page<ArtSyncJob>>
  pauseArtSync(input: RevisionedJobRef): Promise<ArtSyncJob>
  resumeArtSync(input: RevisionedJobRef): Promise<ArtSyncJob>
  cancelArtSync(input: RevisionedJobRef): Promise<ArtSyncJob>
  retryFailedArtSync(input: RevisionedJobRef): Promise<ArtSyncJob>
  onOplPipelineEvent(callback: (event: PipelineEvent) => void): () => void
  auditOplNaming(input: { deviceId: string; profileId: string }): Promise<NamingAudit>
  createOplNamingPlan(input: {
    auditId: string
    expectedRevision: number
    itemIds?: string[]
  }): Promise<NamingPlan>
  confirmOplNaming(input: {
    planId: string
    expectedRevision: number
    confirmation: 'ADEQUAR NOMES OPL'
  }): Promise<NamingOperationResult>
  getOplNamingOperation(operationId: string): Promise<NamingOperationResult | undefined>
  listFragmentationGames(devicePath: string): Promise<FragmentationInventory>
  diagnoseFragmentation(input: FragmentationDiagnoseInput): Promise<FragmentationDiagnostic>
  getCurrentFragmentationDiagnosis(
    devicePath: string
  ): Promise<FragmentationDiagnosisActivity | undefined>
  cancelFragmentationDiagnosis(operationId: string): Promise<void>
  planFragmentationRepair(input: FragmentationRepairPlanInput): Promise<RepairPlan>
  confirmFragmentationRepair(input: FragmentationRepairConfirmation): Promise<RepairOperation>
  cancelFragmentationRepair(operationId: string): Promise<void>
  getFragmentationRepairOperation(operationId: string): Promise<RepairOperation | undefined>
  getFragmentationRepairReport(reportId: string): Promise<RepairReport | undefined>
  getFragmentationRepairReportByOperation(operationId: string): Promise<RepairReport | undefined>
  listFragmentationRecovery(deviceId?: string): Promise<RecoveryItem[]>
  resolveFragmentationRecovery(input: ResolveRecoveryInput): Promise<RecoveryItem>
  onFragmentationRepairEvent(callback: (event: RepairEvent) => void): () => void
  listOplProfiles(): Promise<OplProfile[]>
  getOplProfile(id: string): Promise<OplProfile | undefined>
  registerOfficialOpl(input: OplProfileRegistration): Promise<OplProfile>
  planOplUpdate(
    input: OplUpdatePlanInput
  ): Promise<{ id: string; profileId: string; memoryCardPath: string; createdAt: string }>
  confirmOplUpdate(input: OplUpdateConfirmation): Promise<{ backupPath: string }>
  planInstallation(input: InstallationPlanInput): Promise<InstallationPlan>
  confirmInstallation(input: OperationConfirmation): Promise<InstallationResult>
  cancelInstallation(operationId: string): Promise<void>
  scanCatalog(input: CatalogScanInput): Promise<CatalogSnapshot>
  cancelCatalogScan(operationId: string): Promise<void>
  getCatalogSnapshot(deviceId: string): Promise<CatalogSnapshot | undefined>
  setCatalogGameId(input: CatalogOverrideInput): Promise<void>
  hashCatalogFile(input: CatalogHashInput): Promise<string>
  runDiagnostics(input: {
    devicePath: string
    oplProfileId?: string
    fileSystem?: string
  }): Promise<DeviceDiagnostic>
  indexArt(): Promise<ArtAsset[]>
  planArtSync(input: { deviceId: string; snapshotId: string }): Promise<ArtSyncPlan>
  confirmArtSync(operationId: string): Promise<ArtSyncEntryResult[]>
  detectPcsx2(executablePath: string): Promise<Pcsx2Profile>
  planValidation(input: ValidationPlanInput): Promise<{
    id: string
    pcsx2: Pcsx2Profile
    bios: BiosIdentity
    bootMode: 'memory-card' | 'elf-fallback'
  }>
  startValidation(operationId: string): Promise<ValidationRun>
  confirmValidationCheckpoint(input: {
    operationId: string
    stage: number
    result: ValidationCheckpointResult
    reason?: string
    screenshotPath?: string
  }): Promise<ValidationCheckpoint>
  stopValidation(runId: string): Promise<ValidationRun>
  planReorganization(input: {
    deviceId: string
    devicePath: string
    backupPath: string
  }): Promise<ReorganizationPlan>
  confirmReorganization(input: OperationConfirmation): Promise<ReorganizationResult>
  cancelReorganization(operationId: string): Promise<void>
  generateReadinessReport(input: {
    deviceId: string
    snapshotId: string
    profileId: string
    validationRunId?: string
  }): Promise<ReadinessReport>
  getReadinessReport(reportId: string): Promise<ReadinessReport | undefined>
  recordHardwareSmoke(input: {
    reportId: string
    expectedRevision: number
    consoleModel: string
    adapter: string
    oplVersion: string
    detected: boolean
    artDisplayed: boolean
    noFragmentationError: boolean
    milestoneReached: boolean
  }): Promise<ReadinessReport>
  exportReadinessReport(reportId: string, destinationPath: string): Promise<void>
  getNetworkShareConfig(): Promise<NetworkShareConfig>
  saveNetworkShareConfig(input: SaveNetworkShareConfigInput): Promise<NetworkShareConfig>
  acknowledgeNetworkShareWriteAccess(): Promise<NetworkShareConfig>
  startNetworkShare(): Promise<NetworkShareStatus>
  stopNetworkShare(): Promise<NetworkShareStatus>
  getNetworkShareStatus(): Promise<NetworkShareStatus>
  getNetworkShareSetupInstructions(protocol: NetworkShareProtocol): Promise<SetupInstructions>
  onNetworkShareEvent(callback: (event: NetworkShareEvent) => void): () => void
  listDevices(): Promise<DeviceInfo[]>
  getDeviceSummary(devicePath?: string): Promise<DeviceSummary>
  prepareDevice(input: PrepareDeviceInput): Promise<HistoryEntry>
  copyGame(input: GameImportInput): Promise<HistoryEntry[]>
  copyPs1Game(input: Ps1ImportInput): Promise<HistoryEntry[]>
  installApp(input: AppInstallInput): Promise<HistoryEntry>
  listInstalledApps(devicePath: string): Promise<InstalledApp[]>
  removeApp(devicePath: string, appName: string): Promise<HistoryEntry>
  deleteGame(devicePath: string, relativePath: string, gameId?: string): Promise<DeleteGameResult>
  listSourceFiles(config: SourceProviderConfig): Promise<SourceFile[]>
  importFromSource(input: ImportFromSourceInput): Promise<HistoryEntry>
  listManagedSources(): Promise<ManagedSourceConfig[]>
  saveManagedSource(config: ManagedSourceConfig): Promise<ManagedSourceConfig>
  removeManagedSource(id: string): Promise<void>
  searchRemoteSource(params: RemoteSearchParams): Promise<RemoteSearchResult[]>
  getRemoteItemDetails(id: string): Promise<RemoteItemDetails>
  listRemoteFiles(id: string): Promise<RemoteFile[]>
  getGoogleDriveStatus(): Promise<GoogleDriveStatus>
  saveGoogleDriveClientId(clientId: string): Promise<void>
  connectGoogleDrive(): Promise<void>
  disconnectGoogleDrive(): Promise<void>
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
  listCustomCatalog(query?: CatalogQuery): Promise<CatalogGame[]>
  addCustomCatalogEntry(input: CustomCatalogEntryInput): Promise<CatalogGame>
  removeCustomCatalogEntry(id: string): Promise<void>
  importCustomCatalogCsv(filePath: string): Promise<ImportCustomCatalogCsvResult>
  listTorrentFiles(taskId: string): Promise<TorrentFileEntry[]>
  selectTorrentFiles(taskId: string, fileNames: string[]): Promise<void>
  startTorrentDownload(taskId: string, destinationPath: string): Promise<void>
  detectGameId(filePathOrName: string): Promise<string | null>
  saveGameLibraryEntry(entry: GameLibraryEntry): Promise<GameLibraryEntry>
  getGameLibrary(): Promise<GameLibrary>
  openFolder(folderPath: string): Promise<void>
  openExternalUrl(url: string): Promise<void>
  getHistory(): Promise<HistoryEntry[]>
  clearHistory(): Promise<void>
  openPathDialog(options?: OpenPathDialogOptions): Promise<string[]>
  authorizeLocalFolder(selectedPath: string): Promise<LocalFolderAuthorization>
  createLocalFolder(input: {
    authorizationId: string
    rootToken: string
    folderName: string
  }): Promise<LocalFolderAuthorization>
  listActiveOperations(): Promise<OperationSummary[]>
  onLog(callback: (entry: LogEntry) => void): () => void
  onProgress(callback: (progress: OperationProgress) => void): () => void
  onOperationEvent(callback: (event: OperationEvent) => void): () => void
  onCatalogEvent(callback: (snapshot: CatalogSnapshot) => void): () => void
  onValidationEvent(
    callback: (event: {
      runId: string
      kind: 'started' | 'checkpoint' | 'stopped'
      checkpoint?: ValidationCheckpoint
      status?: ValidationRun['status']
    }) => void
  ): () => void
  onDownloadProgress(callback: (progress: DownloadProgress) => void): () => void
  onDownloadCompleted(callback: (progress: DownloadProgress) => void): () => void
  onDownloadFailed(callback: (progress: DownloadProgress) => void): () => void
}

export interface OpenPathDialogOptions {
  mode?: 'file' | 'folder' | 'multiFile'
  filters?: Array<{ name: string; extensions: string[] }>
  restrictSystemRoots?: boolean
  defaultPath?: string
  withinRoot?: string
}

declare global {
  interface Window {
    oplApi: OplApi
  }
}
export * from './opl-finalization'
