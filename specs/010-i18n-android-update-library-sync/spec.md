# Feature Specification: Internacionalizacao, Atualizacao Android e Sincronizacao de Biblioteca

**Feature Branch**: `010-i18n-android-update-library-sync` (trunk-based — nenhuma branch dedicada criada; trabalho segue em `master`)

**Created**: 2026-08-12

**Status**: Draft

**Input**: User description: "Aproveitando agora, vamos internacionalizar o app, vamos traduzir todos os elementos visuais e textuais do app android e desktop, vamos propor aqui o idioma ptbr, ingles, espanhol, alemao, russo, mandarin, japones a principio, o setup deve ter a opcao do idioma e ele deve ser configuravel no primeiro launch ou em configuracoes, quero essa feature implementada como um todo. Outro ponto de evolucao do app, quando abrir no android, verificar se existe uma nova versao disponivel e ter a opcao de atualizacao em configuracoes. E adicione tambem um mecanismo de reconhecimento de mudanca de biblioteca, quando eu trocar o dispositivo ele subir um popup carregando a biblioteca pra nao ter carregamento tardio e iludir o usuario, e coloque um loading na spash screen do app." (ver `.spec-master/context/input-i18n-update-library-sync.md`)

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Escolher idioma no primeiro uso (Priority: P1)

Um usuario abre o app OPL Forge (desktop ou Android) pela primeira vez e
escolhe seu idioma preferido entre 7 opcoes (Portugues do Brasil, Ingles,
Espanhol, Alemao, Russo, Mandarim, Japones) antes de comecar a usar o app.

**Why this priority**: Sem isso, usuarios que nao leem portugues nao
conseguem usar o app de forma inteligivel — e o requisito central desta
feature.

**Independent Test**: Instalar o app pela primeira vez, verificar que a
tela de selecao de idioma aparece, escolher um idioma diferente de pt-BR,
e confirmar que todas as telas subsequentes do setup e da UI principal
aparecem traduzidas nesse idioma.

**Acceptance Scenarios**:

1. **Given** um usuario abrindo o app pela primeira vez, **When** o app
   detecta que nenhum idioma foi configurado ainda, **Then** o app
   apresenta uma tela de selecao entre os 7 idiomas suportados, com um
   idioma pre-selecionado com base no idioma do sistema operacional quando
   suportado (ou pt-BR quando o idioma do SO nao estiver entre os 7).
2. **Given** o usuario selecionou um idioma no primeiro launch, **When** o
   setup continua, **Then** todas as telas de setup e a UI principal do
   app aparecem no idioma escolhido, sem textos remanescentes em outro
   idioma.

---

### User Story 2 - Trocar idioma em Configuracoes (Priority: P1)

Um usuario que ja usa o app quer mudar o idioma da interface a qualquer
momento, acessando Configuracoes.

**Why this priority**: Usuarios podem ter escolhido o idioma errado no
primeiro launch, ou querer trocar depois — sem essa opcao persistente a
feature de i18n fica incompleta.

**Independent Test**: Com o app ja em uso, abrir Configuracoes, trocar o
idioma, e verificar que a UI aberta reflete a mudanca imediatamente, sem
reiniciar o app; fechar e reabrir o app confirma que o idioma escolhido
persiste.

**Acceptance Scenarios**:

1. **Given** o usuario esta em Configuracoes, **When** ele seleciona um
   idioma diferente do atual, **Then** toda a UI visivel (incluindo a
   propria tela de Configuracoes) e atualizada para o novo idioma sem
   necessidade de reiniciar o app.
2. **Given** o usuario trocou o idioma e fechou o app, **When** ele reabre
   o app, **Then** o idioma escolhido anteriormente continua ativo.
3. **Given** uma tela contem uma chave de texto sem traducao disponivel no
   idioma selecionado, **When** essa tela e renderizada, **Then** o app
   exibe o texto em pt-BR como fallback, sem mostrar a chave crua ou
   quebrar a tela.

---

### User Story 3 - Verificar e aplicar atualizacao no Android (Priority: P2)

Um usuario Android abre o app e, se houver uma versao mais nova
disponivel, consegue saber disso e iniciar a atualizacao a partir de
Configuracoes.

