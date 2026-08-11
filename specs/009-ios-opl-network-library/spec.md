# Feature Specification: iOS OPL Network Library

**Feature Branch**: `009-ios-opl-network-library`

**Created**: 2026-08-10

**Status**: Draft

**Input**: User description: "Portar o app mobile OPL Forge (mobile/, specs 006-008) de Android-only para também suportar iOS, com paridade funcional completa — não um scaffold vazio. Todas as 7 TurboModules nativas hoje só têm implementação em Kotlin; este port precisa reimplementá-las em Swift com paridade funcional real, adaptando os dois pontos onde o modelo do iOS diverge estruturalmente do Android: acesso a armazenamento (SAF → UIDocumentPickerViewController + security-scoped bookmarks) e compartilhamento SMB em background (Foreground Service → sem equivalente direto no iOS). Todas as outras funcionalidades (specs 006-008) devem ter paridade de comportamento, testável em iPhone físico contra uma PS2 real."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Selecionar a Biblioteca e Compartilhar com a PS2 no iOS (Priority: P1)

Um usuário com iPhone escolhe, através do seletor de documentos do iOS, a pasta que representa sua biblioteca OPL (armazenada no app Arquivos, iCloud Drive, ou outro provedor de arquivos), concede acesso persistente a ela, e compartilha essa biblioteca com a PS2 pela rede local usando o mesmo protocolo SMB1 já usado pela versão Android — mantendo o app em primeiro plano durante o compartilhamento.

**Why this priority**: Sem esta jornada, o app iOS não tem razão de existir — é o caminho crítico que já valida a maior divergência de plataforma (armazenamento) e o maior risco técnico (servidor SMB em iOS).

**Independent Test**: Pode ser testado de ponta a ponta escolhendo uma pasta de teste no seletor de documentos, iniciando o compartilhamento, e conectando uma PS2 real via OPL ao endereço/porta exibidos — a PS2 deve listar e conseguir ler os arquivos da pasta escolhida.

**Acceptance Scenarios**:

1. **Given** o app é aberto pela primeira vez no iOS, **When** o usuário toca em "Selecionar biblioteca", **Then** o seletor de documentos nativo do iOS abre em modo de escolha de pasta e, após a escolha, o app guarda acesso persistente a essa pasta entre reinícios do app.
2. **Given** uma biblioteca já selecionada e catalogada, **When** o usuário informa usuário/senha, confirma o acesso de escrita, e inicia o compartilhamento, **Then** um servidor SMB1 local sobe e anuncia endereço IP e porta na tela, e uma PS2 real na mesma rede consegue autenticar e navegar as pastas DVD/CD/PS1/APPS.
3. **Given** o compartilhamento está ativo e o app vai para segundo plano ou a tela é bloqueada, **When** o iOS suspende o processo do app, **Then** o app comunica claramente ao usuário (antes de sair da tela de compartilhamento, e ao reabrir o app) que o compartilhamento parou e precisa ser reiniciado — nunca falha silenciosamente deixando o usuário achar que a PS2 ainda está conectada.

---

### User Story 2 - Catalogar, Diagnosticar e Preparar o Dispositivo (Priority: P2)

O usuário cataloga a biblioteca escolhida (contagem de jogos por tipo, detecção de arte de capa), roda um diagnóstico que verifica as 7 pastas obrigatórias do OPL e o espaço livre, e usa a opção de preparar o dispositivo para criar automaticamente qualquer pasta obrigatória que esteja faltando.

**Why this priority**: É o que torna a biblioteca "pronta para a PS2" antes mesmo de compartilhar — mas depende da User Story 1 já existir (seleção de biblioteca) para ter uma pasta para catalogar.

**Independent Test**: Pode ser testado apontando o app para uma pasta com estrutura incompleta (faltando CFG e VMC, por exemplo), rodando o diagnóstico, confirmando que as pastas faltantes aparecem listadas, tocando em "Preparar dispositivo", e verificando que as pastas foram criadas de fato no Arquivos/iCloud Drive.

**Acceptance Scenarios**:

