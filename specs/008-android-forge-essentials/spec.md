# Feature Specification: Funcionalidades-Chave do Forge no Android

**Feature Branch**: `008-android-forge-essentials`

**Created**: 2026-08-09

**Status**: Draft

**Input**: User description: "Expandir o app Android (spec 006) com as funcionalidades-chave do OPL Forge que hoje só existem no app desktop (specs 001-005): catálogo Essentials (descobrir e instalar jogos do Internet Archive), adicionar jogos por importação local, diagnóstico do dispositivo/biblioteca, e uma fila de transferências/downloads durável. O Gerenciador de Componentes fica explicitamente fora de escopo (nem o desktop tem uma versão funcional dele). Tudo adaptado ao modelo de armazenamento do Android (SAF sobre a biblioteca já selecionada em spec 006), estendendo o app existente, não substituindo-o."

## Contexto

O app desktop (Electron, specs 001–005) gerencia uma biblioteca OPL conectada via USB ao computador, com um conjunto de funcionalidades que o app Android (spec 006) ainda não tem: descobrir e baixar jogos de um catálogo remoto, importar arquivos locais para a biblioteca, diagnosticar a prontidão da biblioteca, e gerenciar downloads de forma durável. O app Android atual só sabe selecionar uma pasta (SAF), catalogar o que já existe nela (leitura), e compartilhá-la com o PS2 via SMB — ele não tem nenhuma forma de **colocar** jogos novos na biblioteca a partir do próprio celular, nem uma verificação formal de "essa biblioteca está pronta pro PS2 usar".

Esta spec porta as funcionalidades desktop que **realmente têm uma implementação funcional** (confirmado por investigação do código-fonte), reinterpretadas para o modelo de armazenamento do Android:

| Funcionalidade desktop                 | Status no desktop                                 | Porta pro Android?                      |
| -------------------------------------- | ------------------------------------------------- | --------------------------------------- |
| Catálogo Essentials (Internet Archive) | Real, funcional (`essentials-catalog.service.ts`) | Sim — US1                               |
| Adicionar Jogos (importação local)     | Real, funcional (`game-installation.service.ts`)  | Sim — US2                               |
| Diagnóstico do Dispositivo             | Real, funcional (`device-diagnostic.service.ts`)  | Sim — US3                               |
| Fila de Transferências/Downloads       | Real, funcional (`download-store.ts`)             | Sim, como suporte às US1/US2 — US4      |
| Gerenciador de Componentes             | **Mockup sem backend**, mesmo no desktop          | **Não** — explicitamente fora de escopo |

O app Android já selecionado/catalogado (spec 006) continua sendo a base: nenhuma dessas funcionalidades exige gerenciar um dispositivo USB como "bloco" — todas operam sobre a mesma árvore SAF já autorizada pelo usuário em spec 006 (armazenamento interno, cartão SD, ou pen drive via USB-OTG, tratados de forma idêntica pelo SAF).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Descobrir e Instalar do Catálogo Essentials (Priority: P1)

Como usuário do app Android, quero navegar um catálogo de jogos disponíveis para download (a mesma fonte que o desktop usa) e instalar os que eu escolher diretamente na minha biblioteca, sem precisar de um computador.

**Why this priority**: É a funcionalidade que mais diferencia o app de um simples "visualizador" — permite montar uma biblioteca do zero, só com o celular, que é o cenário mais atraente de "biblioteca portátil".

**Independent Test**: Abrir o catálogo, buscar um jogo, confirmar o aviso legal, baixar, e ver o item aparecer na aba Biblioteca depois de recatalogar.

**Acceptance Scenarios**:

