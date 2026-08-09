# Data Model & State Schema: OPL Forge UX / Information Architecture Redesign

**Feature**: `004-ia-ux-redesign`  
**Date**: 2026-08-08  
**Status**: Complete

---

## 1. Core Entities

### StorageDevice

Represents a physical or logical storage volume attached to the host machine.

```typescript
export type FileSystemType = 'exFAT' | 'FAT32' | 'NTFS' | 'ext4' | 'apfs' | 'unknown'
export type DeviceHealthGrade = 'healthy' | 'warning' | 'critical' | 'unformatted'

export interface StorageDevice {
  id: string // Unique volume identifier or mount path
  label: string // Volume label (e.g. "MY_PS2_HDD")
  mountPath: string // File system path (e.g. "/media/user/PS2" or "E:")
  totalBytes: number // Total storage capacity in bytes
  freeBytes: number // Available storage capacity in bytes
  usedBytes: number // Used storage capacity in bytes
  fileSystem: FileSystemType // Partition file system format
  isOplFormatted: boolean // True if valid DVD/CD/ART/CFG folders exist
  healthGrade: DeviceHealthGrade // Overall health rating based on diagnostics
  itemCounts: {
    ps2Games: number
    ps1Games: number
    apps: number
    issuesCount: number
  }
}
```

---

### LibraryItem

Represents a game or application entry within a device or local library.

```typescript
export type ContentType = 'PS2_DVD' | 'PS2_CD' | 'PS1_VCD' | 'APP'
export type RegionType = 'NTSC-U' | 'PAL' | 'NTSC-J' | 'UNKNOWN'
export type ItemStatus =
  'ready' | 'needs_attention' | 'fragmented' | 'invalid_name' | 'validation_warning'

export interface LibraryItem {
  id: string // Unique identifier (e.g. "SLUS-21259")
  title: string // Display title (e.g. "Shadow of the Colossus")
  gameId: string // Official Game Serial ID (e.g. "SLUS_212.59")
  contentType: ContentType // Format classification
  region: RegionType // Game media region
  sizeBytes: number // Size on disk in bytes
  filePath: string // Absolute path to file or ISO
  status: ItemStatus // Visual readiness status badge
  isFragmented: boolean // True if ISO clusters are fragmented
  fragmentCount: number // Number of non-contiguous fragments
  isOplNameValid: boolean // True if filename conforms to GAME_ID.Title.iso
  hasCoverArt: boolean // True if COV artwork exists in ART/
  hasBackgroundArt: boolean // True if BG artwork exists in ART/
  crcHash?: string // Optional calculated CRC32 checksum
  pcsx2Compatible?: boolean // Optional verification flag from PCSX2 test
}
```

---

### DiagnosticReport & Issue

Represents audit findings for an active storage device.

```typescript
export type IssueSeverity = 'warning' | 'error' | 'info'
export type IssueCategory = 'structure' | 'filesystem' | 'fragmentation' | 'naming' | 'artwork'

export interface DiagnosticIssue {
  id: string
  category: IssueCategory
  severity: IssueSeverity
  title: string
  description: string
  targetPath?: string
  autoFixable: boolean
  fixActionType?: 'rename_opl' | 'defrag' | 'create_folders' | 'fetch_art'
}

export interface DiagnosticReport {
  deviceId: string
  timestamp: string
  isStructureValid: boolean
  isFilesystemCompatible: boolean
  totalGamesAudited: number
  healthyGamesCount: number
  issues: DiagnosticIssue[]
}
```

---

### ActivityTask & TaskLogLine

Represents background asynchronous operations and real-time log streaming.

```typescript
export type TaskStatus = 'idle' | 'running' | 'completed' | 'warning' | 'failed' | 'cancelled'

export interface TaskLogLine {
  id: string
  timestamp: string
  level: 'info' | 'warn' | 'error'
  message: string
  details?: string
}

export interface ActivityTask {
  id: string
  title: string // e.g. "Copiando Shadow of the Colossus.iso"
  currentStep: string // e.g. "Verificando fragmentação do destino..."
  progressPercent: number // 0 to 100
  bytesTransferred: number
  totalBytes: number
  speedBytesPerSec: number
  status: TaskStatus
  logs: TaskLogLine[]
}
```

---

### OplComponent (formerly Essentials)

Represents required system binaries, runtimes, theme assets, and databases.

```typescript
export type ComponentCategory = 'runtime' | 'database' | 'theme' | 'utility'

export interface OplComponent {
  id: string
  name: string // e.g. "OPL Latest Release (v1.2.0)"
  category: ComponentCategory
  description: string // Plain language explanation of purpose
  version: string
  isInstalled: boolean
  installedVersion?: string
  sizeBytes: number
  downloadUrl?: string
  legalNoticeRequired: boolean
}
```

---

## 2. Global State Schema (Zustand Stores)

### DeviceStore (`src/stores/device-store.ts`)

- `activeDeviceId: string | null`
- `devices: StorageDevice[]`
- `isScanning: boolean`
- `selectDevice(id: string): void`
- `refreshDevices(): Promise<void>`

### ActivityLogStore (`src/stores/log-store.ts`)

- `activeTask: ActivityTask | null`
- `isDrawerOpen: boolean`
- `logFilter: 'all' | 'info' | 'warn' | 'error'`
- `toggleDrawer(open?: boolean): void`
- `appendLog(line: TaskLogLine): void`
- `updateTaskProgress(progress: Partial<ActivityTask>): void`
