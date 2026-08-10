# OPL Forge Mobile

Android companion app for OPL Forge (spec [006-android-opl-network-library](../specs/006-android-opl-network-library/)). Turns an Android phone/tablet into a portable OPL library, shareable to a PS2 over LAN via a purpose-built SMB1 server.

React Native 0.86 (New Architecture — JSI + Fabric + TurboModules) via the Expo prebuild workflow, not managed Expo Go. Kotlin TurboModules bridge the RN UI to Storage Access Framework, Room, Android Keystore, and a from-scratch SMB1/CIFS server.

## What shipped (verified on-device, not just unit-tested)

- **US1 — Select library**: SAF folder picker, persisted URI permission, launch-time access revalidation, "access lost" recovery flow.
- **US2 — Catalog scanning**: read-only scan of DVD/CD/PS1/App content, Game ID + naming-convention detection, structural issue flags, cancellable.
- **US3 — SMB sharing**: real SMB1 server (custom frame codec/command handlers), Foreground Service (`connectedDevice` type), credentials in `EncryptedSharedPreferences`, connect/disconnect tracking.
- **US4 — Guided PS2 setup tutorial**: step-by-step connection details (IP/port/share/user) pulled live from the active session.
- **US5 — Home status dashboard**: six at-a-glance states derived from library/catalog/sharing stores, no polling.
- **US6 — Library browsing**: bottom-tab shell (Home / Library / Sharing / Settings), paginated `getCatalogEntries()` Room query, type-filter chips, virtualized list, game detail sheet.

Build/test status as of this session:

- `./gradlew :app:assembleDebug` — real installable debug APK
- `./gradlew :app:testDebugUnitTest` — 10/10 JUnit tests (`FrameCodecTest`, `LocalNetworkGuardTest`, `WriteLockTest` — see recovery note below)
- `./gradlew :app:connectedDebugAndroidTest` — 3/3 instrumented tests (`SmbServerIntegrationTest`: real bind/accept, a real NEGOTIATE round-trip, clean shutdown)
- `npx tsc --noEmit` / `npx eslint src __tests__` — clean
- `npx jest` — 35/35 tests (8 suites)
- Manually exercised end-to-end on a Pixel 10 Pro emulator: select library → scan → filter/browse in the Library tab → open a detail sheet → start sharing (correct bound address/port shown) → tutorial → Settings tab.

**⚠️ Incident, recovery, and reduced test count**: `mobile/android/` was accidentally wiped by an `expo prebuild` run and had to be rewritten from scratch (see `specs/007-android-native-recovery/spec.md` for the full incident report). The native layer above is a faithful rewrite, re-verified live, but the JVM unit test suite was rebuilt smaller (10 tests vs. the original 53) and one instrumented test (`SafPersistedPermissionTest`) wasn't re-created — an explicit, known gap, not a silent one. `mobile/.gitignore` now git-tracks the hand-written Kotlin subtree specifically so this can't happen again.

## Known gaps / deferred

- **Hardware Smoke Test (SC-009)** — the spec requires validating against a _real_ PS2 + Open PS2 Loader, not just "another client can see the share." This has not been run: no physical PS2 was available in this environment. Whether OPL's ETH-mode SMB client accepts a non-standard port (1445, since 445 is privileged on Android — see `research.md` R5) is an open question that can only be answered on real hardware.
- **Accessibility pass** — the Library screen's filter chips meet a 44×44dp minimum touch target; most other screens' buttons (`paddingVertical: spacing.sm` = 8dp) likely fall short of that guideline and haven't been audited/fixed yet.
- **Performance validation (SC-002/003/007/008)** — not measured against a ~500-item reference library; only exercised with a handful of real files.
- **`quickstart.md` scenarios 1–10** — not run as a formal end-to-end checklist pass; individual user-story flows were verified ad hoc during implementation instead.
- A few Android manifest permissions (`SYSTEM_ALERT_WINDOW`, `VIBRATE`, `READ/WRITE_EXTERNAL_STORAGE` up to API 32) come from Expo's default prebuild template/autolinked modules, not from anything this feature requests — `app.json`'s own `android.permissions` list is the accurate minimal-permission source of truth (FR-029).

## Real bugs found via on-device testing (not caught by unit tests)

1. Android's `connectedDevice` foreground-service type needs `FOREGROUND_SERVICE_CONNECTED_DEVICE` _plus_ one of Bluetooth/NFC/Wifi-state/USB permissions — added `CHANGE_WIFI_STATE`.
2. Port 445 is privileged; Android throws `EACCES` binding it from an unprivileged app — defaulted to 1445 instead.
3. `POST_NOTIFICATIONS` needs a runtime request on Android 13+, not just a manifest entry.
4. A React key-collision bug in the tutorial step list, from reading `WritableArray.size()` mid-construction across the JNI bridge.
5. An instrumented test was writing to the same SharedPreferences file as the real app, wiping a real selected library as a side effect of running the test suite.

## Development

```bash
npm install
npx react-native start
```

Native changes require a full prebuild + install cycle (`npx expo prebuild --platform android`, then `./gradlew :app:assembleDebug` and `adb install -r`) — Gradle tasks touching native/CMake code need the build sandbox disabled to write compiler output.
