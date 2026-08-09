export type PipelinePhase =
  | 'queued'
  | 'probing'
  | 'transferring'
  | 'paused'
  | 'downloaded'
  | 'validating'
  | 'planning'
  | 'awaiting-confirmation'
  | 'installing'
  | 'promoting'
  | 'verifying'
  | 'cataloging'
  | 'queueing-art'
  | 'ready'
  | 'waiting-device'
  | 'failed'
  | 'cancelled'
  | 'recovery-pending'

export interface ReleaseIdentity {
  schemaVersion: number
  publicVersion: string
  internalVersion: string
  channel: 'stable' | 'prerelease'
  tag: string
  artifactVersion: string
}

export type UpdatePolicyMode =
  'check-automatic' | 'ask-before-download' | 'download-automatic' | 'manual-only'
export interface UpdatePolicy {
  revision: number
  mode: UpdatePolicyMode
  channel: 'stable'
  updatedAt: string
}
export type UpdateState =
  | 'IDLE'
  | 'CHECKING'
  | 'UPDATE_AVAILABLE'
  | 'NO_UPDATE'
  | 'DOWNLOADING'
  | 'READY_TO_INSTALL'
  | 'INSTALLING'
  | 'ERROR'
export interface UpdateSession {
  sessionId: string
  revision: number
  state: UpdateState
  currentPublicVersion: string
  currentInternalVersion: string
  candidatePublicVersion?: string
  candidateInternalVersion?: string
  releaseName?: string
  releaseNotes?: string
  sizeBytes?: number
  downloadedBytes?: number
  progress?: number
  lastError?: SerializableTaskError
  installBlockedByOperations: string[]
  updatedAt: string
}

export type DownloadTarget =
  | { kind: 'opl-device'; deviceId: string; profileId: string; mediaHint?: 'CD' | 'DVD' }
  | {
      kind: 'local-folder'
      authorizationId: string
      rootToken: string
      collisionPolicy: 'fail' | 'rename'
    }

export type ImportItemPhase =
  | 'queued'
  | 'probing'
  | 'copying'
  | 'validating'
  | 'planning'
  | 'awaiting-confirmation'
  | 'installing'
  | 'promoting'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'recovery-pending'
export interface ImportItem {
  itemId: string
  displayName: string
  sourcePath?: string
  phase: ImportItemPhase
  bytesDone: number
  totalBytes?: number
  throughputBytesPerSecond?: number
  etaSeconds?: number
  canCancel: boolean
  error?: SerializableTaskError
}
export interface ImportJob {
  schemaVersion: number
  revision: number
  jobId: string
  devicePath?: string
  mediaType?: 'DVD' | 'CD'
  state:
    'queued' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled' | 'recovery-pending'
  items: ImportItem[]
  currentItemId?: string
  progress: number
  lastSequence: number
  createdAt: string
  updatedAt: string
}

export interface OperationSummary {
  operationId: string
  kind: 'import' | 'download' | 'update' | 'finalization' | 'art' | 'naming'
  revision: number
  state: string
  phase: string
  progress: number
  currentItem?: string
  counts?: { completed: number; failed: number; remaining: number; total: number }
  bytes?: { done: number; total?: number }
  canCancel: boolean
  recoveryActions?: string[]
  message: string
}

export type TransferKind = 'http' | 'torrent'
export type ResumeCapability = 'unknown' | 'supported' | 'unsupported' | 'invalidated'
export type FinalizationInstallFormat = 'ISO' | 'ZSO' | 'USBExtreme'
export type GameIdentitySource =
  'system-cnf' | 'ul-cfg' | 'user-override' | 'filename-hint' | 'catalog-hint'
export type FinalizationFragmentation = 'contiguous' | 'fragmented' | 'not-verified'
export type OplArtType = 'ICO' | 'COV' | 'COV2' | 'LAB' | 'LGO' | 'SCR' | 'SCR2' | 'BG'
export type ArtReplacePolicy = 'missing-only' | 'replace-invalid' | 'replace-all'
export type ArtSyncItemState =
  | 'pending'
  | 'downloading'
  | 'cached'
  | 'staged'
  | 'validated'
  | 'installed'
  | 'skipped'
  | 'failed'
  | 'cancelled'
