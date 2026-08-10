# Feature Specification: Android OPL Network Library

**Feature Branch**: `006-android-opl-network-library`

**Created**: 2026-08-09

**Status**: Draft

**Input**: User description: "Primeira versão Android do OPL Forge (React Native). O projeto desktop Electron NÃO deve ser portado 1:1 — esta feature define a primeira fatia vertical funcional do OPL Forge Mobile, reinterpretando os princípios e capacidades existentes (constituição, specs 001–005, arquitetura `electron/`/`src/`, e especialmente a spec 005 de compartilhamento SMB/FTP) para as restrições do Android. Objetivo: um dispositivo Android seleciona explicitamente uma pasta como sua biblioteca OPL (via Storage Access Framework/Scoped Storage), a biblioteca é escaneada e catalogada (majoritariamente read-only), o usuário navega a biblioteca com padrões mobile-nativos preservando a identidade visual do OPL Forge (dark-only, violeta, cards, estados emerald/amber/red), e então inicia o compartilhamento da biblioteca via um servidor compatível com o cliente SMB do Open PS2 Loader, rodando como um Foreground Service Android explícito e com notificação persistente, restrito à rede local. Um tutorial guiado mostra ao usuário o que configurar no menu ETH do PS2. Fora do escopo: formatação de dispositivo, acesso bruto a partições, reparo de fragmentação, PCSX2/emulação, torrent/P2P, USBExtreme completo, sincronização em nuvem, contas/login, iOS. Execução apenas da fase de especificação — decisões técnicas de arquitetura (fronteira React Native/Kotlin, biblioteca SMB, mecanismo de Foreground Service, escolha de persistência local) ficam documentadas como pendentes para `plan.md`, não decididas aqui."

## Clarifications

### Session 2026-08-09

- Q: A biblioteca OPL no Android pode ficar apenas em armazenamento interno/cartão SD, ou o MVP também precisa suportar HDs/pendrives externos conectados via USB-OTG? → A: Também USB-OTG — o seletor de biblioteca deve cobrir tanto armazenamento interno/cartão SD quanto dispositivos externos conectados via USB-OTG, sempre através do mecanismo de seleção de pastas do sistema operacional.
- Q: O compartilhamento SMB para o PS2 deve exigir usuário/senha obrigatórios, ou o MVP pode permitir um modo sem credenciais? → A: Obrigatórias — mantém paridade de segurança com o compartilhamento desktop (spec 005).
- Q: Neste primeiro MVP, o PS2 pode escrever de volta na biblioteca compartilhada (ex.: saves, memory card virtual), ou o compartilhamento deve ser estritamente somente leitura? → A: Escrita limitada permitida, mediante um reconhecimento explícito e único do usuário de que o PS2 poderá criar/modificar/sobrescrever arquivos na biblioteca local pela rede — mesmo padrão de consentimento do compartilhamento desktop (spec 005).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Selecionar a Biblioteca e Obter Acesso Autorizado (Priority: P1)

**As a** dono de um dispositivo Android que já tem arquivos de jogos de PS2 salvos localmente (armazenamento interno, cartão SD, ou pasta compartilhada de outro app),
**I want to** apontar explicitamente para a pasta que representa minha biblioteca OPL e conceder acesso a ela,
**So that** o app tenha uma fonte de verdade clara e sob meu controle para tudo que ele faz depois, sem adivinhar ou reler outro lugar por conta própria.

**Why this priority**: Sem uma biblioteca autorizada nada mais nesta feature pode acontecer — é o primeiro passo do fluxo principal e a base do princípio "contexto escolhido pelo usuário é autoritativo".

**Independent Test**: Pode ser testado abrindo o app sem biblioteca selecionada, escolhendo uma pasta pelo seletor do sistema, e confirmando que a seleção permanece ativa depois de fechar e reabrir o app completamente.

**Acceptance Scenarios**:

1. **Given** o app foi recém-instalado e nenhuma biblioteca foi selecionada, **When** o usuário abre a Home, **Then** o app mostra um estado explícito de "nenhuma biblioteca configurada" com uma única ação primária para selecionar uma.
2. **Given** o usuário aciona a seleção de biblioteca, **When** ele escolhe uma pasta pelo seletor nativo do sistema e confirma, **Then** o app registra essa pasta como a biblioteca ativa, solicita o acesso necessário e passa a exibi-la como biblioteca ativa em todo o app.
3. **Given** uma biblioteca já está selecionada, **When** o usuário fecha completamente o app e o reabre, **Then** a mesma biblioteca continua ativa sem nenhum prompt de reseleção, a menos que o acesso tenha sido revogado pelo sistema.
4. **Given** uma biblioteca está selecionada, **When** o usuário decide trocar de biblioteca em Configurações, **Then** a troca só ocorre a partir dessa ação explícita — o app MUST NOT trocar ou redescobrir outra pasta por conta própria.
5. **Given** o acesso anteriormente concedido deixou de ser válido (revogado fora do app, pasta removida, mídia removível ejetada), **When** o usuário abre o app, **Then** o app relata claramente a perda de acesso e solicita nova seleção, em vez de continuar silenciosamente com dados obsoletos ou parciais.

