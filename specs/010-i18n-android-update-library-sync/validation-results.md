# Validation Results

Date: 2026-08-12

## What was implemented and verified this session

**i18n infrastructure (desktop + mobile)** — `i18next`/`react-i18next` wired
on both platforms, 7 language catalogs (`pt-BR`, `en`, `es`, `de`, `ru`,
`zh`, `ja`) covering the Settings screens, navigation labels, first-launch
language step, splash disclaimer, and library-changed popup. Verified live
in the browser preview:

- First-launch language modal appears on a clean install, pre-selects the
  browser's locale (English), lists all 7 languages.
- Selecting Spanish updates the sidebar nav and the full Settings page
  instantly, no reload.
- Reloading the page keeps Spanish active and does not re-show the
  first-launch modal (persistence confirmed).

**Desktop**: `src/i18n/`, `src/stores/settings-store.ts` (zustand +
`persist` to `localStorage`), `src/components/setup/LanguageStep.tsx`
(global modal gate in `AppShell.tsx`), `SettingsPage.tsx` fully migrated
with a language selector. `pnpm run build`, `pnpm run lint`, and
`pnpm run test:run` all pass (6 pre-existing, unrelated failures — see
below).

**Mobile**: `mobile/src/i18n/`, `mobile/src/stores/settings-store.ts`
(zustand + `persist` to `AsyncStorage`), `LanguageSelectScreen.tsx`
(first-launch route), `SettingsScreen.tsx` (replaces the
`LibrarySelectScreen` placeholder previously wired to the Settings tab),
Android update check (`services/update-check.ts`, GitHub Releases feed
under a `mobile-v*` tag convention, wired as a bootstrap step), library
source-change detection (`library-store.ts` extended to compare
`treeUri` via a fast pre-check before the slower revalidate call) with
`LibraryChangedOverlay.tsx`, and `SplashProgress.tsx` gating splash
visibility on real bootstrap completion. `tsc --noEmit` and `jest` (42/42
relevant tests) pass.

## Deviations from plan.md worth knowing

- **No first-launch wizard exists on desktop.** `plan.md` assumed one;
  the actual repo has none, so `LanguageStep` is implemented as a global
  modal gated on `languageSource !== 'user'`, mounted in `AppShell.tsx`.
- **Library identity field is `treeUri`, not `id`/`path`.** `data-model.md`
  used `id`/`path` as a stand-in for "whatever identifies the library
  source" — the real field returned by `LibraryModule` is `treeUri` (a SAF
  tree URI). Same comparison semantics, different field name.
- **Settings persistence uses `localStorage` (desktop) / `AsyncStorage`
  (mobile) via zustand's `persist` middleware**, not a hand-rolled JSON
  file — no such persistence layer existed yet on either platform despite
  `SettingsPage.tsx`'s aspirational copy about it; this was the simplest
  option that didn't require inventing new main-process/IPC surface
  (Constitution Principle II).
- **Android update mechanism uses a `mobile-v*` GitHub Releases tag
  convention** that doesn't exist yet in the repo's release history — the
  check will correctly report "no update" until releases start using that
  tag prefix, which is the safe behavior (not a false positive against
  desktop's unrelated version tags).

## Deferred (not completed this session)

- **Full-app string migration (T022a/T022b)**: only Settings, navigation,
  the first-launch step, splash, and the library-changed popup are
  translated. The other 19 desktop pages and 17 mobile screens still have
  hardcoded Portuguese strings. The i18n mechanism itself is fully working
  end-to-end and proven live — extending it to every remaining screen is
  large, mechanical, repetitive work (extract strings → add keys → 6
  translations × N screens) better suited to a dedicated follow-up pass
  than to be rushed at the end of this session.
- **Android/emulator-side manual verification** (quickstart scenarios 3-5:
  update check, device-swap popup, splash loading) — no Android
  device/emulator was available in this session; verified only via
  TypeScript + unit tests, which cover the underlying logic
  (`update-check.test.ts`, `library-store.test.ts`) but not the real
  on-device UX.
- **Component/integration tests** for `LanguageStep`, `LanguageSelectScreen`,
  `LibraryChangedOverlay`, and `SplashProgress` (T016/T017/T026/T037/T041)
  — unit-level coverage exists for the underlying store logic; UI-level
  interaction tests were not written.
- **Per-step bootstrap progress reporting** (T040) — `SplashProgress` shows
  a generic spinner for the whole bootstrap duration rather than per-step
  detail.

## Pre-existing issues confirmed unrelated to this feature

Verified via `git stash` (running the exact same commands against
unmodified `master`):

- 6 desktop test failures (`fragmentation-diagnosis`, `fragmentation-repair`,
  `finalization-safe-path`) — macOS `/private/var` symlink resolution and
  an FTP port-21 permission requirement, both environmental.
- `mobile/__tests__/src/screens/Library.test.tsx` — missing `expo-asset`
  peer dependency of `expo-font`, unrelated to any file touched here.
- `cd mobile && npx eslint .` fails repo-wide with a broken
  `@typescript-eslint` plugin resolution — a pre-existing mobile ESLint
  config issue, not something this feature introduced. `tsc --noEmit` and
  `jest` were used as the mobile quality gates instead.
