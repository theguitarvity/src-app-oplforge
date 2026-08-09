# Interface Contracts: OPL Forge UX / Information Architecture Redesign

**Feature**: `004-ia-ux-redesign`  
**Date**: 2026-08-08  
**Status**: Complete

---

## 1. Primary Navigation & View Layout Contract

### `Sidebar` Props & Contract

```typescript
export interface NavigationItem {
  id: string
  label: string
  path: string
  iconName: string // Lucide icon identifier
  badgeCount?: number
}

// Global top-level sidebar items (Max 6)
export const PRIMARY_NAVIGATION: NavigationItem[] = [
  { id: 'home', label: 'Home', path: '/', iconName: 'Home' },
  { id: 'devices', label: 'Dispositivos', path: '/devices', iconName: 'HardDrive' },
  { id: 'library', label: 'Biblioteca', path: '/library', iconName: 'Library' },
  { id: 'catalog', label: 'Catálogo', path: '/catalog', iconName: 'Search' },
  { id: 'tools', label: 'Ferramentas', path: '/tools', iconName: 'Wrench' },
  { id: 'settings', label: 'Configurações', path: '/settings', iconName: 'Settings' }
]
```

---

## 2. Device Context & Workspace Contract

### Device Selection & Tab Contract

```typescript
export type DeviceWorkspaceTab = 'overview' | 'games' | 'files' | 'diagnostics'

export interface DeviceWorkspaceProps {
  deviceId: string
  activeTab: DeviceWorkspaceTab
  onTabChange: (tab: DeviceWorkspaceTab) => void
}
```

---

## 3. Game Detail & Contextual Action Contract

### Game Detail Drawer Contract

```typescript
export interface GameDetailActions {
  onValidateCrc: (item: LibraryItem) => Promise<void>
  onCheckDefrag: (item: LibraryItem) => Promise<void>
  onRenameOplStandard: (item: LibraryItem) => Promise<void>
  onLaunchPcsx2: (item: LibraryItem) => Promise<void>
  onManageArtwork: (item: LibraryItem) => void
  onDeleteGame: (item: LibraryItem) => Promise<void>
}

export interface GameDetailDrawerProps {
  item: LibraryItem | null
  isOpen: boolean
  onClose: () => void
  actions: GameDetailActions
}
```

---

## 4. Activity Drawer & Status Bar Contract

### Activity Progress Feedback Contract

```typescript
export interface ActivityStatusBarProps {
  activeTask: ActivityTask | null
  isDrawerOpen: boolean
  onToggleDrawer: () => void
}

export interface ActivityDrawerProps {
  isOpen: boolean
  onClose: () => void
  activeTask: ActivityTask | null
  logs: TaskLogLine[]
  onClearLogs: () => void
  onExportLogs: () => void
}
```