---

### User Story 2 - Catalogar e Validar a Biblioteca Selecionada (Priority: P1)

**As a** usuário que já selecionou sua biblioteca,
**I want** que o app escaneie a pasta e me mostre o que reconhece nela,
**So that** eu saiba o que vai ficar disponível para o PS2 e o que precisa de atenção antes de compartilhar.

**Why this priority**: Sem catalogação o usuário compartilharia uma pasta "às cegas"; catalogar read-only entrega valor sozinho (visibilidade da biblioteca) mesmo antes de qualquer compartilhamento existir.

**Independent Test**: Pode ser testado escaneando uma biblioteca com estrutura OPL válida e confirmando que a contagem de jogos por tipo, o progresso do escaneamento e os problemas identificados aparecem corretamente, sem qualquer arquivo da biblioteca ser alterado.

**Acceptance Scenarios**:

1. **Given** uma biblioteca selecionada contendo pastas OPL reconhecidas (`DVD/`, `CD/`, `PS1/`, `APPS/`, `ART/`, `CFG/`, `VMC/`), **When** o usuário inicia um escaneamento, **Then** o app relata o número de itens encontrados por tipo, com progresso visível, e permite cancelar a qualquer momento sem deixar o índice local inconsistente.
2. **Given** o escaneamento termina, **When** o usuário visualiza um jogo catalogado, **Then** a entrada mostra tipo, Game ID (quando derivável), título, extensão/formato, tamanho, localização lógica na biblioteca, se existe arte correspondente, e conformidade básica com o padrão de nomes OPL.
3. **Given** um arquivo ou pasta não segue a estrutura ou o padrão de nomes esperado, **When** o escaneamento termina, **Then** ele é sinalizado com um status claro de atenção, sem ser ocultado nem alterado.
4. **Given** a biblioteca está vazia ou não contém nenhuma das pastas OPL esperadas, **When** o escaneamento roda, **Then** o app comunica isso claramente em vez de apresentar um falso estado de "tudo certo, 0 problemas".

---

### User Story 3 - Compartilhar a Biblioteca com o PS2 pela Rede Local (Priority: P1)

**As a** usuário com uma biblioteca validada no Android e um PS2 rodando Open PS2 Loader na mesma rede,
**I want** iniciar o compartilhamento da minha biblioteca,
**So that** eu consiga navegar e carregar meus jogos direto no PS2, sem precisar antes copiar os arquivos para um PC.

**Why this priority**: É o valor central desta feature — transformar o Android numa "biblioteca OPL portátil" acessível pelo PS2. As histórias 1 e 2 existem para viabilizar esta.

**Independent Test**: Pode ser testado iniciando o compartilhamento a partir de uma biblioteca já catalogada, configurando um PS2 real (ou um cliente SMB equivalente) com os dados exibidos pelo app, e confirmando que ele consegue navegar a estrutura compartilhada.

**Acceptance Scenarios**:

1. **Given** a biblioteca está validada e o dispositivo está em uma rede Wi-Fi, **When** o usuário aciona o início do compartilhamento pela primeira vez, **Then** o app solicita usuário/senha para o compartilhamento, exige que o usuário reconheça explicitamente (separadamente das credenciais) que o PS2 poderá criar, modificar e sobrescrever arquivos na biblioteca local, inicia o serviço restrito à rede local, exibe uma notificação persistente e disponibiliza os dados de conexão.
2. **Given** o compartilhamento está ativo, **When** o OPL no PS2 se conecta usando os parâmetros de rede exibidos pelo app, **Then** o PS2 consegue navegar a estrutura de pastas compartilhada e iniciar o carregamento de um jogo.
3. **Given** o compartilhamento está ativo, **When** o usuário o interrompe explicitamente, **Then** o serviço para imediatamente, a notificação é removida e o PS2 deixa de conseguir alcançar a biblioteca.
4. **Given** o dispositivo não tem conectividade de rede local (sem Wi-Fi, ou apenas dados móveis), **When** o usuário tenta iniciar o compartilhamento, **Then** o app bloqueia a ação com uma explicação clara, em vez de iniciar um serviço inalcançável.
5. **Given** o compartilhamento está ativo, **When** o app deixa de estar em primeiro plano (usuário troca de app ou bloqueia a tela) durante uma sessão de uso do PS2, **Then** o compartilhamento continua operacional durante essa sessão, evidenciado pela notificação persistente e pela conexão do PS2 se mantendo.

