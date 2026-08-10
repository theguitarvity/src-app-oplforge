# Feature Specification: Recuperação do Código Nativo Android (007)

**Feature Branch**: `007-android-native-recovery`

**Created**: 2026-08-09

**Status**: Recovered — see "Recovery Outcome" note below and `specs/006-android-opl-network-library/tasks.md` "Incident and recovery" section for verification detail.

## Recovery Outcome (post-hoc)

The native layer was rewritten and re-verified in the same session this spec was written. Build (`assembleDebug`), unit tests (10/10, a reduced re-scoped suite), instrumented tests (3/3, including a real SMB1 NEGOTIATE round-trip over a live socket), and a live on-device walkthrough (library select → catalog scan with identical fixture results → sharing start with correct address/port) all passed. One new real bug was found and fixed during re-verification: `startSharing()` resolved before the async Foreground Service actually bound its socket, briefly showing an empty address/port with no follow-up update — fixed with an `onServerBound` callback and a companion-field ordering fix. FR-008 (recurrence prevention) was satisfied by git-tracking the hand-written Kotlin subtree via `.gitignore` negation rules, so a future `expo prebuild` can't delete the only copy again. Known reduced scope vs. the original: the JVM unit suite is smaller (10 vs. 53 tests) and `SafPersistedPermissionTest` wasn't re-created — see `mobile/README.md`.

**Input**: User description: "Recuperação e reescrita do código nativo Android da feature 006 (Android OPL Network Library). Durante a implementação, um `expo prebuild` acidental apagou toda a pasta mobile/android (que é git-ignored e nunca foi commitada), destruindo todo o código Kotlin nativo escrito nas sessões anteriores — exceto MainActivity.kt e MainApplication.kt. O lado TypeScript/React Native, os testes Jest, os contratos de Codegen, tasks.md e research.md permanecem intactos e são a fonte da verdade para o que precisa ser reconstruído. Local History do Android Studio não tem nada recuperável — precisa ser reescrito do zero."

## Contexto do Incidente

Durante a sessão de implementação de `specs/006-android-opl-network-library`, ao tentar regenerar os recursos de ícone/splash screen do app (para aplicar a marca OPL Forge), foi executado `npx expo prebuild --platform android`. Esse comando limpa e recria a pasta `mobile/android/` inteira a partir do template do Expo. A pasta `mobile/android` está no `.gitignore` (padrão do fluxo Expo prebuild) e **nunca foi commitada**, então todo o código Kotlin nativo escrito à mão nas sessões anteriores foi apagado permanentemente, sobrando apenas `MainActivity.kt` e `MainApplication.kt` (os únicos arquivos gerados pelo próprio template).

Tentativa de recuperação via Local History do Android Studio confirmada sem sucesso: o projeto só foi aberto no Android Studio _depois_ do apagamento, então não existe nenhuma revisão anterior ao incidente.

O lado TypeScript/React Native (`mobile/src/`), os testes Jest, os contratos Codegen (`mobile/src/native/specs/*.ts`), e a documentação de `specs/006-android-opl-network-library/` (`tasks.md`, `research.md`, `mobile/README.md`) **permanecem intactos** e são a fonte da verdade sobre o comportamento exato que o código Kotlin precisa reproduzir — este não é um trabalho de design novo, é reconstrução fiel de um contrato já definido e já validado uma vez.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Build nativo volta a existir (Priority: P1)

Como continuidade do trabalho da feature 006, preciso que `mobile/android` volte a compilar e produzir um APK instalável, com todos os módulos nativos (TurboModules, servidor SMB, Room, Foreground Service) reescritos fielmente ao que existia antes do incidente.

**Why this priority**: Sem isso, nenhuma funcionalidade nativa (US1–US6 da feature 006) funciona — o app JS roda mas todas as chamadas a módulos nativos falham.

**Independent Test**: `./gradlew :app:assembleDebug` conclui com sucesso e o APK resultante instala e abre no emulador sem crash.

**Acceptance Scenarios**:

1. **Given** a pasta `mobile/android/app/src/main/java/com/oplforge/mobile/` reduzida a `MainActivity.kt`/`MainApplication.kt`, **When** o código nativo é reescrito, **Then** `./gradlew :app:assembleDebug` termina com `BUILD SUCCESSFUL`.
2. **Given** o APK reconstruído instalado no emulador, **When** o app abre, **Then** nenhum módulo nativo (`CatalogModule`, `SharingModule`, `LibraryModule`) lança `TurboModuleRegistry` not-found.

---

