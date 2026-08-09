# Quickstart Validation Guide: OPL Forge UX / IA Redesign

**Feature**: `004-ia-ux-redesign`  
**Date**: 2026-08-08

---

## Overview

This guide provides runnable end-to-end manual and automated validation procedures to verify that the redesigned Information Architecture, Navigation, Device Workspace, Game Detail Panel, Activity Drawer, and Diagnostics operate correctly.

---

## Validation Environment Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Run unit & contract tests
pnpm test:run

# 3. Launch application in development mode
pnpm dev
# or for Electron dev mode:
pnpm electron:dev
```

---

## Scenario 1: Primary Navigation & Sidebar Constraints

**Objective**: Verify sidebar item count and zero-scroll constraint.

1. Launch application on a $1280 \times 720$ or $1440 \times 900$ viewport.
2. Confirm the sidebar contains exactly **6 primary items**:
   - `Home` (`/`)
   - `Dispositivos` (`/devices`)
   - `Biblioteca` (`/library`)
   - `Catálogo` (`/catalog`)
   - `Ferramentas` (`/tools`)
   - `Configurações` (`/settings`)
3. Inspect DOM elements: Verify no vertical scrollbar exists on the sidebar container (`overflow-y: hidden` or no scroll overflow).

---

## Scenario 2: Disconnected Empty State vs Active Device Workspace

**Objective**: Verify intent-driven Home behavior.

1. Open application without connecting any OPL USB drive.
2. Verify Home displays the **Action-Oriented Empty State**:
   - Primary CTA button: `Detectar Dispositivos`
   - Secondary actions: `Preparar Dispositivo`, `Abrir Biblioteca Local`, `Explorar Catálogo`
3. Connect or emulate an OPL drive and select it.
4. Verify Home transitions to **Device Workspace**:
   - Displays volume label, capacity gauge (Free / Total GB), health rating badge.
   - Displays Quick Actions bar (`Adicionar Jogos`, `Abrir Biblioteca`, `Verificar Dispositivo`).

---

## Scenario 3: Unified Library & Contextual Game Detail Drawer

**Objective**: Verify game status badges and inline contextual operations.

1. Navigate to `/library`.
2. Toggle between **Grid View** and **List View**.
3. Apply filter `Todos` $\rightarrow$ `PS2` $\rightarrow$ `PS1` $\rightarrow$ `Apps`.
4. Click on a game item with status `Needs Attention` or `Fragmented`.
5. Verify the **Game Detail Slide-Over Drawer** opens:
   - Displays media metadata (Serial, Region, Format, Size, Hash).
   - Displays contextual action buttons:
     - `Validar ISO`
     - `Verificar Fragmentação`
     - `Renomear para Padrão OPL`
     - `Testar no PCSX2`
6. Click `Validar ISO` or `Testar no PCSX2` and verify the action triggers directly from within the drawer.

---

## Scenario 4: Progress Status Bar & Activity Log Drawer

**Objective**: Verify non-intrusive bottom progress feedback.

1. Trigger a background file operation (e.g. copying an ISO or running device diagnostics).
2. Observe the bottom status bar (`height: 36px`):
   - Confirms progress percentage bar, current file, and transfer rate.
3. Click `Mostrar Detalhes`.
4. Verify the **Activity Drawer** slides open from the bottom showing streamed log output.
5. Click `Ocultar Detalhes` or close button to verify smooth collapse.

---

## Scenario 5: Guided Device Preparation Wizard

**Objective**: Verify safety checks and confirmation locks.

1. Navigate to `Dispositivos` $\rightarrow$ Click `Preparar Dispositivo`.
2. Step 1: Select target device.
3. Step 2: Inspection & Folder choice.
4. Step 3: Safety confirmation screen.
5. Verify target drive label and mount point are explicitly shown in bold red text.
6. Verify format button is disabled until user toggles explicit confirmation checkbox.