---

### User Story 4 - Configurar o PS2 com um Tutorial Guiado (Priority: P2)

**As a** usuário que não conhece de cor o menu de rede do OPL,
**I want** uma tela guiada mostrando exatamente o que digitar nas configurações ETH do PS2,
**So that** eu não precise consultar tutoriais externos nem adivinhar os campos.

**Why this priority**: Reduz drasticamente a barreira de uso da História 3 para usuários não técnicos, mas o compartilhamento em si (História 3) já entrega valor sem esta tela.

**Independent Test**: Pode ser testado abrindo o tutorial com o compartilhamento ativo e confirmando que todos os valores necessários (endereço, porta, nome do compartilhamento, credenciais quando existirem) aparecem corretos e legíveis em uma tela pequena.

**Acceptance Scenarios**:

1. **Given** o compartilhamento está ativo, **When** o usuário abre o tutorial, **Then** ele mostra endereço IP, porta, nome do compartilhamento e credenciais (se aplicável) junto com os campos correspondentes no menu de rede do OPL, na ordem em que aparecem nesse menu.
2. **Given** o tutorial está aberto em uma tela pequena, **When** o usuário rola o conteúdo, **Then** cada passo permanece legível, sem exigir rolagem horizontal nem texto espremido.
3. **Given** o usuário seguiu o tutorial mas o PS2 não conectou, **When** ele volta ao app, **Then** o tutorial ou a tela de status aponta possíveis causas prováveis (ex.: redes Wi-Fi diferentes) como próximo passo.

---

### User Story 5 - Acompanhar o Status pela Home (Priority: P2)

**As a** usuário que volta ao app depois de já ter configurado tudo,
**I want** que a Home me diga de relance o estado da minha biblioteca e da sessão de compartilhamento,
**So that** eu não precise entrar em submenus para saber se está tudo funcionando.

**Why this priority**: Melhora a confiança e reduz suporte/dúvidas, mas as capacidades centrais (Histórias 1–3) funcionam mesmo sem uma Home consolidada.

**Independent Test**: Pode ser testado colocando o app em cada uma das combinações de estado (sem biblioteca / biblioteca com problemas / pronta / compartilhamento desligado / ligado sem cliente / PS2 conectado) e confirmando que a Home reflete cada uma de forma visualmente distinta.

**Acceptance Scenarios**:

1. **Given** nenhuma biblioteca foi configurada, **When** o usuário abre a Home, **Then** o estado é visualmente distinto de todos os outros, com uma única ação clara em destaque.
2. **Given** a biblioteca está selecionada e validada, sem compartilhamento ativo, **When** o usuário abre a Home, **Then** ela mostra "pronta para compartilhar" com contagem de jogos e eventuais problemas.
3. **Given** a biblioteca tem problemas de validação, **When** o usuário abre a Home, **Then** isso é destacado de forma distinta (ex.: âmbar/vermelho) com um caminho para ver detalhes.
4. **Given** o compartilhamento está ligado mas nenhum PS2 conectado, **When** o usuário abre a Home, **Then** ela mostra "compartilhando, aguardando conexão".
5. **Given** um PS2 está conectado, **When** o usuário abre a Home, **Then** ela mostra o estado "conectado" de forma distinta (ex.: esmeralda).

---

### User Story 6 - Navegar a Biblioteca no Celular (Priority: P3)

**As a** usuário com uma biblioteca já catalogada,
**I want** navegar meus jogos com uma experiência mobile-nativa (listas, cards, busca/filtro, tela de detalhe),
**So that** eu consiga conferir o que tenho na biblioteca sem precisar do PS2 ou de um PC.

**Why this priority**: É uma camada de conveniência sobre a catalogação (História 2); agrega valor mas não é indispensável para provar a fatia vertical ponta a ponta desta feature.

**Independent Test**: Pode ser testado navegando uma biblioteca catalogada de referência (~500 itens), filtrando por tipo e abrindo o detalhe de um jogo, confirmando navegação fluida e sem travamentos perceptíveis.

**Acceptance Scenarios**:

1. **Given** a biblioteca foi catalogada, **When** o usuário abre a aba de biblioteca, **Then** os jogos são listados e filtráveis por tipo (DVD/CD/PS1/Apps) usando padrões mobile-nativos (navegação inferior/abas, sem sidebar ou drawer desktop).
2. **Given** o usuário toca em um jogo, **When** a tela/sheet de detalhe abre, **Then** ela mostra metadados, status de validação e as ações disponíveis, dimensionados para toque.
3. **Given** uma biblioteca grande (~500 jogos), **When** o usuário rola a lista, **Then** a rolagem permanece fluida e responsiva.

