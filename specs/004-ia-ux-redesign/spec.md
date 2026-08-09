# Feature Specification: OPL Forge UX & Information Architecture Redesign

**Feature Branch**: `004-ia-ux-redesign`  
**Created**: 2026-08-08  
**Status**: Draft  
**Input**: User request for Information Architecture and Interaction Flow Redesign of OPL Forge desktop application.

---

## Executive Summary & Vision

OPL Forge is evolving from a utility-centric layout (a collection of disconnected technical tools in a long sidebar) into an **Intent-Driven Desktop Workspace**.

The design system, dark aesthetic, color palette, clean typography, and desktop-first feel are strictly preserved. The Information Architecture is restructured around the core user mental model:

$$\text{DISPOSITIVO} \longrightarrow \text{BIBLIOTECA} \longrightarrow \text{JOGO} \longrightarrow \text{AÇÃO}$$

Instead of forcing users to understand internal OPL mechanics (fragmentation details, naming conventions, emulator paths) before deciding where to click, the system contextualizes tools directly within the device workspace, library view, or individual game detail cards.

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Device Context & Workspace Management (Priority: P1)

**As a** PS2 gamer or homebrew user,  
**I want to** connect a USB drive or external HDD and have the application immediately adapt its entire workspace to that active device,  
**So that** I can manage my games, inspect storage health, and run relevant operations in one centralized hub without searching through unrelated tools.

**Why this priority**: Device selection is the primary anchor of the entire application. Operating within an active device context unlocks 90% of user tasks (adding games, managing library, running health checks).

**Independent Test**: Can be tested independently by connecting/selecting a storage device and verifying that the workspace updates with device metrics, library items scoped to that drive, and contextual quick actions.

**Acceptance Scenarios**:

1. **Given** no device is connected or selected, **When** the user opens OPL Forge, **Then** the system displays an action-oriented Empty State cleanly highlighting the primary action ("Detect / Connect Device") alongside secondary options ("Prepare Device", "Open Local Library", "Explore Catalog").
2. **Given** a formatted OPL drive is connected, **When** the user selects the drive, **Then** the application transitions into the Device Workspace showing storage capacity (used/free), OPL readiness status, game count breakdown, and health summary.
3. **Given** a connected drive with issues (e.g., 2 fragmented games, 1 missing cover art), **When** viewing the Device Workspace Home, **Then** a prominent Health Warning banner details the exact issue count with a single-click "Run Diagnostics" CTA.

---

### User Story 2 — Unified Game Library & Item Contextual Tools (Priority: P1)

**As a** user managing a collection of PS2 games, PS1 titles, and homebrew applications,  
**I want** a unified, filterable library with clear visual status indicators and contextual action menus on every game,  
**So that** I can find games instantly, check their readiness, and execute actions (validate, rename, defrag, test in PCSX2) directly on the game itself.

**Why this priority**: Managing and browsing the library is the core day-to-day activity. Moving tools (PCSX2 validation, name fixes, fragmentation checks) from the primary navigation into the game detail context resolves the primary usability bottleneck.

**Independent Test**: Can be tested by navigating to the Library, switching between Grid and List view, filtering by type (PS2/PS1/Apps) or status (Ready/Needs Attention), opening a game detail panel, and executing contextual tools from within the panel.

**Acceptance Scenarios**:

1. **Given** a device library containing mixed content (PS2 ISOs, PS1 VCDs, APPS), **When** the user applies a filter (e.g., "PS2 Games only" or "Status: Needs Attention"), **Then** the view filters items instantaneously while maintaining active pagination/scroll state.
2. **Given** a game with an invalid OPL file name or missing cover art, **When** viewing the game card or list item, **Then** a visual badge ("Invalid Name" or "Missing Artwork") highlights the issue.
3. **Given** a specific game selected in the library, **When** the user opens the Game Detail view, **Then** all relevant operations for that specific game (Validate, Check Fragmentation, Rename to OPL Standard, Test in PCSX2, Manage Artwork) are presented in a contextual action panel rather than in global navigation.

