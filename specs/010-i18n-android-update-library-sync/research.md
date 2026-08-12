# Research: i18n, Android Update Check, Library/Device Sync

## Decision: Biblioteca de i18n compartilhada (desktop + mobile)

**Decision**: Adotar `i18next` como motor de traducao/fallback em ambas as
plataformas, com `react-i18next` no desktop (React/Vite) e no mobile
(React Native/Expo) — a mesma dupla de pacotes funciona sem alteracao em
React Native, pois nao depende de DOM.

**Rationale**: Nenhuma lib de i18n existe hoje no repo (`app-features.md`,
DISCOVERED_FROM_CODEBASE). `i18next`/`react-i18next` e a combinacao mais
usada tanto em apps React web quanto React Native, com fallback de idioma
nativo (`fallbackLng`), interpolacao e namespaces — cobre diretamente
FR-006 (catalogo por idioma) e FR-007 (fallback para pt-BR) sem exigir
logica de fallback escrita a mao em duas bases de codigo distintas. Usar a
mesma lib nas duas plataformas reduz duplicacao de conceitos (chaves,
namespaces, interpolacao) entre desktop e mobile.

**Alternatives considered**:

- `react-intl` (FormatJS): mais focado em formatacao ICU avancada; exigiria
  adaptar consumo diferente em RN vs. web e nao tem vantagem clara para o
  escopo atual (nao ha requisitos de formatacao ICU complexa alem de
  data/hora/numero, que `Intl`/`i18next` ja cobrem via `Intl` API nativa).
- Solucao caseira (dicionarios TS + hook proprio): rejeitada — reimplementa
  fallback/interpolacao que `i18next` ja resolve testado, contra o
  Principio V (evolucao incremental verificada, evitar complexidade sem
  requisito atual que a justifique).

## Decision: Deteccao de idioma do sistema operacional

**Decision**: Desktop usa `navigator.language`/`Intl.DateTimeFormat().resolvedOptions().locale`
do proprio renderer Electron (sem IPC novo). Mobile adiciona a dependencia
`expo-localization` (compativel com o Expo SDK ~57 ja usado) para ler o
locale do dispositivo Android no bootstrap.

**Rationale**: `navigator.language` ja esta disponivel no renderer sem
exigir nenhuma nova superficie de IPC, respeitando o Principio II
(isolamento/menor privilegio — nada novo exposto via `contextBridge`).
`expo-localization` e a forma padrao no ecossistema Expo de acessar o
locale do SO sem escrever codigo nativo Android proprio, e e mantida pela
mesma organizacao que ja fornece `expo-splash-screen`/`expo-status-bar`/
`expo-system-ui`, ja presentes em `mobile/package.json`.

**Alternatives considered**: Modulo nativo customizo em `mobile/src/native/`
— rejeitado por reimplementar o que `expo-localization` ja resolve, sem
requisito que justifique a complexidade adicional (Principio V).

## Decision: Persistencia da preferencia de idioma

**Decision**: Desktop persiste no mesmo arquivo de preferencias locais ja
referenciado em `SettingsPage.tsx` ("preparado para persistencia em
JSON"); a implementacao deve localizar/confirmar esse arquivo (hoje nao
identificado por caminho exato) e adicionar o campo `language` a ele, ou
criar esse arquivo em `userData` caso ainda nao exista fisicamente,
seguindo o padrao de escrita atomica em JSON descrito no Principio IV.
Mobile persiste via `AsyncStorage` (ja transitivo do React Native, sem
nova dependencia de terceiros) atras de um novo `settings-store.ts`
(zustand), consistente com o padrao dos demais stores em
`mobile/src/stores/`.

**Rationale**: Reaproveita mecanismos ja estabelecidos por plataforma em
vez de introduzir uma terceira forma de persistencia. Nenhum requisito
exige que a preferencia de idioma seja sincronizada entre desktop e
mobile — cada plataforma mantem sua propria preferencia local (nao ha
"conta" compartilhada mencionada em nenhuma fonte).

**Alternatives considered**: `expo-secure-store` no mobile — rejeitado
porque a preferencia de idioma nao e um dado sensivel; `SecureStore` e
mais lento e destinado a segredos, nao a preferencias de UI.

## Decision: Mecanismo de update Android (FR-016, decidido em clarify)