**Why this priority**: Traz o Android para paridade com o desktop (que ja
tem esse fluxo via `electron-updater`), reduzindo o risco de usuarios
Android ficarem presos em versoes desatualizadas.

**Independent Test**: Com uma versao mais nova publicada, abrir o app
Android e verificar que Configuracoes mostra a informacao de atualizacao
disponivel e permite iniciar a atualizacao; com o app ja na versao mais
recente, confirmar que nenhuma acao de update e oferecida.

**Acceptance Scenarios**:

1. **Given** o usuario abre o app Android e existe uma versao mais nova
   disponivel, **When** a checagem de versao em background termina,
   **Then** Configuracoes exibe a indicacao de atualizacao disponivel e
   uma acao para iniciar a atualizacao.
2. **Given** o usuario abre o app Android e ja esta na versao mais
   recente, **When** a checagem termina, **Then** nenhuma acao de update
   e oferecida em Configuracoes.
3. **Given** o dispositivo esta sem conectividade ou a checagem falha,
   **When** o app abre, **Then** o app funciona normalmente e a falha na
   checagem nao bloqueia nem trava o uso do app.

---

### User Story 4 - Ser avisado ao trocar de dispositivo/biblioteca (Priority: P2)

Um usuario troca o dispositivo/fonte de onde sua biblioteca de jogos PS2 e
lida (ex.: conecta um PS2/dispositivo diferente do usado na sessao
anterior) e, em vez de ver uma biblioteca vazia por alguns instantes, ve
um popup indicando que a biblioteca esta sendo carregada.

**Why this priority**: Evita que o usuario interprete o carregamento
normal como perda de dados ou bug — um problema direto de confianca no
produto.

**Independent Test**: Com uma biblioteca ja carregada de um dispositivo A,
trocar para um dispositivo/fonte B; verificar que um popup de carregamento
aparece antes da lista de jogos do dispositivo B, e que reabrir o app com
o mesmo dispositivo anterior nao aciona esse popup desnecessariamente.

**Acceptance Scenarios**:

1. **Given** o app tem uma biblioteca carregada de um dispositivo/fonte
   conhecido, **When** o usuario troca para um dispositivo/fonte
   diferente, **Then** o app exibe um popup informando que a biblioteca
   esta sendo carregada, em vez de mostrar a lista de jogos vazia.
2. **Given** o popup de carregamento esta visivel, **When** o carregamento
   da nova biblioteca termina com sucesso, **Then** o popup e substituido
   pelo conteudo real da biblioteca.
3. **Given** o popup de carregamento esta visivel, **When** o carregamento
   falha (ex.: erro de rede ou dispositivo), **Then** o popup e
   substituido por uma mensagem de erro clara, nao por uma tela vazia
   silenciosa.
4. **Given** o usuario reabre o app com o mesmo dispositivo/fonte da
   sessao anterior, **When** o app inicializa, **Then** o popup de "troca
   de biblioteca" nao aparece (apenas o loading normal de inicializacao).

---

### User Story 5 - Ver progresso na splash screen (Priority: P3)

Um usuario abrindo o app ve um indicador visual de loading na splash
screen, em vez de uma tela estatica sem feedback do que esta acontecendo.

**Why this priority**: Melhoria de percepcao/confianca durante a
inicializacao; menor impacto que as historias anteriores, mas parte
explicita do pedido original.

**Independent Test**: Abrir o app do zero (cold start) e observar que a
splash screen exibe um indicador de loading visivel durante o tempo de
inicializacao real, ate a UI principal aparecer.

**Acceptance Scenarios**:

1. **Given** o app esta inicializando (cold start), **When** a splash
   screen esta visivel, **Then** um indicador visual de loading e exibido
   durante todo o tempo de inicializacao.

---

### Edge Cases

- O que acontece se o usuario trocar o idioma do sistema operacional
  enquanto o app ja tem um idioma explicitamente configurado? O app deve
  continuar usando o idioma escolhido pelo usuario, nao o do SO (a escolha
  explicita do usuario tem prioridade sobre a deteccao automatica, que so
  vale como sugestao inicial no primeiro launch).