---

### User Story 3 — Guided Device Preparation Wizard (Priority: P2)

**As a** novice or advanced user needing to set up a new hard drive or USB drive for Open PS2 Loader,  
**I want** a clear step-by-step preparation wizard with explicit warnings for destructive operations,  
**So that** I can format and structure my drive safely without fear of losing data or corrupting existing partitions.

**Why this priority**: Device preparation is a high-risk operation that must be guided and safe, protecting user data and complying with safety principles.

**Independent Test**: Can be tested by launching "Prepare Device" from the Device menu or Empty State, stepping through device selection, file system configuration (exFAT/FAT32), confirmation with safety locks, and progress visualization.

**Acceptance Scenarios**:

1. **Given** a user initiating device preparation, **When** selecting the target drive, **Then** the wizard explicitly displays the drive's exact volume label, drive letter/path, total capacity, and a mandatory confirmation checkbox before proceeding.
2. **Given** a preparation operation in progress, **When** formatting and creating OPL standard directory structures (`DVD`, `CD`, `PS1`, `APPS`, `ART`, `CFG`, `VMC`), **Then** the wizard shows real-time progress steps without blocking the app layout, with technical logs accessible via an expandable drawer.
3. **Given** an environment where destructive format protection is active (per Constitution Principle I), **When** attempting format without required environment override or explicit confirmation, **Then** the system blocks execution with an informative message.

---

### User Story 4 — Non-Intrusive Activity Drawer & Progress Feedback (Priority: P2)

**As a** power user performing batch operations (e.g., copying 10 ISOs or running library diagnostics),  
**I want** clean high-level progress indicators in a bottom status bar with an expandable Activity Drawer for technical logs,  
**So that** the interface remains clean during routine tasks while keeping detailed logs available on demand for troubleshooting.

**Why this priority**: Replacing the permanent, screen-consuming bottom log panel with a dynamic status bar + drawer reclaims 20-30% of vertical screen space while enhancing feedback for both novice and advanced users.

**Independent Test**: Can be tested by starting a file operation (e.g. copying a game or scanning a device), observing the compact status bar progress indicator, expanding the drawer to inspect raw log lines, and closing it when complete.

**Acceptance Scenarios**:

1. **Given** an background file copy or validation task, **When** the task is running, **Then** a non-intrusive status bar at the bottom displays progress percentage, current file name, copy speed, and an "Inspect Details" toggle button.
2. **Given** an active operation with errors or warnings, **When** the user clicks "Inspect Details", **Then** the Activity Drawer slides open smoothly showing technical output lines without destroying or altering the main view layout.
3. **Given** an error occurring during an operation, **When** presented to the user, **Then** a clear, human-readable message is shown (e.g., "Could not copy Shadow of the Colossus.iso") alongside a "View Technical Details" button rather than a raw unformatted stack trace.

---

### User Story 5 — Integrated OPL Components & Catalog Discovery (Priority: P3)

**As a** user setting up my OPL environment or missing artwork/game metadata,  
**I want** to browse game metadata/covers in a Catalog view and manage essential OPL components (formerly "Essentials") under a clear "Componentes OPL" interface,  
**So that** I don't need to know technical jargon before installing required runtimes or downloading missing artwork.

**Why this priority**: Resolves ambiguity around vague legacy menu items ("Essentials") and provides seamless integration for metadata lookup and component management.

**Independent Test**: Can be tested by navigating to "Componentes OPL" to check/install required files (e.g., OPL binaries, cheat databases, theme templates) and browsing the Catalog to auto-fill missing game media.

**Acceptance Scenarios**:

1. **Given** a user looking for missing artwork or Game IDs, **When** searching the Catalog, **Then** results display cover art, game region, game ID (e.g. SLUS-21259), and a direct "Apply to Library Game" action if a matching local ISO is found.
2. **Given** a user needing required OPL files, **When** accessing "Componentes OPL" (under Tools/Setup), **Then** clear plain-language descriptions (e.g., "OPL Latest Stable Build", "PCSX2 Compatibility Database", "Default Artwork Assets") explain each component before installation.