1. **Given** uma biblioteca selecionada e válida, **When** o usuário abre o catálogo Essentials, **Then** vê uma lista navegável/buscável de jogos disponíveis com nome, tipo e tamanho.
2. **Given** o catálogo aberto, **When** o usuário seleciona um item para baixar, **Then** o sistema exige uma confirmação legal explícita por item antes de iniciar o download (mesma exigência do desktop).
3. **Given** um download em andamento, **When** o usuário sai da tela ou do app, **Then** o download continua em segundo plano e pode ser retomado se interrompido.
4. **Given** um download concluído, **When** o usuário recataloga a biblioteca, **Then** o novo item aparece na aba Biblioteca no tipo/pasta correta (DVD/CD/PS1/APPS).
5. **Given** espaço livre insuficiente na biblioteca, **When** o usuário tenta baixar um item maior que o espaço disponível, **Then** o sistema bloqueia o download com uma mensagem clara antes de gastar qualquer transferência de rede.
6. **Given** o usuário quer preencher a biblioteca automaticamente, **When** ele define um orçamento de espaço (ex.: "usar até 20GB livres"), **Then** o sistema sugere uma seleção automática de itens ("Smart Fill") que cabe nesse orçamento, sujeita à mesma confirmação legal por item antes de baixar.

---

### User Story 2 - Adicionar Jogos por Importação Local (Priority: P1)

Como usuário do app Android, quero escolher um arquivo de jogo que já tenho no celular (baixado por outro app, transferido de outro lugar) e importá-lo para minha biblioteca, sem precisar de um computador.

**Why this priority**: Cobre o caso de quem já tem os arquivos e só precisa organizá-los na biblioteca — tão fundamental quanto o download, e mais simples de entregar primeiro.

**Independent Test**: Escolher um arquivo `.iso`/`.zso` local via seletor do sistema, importar, e ver o item aparecer na Biblioteca depois de recatalogar.

**Acceptance Scenarios**:

1. **Given** uma biblioteca selecionada e válida, **When** o usuário escolhe "Adicionar jogo" e seleciona um arquivo local via seletor do sistema, **Then** o sistema copia o arquivo para a pasta correta da biblioteca (DVD/CD/PS1/APPS conforme detectado) sem alterar o arquivo original.
2. **Given** uma cópia em andamento, **When** o processo falha no meio (espaço insuficiente, erro de I/O, app fechado), **Then** a biblioteca não fica com um arquivo parcial/corrompido — o sistema reverte a cópia incompleta.
3. **Given** um arquivo maior que o limite do sistema de arquivos de destino, **When** o usuário tenta importá-lo, **Then** o sistema aplica o mesmo particionamento multi-parte que o desktop usa para esse cenário, de forma transparente ao usuário.
4. **Given** um arquivo já importado com o mesmo conteúdo, **When** o usuário tenta importar de novo, **Then** o sistema avisa que o item já existe em vez de duplicar silenciosamente.

---

### User Story 3 - Diagnóstico da Biblioteca (Priority: P2)

Como usuário do app Android, quero uma verificação clara de que minha biblioteca está estruturalmente pronta para o PS2 usar, além do que a catalogação já mostra hoje.

**Why this priority**: Já existe uma catalogação parcial (spec 006); esta US formaliza e completa essa verificação com os mesmos critérios do desktop, mas depende menos de nova infraestrutura que US1/US2.

**Independent Test**: Abrir a tela de Diagnóstico com uma biblioteca faltando uma das pastas obrigatórias e confirmar que o sistema aponta exatamente o que falta.

**Acceptance Scenarios**:

1. **Given** uma biblioteca selecionada, **When** o usuário abre o Diagnóstico, **Then** o sistema verifica a presença das pastas obrigatórias do OPL (DVD, CD, PS1, APPS, ART, CFG, VMC) e informa quais existem e quais faltam.
2. **Given** a verificação de pastas concluída, **When** o diagnóstico continua, **Then** o sistema informa o espaço livre disponível na biblioteca.
3. **Given** todas as verificações concluídas, **When** o usuário vê o resultado, **Then** o sistema classifica a biblioteca em um de três estados gerais (pronta / precisa atenção / não pronta), consistente com os mesmos critérios do desktop.
4. **Given** uma biblioteca com itens sinalizados na catalogação (spec 006, `structuralIssues`), **When** o Diagnóstico roda, **Then** esses itens contam para a classificação geral, sem duplicar a lógica de scan já existente.

---

### User Story 4 - Fila de Transferências Durável (Priority: P2)

Como usuário do app Android, quero ver e controlar downloads/importações em andamento em um único lugar, com garantia de que nada é perdido ou corrompido se eu sair do app.

