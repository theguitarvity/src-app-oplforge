# Contract: Settings Store & Android Update Check

## `settings-store` (desktop e mobile)

Interface zustand, tipada, consistente entre plataformas onde aplicavel.

```ts
interface SettingsState {
  language: SupportedLanguage // 'pt-BR' | 'en' | 'es' | 'de' | 'ru' | 'zh' | 'ja'
  languageSource: 'user' | 'system-default'
  lastLibrarySource: { id: string; path: string } | null // apenas mobile (e desktop se estendido)

  setLanguage: (language: SupportedLanguage) => void
  hydrate: () => Promise<void> // le persistencia local no boot
  recordLibrarySource: (source: { id: string; path: string }) => void
  hasLibrarySourceChanged: (candidate: { id: string; path: string }) => boolean
}
```

Regras:

- `setLanguage` MUST persistir imediatamente (escrita atomica desktop /
  `AsyncStorage.setItem` mobile) e MUST disparar `i18next.changeLanguage`
  para refletir na UI sem reload (FR-004).
- `hasLibrarySourceChanged` MUST retornar `false` quando `lastLibrarySource`
  for `null` e nenhuma sessao anterior existir na primeira instalacao (para
  nao mostrar popup de "troca" no primeiro uso, apenas o loading normal).
- `recordLibrarySource` MUST ser chamado somente apos o carregamento da
  biblioteca concluir (sucesso), nunca antes — para nao perder a
  possibilidade de detectar a troca caso o carregamento falhe e o usuario
  tente novamente.

## Servico de checagem de update Android (`update-check.ts`)

```ts
interface AndroidUpdateStatus {
  checkedAt: string | null
  currentVersion: string
  latestVersion: string | null
  updateAvailable: boolean
  releaseUrl: string | null
  checkFailed: boolean
}

function checkForAndroidUpdate(): Promise<AndroidUpdateStatus>
```

Regras:

- MUST consultar o feed de releases GitHub ja usado pelo desktop
  (`electron-builder.yml`: `owner: theguitarvity, repo: src-app-oplforge`),
  sem introduzir um segundo backend de release.
- MUST retornar `checkFailed: true` (nunca lancar excecao nao tratada) em
  caso de falha de rede/parsing, para que o app continue funcionando
  normalmente (FR-010).
- MUST ser chamado uma vez ao abrir o app (FR-008), com o resultado
  exposto para a tela de Configuracoes (FR-009); NAO deve ser chamado em
  loop nem bloquear a navegacao inicial do app.
- A acao de "atualizar" em Configuracoes MUST abrir `releaseUrl` (link
  externo) — nao ha instalacao silenciosa nem download automatico
  embutido no escopo desta feature.