---

### Edge Cases

- **Device Unplugged Mid-Operation**: How does the workspace react if a connected USB drive is suddenly removed during a scan or copy? (System MUST catch disconnection, cancel pending tasks cleanly, update status bar to Warning state, and transition to Disconnected Empty State without crashing).
- **Dual Connected Devices**: What happens when 2 or more OPL drives are connected simultaneously? (Primary navigation header MUST include a clear Device Selector dropdown allowing instant context switching between Active Device A and Active Device B).
- **Corrupted / Non-OPL Partition**: How does system handle a drive formatted with unsupported partition table or missing OPL folder structure? (Device Workspace displays a "Non-OPL Structure Detected" diagnosis with a single CTA to "Initialize OPL Folders" non-destructively or "Format & Prepare").
- **Ultra-wide & Low-resolution Displays**: How does the updated IA scale from 1280x720 to 4K displays? (Sidebar items are capped at 6 top-level categories fitting vertically on 720p without scrolling; content pane uses responsive CSS grid for game library items).

---

## Requirements _(mandatory)_

### Functional Requirements

#### 1. Information Architecture & Navigation

- **FR-001**: System MUST consolidate primary top-level sidebar navigation into maximum 6 primary items:
  1. **Home** (Visão Geral / Dashboard)
  2. **Dispositivos** (Device Manager & Workspace)
  3. **Biblioteca** (Unified Library for PS2, PS1, and Apps)
  4. **Catálogo** (Metadata & Artwork Explorer)
  5. **Ferramentas** (Utilities, Diagnostics & Componentes OPL)
  6. **Configurações** (App Settings & PCSX2 Path Config)
- **FR-002**: System MUST render primary sidebar without vertical scrollbars on standard desktop resolutions (1280x720 and 1440x900).
- **FR-003**: System MUST provide a global Device Selector bar at the top of the workspace whenever one or more compatible storage devices are detected.
- **FR-004**: System MUST maintain dark theme visual identity: dark background (`#0B0B0E` / `#121218`), deep purple accent (`#7C3AED` / `#6D28D9`), subtle linear borders (`#1F1F2E`), clean sans-serif typography, and high contrast text.

#### 2. Device Workspace & Empty States

- **FR-005**: When no device is selected or connected, System MUST render an action-oriented Empty State with a primary "Detect Devices" CTA, secondary "Prepare New Device", "Open Local Library", and "Explore Catalog" links.
- **FR-006**: When a device is active, System MUST transform the application context into a Device Workspace containing storage gauges (Used / Free / Total capacity), OPL directory status, content count breakdown (PS2, PS1, Apps), and overall health state.
- **FR-007**: Device Workspace MUST provide structured sub-navigation tabs:
  - _Visão Geral_ (Overview & Quick Actions)
  - _Jogos_ (Device Scoped Library)
  - _Arquivos OPL_ (OPL Directory Structure & Management)
  - _Diagnóstico_ (Device Health & Defragmentation)

#### 3. Unified Game Library & Detail Panel

- **FR-008**: System MUST integrate PS2 ISOs, PS1 VCDs, and APPS into a unified Library view with type filtering tabs ("Todos", "PS2", "PS1", "Apps").
- **FR-009**: System MUST support toggleable Grid View (Cover Card display) and List View (tabular layout with columns for Cover, Name, Serial/Game ID, Region, Format, Size, Status).
- **FR-010**: System MUST display visual status badges on game cards/rows for:
  - `Ready` (Valid OPL name, zero fragment issues, valid format)
  - `Needs Attention` (Missing artwork or minor warning)
  - `Fragmented` (ISO file requires defragmentation for OPL compatibility)
  - `Invalid Name` (Filename does not conform to OPL standard format `GAME_ID.Title.iso`)
  - `Validation Warning` (Failed PCSX2 check or CRC mismatch)
