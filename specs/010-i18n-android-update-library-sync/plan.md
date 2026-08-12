# Implementation Plan: Internacionalizacao, Atualizacao Android e Sincronizacao de Biblioteca

**Branch**: `010-i18n-android-update-library-sync` (trunk-based, sem branch dedicada) | **Date**: 2026-08-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/010-i18n-android-update-library-sync/spec.md`

## Summary

Introduzir i18n em 7 idiomas (pt-BR padrao, en, es, de, ru, zh, ja) no
desktop e no Android via `i18next`/`react-i18next`, com selecao no
primeiro launch e em Configuracoes e fallback para pt-BR; adicionar
checagem de atualizacao no Android contra o feed de releases GitHub ja
usado pelo desktop, com acao de update em uma nova tela de Configuracoes
mobile; e adicionar deteccao de troca de dispositivo/biblioteca por
comparacao de `id`/`path` da fonte ativa, exibindo popup de carregamento
e um indicador de progresso na splash screen do mobile. Toda a execucao e
aditiva sobre stores e telas ja existentes (`device-store.ts`,
`library-store.ts`, `bootstrap.ts`, `SettingsPage.tsx`), sem alterar o
update do desktop nem o pipeline de release existente.

## Technical Context

**Language/Version**: TypeScript (desktop `src/`/`electron/`, mobile `mobile/src/`), Node.js (Electron main), Kotlin/Java apenas nos modulos nativos ja existentes em `mobile/android/` (nao alterados por esta feature)

**Primary Dependencies**: `i18next` + `react-i18next` (novo, desktop e mobile); `expo-localization` (novo, mobile) para deteccao de locale do SO; `AsyncStorage` (ja transitivo do React Native) para persistencia de preferencias mobile; reaproveitamento de `electron-updater`/GitHub Releases (desktop, existente) como fonte de versao consultada pelo Android; zustand (existente) para os novos stores de settings/idioma e para o estado do popup de troca de biblioteca

**Storage**: Desktop — arquivo de preferencias JSON local referenciado em `SettingsPage.tsx`, estendido com campo `language` (escrita atomica, ver Principio IV); Mobile — `AsyncStorage` para `language` e ultimo `id`/`path` de biblioteca conhecido, via novo `settings-store.ts`

**Testing**: Vitest (desktop, existente) para logica de fallback de idioma, comparacao de id/path e parsing de versao; Jest (`jest-expo`, mobile, existente) para os mesmos comportamentos no lado mobile e para o novo `SettingsScreen`/popup

**Target Platform**: Desktop Electron (Windows/macOS/Linux, sem mudanca de matriz de build); Android via Expo/React Native (mesmo alvo ja suportado pelo projeto)

**Project Type**: Aplicacao desktop Electron + app mobile React Native/Expo, monorepo existente

**Performance Goals**: Troca de idioma reflete na UI em menos de 1s (SC-002); popup de carregamento cobre 100% do intervalo real de bootstrap da biblioteca apos deteccao de troca (SC-004), sem atraso artificial adicionado

**Constraints**: `contextIsolation=true`, `nodeIntegration=false`, `sandbox=true` no renderer Electron mantidos; nenhum novo canal IPC generico exposto; checagem de update Android nao pode bloquear abertura/uso do app em caso de falha (FR-010); escolha de idioma explicita do usuario tem precedencia sobre deteccao automatica do SO apos o primeiro launch (FR-015)

**Scale/Scope**: 3 user-facing capabilities (i18n, update Android, sync de biblioteca+splash), 7 idiomas, 17 requisitos funcionais, 5 criterios de sucesso; escopo aditivo sobre desktop (`src/`, `electron/`) e mobile (`mobile/`) existentes

## Constitution Check

_Gate before Phase 0: PASS. Re-evaluated after Phase 1: PASS._

| Principle/gate                                 | Design response                                                                                                                                                                                                                              | Result |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| I. Seguranca em operacoes sensiveis            | Nenhuma operacao destrutiva/legal nova; update Android abre link de release para acao manual do usuario, sem instalacao silenciosa.                                                                                                          | PASS   |
| II. Isolamento e menor privilegio              | Nenhum novo canal IPC generico no Electron; deteccao de locale desktop usa `navigator.language` no proprio renderer, sem novo `contextBridge`. Update/locale no mobile usam APIs Expo padrao, nao modulo nativo customizado.                 | PASS   |
| III. Contratos tipados e limites de camada     | Novos stores (`settings-store` mobile, extensao do arquivo de preferencias desktop) seguem o padrao zustand/JSON ja tipado existente; nenhuma logica de dominio nova acessa I/O fora dos servicos/stores estabelecidos.                      | PASS   |
| IV. Integridade, rastreabilidade e recuperacao | Persistencia de idioma/ultimo id-path usa escrita atomica (desktop, padrao existente) e `AsyncStorage` (mobile); falha de checagem de update e tratada sem bloquear o app (FR-010); popup de biblioteca reflete estado real de `loading      | ready  | error` sem mascarar falhas. | PASS |
| V. Evolucao incremental verificada             | Escopo aditivo sobre stores/telas existentes; novas dependencias (`i18next`, `react-i18next`, `expo-localization`) justificadas em `research.md`; testes automatizados cobrem fallback de idioma, comparacao de id/path e parsing de versao. | PASS   |
| Restricoes tecnicas e de produto               | Nenhuma mudanca na estrutura OPL, caminhos de dispositivo, staging de download ou matriz de build; dependencias novas documentadas com motivacao em `research.md`.                                                                           | PASS   |

Nenhuma excecao constitucional ou complexity waiver e necessaria.

## Project Structure

### Documentation (this feature)

```text
specs/010-i18n-android-update-library-sync/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── settings-and-update.md
├── checklists/
│   └── requirements.md
└── tasks.md              # generated later by speckit-tasks
```

### Source Code (repository root)

```text
src/
├── i18n/                          # novo: init do i18next, catalogos por idioma (desktop)
│   ├── index.ts
│   └── locales/{pt-BR,en,es,de,ru,zh,ja}.json
├── stores/
│   └── settings-store.ts          # novo: idioma selecionado, persistencia local
├── pages/
│   └── SettingsPage.tsx           # alterado: seletor de idioma na aba Geral
└── components/
    └── setup/LanguageStep.tsx     # novo: passo de idioma no primeiro launch (se setup existir)