**Decision**: O app Android consulta um endpoint/feed de versao proprio,
reaproveitando a mesma fonte de releases publicada ja usada pelo desktop
(GitHub Releases do repositorio configurado em `electron-builder.yml`,
`owner: theguitarvity, repo: src-app-oplforge`), comparando a versao
publicada mais recente com `expo-application`/`Constants.expoConfig.version`
do app instalado. A acao de atualizacao em Configuracoes abre o link do
artefato/pagina de release correspondente para o usuario baixar/instalar
manualmente (nao ha instalacao silenciosa em Android fora de uma loja).

**Rationale**: Decisao explicita do usuario via `/speckit-clarify`
(2026-08-12), preferindo nao depender da Google Play In-App Updates API
(que exigiria publicacao formal na Play Store, nao confirmada como canal
de distribuicao atual). Reaproveitar o mesmo repositorio de releases do
desktop evita introduzir um segundo sistema de publicacao de versao.

**Alternatives considered**: Google Play In-App Updates API — descartada
pelo usuario nesta decisao; servidor de update dedicado — descartado por
introduzir infraestrutura nova sem motivacao presente nas fontes
(Principio V, "Dependências novas e mudanças estruturais... MUST
apresentar motivação").

## Decision: Criterio de deteccao de troca de biblioteca/dispositivo (FR-017, decidido em clarify)

**Decision**: A deteccao compara o `id`/`path` da fonte de biblioteca ativa
(mobile: retornado por `LibraryModule.selectLibrary()`, guardado em
`useLibraryStore`; desktop: `DeviceInfo.id`/`path` em `useDeviceStore`)
com o ultimo `id`/`path` persistido da sessao anterior. Uma diferenca
dispara o estado "biblioteca mudou" antes de chamar
`revalidate()`/`selectLibrary()`, mostrando o popup ate a promise
resolver.

**Rationale**: Decisao explicita do usuario via `/speckit-clarify`
(2026-08-12), preferindo nao introduzir captura de serial/MAC do
dispositivo fisico (que exigiria novo codigo nativo em
`mobile/src/native/` sem requisito atual que justifique, Principio V).
`id`/`path` ja existe em ambas as stores hoje (DISCOVERED_FROM_CODEBASE),
entao a implementacao e aditiva, nao um novo tipo de identidade.

**Alternatives considered**: Fingerprint por serial/MAC — descartado pelo
usuario nesta decisao; hash do conteudo da biblioteca — rejeitado por
exigir ler a biblioteca inteira antes de decidir mostrar o popup, o que
inverteria a ordem (o popup precisa aparecer _antes_ do carregamento
terminar, nao depois).

## Decision: Tela de Configuracoes no mobile

**Decision**: Substituir o placeholder atual (`RootNavigator.tsx:91`,
tab "Settings" apontando para `LibrarySelectScreen`) por uma tela
`SettingsScreen` propria em `mobile/src/screens/`, seguindo o padrao das
demais telas listadas em `mobile/src/screens/` (Home, Library, Essentials,
etc.), contendo o seletor de idioma (FR-003) e a acao de atualizacao
(FR-009).

**Rationale**: Nao ha tela de Configuracoes real hoje no mobile
(DISCOVERED_FROM_CODEBASE, `RootNavigator.tsx:91`) — e um requisito
direto da spec (User Story 2 e 3), nao uma escolha de implementacao
opcional.

**Alternatives considered**: Nenhuma — a ausencia de tela e um gap
funcional direto, nao uma decisao de design com alternativas
razoaveis.

## Decision: Popup de troca de biblioteca e loading de splash

**Decision**: O popup de "biblioteca mudou" e implementado como um estado
adicional no fluxo de bootstrap mobile (`mobile/src/app/bootstrap.ts` +
`mobile/src/stores/library-store.ts`), renderizado como overlay modal
sobre a tela de Biblioteca enquanto `useLibraryStore().status === 'loading'`
E a origem da troca for detectada (ver decisao acima). O indicador de
loading da splash e adicionado ao `SplashOverlay` existente em
`mobile/src/app/App.tsx`, substituindo o tempo fixo `MIN_SPLASH_MS` sem
feedback por um indicador visual (spinner/progress) que permanece visivel
pelo tempo real de bootstrap.

**Rationale**: Reaproveita a infraestrutura de estado ja existente
(`idle|loading|ready|error` em `library-store.ts`) em vez de criar uma
segunda maquina de estados paralela, respeitando o Principio V (escopo
minimo coerente).

**Alternatives considered**: Popup global independente do
`library-store` — rejeitado por duplicar estado que ja existe.

## Open items resolved

Todos os `[NEEDS CLARIFICATION]` do `spec.md` foram resolvidos via
`/speckit-clarify` em 2026-08-12 (ver FR-016, FR-017). Nenhum item
permanece em aberto para a fase de design (Phase 1).