1. **Given** uma biblioteca selecionada com jogos nas pastas DVD/CD/PS1/APPS, **When** o usuário roda a catalogação, **Then** o app mostra a contagem correta de jogos por tipo e detecta a arte de capa presente (convenção `<ID>_COV[2].png`).
2. **Given** uma biblioteca faltando uma ou mais das 7 pastas obrigatórias do OPL, **When** o usuário roda o diagnóstico, **Then** o app lista exatamente quais pastas estão faltando e classifica a prontidão geral (pronta / pronta com avisos / requer reorganização / não pronta).
3. **Given** um diagnóstico apontando pastas faltantes, **When** o usuário toca em "Preparar dispositivo", **Then** todas as pastas obrigatórias faltantes são criadas na pasta raiz da biblioteca e um novo diagnóstico automático confirma a estrutura completa.

---

### User Story 3 - Descobrir e Baixar Jogos do Catálogo Essentials (Priority: P3)

O usuário navega o catálogo Essentials (listagem pré-configurada do Internet Archive, com arte de capa via libretro-thumbnails, pontuação por tier e verificação de disponibilidade), seleciona jogos individualmente ou usa o assistente de preenchimento inteligente (Smart Fill) para preencher automaticamente o espaço livre do dispositivo, confirma o aviso legal por item, e acompanha o progresso na fila de transferências.

**Why this priority**: Valor real de descoberta de conteúdo, mas o app já é útil sem isso (usuário pode importar jogos que já possui) — por isso prioridade menor que as jornadas de infraestrutura básica.

**Independent Test**: Pode ser testado navegando o catálogo, selecionando 1-2 itens pequenos, confirmando o aviso legal, e verificando que o download aparece na fila de transferências e conclui salvando o arquivo na pasta correta da biblioteca.

**Acceptance Scenarios**:

1. **Given** o catálogo Essentials carregado, **When** o usuário busca ou filtra por tier de pontuação, **Then** a lista filtra corretamente e mostra a arte de capa quando disponível.
2. **Given** um dispositivo com espaço livre conhecido, **When** o usuário abre o assistente Smart Fill, escolhe um limite de espaço dentro do disponível e um modo (melhor avaliados ou aleatório), **Then** o app apresenta um plano de jogos selecionados que cabem no espaço escolhido, sem exceder o espaço livre real do dispositivo.
3. **Given** um ou mais itens selecionados, **When** o usuário confirma o aviso legal e inicia o download, **Then** o(s) item(ns) aparece(m) na fila de transferências com progresso visível, e ao concluir o arquivo está na pasta correta (DVD/CD/PS1/APPS conforme o tipo) da biblioteca escolhida.

---

### Edge Cases

