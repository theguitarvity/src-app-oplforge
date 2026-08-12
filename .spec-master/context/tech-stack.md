# Tech Stack

## Architecture Overview

Monorepo com app desktop Electron (`electron/` main process + `src/`
renderer React) e app mobile Android (`mobile/`, React Native/Expo, com
projeto Android nativo gerado via `expo prebuild` em `mobile/android/` e
módulos nativos em `mobile/src/native/`). Ambos usam zustand para estado
local e falam com o "device"/biblioteca via camadas próprias (IPC no
desktop, native modules no mobile).

## Languages

- TypeScript (desktop `src/`, `electron/`, mobile `mobile/src/`).
- Kotlin/Java nativo no projeto Android gerado (`mobile/android/`), para os
  módulos nativos referenciados em `mobile/src/native/`.

## Frameworks

- Desktop: React + Vite + Tailwind CSS + Radix UI + React Router +
  TanStack Query + react-hook-form.
- Mobile: React Native 0.86.2 + Expo ~57 + React Navigation
  (bottom-tabs + native-stack).
- Ambos: zustand para state management.

## Runtime

- Desktop: Electron (main + preload + renderer, contextIsolation/sandbox
  conforme constituição).
- Mobile: Android via Expo/React Native runtime + módulos nativos.

## Infrastructure

- Distribuição desktop: `electron-builder` publicando via GitHub Releases
  (`electron-builder.yml`, provider: github).
- Distribuição Android: não definida no repo hoje (sem config de Play
  Store nem de update endpoint próprio) — a decidir na Feature 2.

## Components

### Desktop — Settings & Updates

Responsibilities:

- `src/pages/SettingsPage.tsx` — tabs Geral/Fontes/Rede; hoje contém
  `UpdateDialog` (componente de update) dentro da aba Geral.
- `electron/services/updates/update.service.ts` — usa `electron-updater`
  (`autoUpdater`), expõe `checkForUpdates`/`downloadUpdate`/
  `quitAndInstall` via IPC (`electron/preload.ts`).

Affected areas: Feature 1 (nova opção de idioma na mesma aba Geral),
Feature 2 (referência de padrão de UI para paridade no Android, sem
reimplementar o backend de update do desktop).

### Mobile — Navigation & Settings

Responsibilities:

- `mobile/src/navigation/RootNavigator.tsx` — define tabs incluindo
  "Settings", hoje apontando (placeholder) para `LibrarySelectScreen`.
- Não existe hoje uma tela de Configurações real no mobile.

Affected areas: Feature 1 (precisa de tela de Configurações própria para
alojar seletor de idioma), Feature 2 (idem, para ação de update).

### Mobile — Library loading & bootstrap

Responsibilities:

- `mobile/src/stores/library-store.ts` (zustand) — `useLibraryStore`,
  chama `LibraryModule.selectLibrary()`/`revalidateAccess()`, estados
  `idle|loading|ready|error`.
- `mobile/src/app/bootstrap.ts` — `runBootstrap()`, roda steps
  sequenciais incluindo `useLibraryStore.getState().revalidate()`.
- `mobile/src/app/App.tsx` — `SplashScreen.preventAutoHideAsync()` +
  `SplashOverlay` custom, com `MIN_SPLASH_MS` fixo, sem indicador de
  progresso real.

Affected areas: Feature 3 (popup de troca de biblioteca plugaria no fluxo
de `revalidate()`/bootstrap; indicador de loading na splash substituiria/
complementaria o `SplashOverlay` atual).

### Desktop — Device store

Responsibilities:

- `src/stores/device-store.ts` (zustand) — `useDeviceStore`,
  `activeDevice`, `devices[]`, `selectionRevision`.
- `src/types/opl.ts` — `DeviceInfo` (`id`, `path`, `sourceKind`), sem
  campo de fingerprint/serial/MAC.

Affected areas: Feature 3, caso a detecção de troca de dispositivo também
se aplique ao desktop (a confirmar em `clarify` — pedido do usuário
menciona "trocar o dispositivo" e popup, foco aparente é mobile pela
menção a splash screen, mas não está explicitamente restrito).

## Integration Points

- IPC Electron (`electron/preload.ts`) — canal estreito via
  `contextBridge`, todo novo dado exposto (ex.: idioma, update) deve seguir
  esse padrão.
- Native modules Android (`mobile/src/native/`) — ponto de integração para
  qualquer leitura de identificador de dispositivo, se necessário para a
  Feature 3.

## Configuration

- Preferências do usuário no desktop: descritas em `SettingsPage.tsx` como
  "preparadas para persistência em JSON e futura migração para SQLite" —
  ainda não confirmado onde esse arquivo de fato vive; a implementação
  deve localizar/criar essa camada durante `plan`.
