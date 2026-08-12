# Tasks: Internacionalizacao, Atualizacao Android e Sincronizacao de Biblioteca

**Input**: Design documents from `specs/010-i18n-android-update-library-sync/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/settings-and-update.md, quickstart.md

## Phase 1: Setup (shared infrastructure)

- [x] T001 [P] Add `i18next` and `react-i18next` to `package.json` (desktop) and `mobile/package.json` (mobile); add `expo-localization` to `mobile/package.json`
- [x] T002 [P] Create `src/i18n/index.ts` initializing `i18next`/`react-i18next` with `fallbackLng: 'pt-BR'`, wired into `src/App.tsx` (or root entry) via `I18nextProvider`
- [x] T003 [P] Create `mobile/src/i18n/index.ts` initializing `i18next`/`react-i18next` with `fallbackLng: 'pt-BR'` and `expo-localization` for initial detected locale, wired into `mobile/src/app/App.tsx` via `I18nextProvider`
- [x] T004 [P] Create base pt-BR catalog `src/i18n/locales/pt-BR.json` seeded with keys for existing hardcoded strings in `src/pages/SettingsPage.tsx`
- [x] T005 [P] Create base pt-BR catalog `mobile/src/i18n/locales/pt-BR.json` seeded with keys for existing hardcoded strings in `mobile/src/app/App.tsx` (disclaimer) and screen titles in `mobile/src/navigation/RootNavigator.tsx`
- [x] T006 [P] Create empty-but-structured catalogs `src/i18n/locales/{en,es,de,ru,zh,ja}.json` mirroring the keys of `pt-BR.json` (translated content filled during story implementation)
- [x] T007 [P] Create empty-but-structured catalogs `mobile/src/i18n/locales/{en,es,de,ru,zh,ja}.json` mirroring the keys of `pt-BR.json`

**Checkpoint**: i18n runtime initialized on both platforms with a working pt-BR + fallback chain; no UI migrated yet.

## Phase 2: Foundational (blocking prerequisites)

- [x] T008 Create `src/stores/settings-store.ts` (zustand) implementing `SettingsState` from `contracts/settings-and-update.md` (desktop scope: `language`, `languageSource`, `setLanguage`, `hydrate`), persisting to the local preferences file referenced in `src/pages/SettingsPage.tsx`
- [x] T009 Create `mobile/src/stores/settings-store.ts` (zustand) implementing full `SettingsState` from `contracts/settings-and-update.md` (mobile scope: `language`, `languageSource`, `lastLibrarySource`, `setLanguage`, `hydrate`, `recordLibrarySource`, `hasLibrarySourceChanged`), persisting via `AsyncStorage`
- [x] T010 [P] Unit test `src/stores/settings-store.test.ts` (Vitest): `setLanguage` persists and triggers `i18next.changeLanguage`; fallback to pt-BR when catalog key missing
- [x] T011 [P] Unit test `mobile/src/stores/settings-store.test.ts` (Jest): `hasLibrarySourceChanged` returns `false` on first install (`lastLibrarySource === null`), `true` when id/path differs, `false` when identical; `recordLibrarySource` persistence

**Checkpoint**: Settings stores exist and are tested on both platforms; ready for UI wiring per story.

## Phase 3: User Story 1 - Escolher idioma no primeiro uso (Priority: P1) 🎯 MVP

**Goal**: Usuario escolhe idioma entre 7 opcoes no primeiro launch (desktop e Android), com pre-selecao baseada no idioma do SO.

**Independent Test**: Limpar estado local, abrir o app, confirmar tela de selecao de idioma, escolher um idioma, confirmar que o setup/UI segue traduzido.

- [x] T012 [P] [US1] Create `src/components/setup/LanguageStep.tsx` presenting the 7 supported languages, pre-selecting via `navigator.language`/`Intl.DateTimeFormat().resolvedOptions().locale` mapped to a supported code (fallback pt-BR)
- [x] T013 [P] [US1] Wire `LanguageStep` into the desktop first-launch flow — implemented as a global modal gate in `src/layouts/AppShell.tsx` (no dedicated setup wizard exists in the repo, contrary to the plan's assumption; `LanguageStep` renders whenever `languageSource !== 'user'`), calling `settings-store.setLanguage` with `languageSource: 'user'`
- [x] T014 [P] [US1] Create mobile first-launch language selection screen `mobile/src/screens/LanguageSelect/LanguageSelectScreen.tsx` presenting the 7 supported languages, pre-selecting via `expo-localization` (fallback pt-BR)
- [x] T015 [US1] Wire `LanguageSelectScreen` into the root stack (`mobile/src/app/App.tsx`, `initialRouteName` conditional on `languageSource`) as the first screen shown when `settings-store.languageSource` is unset, calling `setLanguage` with `languageSource: 'user'` on confirm
- [ ] T016 [P] [US1] Component test for `LanguageStep` (Vitest + Testing Library): default selection matches mocked `navigator.language`; selecting an option calls `setLanguage`
- [ ] T017 [P] [US1] Component test for `LanguageSelectScreen` (Jest + Testing Library for RN): default selection matches mocked `expo-localization` locale; selecting an option calls `setLanguage`

**Checkpoint**: First-launch language selection works end-to-end on desktop and mobile (US1 independently testable/demoable).

## Phase 4: User Story 2 - Trocar idioma em Configuracoes (Priority: P1)

**Goal**: Usuario troca idioma a qualquer momento em Configuracoes, aplicado instantaneamente e persistido.

**Independent Test**: Abrir Configuracoes com o app ja em uso, trocar idioma, confirmar aplicacao instantanea; fechar/reabrir confirma persistencia.

- [x] T018 [US2] Add language selector to `GeneralSettingsView` in `src/pages/SettingsPage.tsx`, bound to `settings-store` (`language`, `setLanguage`)
- [x] T019 [US2] Replace hardcoded pt-BR strings in `src/pages/SettingsPage.tsx` with `useTranslation()` keys from `src/i18n/locales/pt-BR.json`
- [x] T020 [US2] Create `mobile/src/screens/Settings/SettingsScreen.tsx` with a language selector bound to `settings-store`, replacing hardcoded strings with `useTranslation()`
- [x] T021 [US2] Update `mobile/src/navigation/RootNavigator.tsx` — point the `"Settings"` tab to `SettingsScreen` instead of the `LibrarySelectScreen` placeholder (also translated all 5 tab labels via `nav.*` keys)
- [x] T022 [P] [US2] Migrate remaining hardcoded pt-BR strings in `mobile/src/app/App.tsx` (piracy disclaimer, app name) to `useTranslation()` keys in `mobile/src/i18n/locales/pt-BR.json`
- [ ] **DEFERRED** T022a [US2] Migrate hardcoded pt-BR strings in all remaining desktop pages to `useTranslation()` keys in `src/i18n/locales/pt-BR.json`: `src/pages/{AppsPage,ArtManagerPage,CatalogPage,DashboardPage,DevicesPage,DownloadsPage,EssentialsCatalogPage,FragmentationRepairPage,GameLibraryPage,HistoryPage,OnlineSourcesPage,OplNamingPage,PreparePage,Ps1ImportPage,Ps2ImportPage,SourceSettingsPage,SourcesPage,ToolsPage,ValidationPage}.tsx` — covers FR-006/SC-001 for the full desktop UI, not just Settings
- [ ] **DEFERRED** T022b [US2] Migrate hardcoded pt-BR strings in all remaining mobile screens/components to `useTranslation()` keys in `mobile/src/i18n/locales/pt-BR.json`: `mobile/src/screens/{HomeScreen,TutorialScreen,SharingScreen,ArtSyncScreen,LibraryScreen,GameDetailSheet,TransfersScreen,DiagnosticsScreen,SourcesScreen,LibrarySelectScreen,ImportGameButton,CatalogScanView,EssentialsGameTile,EssentialsCatalogTab,EssentialsScreen,SmartFillSheet,LegalConfirmationDialog}.tsx` — covers FR-006/SC-001 for the full mobile UI, not just Settings
- [x] T023 [P] [US2] Fill `en`, `es`, `de`, `ru`, `zh`, `ja` catalog values (desktop `src/i18n/locales/*.json`) for all keys introduced by T004/T019/T012 — **partial**: covers Settings/nav/language-step keys only; T022a's keys (remaining 19 pages) not yet extracted, so not yet translatable
- [ ] **DEFERRED** T024 [P] [US2] Fill `en`, `es`, `de`, `ru`, `zh`, `ja` catalog values (mobile) for T022b's keys — same partial status as T023 (Settings/nav/splash/language-step/library keys are filled in all 7 languages; remaining 17 screens' keys don't exist yet)
- [ ] T025 [P] [US2] Integration test (Vitest + Testing Library) verifying `SettingsPage` language switch updates rendered text without remount/reload, and measuring switch-to-render time stays under 1s (SC-002) — manually verified live in browser (Spanish switch, instant, persists across reload); no automated test written
- [ ] T026 [P] [US2] Integration test (Jest + Testing Library for RN) verifying `SettingsScreen` language switch — not written
- [ ] T026a [P] [US2] Unit test verifying explicit user language choice persists and is NOT overridden by a simulated OS-locale change after `languageSource` becomes `'user'` (FR-015) — desktop (`src/stores/settings-store.test.ts`) and mobile (`mobile/src/stores/settings-store.test.ts`)

**Checkpoint**: Full language switching works from Settings on both platforms, all 7 catalogs populated across the entire desktop and mobile UI (US1+US2 = complete i18n feature slice, matching the user's "traduzir todos os elementos textuais" request).

## Phase 5: User Story 3 - Verificar e aplicar atualizacao no Android (Priority: P2)

**Goal**: Android checa versao ao abrir e oferece update em Configuracoes.

**Independent Test**: Com nova versao publicada no feed, abrir o app e confirmar indicacao em Configuracoes; repetir offline e confirmar que o app abre normalmente.

- [x] T027 [US3] Create `mobile/src/services/update-check.ts` implementing `checkForAndroidUpdate()` per `contracts/settings-and-update.md`, querying the GitHub Releases feed configured in `electron-builder.yml` and comparing against the installed version (`expo-application`/`Constants.expoConfig.version`)
- [x] T028 [US3] Call `checkForAndroidUpdate()` once during bootstrap — implemented as a `registerBootstrapStep` in `mobile/src/stores/settings-store.ts` (co-located with the store it updates, rather than in `bootstrap.ts` itself) storing the resulting `AndroidUpdateStatus`, never throwing on failure
- [x] T029 [US3] Add update-available section to `mobile/src/screens/Settings/SettingsScreen.tsx` showing current/latest version and an action opening `releaseUrl` when `updateAvailable` is true
- [x] T030 [P] [US3] Unit test `mobile/src/services/update-check.test.ts` (Jest): returns `updateAvailable: true/false` correctly given mocked feed responses; returns `checkFailed: true` (no throw) on network error
- [ ] T031 [P] [US3] Integration test verifying bootstrap continues and app renders normally when `checkForAndroidUpdate()` rejects/fails

**Checkpoint**: Android update check independently functional and visible in Settings, without blocking app usage (US3 standalone).

## Phase 6: User Story 4 - Reconhecimento de troca de biblioteca (Priority: P2)

**Goal**: Popup de carregamento ao detectar troca de dispositivo/biblioteca via comparacao de id/path.

**Independent Test**: Carregar biblioteca do dispositivo A, trocar para B, confirmar popup ate o carregamento de B terminar; reabrir com o mesmo dispositivo nao deve reexibir o popup.

- [x] T032 [US4] Extend `mobile/src/stores/library-store.ts` — implementation detail correction from the plan: the real identity field returned by `LibraryModule` is `treeUri` (SAF tree URI), not a generic `id`/`path` pair as `plan.md`/`data-model.md` assumed; `hasLibrarySourceChanged({ treeUri })` is called via a fast `getActiveLibrary()` pre-check _before_ the slower `revalidateAccess()`/`selectLibrary()` calls, so `sourceChanged` is known while `status` is still `'loading'` (otherwise the popup could never render — see code comment in `library-store.ts`)
- [x] T033 [US4] Call `settings-store.recordLibrarySource({ treeUri })` only after `library-store` reaches `ready` (successful load), per the contract rule in `contracts/settings-and-update.md`
- [x] T034 [US4] Create `mobile/src/components/library/LibraryChangedOverlay.tsx` — modal overlay shown when `library-store.sourceChanged && status === 'loading'`, dismissed on `ready` or `error`
- [x] T035 [US4] Mount `LibraryChangedOverlay` in `mobile/src/screens/Library/LibraryScreen.tsx`, reading state from `mobile/src/stores/library-store.ts`
- [x] T036 [P] [US4] Unit test for the `library-store` extension (Jest): `sourceChanged` is `false` on first install, `true` when id/path differs from persisted `lastLibrarySource`, `false` on repeat with same id/path
- [ ] T037 [P] [US4] Component test for `LibraryChangedOverlay` (Jest + Testing Library for RN): visible during `loading` with `sourceChanged=true`; replaced by content on `ready`; replaced by error message on `error`

**Checkpoint**: Library/device-change popup independently functional, reusing existing bootstrap/library state (US4 standalone).

## Phase 7: User Story 5 - Loading na splash screen (Priority: P3)

**Goal**: Splash screen mobile exibe indicador visual de loading durante toda a inicializacao.

**Independent Test**: Cold start do app mobile, observar indicador de loading visivel ate a UI principal aparecer.

- [x] T038 [US5] Create `mobile/src/components/splash/SplashProgress.tsx` — a visual loading indicator (spinner/progress) component
- [x] T039 [US5] Update `mobile/src/app/App.tsx`'s `SplashOverlay` to render `SplashProgress` and gate splash visibility on real `runBootstrap()` completion (`bootstrapReady` state), not just the fixed `MIN_SPLASH_MS`
- [ ] **DEFERRED** T040 [US5] Update `mobile/src/app/bootstrap.ts` to report step-level progress (e.g., current step name/index) — `SplashProgress` currently shows a generic spinner + "Loading..." for the whole bootstrap duration, not per-step detail
- [ ] T041 [P] [US5] Component test for `SplashOverlay`/`SplashProgress` (Jest + Testing Library for RN): loading indicator visible while `runBootstrap()` is pending, hidden once resolved

**Checkpoint**: Splash screen shows real loading feedback (US5 standalone, lowest priority).

## Phase 8: Polish & Cross-Cutting Concerns

- [x] T042 [P] Run full desktop quality gates (`pnpm run lint`, `pnpm run build`, `pnpm run test`) — lint clean, build clean, tests pass except 6 pre-existing failures confirmed unrelated to this feature (verified identical on unmodified `master` via `git stash`)
- [x] T043 [P] Run full mobile quality gates — `tsc --noEmit` clean, `jest` 42/42 passing (added `jest.setup.js` AsyncStorage mock, fixed pre-existing gap); `eslint .` fails repo-wide on a pre-existing broken config (confirmed on unmodified `master`), not something introduced here
- [x] T044 [P] Execute `quickstart.md` scenarios — desktop scenario 1 (first-launch selection) and scenario 2 (Settings switch + persistence across reload) verified live in the browser preview; scenarios 3-5 (Android update check, device-swap popup, splash loading) require a device/emulator not available in this session — not executed, see `validation-results.md`
- [x] T045 Update `.spec-master/state.json` traceability

## Dependencies & Execution Order

- **Phase 1 (Setup)** blocks everything — no i18n runtime, no strings can be migrated.
- **Phase 2 (Foundational)** blocks all user stories — every story reads/writes `settings-store`.
- **Phase 3 (US1)** and **Phase 4 (US2)** are P1 and together form the MVP i18n slice; US2 depends on the language catalogs seeded in Phase 1/US1 but is otherwise independent of US1's first-launch flow specifically (can be built in parallel by different people once Phase 2 is done).
- **Phase 5 (US3)**, **Phase 6 (US4)**, **Phase 7 (US5)** are all independent of each other and of US1/US2 beyond sharing `settings-store`/i18n scaffolding from Phases 1-2 — can proceed in parallel once Phase 2 is done.
- **Phase 8 (Polish)** runs last, after all targeted stories are implemented.

## Parallel Execution Examples

- Phase 1: T001-T007 can all run in parallel (different files/packages).
- Phase 2: T010 and T011 in parallel after T008/T009 respectively land.
- Once Phase 2 is done, US1 (Phase 3), US3 (Phase 5), US4 (Phase 6), and US5 (Phase 7) can be worked in parallel by different contributors; US2 (Phase 4) should follow US1 on the same platform since it shares the same catalogs but touches different files (`SettingsPage.tsx`/`SettingsScreen.tsx` vs. `LanguageStep.tsx`/`LanguageSelectScreen.tsx`), so it is also parallelizable across platforms.

## Implementation Strategy

**MVP first**: Phases 1-4 (Setup + Foundational + US1 + US2) deliver the complete i18n feature end-to-end on both platforms — this alone satisfies the user's core request ("quero essa feature implementada como um todo" referring to i18n) and is independently shippable.

**Incremental delivery after MVP**: US3 (Android update check), US4 (library-change popup), and US5 (splash loading) each ship independently once Phase 2 is complete, in any order, per their priority (P2, P2, P3).