mobile/src/
├── i18n/                          # novo: init do i18next, catalogos por idioma (mobile)
│   ├── index.ts
│   └── locales/{pt-BR,en,es,de,ru,zh,ja}.json
├── stores/
│   ├── settings-store.ts          # novo: idioma + ultimo id/path de biblioteca conhecido
│   └── library-store.ts           # alterado: expõe deteccao de troca (compara id/path)
├── screens/
│   └── SettingsScreen.tsx         # novo: substitui placeholder do RootNavigator
├── navigation/
│   └── RootNavigator.tsx          # alterado: tab "Settings" aponta para SettingsScreen
├── components/
│   ├── library/LibraryChangedOverlay.tsx  # novo: popup de carregamento
│   └── splash/SplashProgress.tsx          # novo: indicador de loading na splash
├── app/
│   ├── App.tsx                    # alterado: SplashOverlay usa SplashProgress
│   └── bootstrap.ts                # alterado: reporta progresso do step de biblioteca
└── services/
    └── update-check.ts             # novo: consulta feed de releases GitHub
```

**Structure Decision**: Aditivo em cima dos diretorios `src/`/`mobile/src/`
ja existentes, seguindo as convencoes ja usadas (`stores/`, `screens/`,
`components/`, `pages/`). Nenhum diretorio novo de top-level e criado; o
unico diretorio novo por plataforma e `i18n/`, isolando catalogos de
traducao do restante da logica.

## Phase 0 outputs

Ver [research.md](research.md) — todas as decisoes tecnicas (biblioteca de
i18n, deteccao de locale, persistencia, mecanismo de update Android,
criterio de troca de biblioteca, tela de Configuracoes mobile, popup +
splash) resolvidas, sem `NEEDS CLARIFICATION` remanescente.

## Phase 1 outputs

- [data-model.md](data-model.md): entidades `LanguagePreference`,
  `TranslationCatalog`, `AndroidUpdateStatus`, `LibrarySourceIdentity`.
- [contracts/settings-and-update.md](contracts/settings-and-update.md):
  contrato do `settings-store` (desktop/mobile) e do servico de checagem
  de update Android.
- [quickstart.md](quickstart.md): roteiro de validacao manual das 5 user
  stories.

## Validation Strategy

- **Unit**: fallback de idioma ausente → pt-BR; comparacao de `id`/`path`
  para decidir exibir/nao exibir popup; parsing/comparacao de versao do
  feed de releases; persistencia de `language`/`lastLibrarySource` em
  `AsyncStorage`/arquivo de preferencias.
- **Component**: `SettingsPage`/`SettingsScreen` com seletor de idioma
  aplicando troca sem reload; `LibraryChangedOverlay` exibido/ocultado
  conforme `library-store.status`; `SplashProgress` visivel durante todo o
  `bootstrap.ts`.
- **Integration**: fluxo completo de bootstrap mobile com troca de
  dispositivo simulada (id/path diferente) → popup aparece → carregamento
  termina → popup some; checagem de update Android com feed indisponivel
  → app abre normalmente (FR-010).
- **Manual/quickstart**: primeiro launch em desktop e Android nos 7
  idiomas; troca de idioma em Configuracoes em ambas as plataformas; troca
  de dispositivo fisico/simulado no Android. Ver [quickstart.md](quickstart.md).

## Post-Design Constitution Re-check

Phase 1 nao introduz IPC novo, nao altera a estrutura OPL nem o pipeline
de release do desktop, e mantem toda leitura de I/O privilegiada nos
locais ja estabelecidos (main process/servicos existentes). Persistencia
nova segue os padroes atomicos/AsyncStorage ja convencionados. PASS.

## Delivery Gates and Ordering

1. Catalogos de traducao e init do `i18next` (desktop + mobile) landam
   antes de qualquer tela ser migrada, para permitir migracao incremental
   tela por tela.
2. `settings-store` (idioma + ultimo id/path) landa antes do
   `SettingsScreen` mobile e antes do popup de troca de biblioteca.
3. Servico de checagem de update Android e aditivo e pode landar em
   paralelo, sem dependencia das demais fatias.
4. Migracao de strings hardcoded por tela e incremental; cada tela
   migrada deve passar lint/build antes da proxima.
5. Lint, typecheck, testes afetados e build (desktop e mobile) MUST
   passar antes da integracao de cada fatia, conforme Principio V.

## Complexity Tracking

Nenhuma violacao constitucional requer justificativa. As tres novas
dependencias (`i18next`, `react-i18next`, `expo-localization`) sao
adicoes de biblioteca padrao de mercado para um requisito presente na
especificacao (i18n e deteccao de locale), nao infraestrutura
especulativa — justificadas em `research.md` conforme exigido pela secao
"Restrições Técnicas e de Produto" da constituicao.
