# App Features

## Context

O OPL Forge é composto por um app desktop (Electron + React) e um app mobile
Android (React Native/Expo) para gerenciar bibliotecas de jogos PS2 (OPL)
via rede. Hoje toda a UI (desktop e mobile) está hardcoded em português
(pt-BR), sem nenhuma camada de i18n. O app desktop já tem checagem de
atualização via `electron-updater` (`electron/services/updates/update.service.ts`,
exposto em `SettingsPage.tsx` via `UpdateDialog`); o Android não tem
nenhuma verificação de atualização. Ao trocar de dispositivo/biblioteca, o
mobile (`mobile/src/stores/library-store.ts`) já tem um fluxo de
`revalidate()`/`selectLibrary()`, mas não existe detecção de "biblioteca
mudou" nem popup de carregamento — o usuário pode ver uma tela vazia antes
do carregamento terminar, o que é enganoso.

## Scope

- Internacionalização completa (textos e elementos visuais dependentes de
  idioma) do app desktop (`src/`) e do app Android (`mobile/`).
- Verificação de nova versão disponível no Android, com ação de atualização
  em Configurações (equivalente ao que já existe no desktop).
- Mecanismo de detecção de troca de dispositivo/biblioteca com popup de
  carregamento, e indicador de loading na splash screen do mobile.

## Features

### Feature 1 — Internacionalização (i18n) multi-idioma

#### Objective

Traduzir toda a interface do desktop e do Android para 7 idiomas: pt-BR
(padrão), en (inglês), es (espanhol), de (alemão), ru (russo), zh
(mandarim), ja (japonês). Permitir a seleção do idioma no primeiro
launch/setup e em Configurações, em ambas as plataformas.

#### Expected behavior

- No primeiro launch (desktop e mobile), o usuário escolhe o idioma antes
  de (ou durante) o setup inicial; um idioma padrão é pré-selecionado a
  partir do idioma do sistema operacional quando suportado, caindo para
  pt-BR quando não suportado.
- A seleção de idioma fica disponível a qualquer momento em Configurações
  (desktop: nova opção na aba "Geral" de `SettingsPage.tsx`; mobile: nova
  tela de Configurações — hoje a tab "Settings" do `RootNavigator.tsx`
  aponta como placeholder para `LibrarySelectScreen` e precisa de uma tela
  própria).
- Trocar o idioma em Configurações aplica a mudança imediatamente em toda a
  UI, sem exigir reinício do app.
- Todo texto visível ao usuário (páginas, componentes, mensagens de erro,
  toasts, labels, tooltips, disclaimers — incluindo o aviso de pirataria
  hardcoded em `mobile/src/app/App.tsx`) passa a vir de um catálogo de
  traduções por idioma, não de strings literais no código.
- Elementos visuais que dependem de idioma/região (ex.: formatação de
  data/hora/número, ícones ou imagens com texto embutido, se existirem) são
  adaptados por idioma; ícones puramente gráficos sem texto não precisam de
  tradução.
- A preferência de idioma é persistida localmente (mesma camada de
  persistência de preferências já referenciada em `SettingsPage.tsx`, hoje
  descrita como "preparada para persistência em JSON") e é recuperada nas
  próximas aberturas do app.

#### Acceptance criteria

- [ ] Usuário consegue selecionar entre os 7 idiomas propostos no primeiro
      launch, tanto no desktop quanto no Android.
- [ ] Usuário consegue trocar o idioma a qualquer momento em Configurações,
      em ambas as plataformas, e a UI reflete a troca sem reiniciar o app.
- [ ] Nenhum texto hardcoded permanece nas telas migradas — toda string
      visível vem do catálogo de tradução ativo.
- [ ] Idioma escolhido persiste entre sessões (fechar e reabrir o app).
- [ ] Quando uma chave de tradução não existir no idioma selecionado, o app
      usa pt-BR como fallback em vez de mostrar a chave crua ou quebrar.

#### Test scenarios

- Primeiro launch em desktop e mobile: idioma default é o do SO se
  suportado; senão, pt-BR.
- Troca de idioma em Configurações reflete instantaneamente em uma tela já
  aberta (ex.: Biblioteca) sem reload manual.
- Fechar e reabrir o app mantém o idioma selecionado.
- Texto de uma chave ausente no idioma X cai para pt-BR sem erro visível.

### Feature 2 — Verificação e atualização de versão no Android