- O que acontece se a checagem de atualizacao do Android retornar uma
  versao mais nova, mas o usuario ignorar a notificacao em Configuracoes?
  O app nao deve forcar a atualizacao nem bloquear o uso — a acao
  permanece disponivel em Configuracoes ate o usuario agir.
- O que acontece se o popup de troca de biblioteca ficar visivel por muito
  tempo (carregamento lento)? O popup deve continuar informando que o
  carregamento esta em andamento, sem timeout artificial que force o
  fechamento antes do carregamento real terminar ou falhar.
- O que acontece se o dispositivo/fonte "mudar e voltar" na mesma sessao
  (ex.: reconexao instavel)? Como a deteccao compara id/path (FR-017), uma
  reconexao ao mesmo id/path nao deve reacionar o popup; se o id/path
  mudar e voltar ao original, cada mudanca de id/path e tratada como uma
  troca independente.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: O app (desktop e Android) MUST oferecer selecao de idioma
  entre 7 opcoes: Portugues do Brasil (padrao), Ingles, Espanhol, Alemao,
  Russo, Mandarim e Japones.
- **FR-002**: O app MUST apresentar a selecao de idioma no primeiro launch
  (antes ou durante o setup inicial), com um idioma pre-selecionado a
  partir do idioma do sistema operacional quando suportado, caindo para
  pt-BR quando o idioma do SO nao estiver entre os 7 suportados.
- **FR-003**: O app MUST permitir trocar o idioma a qualquer momento a
  partir de Configuracoes, em desktop e Android.
- **FR-004**: O app MUST aplicar a troca de idioma imediatamente em toda a
  UI visivel, sem exigir reinicio do app.
- **FR-005**: O app MUST persistir a preferencia de idioma localmente e
  recupera-la em aberturas subsequentes.
- **FR-006**: Todo texto visivel ao usuario nas telas cobertas por esta
  feature (paginas, componentes, mensagens de erro, toasts, labels,
  tooltips, disclaimers) MUST vir de um catalogo de traducao por idioma,
  nao de strings literais fixas no codigo.
- **FR-007**: Quando uma chave de traducao nao existir no idioma
  selecionado, o app MUST usar pt-BR como fallback, sem exibir a chave
  crua nem quebrar a renderizacao.
- **FR-008**: O app Android MUST verificar automaticamente, ao ser
  aberto, se existe uma versao mais nova disponivel.
- **FR-009**: O app Android MUST exibir em Configuracoes uma indicacao de
  atualizacao disponivel e uma acao para o usuario iniciar a atualizacao,
  quando aplicavel.
- **FR-010**: Falha na checagem de atualizacao (ex.: sem conectividade)
  MUST NOT bloquear a abertura ou o uso normal do app Android.
- **FR-011**: O app MUST detectar quando o dispositivo/fonte da
  biblioteca ativa mudou em relacao a ultima sessao/estado conhecido.
- **FR-012**: Ao detectar troca de dispositivo/biblioteca, o app MUST
  exibir um popup de carregamento em vez de uma tela de biblioteca vazia,
  ate o carregamento terminar (sucesso ou erro).
- **FR-013**: Quando o dispositivo/biblioteca ativa nao mudou desde a
  ultima sessao conhecida, o app MUST NOT exibir o popup de troca de
  biblioteca desnecessariamente.
- **FR-014**: A splash screen do app MUST exibir um indicador visual de
  loading durante a inicializacao (cold start).
- **FR-015**: O app MUST auto-detectar o idioma do sistema operacional
  como sugestao inicial apenas no primeiro launch; apos o usuario definir
  um idioma explicitamente, o app MUST respeitar essa escolha independente
  de mudancas futuras no idioma do SO.
- **FR-016**: O app Android MUST verificar disponibilidade de atualizacao
  consultando um endpoint/feed de versao proprio (reaproveitando a mesma
  fonte de releases ja usada pelo desktop, ex.: GitHub Releases), e nao a
  Google Play In-App Updates API — decisao do usuario em `/speckit-clarify`
  (2026-08-12), pois o app nao esta necessariamente distribuido via Play
  Store hoje.