**Why this priority**: É infraestrutura de suporte às US1/US2 — sem ela, downloads/importações não sobrevivem a um app fechado nem evitam corrupção por escrita concorrente. Prioridade P2 porque só é observável através de US1/US2, mas é bloqueante para ambas terem qualidade de produção.

**Independent Test**: Iniciar um download, forçar o fechamento do app, reabrir, e confirmar que o item aparece na fila com o progresso preservado e retomável.

**Acceptance Scenarios**:

1. **Given** um download ou importação em andamento, **When** o app é fechado (pelo usuário ou pelo sistema) e reaberto, **Then** o item persiste na fila com seu progresso, não reinicia do zero nem desaparece.
2. **Given** uma transferência ativa para um arquivo específico da biblioteca, **When** uma segunda transferência tenta escrever no mesmo arquivo, **Then** o sistema impede as duas escritas simultâneas (enfileira ou rejeita a segunda), nunca corrompendo o arquivo.
3. **Given** uma transferência com falha (rede caiu, espaço acabou), **When** o usuário vê a fila, **Then** o item aparece com um estado de falha claro e uma ação para tentar de novo, não como se tivesse sucesso.
4. **Given** a fila com múltiplos itens, **When** o usuário quer ver o progresso, **Then** o sistema mostra progresso individual por item, sem exigir que o usuário mantenha uma tela específica aberta.

---

### Edge Cases

- O que acontece se a biblioteca ficar com acesso inválido (spec 006 FR-004) enquanto uma transferência está em andamento? → A transferência deve falhar de forma segura (sem corromper o que já foi escrito) e ser marcada como precisa de nova tentativa, não silenciosamente perdida.
- O que acontece se o usuário tentar rodar Diagnóstico sem nenhuma biblioteca selecionada? → Mesmo tratamento que catalogação hoje (spec 006 FR): erro claro orientando a selecionar uma biblioteca primeiro.
- O que acontece se o item do catálogo Essentials não estiver mais disponível na fonte remota (link quebrado)? → O sistema informa isso antes de gastar tempo/dados tentando baixar, mesmo comportamento de verificação de acessibilidade que o desktop já faz.
- O que acontece durante uma importação/download se o compartilhamento SMB (spec 006) estiver ativo ao mesmo tempo, e o PS2 estiver lendo o mesmo arquivo que está sendo escrito? → Mesma proteção de escrita-concorrente que spec 006 FR-033 já define para o lado do PS2 escrevendo deve se aplicar aqui: o sistema nunca deixa uma leitura do PS2 e uma escrita de importação/download colidirem de forma que corrompa dados.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: O sistema MUST expor um catálogo navegável de jogos disponíveis para download, com busca/filtro, usando a mesma fonte remota que o app desktop usa.
- **FR-002**: O sistema MUST exigir confirmação legal explícita por item antes de iniciar qualquer download do catálogo, sem exceção.
- **FR-003**: O sistema MUST oferecer uma seleção automática ("Smart Fill") de itens do catálogo até um orçamento de espaço definido pelo usuário, sujeita à mesma confirmação legal por item.
- **FR-004**: O sistema MUST verificar espaço livre suficiente na biblioteca antes de iniciar um download, recusando com mensagem clara se insuficiente.
- **FR-005**: O sistema MUST permitir ao usuário escolher um arquivo de jogo local (via seletor de arquivos do sistema) e importá-lo para a biblioteca, na pasta correta conforme o tipo detectado.
- **FR-006**: O sistema MUST NUNCA alterar ou apagar o arquivo original durante uma importação local — a operação é sempre uma cópia.
- **FR-007**: O sistema MUST reverter qualquer cópia/download incompleto (falha de rede, espaço, ou encerramento do app) sem deixar um arquivo parcial/corrompido na biblioteca.
- **FR-008**: O sistema MUST aplicar particionamento multi-parte para arquivos que excedem o limite de tamanho do sistema de arquivos de destino, de forma transparente ao usuário, mantendo a biblioteca navegável pelo OPL da mesma forma que o desktop já garante.
- **FR-009**: O sistema MUST detectar e avisar quando um arquivo já existe na biblioteca antes de importar/baixar um duplicado.
- **FR-010**: O sistema MUST fornecer uma tela de Diagnóstico que verifica a presença das pastas obrigatórias do OPL (DVD, CD, PS1, APPS, ART, CFG, VMC), o espaço livre disponível, e reaproveita o resultado da catalogação (spec 006) para classificar a biblioteca em pronta / precisa atenção / não pronta.
- **FR-011**: O sistema MUST manter uma fila de transferências (downloads do catálogo + importações locais) que persiste através de fechamentos do app, com progresso individual visível por item e capacidade de retomar itens interrompidos.
- **FR-012**: O sistema MUST garantir que nunca duas transferências escrevam no mesmo arquivo de destino simultaneamente.
- **FR-013**: O sistema MUST impedir que uma transferência de escrita colida com uma leitura ativa do PS2 (via compartilhamento SMB, spec 006) de forma que corrompa dados, usando a mesma disciplina de escrita segura já estabelecida em spec 006 FR-033.
- **FR-014**: O sistema MUST deixar o "Gerenciador de Componentes" explicitamente fora de escopo desta spec — não deve ser implementado nem no desktop nem aqui até que exista uma versão funcional real para portar.
- **FR-015**: Todas as funcionalidades desta spec MUST operar sobre a mesma biblioteca SAF já selecionada e validada por spec 006 (FR-001–FR-004) — nenhuma delas introduz um modelo de acesso a armazenamento diferente ou gerenciamento de dispositivo USB como bloco.