- **FR-011**: System MUST provide a slide-over or dedicated Game Detail panel containing:
  - Game metadata (Serial ID, Region, Media Format, File Size, File Path, CRC Hash)
  - Artwork Manager (Cover front/back, Background, Icon preview & update)
  - Contextual Actions Bar:
    - _Validar ISO / CRC_
    - _Verificar Fragmentação_
    - _Renomear para Padrão OPL_
    - _Testar no PCSX2_
    - _Excluir / Exportar_
- **FR-012**: Legacy sidebar items "Fragmentação", "Nomes OPL", and "Validar no PCSX2" MUST be removed from global sidebar and rendered exclusively as contextual actions within Game Detail and Device Diagnostics.

#### 4. Device Preparation Wizard

- **FR-013**: System MUST implement device preparation as a step-by-step wizard launched from Device Manager or Dispositivos context:
  1. _Seleção do Dispositivo_ (Select Target Drive)
  2. _Verificação & Validação_ (Inspect existing partitions & filesystem)
  3. _Configuração de Formato_ (exFAT / FAT32 & OPL Folder Selection)
  4. _Confirmação de Segurança_ (Explicit confirmation with target details)
  5. _Execução & Progresso_ (Visual progress steps)
  6. _Conclusão_ (Success report & Next Steps)
- **FR-014**: Device Preparation MUST explicitly display volume label, drive letter/mount point, exact capacity, and require a confirmation action prior to executing destructive formatting or partition changes (Constitution Principle I).

#### 5. Diagnostics & Health Check

- **FR-015**: System MUST replace standalone "Fragmentação" menu with a comprehensive "Diagnóstico do Dispositivo" tool accessible from Device Workspace and Tools.
- **FR-016**: Health Check MUST audit:
  - OPL Folder Structure integrity (`DVD`, `CD`, `PS1`, `APPS`, `ART`, `CFG`, `VMC`)
  - Filesystem format compatibility (exFAT / FAT32)
  - Game filename compliance
  - File fragmentation status
  - Missing artwork & CFG metadata
- **FR-017**: Diagnostics view MUST display issue summaries with single-click "Corrigir Problemas" (Fix All) or granular individual fix buttons.

#### 6. Activity & Log Drawer

- **FR-018**: System MUST replace the permanent fixed-height bottom log panel with a dynamic Status Bar + Expandable Activity Drawer.
- **FR-019**: When background operations (copying ISO, scanning drive, downloading metadata, running defrag) are running, Status Bar MUST show:
  - Operation title & file name
  - Progress percentage bar & ratio (e.g. `3.8 / 4.3 GB - 83%`)
  - Estimated time remaining & speed (MB/s)
  - Toggle button: "Mostrar Detalhes"
- **FR-020**: Clicking "Mostrar Detalhes" MUST expand the Activity Drawer displaying timestamped log messages with filter levels (Info, Warning, Error) and copy/export log capabilities.

#### 7. Componentes OPL (formerly "Essentials") & Catalog

- **FR-021**: Legacy "Essentials" sidebar item MUST be renamed to "Componentes OPL" and relocated under Ferramentas / Configuration.
- **FR-022**: Componentes OPL MUST present a categorized list of required binaries, themes, compatibility DBs, and runtimes with clear descriptions of their purpose, version, and installation status.
- **FR-023**: System MUST provide a Catalog section for searching online/offline PS2 database metadata, cover art downloading, and Game ID cross-referencing.

---

### Key Entities _(include if feature involves data)_