- O que acontece quando o usuário revoga o acesso à pasta escolhida (ex.: move ou exclui a pasta pelo app Arquivos) enquanto a biblioteca está selecionada no app? O app deve detectar a perda de acesso e orientar a selecionar novamente, sem travar ou mostrar dados desatualizados como se ainda fossem válidos.
- O que acontece se o usuário tentar iniciar o compartilhamento enquanto o app está prestes a ser suspenso pelo iOS (ex.: bateria fraca acionando modo de economia agressivo)? O app deve deixar claro que o compartilhamento depende do app permanecer em primeiro plano.
- O que acontece quando a pasta escolhida está no iCloud Drive e o arquivo de um jogo ainda não foi baixado localmente (arquivo "on-demand" do iCloud)? A leitura pela PS2 não deve travar indefinidamente nem corromper a transferência — o app deve tratar isso como um estado tratável (baixar sob demanda antes de servir, ou reportar erro claro).
- O que acontece se dois processos tentarem escrever no mesmo arquivo simultaneamente (a PS2 escrevendo via SMB e o app baixando um item do Essentials para o mesmo caminho)? O mesmo mecanismo de trava de escrita único por dispositivo já usado no Android/desktop se aplica.
- O que acontece se a rede Wi-Fi do iPhone não permitir tráfego local (ex.: isolamento de cliente no roteador, ou o usuário nunca concedeu a permissão de Rede Local do iOS)? O app deve identificar essa falha e orientar o usuário a verificar a permissão de Rede Local do iOS e as configurações do roteador, em vez de mostrar um erro genérico.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: O app iOS MUST permitir ao usuário escolher, via seletor de documentos nativo do iOS, uma pasta para servir como biblioteca OPL, e persistir acesso a ela entre reinícios do app.
- **FR-002**: O app iOS MUST revalidar o acesso à biblioteca escolhida ao abrir o app, e distinguir claramente entre "biblioteca válida" e "acesso perdido" (mesma semântica do Android).
- **FR-003**: O app iOS MUST catalogar a biblioteca escolhida, contando jogos por tipo (DVD/CD/PS1/Apps) e detectando arte de capa presente na convenção `<GAMEID>_COV[2].png`.
- **FR-004**: O app iOS MUST expor um diagnóstico de dispositivo que verifica a presença das 7 pastas obrigatórias do OPL (DVD, CD, PS1, APPS, ART, CFG, VMC), o espaço livre, e classifica a prontidão geral da biblioteca.
- **FR-005**: O app iOS MUST oferecer uma ação de "preparar dispositivo" que cria automaticamente qualquer pasta obrigatória do OPL que esteja faltando na biblioteca escolhida.
- **FR-006**: O app iOS MUST implementar um servidor SMB1 local compatível com o cliente de rede do OPL (mesmo subconjunto de comandos já suportado no Android: NEGOTIATE, SESSION_SETUP_ANDX, TREE_CONNECT_ANDX, ECHO, NT_CREATE_ANDX, OPEN_ANDX, READ_ANDX, WRITE_ANDX, CLOSE, TRANSACTION2/FIND_FIRST2, CHECK_DIRECTORY), com autenticação NTLMv1 em nível de compartilhamento (senha real enviada em TREE_CONNECT_ANDX, não em SESSION_SETUP_ANDX).
- **FR-007**: O app iOS MUST exigir confirmação explícita de usuário/senha e do aviso de acesso de escrita antes de iniciar o compartilhamento, com o nome do compartilhamento definível pelo usuário (padrão "oplforge") — mesma semântica do Android.
- **FR-008**: O app iOS MUST comunicar de forma clara e imediata quando o compartilhamento é interrompido por suspensão do app pelo iOS, tanto na própria tela de compartilhamento quanto ao reabrir o app — nunca deixar a UI mostrar "conectado" quando o servidor não está mais respondendo.
- **FR-009**: O app iOS MUST oferecer o catálogo Essentials (listagem do Internet Archive, pontuação por tier, verificação de disponibilidade, arte de capa via libretro-thumbnails) com busca e filtro por tier, com paridade de comportamento com o Android.
- **FR-010**: O app iOS MUST oferecer o assistente Smart Fill (leitura do espaço livre real do dispositivo escolhido, escolha de um limite dentro desse espaço, e escolha entre modo "melhor avaliados" e modo "aleatório") antes de gerar um plano de download.
- **FR-011**: O app iOS MUST exigir confirmação legal explícita por item (ou por lote, ao usar Smart Fill) antes de iniciar qualquer download do catálogo Essentials — mesmo texto de confirmação já usado no Android.
- **FR-012**: O app iOS MUST manter uma fila de transferências durável (sobrevive a fechar e reabrir o app) para downloads do Essentials e importações locais, com progresso visível, cancelamento e nova tentativa por item.
- **FR-013**: O app iOS MUST impedir duas escritas simultâneas no mesmo arquivo da biblioteca (ex.: PS2 escrevendo via SMB e um download do Essentials terminando ao mesmo tempo) através de um mecanismo de trava único por dispositivo.
- **FR-014**: O app iOS MUST oferecer a funcionalidade de Art Sync (baixar arte de capa faltante para jogos já catalogados) com paridade de comportamento com o Android.
- **FR-015**: O app iOS MUST oferecer o tutorial de conexão (passo a passo de configuração de rede SMB na PS2) com os dados reais da sessão de compartilhamento ativa.
- **FR-016**: O app iOS MUST tratar arquivos "on-demand" do iCloud Drive (ainda não baixados localmente) de forma que a leitura pela PS2 nunca trave indefinidamente nem sirva dados corrompidos/parciais.
- **FR-017**: O app iOS MUST solicitar e usar a permissão de Rede Local do iOS (necessária para o servidor SMB ser alcançável na LAN) e orientar o usuário de forma clara quando essa permissão for negada.

### Key Entities