#### Objective

Ao abrir o app no Android, verificar se existe uma nova versão disponível
e oferecer a opção de atualização a partir de Configurações — trazendo o
Android para paridade com o fluxo que o desktop já tem via
`electron-updater`/`UpdateDialog`.

#### Expected behavior

- Ao abrir o app Android, o app verifica em background se há uma versão
  mais nova disponível (mecanismo concreto de distribuição/atualização do
  Android — ex.: Play Store, APK auto-hospedado, ou outro — é uma decisão
  técnica em aberto, ver Open Questions).
- Se houver atualização disponível, o usuário vê essa informação e pode
  disparar a atualização a partir da tela de Configurações (mesma seção
  onde o idioma é configurável).
- A checagem de atualização não bloqueia o uso do app enquanto roda, e
  falha de checagem (sem rede, servidor indisponível) não impede o app de
  abrir normalmente.

#### Acceptance criteria

- [ ] Ao abrir o app Android, uma checagem de nova versão é disparada
      automaticamente.
- [ ] Em Configurações, existe uma opção visível para ver a versão atual e
      atualizar quando uma nova versão estiver disponível.
- [ ] Falha na checagem de atualização (offline, erro de rede) não trava
      nem impede a abertura/uso do app.

#### Test scenarios

- App abre com nova versão disponível: indicação aparece em Configurações.
- App abre já na versão mais recente: nenhuma ação de update é oferecida.
- App abre sem conectividade: abre normalmente, checagem falha
  silenciosamente ou com indicação não bloqueante.

### Feature 3 — Reconhecimento de troca de biblioteca/dispositivo com loading

#### Objective

Detectar quando o dispositivo/biblioteca ativa mudou (ex.: usuário trocou
de PS2/dispositivo de origem) e exibir um popup de carregamento enquanto a
nova biblioteca é lida, evitando que o usuário veja um estado vazio/enganoso
antes do carregamento terminar. Adicionar também um indicador de loading na
splash screen do app.

#### Expected behavior

- Quando o app detecta que o dispositivo/fonte da biblioteca mudou em
  relação à última sessão conhecida (mobile: via `library-store.ts`
  /`LibraryModule`; desktop: via `device-store.ts`), um popup/estado de
  carregamento é exibido informando que a biblioteca está sendo carregada,
  em vez de mostrar a tela de biblioteca vazia.
- O popup permanece visível até a biblioteca terminar de carregar (sucesso
  ou erro), e então dá lugar ao conteúdo real ou a uma mensagem de erro
  explícita.
- A splash screen do app (hoje implementada apenas no mobile, em
  `mobile/src/app/App.tsx`/`SplashOverlay`) passa a exibir um indicador de
  loading/progresso, e não apenas um tempo mínimo fixo (`MIN_SPLASH_MS`)
  sem feedback visual do que está acontecendo.

#### Acceptance criteria

- [ ] Ao trocar de dispositivo/fonte de biblioteca, o app exibe um popup de
      carregamento em vez de uma tela de biblioteca vazia.
- [ ] O popup desaparece somente após o carregamento da biblioteca
      concluir (sucesso ou erro tratado).
- [ ] A splash screen do app exibe um indicador visual de loading durante
      a inicialização.
- [ ] Quando o dispositivo/biblioteca não mudou desde a última sessão, o
      popup de "biblioteca mudou" não aparece desnecessariamente.

#### Test scenarios

- Usuário troca de dispositivo PS2 conectado: popup de carregamento
  aparece antes da lista de jogos.
- Usuário reabre o app com o mesmo dispositivo de antes: sem popup de
  troca, splash mostra loading normal de inicialização.
- Carregamento da biblioteca falha (erro de rede/dispositivo): popup dá
  lugar a uma mensagem de erro clara, não a uma tela vazia silenciosa.

## Cross-feature requirements

- Todo texto introduzido pelas Features 2 e 3 (mensagens de update, popup
  de carregamento, splash) já deve nascer usando o catálogo de tradução da
  Feature 1 — não deve ser hardcoded em pt-BR e depois migrado depois.

## Quality requirements

- Troca de idioma não pode causar re-render quebrado ou flash de texto em
  branco.
- Popup de carregamento de biblioteca e indicador de splash não podem
  adicionar atraso perceptível além do tempo real de carregamento (não é
  para simular loading artificial, é para refletir o loading real que já
  acontece hoje sem feedback).