### User Story 2 - Paridade funcional end-to-end (Priority: P1)

Como continuidade da feature 006, preciso re-verificar ao vivo, em emulador/dispositivo real, exatamente o mesmo fluxo que já tinha sido validado antes do incidente: selecionar biblioteca → catalogar → compartilhar via SMB → tutorial de conexão → navegar a biblioteca.

**Why this priority**: A feature 006 só é considerada "funcional" com verificação real em dispositivo, não apenas testes automatizados — essa foi a lição já registrada em `tasks.md`. Reescrever o código sem reverificar ao vivo reintroduziria o mesmo risco de regressão silenciosa.

**Independent Test**: Executar manualmente, num emulador, o roteiro completo descrito em `mobile/README.md` ("O que shippou") e confirmar que cada passo se comporta como antes.

**Acceptance Scenarios**:

1. **Given** o app reconstruído, **When** o usuário seleciona uma pasta via SAF, **Then** o acesso é persistido e revalidado no próximo lançamento (igual ao comportamento original).
2. **Given** uma biblioteca selecionada, **When** o usuário inicia a catalogação, **Then** o snapshot é persistido no Room e os itens aparecem na aba Biblioteca com paginação/filtro funcionando.
3. **Given** uma biblioteca catalogada, **When** o usuário inicia o compartilhamento, **Then** o servidor SMB liga na porta 1445, a notificação persistente aparece, e uma conexão TCP real consegue negociar com o servidor.
4. **Given** compartilhamento ativo, **When** o usuário abre o tutorial, **Then** os passos de conexão (IP/porta/nome do compartilhamento/usuário) aparecem na ordem correta.

---

### User Story 3 - Bugs conhecidos não voltam (Priority: P2)

Como continuidade da feature 006, preciso que os 6 bugs reais já descobertos e corrigidos durante a implementação original (documentados em `research.md` e no histórico de `tasks.md`) sejam reaplicados na reescrita, para não pagar o mesmo custo de descoberta duas vezes.

**Why this priority**: Esses bugs não são óbvios a partir do código-fonte por si só — foram descobertos por tentativa e erro em dispositivo real (permissões de Foreground Service, porta privilegiada, permissão de notificação em runtime, colisão de chave React, contaminação de dados de teste, sandbox de build). Reescrever "do zero" sem essa lista implica redescobri-los um por um.

**Independent Test**: Cada um dos 6 itens da lista abaixo tem uma verificação explícita (manifest, código, ou execução de teste) que confirma que a correção está presente na reescrita.

**Acceptance Scenarios**:

1. **Given** o `AndroidManifest.xml` reconstruído, **When** inspecionado, **Then** contém `FOREGROUND_SERVICE_CONNECTED_DEVICE` **e** `CHANGE_WIFI_STATE`.
2. **Given** o `SharingForegroundService` reescrito, **When** inspecionado, **Then** a porta padrão do servidor SMB é 1445, não 445.
3. **Given** o `MainActivity.kt` (que sobreviveu ao incidente), **When** revisado, **Then** já contém `requestNotificationPermissionIfNeeded()` — confirmar que nada foi perdido aqui.
4. **Given** o código do tutorial de conexão reescrito, **When** os passos são construídos do lado Kotlin, **Then** usa um contador local explícito em vez de `WritableArray.size()` durante a construção.
5. **Given** `LibraryPreferences` reescrito, **When** instanciado nos testes instrumentados, **Then** aceita um nome de preferences customizado e os testes usam um nome diferente do de produção.
6. **Given** qualquer comando Gradle que compile código nativo/CMake, **When** executado neste ambiente, **Then** é executado com o sandbox do Bash tool desabilitado.

---

### Edge Cases