---

### Edge Cases

- O que acontece quando a pasta da biblioteca selecionada deixa de estar disponível (mídia removível ejetada, pasta apagada externamente) enquanto o compartilhamento está ativo e um PS2 está conectado?
- O que acontece quando a rede Wi-Fi muda (troca de SSID, desconecta e reconecta, o IP local muda por renovação de DHCP) enquanto o compartilhamento está ativo?
- O que acontece quando o sistema operacional Android encerra o processo do app (pressão de memória, otimização de bateria) enquanto o compartilhamento está ativo?
- O que acontece quando o PS2 está lendo um jogo (meio do boot ou de uma transferência) no exato momento em que o app é encerrado, a rede cai, ou a biblioteca fica inacessível — o app precisa evitar deixar a biblioteca em um estado inconsistente, mesmo que o carregamento no PS2 falhe de forma previsível?
- Como o sistema lida com arquivos ISO grandes (jogos de DVD, potencialmente múltiplos GB) sendo servidos pela rede sem carregar o arquivo inteiro na memória do dispositivo?
- O que acontece quando dois dispositivos tentam se conectar ao compartilhamento ao mesmo tempo (dois PS2s, ou um PS2 e outro cliente de rede)?
- O que acontece quando credenciais incorretas são inseridas repetidamente no PS2?
- O que acontece quando o PS2 tenta gravar de volta na biblioteca (save/VMC) exatamente no momento em que o próprio dispositivo Android está lendo ou exibindo esse mesmo arquivo na interface?
- O que acontece quando o dispositivo Android ou o fabricante não expõe um HD/pendrive conectado via USB-OTG através do seletor de pastas do sistema operacional? O app MUST comunicar isso como um cenário não suportado, em vez de falhar silenciosamente ou travar.
- O que acontece quando o usuário tenta selecionar uma pasta vazia ou sem nenhuma estrutura OPL reconhecível como biblioteca?
- O que acontece quando o usuário revoga a permissão de acesso à pasta pelas configurações do próprio Android enquanto o app está em uso ou compartilhando?
- O que acontece quando o dispositivo entra em modo de economia de energia agressivo (Doze/battery saver) durante uma sessão de compartilhamento que deveria continuar ativa?
- O que acontece quando o usuário tenta iniciar o compartilhamento sem nenhuma biblioteca selecionada ou validada?
- O que acontece quando o app é reaberto depois de ter sido encerrado enquanto o compartilhamento estava ativo — ele deve indicar claramente que a sessão anterior não está mais ativa, sem sugerir falsamente que ainda está compartilhando?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: O sistema MUST exigir que o usuário selecione explicitamente, por meio do mecanismo de seleção de pastas do próprio sistema operacional, qual pasta representa sua biblioteca OPL; o app MUST NOT assumir, adivinhar ou pré-preencher essa localização.
- **FR-002**: O sistema MUST tratar a biblioteca atualmente selecionada como a única fonte de contexto para toda operação subsequente (catalogação, navegação, compartilhamento) e MUST NOT redescobrir, trocar ou substituir silenciosamente essa localização.
- **FR-003**: O sistema MUST solicitar, e sempre que o sistema operacional permitir, persistir o acesso concedido à biblioteca selecionada, de forma que a mesma biblioteca continue ativa entre execuções do app sem exigir nova seleção a cada abertura.
- **FR-004**: Quando o acesso previamente concedido deixar de ser válido (revogado, pasta removida, mídia indisponível), o sistema MUST relatar claramente a perda de acesso e solicitar nova seleção ao usuário, em vez de continuar operando com dados obsoletos ou parciais.
- **FR-005**: O sistema MUST permitir que o usuário selecione como biblioteca uma pasta localizada tanto em armazenamento interno/cartão SD quanto em um dispositivo de armazenamento externo conectado via USB-OTG (ex.: HD ou pendrive), sempre por meio do mecanismo de seleção de pastas do sistema operacional — nunca assumindo um caminho POSIX arbitrário construído pelo próprio app.
- **FR-006**: O sistema MUST reconhecer, quando presentes na biblioteca selecionada, as pastas padrão do OPL: `DVD/`, `CD/`, `PS1/`, `APPS/`, `ART/`, `CFG/`, `VMC/`.
- **FR-007**: Nesta versão, o próprio app MUST NOT criar, modificar, mover, renomear ou apagar arquivos dentro da biblioteca do usuário — toda operação do app sobre a biblioteca selecionada é somente leitura.
- **FR-008**: O sistema MUST escanear a biblioteca selecionada e produzir um catálogo dos itens reconhecidos, identificando para cada um, quando derivável: tipo de conteúdo, Game ID, título, extensão/formato do arquivo, tamanho, localização lógica dentro da biblioteca, existência de arte correspondente, e conformidade básica com o padrão de nomes OPL.
- **FR-009**: O sistema MUST sinalizar problemas estruturais ou de nomenclatura detectados durante a catalogação sem alterar os arquivos correspondentes.
- **FR-010**: A catalogação MUST relatar progresso enquanto executa e MUST permitir cancelamento a qualquer momento, sem deixar a biblioteca do usuário ou o índice local em estado inconsistente.
- **FR-011**: O sistema MUST permitir que o usuário navegue a biblioteca catalogada usando padrões de navegação mobile-nativos (ex.: navegação inferior, telas empilhadas, sheets), organizados em torno da hierarquia conceitual dispositivo/biblioteca → jogo → ação.
- **FR-012**: A identidade visual do app MUST preservar os elementos centrais do OPL Forge — tema exclusivamente escuro, cor primária violeta, superfícies escuras, layout baseado em cards, e estados semânticos esmeralda/âmbar/vermelho — adaptando densidade e disposição para telas móveis, sem reproduzir grids densos ou drawers laterais desktop.
- **FR-013**: O sistema MUST permitir que o usuário inicie e pare, a partir do próprio app, um serviço de compartilhamento de rede local que disponibiliza a biblioteca selecionada para um PlayStation 2 rodando Open PS2 Loader em modo de rede (ETH).
- **FR-014**: O serviço de compartilhamento MUST permanecer desligado por padrão e MUST somente iniciar como resultado de uma ação explícita do usuário.
- **FR-015**: O serviço de compartilhamento MUST rejeitar tentativas de conexão que não se originem da rede local e MUST NOT se expor a interfaces de rede públicas/externas.
- **FR-016**: Enquanto o compartilhamento estiver ativo, o sistema MUST exibir os dados de conexão necessários para configurar o PS2, no mínimo: endereço de rede local do dispositivo, porta e nome do compartilhamento.
- **FR-017**: O acesso ao compartilhamento MUST exigir um usuário e uma senha definidos pelo próprio usuário antes que o serviço possa iniciar, mantendo paridade de segurança com o compartilhamento SMB/FTP do desktop (spec 005, FR-010).
- **FR-018**: O sistema MUST permitir que o PS2 escreva de volta na biblioteca compartilhada (ex.: dados de save, memory card virtual) somente depois que o usuário tiver reconhecido explicitamente, uma única vez, que o PS2 poderá criar, modificar e sobrescrever arquivos na biblioteca local pela rede; esse reconhecimento é distinto de definir usuário/senha do compartilhamento (FR-017) e o compartilhamento MUST NOT iniciar com acesso de escrita habilitado até que esse reconhecimento esteja registrado.
- **FR-019**: O sistema MUST comunicar o estado atual do compartilhamento usando, no mínimo, os estados: desligado, iniciando, em execução sem cliente, em execução com cliente conectado, parando, e erro.
- **FR-020**: O sistema MUST manter o serviço de compartilhamento operacional durante toda uma sessão de uso do PS2 mesmo quando a interface do app não estiver visível em primeiro plano, até que o usuário o interrompa explicitamente ou o sistema operacional force seu encerramento.
- **FR-021**: Enquanto o compartilhamento estiver ativo, o sistema MUST exibir uma notificação persistente e inequívoca indicando que a biblioteca está sendo compartilhada, com uma forma explícita de interrompê-lo diretamente pela notificação ou pelo app.
- **FR-022**: O sistema MUST NOT iniciar o compartilhamento silenciosamente ou em segundo plano sem uma ação explícita do usuário correspondente a essa sessão.
- **FR-023**: O sistema MUST oferecer um tutorial guiado, passo a passo e dimensionado para telas pequenas, mostrando os valores exatos que o usuário precisa inserir nas configurações de rede do OPL no PS2 (endereço, porta, nome do compartilhamento, credenciais quando aplicável) para a sessão de compartilhamento ativa no momento.
- **FR-024**: O sistema MUST refletir mudanças no estado de conexão (incluindo um PS2 conectando ou desconectando) derivadas do próprio serviço de compartilhamento, e não de qualquer informação que o PS2 exiba sobre si mesmo em sua própria tela.
- **FR-025**: A Home MUST permitir que o usuário distinga imediatamente, sem navegar por submenus, entre: nenhuma biblioteca configurada, biblioteca pronta, biblioteca com problemas, compartilhamento desligado, compartilhamento ativo, e PS2 conectado.
- **FR-026**: O sistema MUST servir o conteúdo de arquivos ao PS2 lendo os dados de forma incremental (streaming/em blocos), sem carregar um arquivo de jogo inteiro na memória do dispositivo antes de respondê-lo.
- **FR-027**: O sistema MUST persistir localmente no dispositivo, sem qualquer backend remoto ou conta de usuário: a referência à biblioteca selecionada, o acesso concedido a ela, a configuração de rede do compartilhamento, preferências do usuário, um histórico mínimo de operações, e o índice local do catálogo.
- **FR-028**: O sistema MUST confinar toda operação de leitura de arquivos estritamente à árvore da biblioteca autorizada pelo usuário e MUST NOT construir ou seguir caminhos que possam alcançar locais fora dela.
- **FR-029**: O sistema MUST NOT solicitar permissões de armazenamento ou de rede além do estritamente necessário para selecionar a biblioteca, catalogá-la e operar o serviço de compartilhamento de rede local.
- **FR-030**: Mensagens de erro exibidas ao usuário, incluindo falhas do serviço de compartilhamento, MUST ser apresentadas em linguagem simples e MUST NOT expor credenciais, caminhos internos além dos da própria biblioteca do usuário, ou stack traces técnicos como mensagem principal.
- **FR-031**: O sistema MUST deixar claro ao usuário que esta versão Android não utiliza conta remota, backend ou login — biblioteca, catálogo e compartilhamento operam inteiramente no próprio dispositivo.
- **FR-032**: O sistema MUST NOT retomar automaticamente uma sessão de compartilhamento que estava ativa antes do sistema operacional encerrar completamente o processo do app; retomar exige uma nova ação explícita do usuário.
- **FR-033**: O sistema MUST evitar corrupção de dados quando o PS2 tenta modificar um arquivo da biblioteca ao mesmo tempo em que o próprio dispositivo Android acessa esse mesmo arquivo (ex.: por meio de bloqueio, ou rejeitando a escrita conflitante com uma mensagem clara ao usuário), consistente com o tratamento já existente no compartilhamento desktop (spec 005, FR-013).
- **FR-034**: O sistema MUST rejeitar credenciais de compartilhamento inválidas com uma mensagem genérica de falha de autenticação que não revele se o problema foi o usuário ou a senha, consistente com o compartilhamento desktop (spec 005, FR-015).