export type ArtSyncJobState =
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'cancelled'
  | 'recovery-pending'

export interface SerializableTaskError {
  code: string
  message: string
  retryable: boolean
  action?: string
  phase?: PipelinePhase | string
}

export interface TransferSource {
  kind: TransferKind
  sourceRef: string
  originalFileName?: string
  expectedBytes?: number
  finalUrl?: string
  etag?: string
  lastModified?: string
  infoHash?: string
}

export interface TransferCheckpoint {
  cacheKey: string
  partialRelativePath: string
  bytesConfirmed: number
  totalBytes?: number
  resumeCapability: ResumeCapability
  sourceFingerprint?: string
  checkpointedAt: string
}

export interface SpaceReservation {
  reservationId: string
  taskId: string
  deviceId: string
  scope: 'local-cache' | 'device-staging' | 'final-destination'
  bytes: number
  state: 'held' | 'consumed' | 'released' | 'expired'
  observedFreeBytes: number
  expiresAt?: string
}

export interface DurableDownloadTask {
  schemaVersion: number
  revision: number
  taskId: string
  source: TransferSource
  legalReceiptId?: string
  target?: DownloadTarget
  targetDeviceId: string
  targetProfileId: string
  requestedTitle: string
  requestedMedia?: 'CD' | 'DVD'
  selectedFiles: string[]
  phase: PipelinePhase
  phaseProgress: number
  overallProgress: number
  transfer: TransferCheckpoint
  reservation?: SpaceReservation
  validatedImageId?: string
  finalizationPlanId?: string
  installationId?: string
  artJobId?: string
  lastError?: SerializableTaskError
  attempt: number
  nextRetryAt?: string
  lastSequence: number
  createdAt: string
  updatedAt: string
}

export type DurableDownloadTaskSummary = Omit<DurableDownloadTask, 'source'> & {
  source: Pick<TransferSource, 'kind' | 'originalFileName' | 'expectedBytes'>
}

export interface Page<T> {
  items: T[]
  nextCursor?: string
  revision: number
}

export interface IdentityEvidence {
  source: GameIdentitySource
  value: string
  authoritative: boolean
}

export interface IdentityConflict {
  expected: string
  actual: string
  source: GameIdentitySource
}

export interface FinalizationGameIdentity {
  gameId?: string
  authoritativeSource?: GameIdentitySource
  title: string
  titleBytes: number
  evidence: IdentityEvidence[]
  conflicts: IdentityConflict[]
}

export interface ValidatedGameImage {
  imageId: string
  taskId?: string
  cacheRelativePath: string
  sizeBytes: number
  sha256: string
  extension: 'iso' | 'zso'
  media: 'CD' | 'DVD'
  gameIdentity: FinalizationGameIdentity
  structure: 'valid' | 'invalid' | 'incomplete'
  inspectedAt: string
}

export interface UsbExtremeLayout {
  titleBytes: string
  crc32: string
  gameIdSuffix: string
  partSize: number
  partCount: number
  partNames: string[]
  mediaCode: number
  preservedUnknown: number[]
}

export interface DestinationCollision {
  relativePath: string
  existingSizeBytes: number
  existingSha256?: string
  identical: boolean
}

export interface FinalizationPlan {
  schemaVersion: number
  revision: number
  planId: string
  taskId: string
  imageId: string
  expectedTaskRevision: number
  deviceId: string
  fileSystem: string
  profileId: string
  format: FinalizationInstallFormat
  media: 'CD' | 'DVD'
  canonicalName?: string
  destinationRelativePaths: string[]
  usbExtreme?: UsbExtremeLayout
  requiredBytes: number
  collision?: DestinationCollision
  verificationCapability: string
  status: 'awaiting-confirmation' | 'confirmed' | 'stale' | 'consumed' | 'cancelled'
  warnings: string[]
  createdAt: string
  updatedAt: string
}