- Mobile: nenhuma camada de persistência de configurações identificada
  ainda — precisa ser criada (ex.: `expo-secure-store`/AsyncStorage,
  decisão técnica de `plan`).

## Technical Constraints

- Constituição (`.specify/memory/constitution.md`) Princípio II exige
  `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` no
  renderer, e que acesso a recursos privilegiados fique no processo
  principal — qualquer novo IPC (ex.: checar update) deve seguir esse
  padrão.
- Nenhuma biblioteca de i18n está presente no repo hoje — escolha da
  biblioteca (ex.: i18next/react-i18next para ambas as plataformas, ou
  soluções nativas por framework) é uma decisão técnica a ser tomada em
  `plan`, não antecipada aqui.

## Architectural Principles

- Seguir os 5 princípios da constituição do projeto (segurança em
  operações sensíveis, isolamento/menor privilégio, contratos tipados,
  integridade/rastreabilidade, evolução incremental verificada).

## Testing Strategy

### Unit

Cobrir lógica de seleção/fallback de idioma, lógica de detecção de troca
de dispositivo/biblioteca, e lógica de decisão de exibir popup de update.

### Component

Telas de Configurações (desktop e novo mobile) com seletor de idioma e
ação de update; componente de popup de carregamento de biblioteca;
`SplashOverlay` com indicador de progresso.

### Integration

Fluxo de bootstrap mobile (`bootstrap.ts` + `library-store.ts`) com
detecção de troca de dispositivo end-to-end; fluxo de troca de idioma
refletindo em múltiplas telas simultaneamente.

### E2E

Não determinado pelo contexto atual — a confirmar conforme
`gates detect` e convenções já usadas nas specs 004-009.

## Quality Gates

- build (`pnpm run build`)
- lint (`pnpm run lint`)
- tests (`pnpm run test`)

## Repository Conventions

- Specs numeradas em `specs/NNN-nome-feature/`, com `spec.md`, `plan.md`,
  `tasks.md`, `data-model.md`, `research.md`, `quickstart.md`,
  `checklists/`, `contracts/`.
- Workflow trunk-based (decisão desta sessão) — sem branch dedicada por
  feature.

## CI/CD

- CI presente no repositório (`ci_present: true` via discovery); comandos
  de build/lint/test detectados em `package.json`.

## Technical Non-goals

- Não redefinir o pipeline de release/distribuição do desktop
  (`electron-builder`/GitHub Releases) já existente.
- Não implementar update automático silencioso sem ação do usuário em
  Configurações (paridade com o padrão atual do desktop, que também expõe
  isso via UI, não é totalmente silencioso).

## Open Technical Questions

- Biblioteca de i18n a adotar para desktop (React) e mobile (React
  Native) — decisão de `plan`, não antecipada aqui.
- Onde efetivamente mora a persistência de preferências hoje (arquivo
  JSON referenciado em `SettingsPage.tsx` — caminho exato não confirmado)
  e como estender para incluir idioma.
- Mecanismo de update Android (Play Store In-App Updates vs. distribuição
  própria) — `UNRESOLVED`, herdado de `app-features.md`.
- Critério técnico de fingerprint de dispositivo/biblioteca para a
  Feature 3 — `UNRESOLVED`, herdado de `app-features.md`.

## Source Traceability

| Decision / Constraint                                      | Source                                                                 | Classification           |
| ---------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------ |
| Stack desktop: React+Vite+Tailwind+Radix+zustand           | Leitura de `package.json`/`src/`                                       | DISCOVERED_FROM_CODEBASE |
| Stack mobile: React Native+Expo+zustand                    | Leitura de `mobile/package.json`/`mobile/src/`                         | DISCOVERED_FROM_CODEBASE |
| Update desktop via electron-updater                        | `electron/services/updates/update.service.ts`                          | DISCOVERED_FROM_CODEBASE |
| Sem tela de Configurações real no mobile                   | `mobile/src/navigation/RootNavigator.tsx:91`                           | DISCOVERED_FROM_CODEBASE |
| Sem lib de i18n em nenhuma plataforma hoje                 | Busca no repo (nenhum resultado)                                       | DISCOVERED_FROM_CODEBASE |
| Sem fingerprint de dispositivo em nenhuma plataforma       | `src/types/opl.ts`, `src/stores/device-store.ts`, `mobile/src/native/` | DISCOVERED_FROM_CODEBASE |
| Constituição exige isolamento Electron e contratos tipados | `.specify/memory/constitution.md`                                      | DISCOVERED_FROM_CODEBASE |
| Biblioteca de i18n a escolher em `plan`                    | Não especificado pelo usuário                                          | UNRESOLVED               |