### Key Entities _(include if feature involves data)_

- **LibrarySelection**: Representa a biblioteca OPL atualmente escolhida pelo usuário neste dispositivo. Atributos: referência à pasta concedida pelo sistema operacional, se o acesso concedido ainda é válido, quando foi selecionada, quando foi validada pela última vez.
- **CatalogEntry**: Representa um item reconhecido dentro da biblioteca durante a catalogação. Atributos: tipo de conteúdo (DVD/CD/PS1/App), Game ID, título, extensão/formato, tamanho, localização lógica, presença de arte correspondente, conformidade com o padrão de nomes OPL, problemas estruturais detectados.
- **CatalogSnapshot**: Representa o resultado agregado de um escaneamento da biblioteca. Atributos: total de itens por tipo, total de itens com problemas, data/hora do escaneamento, estado (em andamento, concluído, cancelado, com erro).
- **SharingSession**: Representa a sessão de compartilhamento de rede em execução (ou já finalizada). Atributos: estado (desligado, iniciando, em execução sem cliente, em execução com cliente, parando, erro), endereço de rede local, porta, nome do compartilhamento, usuário/senha exigidos, se o acesso de escrita foi reconhecido pelo usuário e quando, horário de início, mensagem de erro (quando houver).
- **ConnectedClient**: Representa um dispositivo (tipicamente o PS2) atualmente conectado ou recentemente conectado ao compartilhamento. Atributos: endereço de origem, conectado desde, última atividade observada.
- **ConnectionTutorialStep**: Representa um passo do tutorial guiado de configuração do PS2. Atributos: campo correspondente no menu de rede do OPL, valor a ser inserido, ordem de exibição.
- **LocalHistoryEntry**: Representa um registro mínimo de operações relevantes (início/fim de compartilhamento, seleção de biblioteca, catalogação concluída), sem dados sensíveis, para consulta pelo próprio usuário.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Um usuário com um PS2 já na mesma rede consegue ir de "app recém-instalado, sem biblioteca configurada" até "PS2 navegando com sucesso a biblioteca compartilhada" em menos de 7 minutos, sem consultar documentação externa.
- **SC-002**: Para uma biblioteca de referência com aproximadamente 500 itens, a catalogação identifica corretamente tipo, Game ID (quando presente no nome do arquivo) e conformidade de nome para pelo menos 95% dos itens, sem travar nem encerrar de forma inesperada.
- **SC-003**: A catalogação de uma biblioteca de referência com aproximadamente 500 itens exibe progresso contínuo do início ao fim e pode ser cancelada a qualquer momento em até 2 segundos, sem deixar o índice local corrompido.
- **SC-004**: 100% das mudanças de estado do compartilhamento (ligou, desligou, cliente conectou, cliente desconectou, erro) ficam refletidas na interface em até 10 segundos após a mudança real.
- **SC-005**: 0% das tentativas de conexão originadas de fora da rede local do dispositivo conseguem alcançar o compartilhamento.
- **SC-006**: O acesso à biblioteca selecionada permanece válido em pelo menos 95% das reaberturas do app após um fechamento completo, sem exigir nova seleção, exceto quando o próprio sistema operacional revogou o acesso.
- **SC-007**: Uma sessão de compartilhamento ativa permanece operacional e com a conexão do PS2 preservada por pelo menos 30 minutos contínuos com o app fora de primeiro plano (tela bloqueada ou outro app em uso), sem intervenção do usuário.
- **SC-008**: Servir um arquivo de jogo de mais de 4 GB para o PS2 não aumenta o uso de memória do app de forma proporcional ao tamanho do arquivo — o consumo de memória permanece dentro de um teto fixo e previsível, independentemente do tamanho do arquivo servido.
- **SC-009**: Em um teste com hardware real (PlayStation 2 + Open PS2 Loader), o usuário consegue listar e iniciar o carregamento de pelo menos um jogo de cada tipo suportado (DVD, CD, PS1, quando presentes na biblioteca de teste) através do compartilhamento hospedado no Android.