## Non-goals

- Tradução de conteúdo gerado dinamicamente por fontes externas (ex.: nomes
  de jogos, metadados de catálogos de download) — só a UI do app é
  traduzida.
- Localização de moeda/pagamento (o app não processa pagamentos).
- Verificação/atualização de versão no desktop (já existe e não faz parte
  deste escopo, exceto por eventual reaproveitamento de padrão de UI).
- Definir o backend/distribuição concreto do update do Android (Play Store
  vs. APK próprio) — fica como decisão técnica em aberto.

## Dependencies

- Feature 2 depende de uma decisão de mecanismo de distribuição/atualização
  do Android (ver Open Questions) antes de poder ser implementada
  tecnicamente.
- Feature 3 depende de existir algum identificador estável de
  dispositivo/biblioteca para comparar "mudou vs não mudou" — hoje não há
  fingerprint de dispositivo em nenhuma das duas plataformas
  (`DeviceInfo` em `src/types/opl.ts` não tem serial/MAC; mobile também
  não).

## Open questions

- Qual o mecanismo concreto de distribuição/atualização do Android (Google
  Play In-App Updates API, APK auto-hospedado com endpoint próprio, ou
  outro)? Não especificado pelo usuário — `UNRESOLVED`.
- Qual critério define "biblioteca mudou" (novo device id/path, novo
  serial/MAC, hash do conteúdo da biblioteca, ou combinação)? Não há
  fingerprint de dispositivo hoje no código — `UNRESOLVED`.
- As traduções serão fornecidas por um serviço de tradução automática, por
  tradutores humanos, ou geradas assistidamente e revisadas depois? Não
  especificado — `UNRESOLVED`.

## Source traceability

| Requirement                                                                                  | Source                                                                      | Classification           |
| -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------ |
| i18n em 7 idiomas (pt-BR, en, es, de, ru, zh, ja)                                            | Pedido do usuário                                                           | EXPLICIT                 |
| Seleção de idioma no primeiro launch ou em Configurações                                     | Pedido do usuário                                                           | EXPLICIT                 |
| Verificação de nova versão ao abrir no Android                                               | Pedido do usuário                                                           | EXPLICIT                 |
| Opção de atualização em Configurações (Android)                                              | Pedido do usuário                                                           | EXPLICIT                 |
| Popup de carregamento ao trocar de dispositivo/biblioteca                                    | Pedido do usuário                                                           | EXPLICIT                 |
| Loading na splash screen                                                                     | Pedido do usuário                                                           | EXPLICIT                 |
| Idioma default = idioma do SO quando suportado                                               | Inferência de UX comum                                                      | INFERRED                 |
| Troca de idioma aplica sem reiniciar o app                                                   | Inferência de UX comum                                                      | INFERRED                 |
| Fallback para pt-BR quando falta chave de tradução                                           | Inferência de robustez                                                      | INFERRED                 |
| Desktop já tem `electron-updater`/`UpdateDialog`                                             | `electron/services/updates/update.service.ts`, `src/pages/SettingsPage.tsx` | DISCOVERED_FROM_CODEBASE |
| Mobile não tem tela de Configurações própria (placeholder aponta para LibrarySelectScreen)   | `mobile/src/navigation/RootNavigator.tsx:91`                                | DISCOVERED_FROM_CODEBASE |
| Mobile já tem fluxo de `revalidate()`/`selectLibrary()` sem detecção de troca de dispositivo | `mobile/src/stores/library-store.ts`, `mobile/src/app/bootstrap.ts`         | DISCOVERED_FROM_CODEBASE |
| Splash screen só existe no mobile hoje, sem indicador de progresso                           | `mobile/src/app/App.tsx` (`SplashOverlay`, `MIN_SPLASH_MS`)                 | DISCOVERED_FROM_CODEBASE |
| Nenhum fingerprint de dispositivo existe hoje (`DeviceInfo` sem serial/MAC)                  | `src/types/opl.ts:668-678`, `src/stores/device-store.ts`                    | DISCOVERED_FROM_CODEBASE |
| Mecanismo de update Android não definido                                                     | Não informado pelo usuário                                                  | UNRESOLVED               |
| Critério de "biblioteca mudou" não definido                                                  | Não informado pelo usuário                                                  | UNRESOLVED               |
| Fonte das traduções (automática/humana) não definida                                         | Não informado pelo usuário                                                  | UNRESOLVED               |
