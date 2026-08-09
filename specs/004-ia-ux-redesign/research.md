# Research & Technical Decisions: OPL Forge UX / Information Architecture Redesign

**Feature**: `004-ia-ux-redesign`  
**Date**: 2026-08-08  
**Status**: Completed

---

## 1. Primary Navigation Restructuring & Routing Strategy

### Decision

Consolidate 12+ legacy sidebar menu items into **6 top-level primary routes** using `react-router-dom`:

| Legacy Sidebar Item | New IA Destination                          | Routing Path                       |
| :------------------ | :------------------------------------------ | :--------------------------------- |
| Dashboard           | Home                                        | `/`                                |
| Dispositivos        | Dispositivos                                | `/devices`                         |
| Preparar            | Dispositivos → Wizard Modal                 | `/devices?action=prepare`          |
| Jogos PS2           | Biblioteca (Filtro: PS2)                    | `/library?type=ps2`                |
| Biblioteca OPL      | Biblioteca (Todos)                          | `/library`                         |
| Fragmentação        | Ferramentas → Diagnóstico / Detalhe do Jogo | `/tools/diagnostics` ou Contextual |
| Nomes OPL           | Biblioteca → Detalhe do Jogo / Diagnóstico  | Contextual no Jogo                 |
| Validar no PCSX2    | Biblioteca → Detalhe do Jogo                | Contextual no Jogo                 |
| Jogos PS1           | Biblioteca (Filtro: PS1)                    | `/library?type=ps1`                |
| Apps                | Biblioteca (Filtro: Apps)                   | `/library?type=apps`               |
| Catálogo            | Catálogo                                    | `/catalog`                         |
| Essentials          | Ferramentas → Componentes OPL               | `/tools/components`                |

### Rationale

- Completely eliminates sidebar vertical scrollbars on resolutions $\ge 1280 \times 720$.
- Groups functionality by user intent (`Device → Library → Game → Action`).
- Keeps URL query parameters (`?type=ps2`, `?gameId=SLUS-21259`) fully shareable and deep-linkable.

### Alternatives Considered

- _Multi-level nested accordion sidebar_: Rejected because nested accordions increase click depth and visual clutter on desktop.
- _Top horizontal navbar_: Rejected to preserve OPL Forge's desktop sidebar identity and horizontal screen space for tabular game views.

---

## 2. Active Device Context State Management

### Decision

Evolve `src/stores/device-store.ts` using `zustand` to manage:

1. `activeDeviceId`: `string | null` (Currently selected storage device)
2. `connectedDevices`: `StorageDevice[]`
3. `activeDeviceMetrics`: Used/Free capacity, OPL folder status, health grade
4. `setActiveDevice(id: string)`: Updates active device workspace across all views.

### Rationale

- React components across `Home`, `Library`, `Diagnostics`, and `Header` require immediate re-renders when active device changes or is un-plugged.
- Zustand provides lightweight, zero-boilerplate global state with TypeScript type safety.

### Alternatives Considered

- _React Context API_: Rejected due to unnecessary re-render overhead across un-related component subtrees during frequent storage polling.

---

## 3. Activity Drawer & Progress Feedback Architecture

### Decision

Replace `LogPanel.tsx` (permanent fixed bottom bar) with a two-tier feedback system:

1. **Compact Bottom Status Bar**: Always visible during active background operations (`height: 36px`). Displays progress percentage bar, current item name, transfer speed, and an `Inspect Details` toggle button.
2. **Expandable Activity Drawer**: Slides open from the bottom over content when toggled or when an error occurs. Uses `log-store.ts` to consume streamed IPC log lines with log level filters (`INFO`, `WARN`, `ERROR`).

### Rationale

- Reclaims ~200px of permanent vertical space for main content views.
- Provides immediate visual feedback for non-technical users (percentage bar & human-readable status) while retaining deep technical log access for power users.

### Alternatives Considered

- _Modal Dialog for Logs_: Rejected because modal dialogs block user interaction with the rest of the application during long file operations.

---

## 4. Game Detail Contextual Actions Architecture

### Decision

Render Game Details in a responsive Slide-Over Drawer (`<GameDetailDrawer />`) triggered by selecting any game row or grid card in `LibraryPage`.
The drawer encapsulates:

- Game Metadata & Artwork Preview
- Direct Action Triggers:
  - `Validate CRC` $\rightarrow$ calls IPC validation service
  - `Check Defrag` $\rightarrow$ calls IPC defrag check
  - `Rename to OPL Standard` $\rightarrow$ applies filename fix
  - `Launch PCSX2` $\rightarrow$ invokes emulator test IPC

### Rationale

- Keeps user in the library context without switching pages.
- Directly satisfies requirement SC-002 (50% reduction in time to run game operations).

---

## 5. Summary of Tech Stack & Tools

- **UI Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS + Vanilla CSS Variables (Dark theme: `#0B0B0E`, `#121218`, Accent: `#7C3AED`)
- **Icons**: Lucide React
- **State**: Zustand (device, log, active task) + React Query (async library data & catalog queries)
- **Modals/Drawers**: Radix UI Dialog / Primitive Slot overlays