- **StorageDevice**: Represents a physical or logical USB/HDD drive. Attributes: `id`, `label`, `mountPath`, `totalBytes`, `freeBytes`, `fileSystem` (exFAT/FAT32/NTFS/other), `isOplFormatted`, `healthStatus`.
- **LibraryItem**: Represents a game or application stored on a device or local library. Attributes: `id`, `title`, `gameId` (e.g., SLUS-21259), `type` (PS2_DVD, PS2_CD, PS1_VCD, APP), `filePath`, `sizeBytes`, `region` (NTSC-U, PAL, NTSC-J), `status` (Ready, Fragmented, InvalidName, MissingArt, Warning), `fragmentCount`, `coverUrl`, `bgUrl`.
- **DiagnosticReport**: Summary of device audit results. Attributes: `deviceId`, `timestamp`, `structureValid`, `filesystemValid`, `validGamesCount`, `fragmentedGamesCount`, `invalidNamesCount`, `missingArtworkCount`, `issuesList`.
- **ActivityTask**: Active background operation. Attributes: `id`, `title`, `currentStep`, `progressPercent`, `bytesTransferred`, `totalBytes`, `speedBs`, `status` (pending, running, completed, warning, failed, cancelled), `logs`.

---

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Primary navigation items reduced from 12+ legacy items down to **6 clean top-level categories**, eliminating vertical sidebar scrolling on resolutions 1280x720 and above.
- **SC-002**: Time required for a user to perform a game-specific operation (e.g., launch PCSX2 test or check ISO fragmentation) reduced by at least 50%, as actions are accessible directly from the game detail panel in 1 click instead of navigating away to a separate sidebar tool.
- **SC-003**: 100% of destructive operations (device formatting, partition write, file deletion) enforce clear explicit target display and double confirmation before proceeding, achieving 0 accidental formats.
- **SC-004**: Vertical screen space usable for game browsing increased by ~25% through the replacement of the permanent log footer with the dynamic Status Bar & Activity Drawer.
- **SC-005**: 10 distinct UX views specified, designed, and implemented adhering consistently to the OPL Forge dark design system tokens.

---

## Assumptions

- **Design System Tokens**: Existing color CSS variables (`--bg-primary`, `--bg-surface`, `--accent-purple`, etc.) will be retained and mapped directly to the new IA component layouts.
- **IPC API Stability**: Main process IPC handlers for device detection, file operations, defrag checks, and PCSX2 launching remain functional; frontend IPC wrappers will be re-wired to contextual components instead of standalone sidebar screens.
- **Desktop Focus**: The application remains strictly a desktop tool targeting Windows, macOS, and Linux, with layout optimized for mouse & keyboard interaction on screens ranging from 1280x720 to 4K.
- **Backward Compatibility**: Existing device OPL folder structures (`DVD`, `CD`, `ART`, `CFG`, `APPS`) remain fully supported without requiring re-formatting for existing drives.

---

## Required View Specifications (10 Key Views)

The redesigned UX is specified across 10 core views sharing the same design system:

1. **Home — Disconnected State**: Action-oriented Empty state with clear recommended CTAs (Detect Device, Prepare Device, Open Library, Explore Catalog).
2. **Home — Connected State**: Device workspace dashboard showing drive health gauge, space usage, game count summary, health alerts, and quick actions.
3. **Device Workspace**: Multi-tab hub for active device (Visão Geral, Jogos, Arquivos OPL, Diagnóstico).
4. **Game Library (Grid & List)**: Unified filterable view for PS2/PS1/Apps with status badges (Ready, Fragmented, Invalid Name, etc.).
5. **Game Detail Panel**: Contextual slide-over drawer with media metadata, artwork preview, and inline game tools (Validate, Defrag, Rename, Test in PCSX2).
6. **Add Game Flow**: Modal/wizard for importing ISOs/VCDs with automatic Game ID extraction, naming format check, and copy staging.
7. **Device Preparation Wizard**: Guided 5-step wizard for formatting/initializing drives safely.
8. **Diagnostics / Health Check**: Device-wide audit summary showing structure validity, fragment warnings, and one-click fix buttons.
9. **Activity & Log Drawer**: Dynamic bottom status bar with progress percentage + expandable drawer for technical logs.
10. **Catalog & Metadata Explorer**: Online/offline lookup for game IDs, covers, backgrounds, and region info.