## Assumptions

- O público-alvo desta primeira versão é o mesmo da comunidade PS2/OPL já atendida pelo produto desktop, agora usando um celular ou tablet Android como biblioteca portátil em vez de (ou além de) um PC.
- O dispositivo Android roda uma versão que já opera sob o modelo de Scoped Storage do Android moderno (Android 10 ou superior); versões mais antigas não são um alvo garantido desta primeira versão.
- O PS2 e o dispositivo Android já estão na mesma rede local (Wi-Fi) antes do início do fluxo desta feature; problemas de topologia de rede fora do controle do app (ex.: PS2 em uma sub-rede isolada) podem ser sinalizados como falha de alcançabilidade, mas não são responsabilidade do app resolver.
- O compartilhamento de rede exige conectividade Wi-Fi; dados móveis não são um caminho válido para esta feature, já que o PS2 só alcança o compartilhamento pela rede local.
- Esta versão não reproduz literalmente a validação via PCSX2 do produto desktop (specs 001/003) — não há emulador de PS2 disponível nativamente no Android; validação nesta feature se limita a conformidade estrutural/de nomes, sem execução real do jogo.
- Downloads via torrent/P2P (WebTorrent no desktop) estão fora do escopo desta feature; a biblioteca tratada aqui é sempre composta por arquivos que o usuário já possui no dispositivo Android antes de abrir o app.
- Reparo de fragmentação (spec 002) não se aplica a esta feature — não há conceito equivalente de fragmentação física de arquivo relevante no armazenamento típico de um dispositivo Android da forma como existe em HD/USB tradicional, e a feature já é majoritariamente somente leitura.
- Um único dispositivo Android compartilha para um ou mais PS2 na mesma rede local por vez (mesma premissa de escala do compartilhamento desktop, spec 005) — não é um cenário multi-dispositivo Android simultâneo compartilhando a mesma biblioteca.
- Apenas uma biblioteca fica ativa por vez neste MVP; gestão de múltiplas bibliotecas/dispositivos Android não faz parte desta primeira fatia vertical.
- Miniaturas de capas de jogos (`ART/`) são exibidas quando presentes na biblioteca, seguindo o mesmo princípio de reconhecimento de arte já existente no produto desktop, sem introduzir busca remota de metadados/capas nesta feature (isso pertence ao domínio do Catálogo remoto do desktop, fora de escopo aqui).
- Esta feature roda como um app Android independente, novo, não como parte do processo do produto desktop — não há dependência de o PC/Electron estar em execução para que esta feature funcione.