- **FR-017**: O app MUST detectar troca de dispositivo/biblioteca
  comparando o identificador/path da fonte de biblioteca ativa com o da
  sessao anterior conhecida (sem depender de serial/MAC do dispositivo
  fisico) — decisao do usuario em `/speckit-clarify` (2026-08-12). Uma
  mudanca no id/path da fonte MUST disparar o popup de carregamento
  (FR-012); o mesmo id/path entre sessoes MUST NOT disparar o popup.

### Key Entities

- **Idioma selecionado**: preferencia de idioma do usuario, um dos 7
  suportados; persistida localmente; usada para resolver qual catalogo de
  traducao carregar.
- **Catalogo de traducao**: conjunto de pares chave-texto por idioma,
  cobrindo todas as strings visiveis do app; um catalogo por idioma
  suportado, com pt-BR como fallback universal.
- **Estado de atualizacao (Android)**: informacao sobre se ha uma versao
  mais nova disponivel, incluindo se a checagem falhou ou nao foi
  concluida.
- **Identidade de dispositivo/biblioteca**: id/path da fonte de biblioteca
  ativa, comparado entre a sessao atual e a ultima sessao conhecida para
  disparar o popup de carregamento quando diferente (FR-017).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% das telas cobertas por esta feature (setup, telas
  principais, Configuracoes, mensagens de erro visiveis ao usuario) sao
  exibidas corretamente nos 7 idiomas suportados, sem texto hardcoded
  remanescente em pt-BR quando outro idioma esta ativo.
- **SC-002**: Usuarios conseguem trocar de idioma em Configuracoes e ver a
  UI atualizada em menos de 1 segundo, sem reiniciar o app.
- **SC-003**: 100% dos usuarios Android que abrem o app com uma versao
  desatualizada veem a indicacao de atualizacao disponivel em
  Configuracoes na mesma sessao de abertura (quando a checagem tem
  sucesso).
- **SC-004**: Usuarios nunca veem uma tela de biblioteca vazia entre a
  detecção de uma mudanca de id/path da fonte de biblioteca e o fim do
  carregamento (sucesso ou erro); o popup de carregamento cobre 100% desse
  intervalo em todos os casos de troca detectada.
- **SC-005**: 100% das aberturas do app (cold start) exibem um indicador
  visual de loading na splash screen ate a UI principal estar pronta.

## Assumptions

- Assume-se que "elementos visuais" mencionados pelo usuario se referem a
  textos embutidos em imagens/icones quando existirem, e a formatacao de
  data/hora/numero por idioma; nao inclui redesenho visual da UI (INFERRED).
- Assume-se que o publico do app inclui usuarios internacionais que hoje
  nao conseguem usar o app por causa do idioma unico pt-BR (INFERRED a
  partir do pedido de 7 idiomas).
- Assume-se que a checagem de atualizacao do Android roda em background e
  nao exige interacao do usuario para ser iniciada (INFERRED, por analogia
  ao padrao ja existente no desktop via `electron-updater`).
- Assume-se que o mecanismo de deteccao de "biblioteca mudou" pode
  reaproveitar o fluxo de bootstrap/revalidacao ja existente no mobile
  (`mobile/src/stores/library-store.ts`, `mobile/src/app/bootstrap.ts`)
  como ponto de integracao, mas a logica de comparacao "mudou vs nao
  mudou" ainda precisa ser definida (ver Q2) (DISCOVERED_FROM_CODEBASE +
  INFERRED).
- Assume-se que a fonte de conteudo das traducoes (traducao automatica,
  humana, ou assistida com revisao) sera decidida operacionalmente durante
  a implementacao, sem impacto na especificacao funcional em si — os
  requisitos funcionais (FR-001 a FR-007) nao dependem de como o conteudo
  traduzido e produzido, apenas de que ele exista e seja usado
  corretamente pelo app (INFERRED — nao bloqueante para `plan`, ao
  contrario de Q1/Q2 que sao decisoes tecnicas/arquiteturais).
- Suporte a iOS esta fora do escopo desta feature (nao mencionado pelo
  usuario nesta solicitacao; specs de iOS existentes no repo, ex.
  `009-ios-opl-network-library`, nao sao afetadas) (INFERRED).
- Verificacao/atualizacao de versao no desktop nao faz parte desta
  feature, pois ja existe e funciona via `electron-updater` (EXPLICIT —
  non-goal declarado pelo usuario/contexto).
