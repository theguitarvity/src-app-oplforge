# Implementation Plan: OPL Forge UX / Information Architecture Redesign

**Branch**: `004-ia-ux-redesign` | **Date**: 2026-08-08 | **Spec**: [spec.md](file:///home/mrlopito/desenv/personal/oplforge/specs/004-ia-ux-redesign/spec.md)

**Input**: Feature specification from `/specs/004-ia-ux-redesign/spec.md`

---

## Summary

The OPL Forge Information Architecture & UX Redesign transforms the desktop application from a technical tool list into an **Intent-Driven Workspace** centered around the user mental model `DISPOSITIVO → BIBLIOTECA → JOGO → AÇÃO`.

Primary navigation items are consolidated into **6 core routes** (`Home`, `Dispositivos`, `Biblioteca`, `Catálogo`, `Ferramentas`, `Configurações`). Contextual actions (PCSX2 validation, OPL name fixing, fragmentation repair) are relocated directly into game detail cards and device health diagnostics. The permanent bottom log panel is replaced by a dynamic Status Bar + Expandable Activity Drawer. The dark design system aesthetic, purple accent palette (`#7C3AED`), and desktop-first feel are strictly preserved.

---

## Technical Context

**Language/Version**: TypeScript 6.0 | Node.js 22 | React 19  
**Primary Dependencies**: Electron 42, Vite, React Router DOM, Zustand, React Query, Radix UI Primitives, Lucide React, Tailwind CSS  
**Storage**: Host Filesystem (OPL Directory Structure `DVD/`, `CD/`, `ART/`, `CFG/`, `APPS/`, `VMC/`) + JSON configuration  
**Testing**: Vitest + React Testing Library (Unit, Contract, Integration tests)  
**Target Platform**: Desktop (Windows x64/arm64, macOS Intel/Apple Silicon, Linux DEB/AppImage)  
**Project Type**: Desktop Application (Electron + React)  
**Performance Goals**: Instant route switching (<50ms), smooth 60fps library filtering & grid rendering, non-blocking background file operations  
**Constraints**: Zero vertical scrolling on sidebar for $1280 \times 720$ and $1440 \times 900$ viewports; strict Electron isolation (`contextIsolation: true`, `nodeIntegration: false`)  
**Scale/Scope**: 10 core views, 6 primary navigation destinations, unified library handling hundreds of PS2/PS1/App items

---

## Constitution Check

_GATE: All gates evaluated and PASSED against OPL Forge Constitution._

1. **Principle I: Segurança em Operações Sensíveis** $\rightarrow$ **PASS**: Device Preparation Wizard explicitly displays volume label, mount path, exact size, and requires double-confirmation checkbox before format execution.
2. **Principle II: Isolamento e Menor Privilégio** $\rightarrow$ **PASS**: Renderer accesses Node/OS functionality strictly through typed `contextBridge` IPC APIs (`window.oplApi`). No raw Node modules in React components.
3. **Principle III: Contratos Tipados e Limites de Camada** $\rightarrow$ **PASS**: Contracts defined in `data-model.md` and `contracts/ui-contracts.md`. State managed cleanly via Zustand stores.
4. **Principle IV: Integridade, Rastreabilidade e Recuperação** $\rightarrow$ **PASS**: Progress status bar + Activity Drawer provides streaming log feedback and clear human-readable status for all long-running tasks.
5. **Principle V: Evolução Incremental Verificada** $\rightarrow$ **PASS**: Modular component structure with unit/contract tests for sidebar navigation, library filtering, game drawer, and status bar.

---

## Project Structure

### Documentation (this feature)

```text
specs/004-ia-ux-redesign/
├── spec.md              # Feature specification
├── plan.md              # Implementation plan (this file)
├── research.md          # Phase 0 technical research & IA decisions
├── data-model.md        # Phase 1 entities & Zustand state schema
├── quickstart.md        # Phase 1 end-to-end validation scenarios
├── contracts/           # Phase 1 UI component & store contracts
│   └── ui-contracts.md  # React prop contracts & navigation definitions
└── checklists/
    └── requirements.md  # Spec quality validation checklist
```

### Source Code (repository root)

```text
src/
├── app/                 # Main App provider & Router setup
├── assets/              # Static branding icons & graphics
├── components/          # Reusable UI & Feature components
│   ├── activity/        # ActivityStatusBar.tsx & ActivityDrawer.tsx
│   ├── device/          # DeviceWorkspace.tsx, DeviceSelector.tsx, PrepWizard.tsx
│   ├── library/         # GameLibraryView.tsx, GameCard.tsx, GameDetailDrawer.tsx
│   ├── layout/          # Sidebar.tsx (Consolidated 6 items), AppShell.tsx
│   └── ui/              # Radix UI primitives (Dialog, Progress, Select, Badges)
├── layouts/             # Main Application Shell & Responsive Containers
├── pages/               # Top-level Page Views
│   ├── HomePage.tsx            # Dynamic Home (Disconnected Empty State vs Connected Workspace)
│   ├── DevicesPage.tsx         # Device Workspace & Prep Wizard
│   ├── LibraryPage.tsx         # Unified Library (PS2, PS1, Apps)
│   ├── CatalogPage.tsx         # Metadata & Cover Art Discovery
│   ├── ToolsPage.tsx           # Health Diagnostics & Componentes OPL
│   └── SettingsPage.tsx        # App Settings & PCSX2 Configuration
├── services/            # Typed IPC API Bridges (`api.ts`)
├── stores/              # Zustand Global Stores (`device-store.ts`, `log-store.ts`)
├── styles/              # Global CSS & Tailwind Theme configuration
├── types/               # TypeScript interfaces (`opl.ts`, `device.ts`, `library.ts`)
└── utils/               # Formatting, path normalization & validation helpers
```

**Structure Decision**: Single project layout matching existing Vite + Electron React architecture (`src/` for renderer UI, `electron/` for main process).

---

## Complexity Tracking

_No constitutional violations identified. No unjustified architectural complexity._
