/**
 * Shared mobile DTOs — see specs/006-android-opl-network-library/data-model.md.
 * Naming-compatible with desktop's src/types/opl.ts concepts (e.g. GameMediaType)
 * without importing from it (no Electron coupling — plan.md Structure Decision).
 */

export interface SerializableError {
  code: string
  message: string
}

// ---- Library selection (FR-001–FR-005) ----

export type LibrarySourceKind = 'internal' | 'sd-card' | 'usb-otg' | 'unknown'

export interface LibrarySelection {
  treeUri: string
  displayName: string
  sourceKind: LibrarySourceKind
  accessGrantedAt: string
  accessValid: boolean
  lastValidatedAt: string
}

// ---- Catalog (FR-006–FR-010) ----

export type CatalogContentType = 'dvd' | 'cd' | 'ps1' | 'app'

export type NamingConformance = 'conforms' | 'needs-attention'

export interface CatalogEntry {
  id: string
  contentType: CatalogContentType
  gameId?: string
  title: string
  extension: string
  sizeBytes: number
  logicalPath: string
  hasArt: boolean
  namingConformance: NamingConformance
  structuralIssues: string[]
}

export type CatalogSnapshotState = 'running' | 'completed' | 'cancelled' | 'error'

export interface CatalogSnapshot {
  id: string
  state: CatalogSnapshotState
  startedAt: string
  completedAt?: string
  countsByType: Record<CatalogContentType, number>
  issueCount: number
  error?: SerializableError
}

export interface CatalogScanEvent {
  snapshot: CatalogSnapshot
  message: string
  timestamp: string
}

// ---- Sharing (FR-013–FR-024, FR-033, FR-034) ----

export type SharingSessionState =
  | 'off'
  | 'starting'
  | 'running-idle'
  | 'running-connected'
  | 'stopping'
  | 'error'

export interface SharingSession {
  state: SharingSessionState
  boundAddress?: string
  port?: number
  shareName: string
  hasCredentials: boolean
  writeAccessAcknowledgedAt?: string
  startedAt?: string
  error?: SerializableError
}

export interface ConnectedClient {
  id: string
  remoteAddress: string
  connectedAt: string
  activity: 'idle' | 'browsing' | 'transferring'
  lastActivityAt: string
}

export type SharingSessionEventKind =
  | 'state-changed'
  | 'client-connected'
  | 'client-disconnected'
  | 'client-activity-changed'
  | 'write-conflict'

export interface SharingSessionEvent {
  kind: SharingSessionEventKind
  session: SharingSession
  client?: ConnectedClient
  message: string
  timestamp: string
}

export interface ConnectionTutorialStep {
  field: string
  value: string
  order: number
}

// ---- History (FR-027) ----

export type LocalHistoryOperation =
  | 'library-selected'
  | 'catalog-scan-completed'
  | 'sharing-started'
  | 'sharing-stopped'
  | 'write-access-acknowledged'

export interface LocalHistoryEntry {
  id: string
  operation: LocalHistoryOperation
  result: 'success' | 'failure'
  message: string
  timestamp: string
}

// ---- Essentials catalog / transfer queue / diagnostics (spec 008) ----

export interface CatalogListing {
  id: string
  title: string
  fileName: string
  url: string
  sizeBytes?: number
  mediaType: 'ps2-dvd' | 'ps2-cd' | 'ps1'
  scoreTier: string
  accessible: boolean
  checkedAt: string
  boxArtUrl?: string
}

export interface SmartFillPlan {
  availableBytes: number
  selectedItems: CatalogListing[]
  estimatedTotalBytes: number
  remainingBytes: number
  warnings: string[]
}

export type TransferKind = 'download' | 'import'
export type TransferState = 'queued' | 'running' | 'paused' | 'failed' | 'completed'

export interface TransferItem {
  id: string
  kind: TransferKind
  destinationLogicalPath: string
  title: string
  expectedBytes?: number
  transferredBytes: number
  state: TransferState
  legalReceiptId?: string
  partFiles: string[]
  errorMessage?: string
  createdAt: string
  updatedAt: string
}

export interface TransferQueueEvent {
  item: TransferItem
  timestamp: string
}

export type ReadinessStatus = 'ready' | 'ready-with-warnings' | 'requires-reorganization' | 'incompatible'

export interface DiagnosticsReport {
  id: string
  missingFolders: string[]
  freeBytes?: number
  catalogSnapshotId: string
  readiness: ReadinessStatus
  checkedAt: string
}