## Decisions Deferred to Planning (`plan.md`)

Esta especificação define **o quê** e **por quê**; as decisões abaixo são de arquitetura/implementação e MUST ser resolvidas no plano, não aqui, embora sejam registradas para que o planejamento não comece do zero:

1. Estratégia de projeto React Native (RN puro vs. framework sobre RN) e como compartilhar tipos/regras de domínio/design system com o projeto desktop sem acoplar à arquitetura Electron.
2. Onde exatamente fica a fronteira entre a UI React Native e uma camada nativa Android (ex.: módulos Kotlin) — nenhuma FR desta spec assume essa fronteira, apenas exige que a UI não acesse APIs privilegiadas do Android diretamente (constitucional: reinterpretação do Princípio II).
3. Mecanismo concreto de Storage Access Framework/Scoped Storage usado para seleção e persistência de acesso à biblioteca (FR-001 a FR-004), incluindo como o app se comporta se o mecanismo escolhido não suportar persistência de URI em algum fabricante/versão.
4. Biblioteca/implementação concreta do servidor compatível com o cliente SMB do OPL (equivalente Android ao servidor SMB1 próprio da spec 005 desktop) — subset de protocolo necessário, e se código Kotlin/Java próprio ou dependência especializada é usado; decisão MUST ser justificada no `plan.md`, incluindo por que o código do servidor SMB1 do desktop (Node.js) não pode ser reaproveitado diretamente no runtime Android.
5. Mecanismo concreto do serviço em segundo plano que sustenta FR-020/FR-021/FR-022 (o que hoje o Android chama de Foreground Service) e como ele respeita as restrições de execução em segundo plano das versões-alvo do Android.
6. Estratégia de persistência local (FR-027) — se Room/SQLite ou outra solução é usada para o índice de catálogo e configuração, e eventual migração futura.
7. Comportamento técnico detalhado quando a biblioteca fica indisponível em pleno uso (mídia ejetada, permissão revogada) com uma sessão de compartilhamento ativa — a spec define o requisito observável (FR-004, edge cases), o plano define como o servidor de compartilhamento detecta e reage a isso sem deixar o PS2 travado de forma não recuperável.
8. Comportamento técnico detalhado quando a rede Wi-Fi muda enquanto o compartilhamento está ativo (reconectar automaticamente, exigir reinício manual, etc.) — mesma lógica do desktop (spec 005) de não tentar recuperação automática pode ou não se aplicar aqui; decisão cabe ao plano.
9. Comportamento técnico quando o Android mata o processo do app enquanto o compartilhamento está ativo — cobre reinício automático do serviço vs. encerramento definitivo até nova ação do usuário (relacionado a FR-032).
10. Implementação concreta de leitura em streaming/blocos (FR-026) e limites de memória a impor, incluindo como isso interage com o tamanho máximo de arquivo ISO esperado (spec 001 já define até ~4GB no formato ISO9660 direto).
11. Estratégia de testes por camada: regras TypeScript, contratos de tipos compartilhados, componentes React Native, módulos nativos Android, integração com Storage Access Framework, protocolo de compartilhamento de rede, integração servidor/rede, e teste de hardware real com PS2 físico (não considerar o compartilhamento "concluído" apenas por outro PC conseguir montá-lo — mesma lição já registrada na spec 005).
12. As três decisões já resolvidas na fase de especificação (ver seção "Clarifications" acima: suporte a USB-OTG além de interno/SD, credenciais obrigatórias, escrita limitada do PS2 mediante consentimento) são vinculantes para o plano e alimentam diretamente as decisões 3–5 acima — o plano MUST desenhar a solução técnica em torno delas, não reabri-las.

