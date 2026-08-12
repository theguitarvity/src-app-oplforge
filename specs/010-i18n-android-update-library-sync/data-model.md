# Data Model: i18n, Android Update Check, Library/Device Sync

## LanguagePreference

Representa a preferencia de idioma do usuario, por plataforma (nao
sincronizada entre desktop e mobile — ver `research.md`).

| Field      | Type                                                      | Notes                                                                                    |
| ---------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `language` | `'pt-BR' \| 'en' \| 'es' \| 'de' \| 'ru' \| 'zh' \| 'ja'` | Um dos 7 idiomas suportados (FR-001)                                                     |
| `source`   | `'user' \| 'system-default'`                              | `'system-default'` apenas antes da primeira escolha explicita do usuario (FR-002/FR-015) |
| `setAt`    | `string` (ISO 8601)                                       | Quando o valor atual foi definido                                                        |

Persistencia: desktop no arquivo de preferencias JSON local (extensao do
existente); mobile em `AsyncStorage` via `settings-store.ts`.

## TranslationCatalog

Nao e uma entidade persistida, e um artefato estatico por idioma
(`locales/<lang>.json`), carregado em runtime pelo `i18next`.

| Field       | Type     | Notes                                                                       |
| ----------- | -------- | --------------------------------------------------------------------------- |
| `namespace` | `string` | Agrupamento de chaves por area da UI (ex.: `settings`, `library`, `common`) |
| `key`       | `string` | Identificador estavel da string (nao muda entre idiomas)                    |
| `value`     | `string` | Texto traduzido para o idioma do arquivo                                    |

Regra de fallback (FR-007): se `key` ausente no catalogo do idioma ativo,
`i18next` resolve para o catalogo `pt-BR` (configurado como `fallbackLng`).

## AndroidUpdateStatus

Estado da checagem de atualizacao no Android (nao persistido entre
sessoes; recalculado a cada abertura do app, FR-008).

| Field             | Type                        | Notes                                                                                    |
| ----------------- | --------------------------- | ---------------------------------------------------------------------------------------- |
| `checkedAt`       | `string \| null` (ISO 8601) | `null` se a checagem ainda nao rodou/falhou antes de completar                           |
| `currentVersion`  | `string`                    | Versao instalada do app (ex.: via `expo-application`)                                    |
| `latestVersion`   | `string \| null`            | Versao mais recente publicada no feed de releases; `null` se a checagem falhou           |
| `updateAvailable` | `boolean`                   | `latestVersion` semver-maior que `currentVersion`                                        |
| `releaseUrl`      | `string \| null`            | Link da release correspondente, usado pela acao de atualizacao em Configuracoes (FR-009) |
| `checkFailed`     | `boolean`                   | `true` quando a checagem nao completou (rede/erro) — nunca bloqueia o app (FR-010)       |

## LibrarySourceIdentity

Usada para detectar troca de dispositivo/biblioteca (FR-011, FR-017).

| Field        | Type                | Notes                                                                                                                     |
| ------------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `id`         | `string`            | Identificador da fonte de biblioteca ativa (mobile: retorno de `LibraryModule.selectLibrary()`; desktop: `DeviceInfo.id`) |
| `path`       | `string`            | Path associado a fonte (mobile/desktop, conforme `DeviceInfo.path`)                                                       |
| `observedAt` | `string` (ISO 8601) | Quando este `id`/`path` foi visto pela ultima vez                                                                         |

**State transition**: ao iniciar o bootstrap/selecao de biblioteca, o novo
`{id, path}` observado e comparado ao `LibrarySourceIdentity` persistido
da sessao anterior:

- Igual → segue o carregamento normal (loading da splash apenas, sem
  popup adicional) — FR-013.
- Diferente ou ausente (primeira vez) → estado `library-changed` e
  ativado, popup exibido, e o novo `{id, path}` substitui o persistido
  somente apos o carregamento concluir (sucesso ou erro tratado) — FR-012,
  FR-017.

Persistencia: mobile em `AsyncStorage` via `settings-store.ts` (mesmo
store da preferencia de idioma, campos distintos); desktop reaproveita
`device-store.ts` caso a mesma deteccao seja estendida ao desktop (ver
Assumption em `spec.md`).