- O que fazer se, durante a reescrita, o comportamento exato de algum detalhe não estiver claro em `research.md`/`tasks.md` nem for testável pelos testes Jest existentes (contrato JS)? → Usar o contrato TypeScript (`mobile/src/native/specs/*.ts` e `mobile/src/native/*.ts`) como fonte da verdade de comportamento observável, já que ele não foi perdido.
- O que fazer se o `mobile/README.md` (documentação do estado funcional anterior) e `tasks.md` divergirem em algum detalhe? → `tasks.md` é mais granular e foi atualizado por último; usar como desempate.
- Como evitar que isso aconteça de novo? → Ver FR-008 (proteção contra recorrência).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: O sistema MUST reconstruir o servidor SMB1/CIFS próprio (codec de frames, command handlers) em Kotlin, sem depender de biblioteca externa pronta (nenhuma existe para JVM/Android).
- **FR-002**: O sistema MUST reconstruir os três TurboModules — `CatalogScanModule` (scan de catálogo com paginação), `SharingSessionModule` (sessão de compartilhamento SMB), `LibraryModule` (seleção de biblioteca via SAF) — com assinaturas idênticas às já definidas nos contratos Codegen existentes em `mobile/src/native/specs/`.
- **FR-003**: O sistema MUST reconstruir o banco Room (entidades de snapshot/entrada de catálogo, DAOs, `AppDatabase`) com o mesmo schema observável usado pelos testes Jest e pela tela de Biblioteca já existentes.
- **FR-004**: O sistema MUST reconstruir `SharingForegroundService` como Foreground Service tipo `connectedDevice`, porta padrão 1445, com notificação persistente.
- **FR-005**: O sistema MUST reconstruir `CredentialStore` usando `EncryptedSharedPreferences` para as credenciais SMB.
- **FR-006**: O sistema MUST reconstruir `HistoryStore`, `SafDocumentTree`, `ErrorMapping`/`AppError` e `LibraryPreferences` (esta última parametrizável com nome de preferences customizado).
- **FR-007**: O sistema MUST reaplicar, sem exceção, os 6 bugs/correções documentados na User Story 3.
- **FR-008**: O sistema MUST reduzir o risco de recorrência do incidente — ao final da reescrita, `mobile/android` MUST estar em um estado onde uma perda futura seja recuperável (commitar a pasta no git, ou mover a lógica nativa para um local versionado/config plugin, ou documentar explicitamente o risco se a decisão for mantê-la git-ignored). A decisão concreta é de implementação, mas a spec exige que uma decisão explícita seja tomada e registrada.
- **FR-009**: O sistema MUST reconstruir a suíte de testes unitários JVM/Robolectric (paridade com as 53 asserções que existiam) e a suíte de testes instrumentados `androidTest` (paridade com os 5 testes que existiam, incluindo o teste de integração do servidor SMB com socket TCP real).
- **FR-010**: O sistema MUST verificar, ao vivo em emulador/dispositivo real, o fluxo completo descrito na User Story 2, com evidência (screenshot ou log) equivalente à já registrada em `tasks.md` para a feature 006.

### Key Entities

- **CatalogSnapshotEntity / CatalogEntryEntity**: Persistência Room do estado de uma catalogação (metadados de jogos detectados na biblioteca SAF).
- **SharingSession**: Estado em memória/exposto ao JS de uma sessão de compartilhamento SMB ativa (endereço, porta, credenciais associadas, estado da conexão do PS2).
- **LibrarySelection**: URI SAF persistida da pasta escolhida como biblioteca, com metadados de validade de acesso.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: `./gradlew :app:assembleDebug` produz `BUILD SUCCESSFUL` e um APK instalável, sem nenhuma alteração no lado TypeScript/JS necessária para isso.
- **SC-002**: 100% dos testes unitários e instrumentados que existiam antes do incidente voltam a passar (mesma contagem: 53 unitários, 5 instrumentados, ou documentar e justificar qualquer diferença).
- **SC-003**: O fluxo completo (selecionar → catalogar → compartilhar → tutorial → navegar biblioteca) é executado manualmente em um emulador real do início ao fim sem erro, com prints comparáveis aos já capturados para a feature 006.
- **SC-004**: Os 6 itens da lista de bugs conhecidos (User Story 3) são verificáveis individualmente após a reescrita, sem exceção.
- **SC-005**: Uma decisão explícita sobre como evitar a recorrência do incidente (FR-008) está documentada no repositório ao final do trabalho.

## Assumptions

- O contrato observável do lado TypeScript (`mobile/src/native/*.ts`, `mobile/src/native/specs/*.ts`) não mudou e continua sendo a especificação de comportamento a ser satisfeita pelo Kotlin reescrito.
- `specs/006-android-opl-network-library/research.md` e `tasks.md` continuam sendo as fontes autoritativas sobre decisões técnicas já tomadas (porta 1445, tipo de Foreground Service, estratégia de storage, etc.) — esta spec não reabre essas decisões, apenas exige que sejam reaplicadas.
- Não há necessidade de nova UX/design — a interface já existente (App.tsx, RootNavigator, telas) permanece como está; esta spec cobre exclusivamente a camada nativa Android.
- O ambiente de execução (Bash tool com sandbox) continua exigindo `dangerouslyDisableSandbox: true` para comandos Gradle que tocam código nativo/CMake, como já documentado.