## Nota sobre a Constituição do Projeto

A constituição atual (`.specify/memory/constitution.md`, v1.0.0) foi escrita em torno da arquitetura Electron (Princípio II cita explicitamente `contextIsolation`, `nodeIntegration`, `sandbox`, `contextBridge`). Esta especificação reinterpreta a **intenção** desses princípios para Android (menor privilégio → permissões Android/SAF em vez de isolamento de processo Electron; ver FR-001 a FR-004, FR-028, FR-029), mas **não altera a constituição**. Antes ou durante o planejamento, os mantenedores devem decidir explicitamente se querem uma emenda à constituição existente ou uma constituição-irmã específica para o app mobile, cobrindo pelo menos:

- Quais princípios são universais ao produto OPL Forge (ex.: nunca ocultar uma operação destrutiva, sempre confinar caminhos à árvore autorizada, nunca vazar segredos em erros/logs, contexto escolhido pelo usuário é autoritativo) — todos já refletidos como FRs nesta spec independentemente da constituição formal ser emendada ou não.
- Quais princípios eram específicos da arquitetura Electron e precisam de uma redação equivalente para Android (isolamento de processo → fronteira RN/nativo; `contextBridge` → API tipada equivalente).
- Se o padrão de "nunca redescobrir contexto que o usuário já escolheu" (lição já documentada da spec 005, ver FR-002 desta spec) deve virar um princípio constitucional explícito, dado que já causou um bug real em produção no desktop.