### Key Entities

- **CatalogListing**: Um item do catálogo remoto Essentials — nome, tipo, tamanho estimado, disponibilidade do link, status de seleção do usuário.
- **TransferItem**: Uma transferência em andamento ou concluída (download do catálogo ou importação local) — origem, destino na biblioteca, progresso, estado (enfileirado/em andamento/pausado/falhou/concluído), timestamps.
- **DiagnosticsReport**: Resultado de uma execução de Diagnóstico — pastas obrigatórias presentes/ausentes, espaço livre, classificação geral, referência ao snapshot de catalogação usado.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Um usuário sem nenhum jogo na biblioteca consegue encontrar, confirmar e iniciar o download de um jogo do catálogo em menos de 2 minutos, usando só o celular.
- **SC-002**: Um usuário com um arquivo de jogo já baixado no celular consegue importá-lo para a biblioteca em menos de 1 minuto (sem contar o tempo de cópia do arquivo em si).
- **SC-003**: 100% das transferências interrompidas (app fechado, rede caída) são retomáveis ou claramente marcadas como falhas — nenhuma trava a fila nem aparece como sucesso indevidamente.
- **SC-004**: A tela de Diagnóstico aponta corretamente as pastas obrigatórias ausentes em 100% dos casos testados com bibliotecas incompletas.
- **SC-005**: Nenhuma transferência concorrente (duas escritas, ou uma escrita e uma leitura do PS2) resulta em arquivo corrompido, verificado em teste de integração dedicado.

## Assumptions

- A fonte remota do catálogo Essentials (Internet Archive, coleção `playstation2_essentials`) é acessível publicamente sem autenticação, igual ao desktop hoje — se isso mudar, é uma dependência externa fora do controle desta spec.
- O modelo de armazenamento SAF do Android já validado em spec 006 (incluindo USB-OTG tratado como qualquer outra árvore SAF) é suficiente para todas as operações de escrita desta spec — não é necessário acesso a bloco bruto de dispositivo.
- O "Gerenciador de Componentes" permanece fora de escopo indefinidamente, não só nesta spec — uma spec futura pode reabrir isso, mas só quando uma implementação funcional real existir para portar (desktop ou não).
- A confirmação legal por item (FR-002) usa o mesmo texto/aviso já validado no desktop (spec 003), adaptado para a UI mobile, não um novo texto legal a ser criado aqui.
- Limites de tamanho de arquivo de sistemas de arquivos comuns em cartão SD/pen drive Android (exFAT, FAT32) são os mesmos que o desktop já trata (FAT32 ~4GB) — esta spec não introduz suporte a filesystems adicionais.