export interface PipelineEvent {
  operationId: string
  revision: number
  sequence: number
  kind: 'download' | 'finalization' | 'naming' | 'art'
  phase: string
  progress?: number
  currentItem?: string
  bytes?: { done: number; total?: number }
  message: string
  error?: SerializableTaskError
  timestamp: string
}

export interface EnqueueDownloadInput {
  source:
    | { kind: 'http'; url: string; expectedBytes?: number; originalFileName?: string }
    | { kind: 'torrent'; magnet?: string; torrentToken?: string; selectedFiles?: string[] }
  target?: DownloadTarget
  /** @deprecated compatibility input; persisted tasks are migrated to target */
  deviceId?: string
  /** @deprecated compatibility input; persisted tasks are migrated to target */
  profileId?: string
  title?: string
  mediaHint?: 'CD' | 'DVD'
  legalReceiptId?: string
}

export interface ListDownloadsInput {
  deviceId?: string
  phases?: PipelinePhase[]
  cursor?: string
  limit?: number
}

export interface RevisionedTaskRef {
  taskId: string
  expectedRevision: number
}
export interface RevisionedJobRef {
  jobId: string
  expectedRevision: number
}

export interface CancelDownloadInput extends RevisionedTaskRef {
  partialPolicy: 'keep-for-resume' | 'discard'
  confirmation?: 'DESCARTAR DOWNLOAD PARCIAL'
}

export interface ConfirmFinalizationInput {
  planId: string
  expectedRevision: number
  collisionResolution?: 'keep-existing' | 'replace-identical' | 'replace-authorized'
  confirmation: 'FINALIZAR BACKUP PARA OPL'
}

export interface SetFinalizationGameIdInput {
  planId: string
  expectedRevision: number
  gameId: string
  confirmation: 'USAR GAME ID INFORMADO'
}

export interface ArtAssetRecord {
  assetId: string
  gameId: string
  type: OplArtType
  sourceId: string
  directUrl?: string
  archiveId?: string
  entryName?: string
  archiveOffset?: number
  compressionMethod?: number
  compressedBytes?: number
  uncompressedBytes?: number
  crc32?: string
  sha256?: string
  sourceFormat: 'png' | 'jpeg'
}

export interface ArtSyncPlanSummary {
  planId: string
  revision: number
  deviceId: string
  gameCount: number
  itemCount: number
  replacePolicy: ArtReplacePolicy
  warnings: string[]
}

export interface ArtSyncItem {
  itemId: string
  gameId: string
  type: OplArtType
  assetId: string
  cacheKey: string
  state: ArtSyncItemState
  expectedBytes?: number
  receivedBytes?: number
  attempts: number
  nextRetryAt?: string
  error?: SerializableTaskError
}

export interface ArtSyncJob {
  schemaVersion: number
  revision: number
  jobId: string
  planId: string
  deviceId: string
  state: ArtSyncJobState
  items: ArtSyncItem[]
  counts: Partial<Record<ArtSyncItemState, number>>
  currentItemId?: string
  lastSequence: number
  createdAt: string
  updatedAt: string
}

export interface NamingAuditItem {
  itemId: string
  currentRelativePath: string
  canonicalRelativePath?: string
  identity: FinalizationGameIdentity
  classification: 'canonical' | 'correctable' | 'collision' | 'missing-id' | 'unsupported'
  findings: Array<{ code: string; message: string }>
}

export interface NamingAudit {
  auditId: string
  revision: number
  deviceId: string
  items: NamingAuditItem[]
  createdAt: string
}

export interface NamingPlan {
  planId: string
  revision: number
  auditId: string
  deviceId: string
  itemIds: string[]
  exclusions: Array<{ itemId: string; reason: string }>
  status: 'awaiting-confirmation' | 'confirmed' | 'stale' | 'consumed' | 'cancelled'
  createdAt: string
}

export interface NamingOperationResult {
  operationId: string
  items: Array<{ itemId: string; state: 'renamed' | 'failed'; error?: string }>
}