- **Biblioteca OPL (iOS)**: pasta escolhida pelo usuário via seletor de documentos, referenciada por um bookmark de segurança persistente (não por um caminho de arquivo fixo) — substitui o conceito de "origem" (armazenamento interno / cartão SD / USB-OTG) do Android, já que no iOS a única origem real é "uma pasta escolhida pelo usuário", que pode fisicamente estar no armazenamento local do iPhone, no iCloud Drive, ou em um provedor de arquivos de terceiros.
- **Sessão de Compartilhamento**: estado do servidor SMB1 local (desligado / iniciando / ativo aguardando conexão / PS2 conectado), com a mesma máquina de estados do Android, mas com um estado adicional implícito de "suspenso pelo sistema" que precisa ser comunicado ativamente ao usuário, já que o iOS pode encerrar o processo sem aviso do app.
- **Diagnóstico do Dispositivo**: relatório de prontidão da biblioteca (pastas obrigatórias presentes/faltantes, espaço livre, classificação geral) — idêntico em estrutura ao Android.
- **Item do Catálogo Essentials**: um jogo listado do Internet Archive com pontuação por tier, tamanho, disponibilidade e arte de capa — idêntico em estrutura ao Android.
- **Item da Fila de Transferências**: um download ou importação em andamento/concluído/falho, com progresso e caminho de destino na biblioteca — idêntico em estrutura ao Android.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Um usuário consegue escolher uma pasta de biblioteca e ver a catalogação completa (contagem por tipo) em menos de 30 segundos para uma biblioteca de até 50 jogos.
- **SC-002**: Uma PS2 real, na mesma rede local que um iPhone rodando o app com o compartilhamento ativo, consegue autenticar, listar as pastas da biblioteca e abrir/ler um jogo com sucesso em pelo menos 95% das tentativas de conexão, com o app em primeiro plano.
- **SC-003**: Um diagnóstico de dispositivo aponta corretamente 100% das pastas obrigatórias do OPL faltantes, e a ação "preparar dispositivo" resolve 100% dessas pendências em uma única execução.
- **SC-004**: O usuário nunca vê a tela de compartilhamento mostrando "PS2 conectado" ou "aguardando conexão" por mais de alguns segundos depois que o app foi de fato suspenso pelo iOS — a UI reflete a interrupção de forma perceptível.
- **SC-005**: Um plano gerado pelo Smart Fill nunca excede o espaço livre real do dispositivo escolhido.
- **SC-006**: Todo download do catálogo Essentials iniciado sem confirmação do aviso legal é bloqueado — taxa de bloqueio de 100%.
- **SC-007**: As sete funcionalidades principais (seleção de biblioteca, catalogação, diagnóstico/preparação, compartilhamento SMB, catálogo Essentials, Smart Fill, fila de transferências) são verificadas funcionando em um iPhone físico contra uma PS2 real, não apenas em simulador ou por inspeção de código.

## Assumptions

- A única origem de "biblioteca" suportada no iOS é uma pasta escolhida pelo usuário via seletor de documentos nativo (`UIDocumentPickerViewController`, modo de abrir/escolher pasta) com acesso persistido por security-scoped bookmark — não há equivalente iOS a "cartão SD" ou "armazenamento USB-OTG" como origens distintas selecionáveis da mesma forma que no Android; se o usuário quiser um pen drive, ele aparece como um provedor dentro do mesmo seletor de documentos, não como uma opção de origem separada na UI.
- O compartilhamento SMB com a PS2 exige que o app permaneça em primeiro plano (tela ligada, app não minimizado) durante toda a sessão — o iOS não oferece um equivalente direto e confiável ao Foreground Service do Android para manter um servidor de rede vivo indefinidamente em segundo plano. Isso é uma limitação de plataforma assumida deliberadamente, não um defeito a ser "corrigido" depois — a experiência do usuário é ajustada (avisos claros) em vez de prometida como idêntica ao Android.
- A UI em React Native (telas, navegação, stores de estado, design system) já é multiplataforma e é reaproveitada sem alterações — apenas a camada nativa (as 7 TurboModules) precisa de uma implementação Swift equivalente à Kotlin existente.
- O mesmo subconjunto do protocolo SMB1 já validado contra um cliente OPL real no Android (specs 006-008, incluindo os comandos ECHO e OPEN_ANDX adicionados para corrigir erros reais de conexão) é suficiente para o iOS — não há necessidade de suportar comandos SMB adicionais além dos já mapeados.
- O Gerenciador de Componentes permanece fora de escopo (já registrado como não-funcional/aspiracional mesmo no desktop, per spec 006) e não deve ser portado para iOS.
- A verificação funcional deste port segue o mesmo padrão de rigor já usado nas specs 006-008: testes ao vivo em hardware real (iPhone físico + PS2 real), não apenas revisão de código ou testes em simulador.
