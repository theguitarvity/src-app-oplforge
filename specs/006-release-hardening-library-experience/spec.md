# Feature Specification: Release Hardening, OPL Connectivity and Library Experience

**Feature Branch**: `006-release-hardening-library-experience`

**Created**: 2026-08-09

**Status**: Draft

**Input**: User description: "Tornar a versão distribuída do OPL Forge confiável para uso real, corrigindo identidade Windows, conexão SMB com OPL real, versionamento e artefatos de release, atualização integrada, capas locais, download para o computador e progresso de importação."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Conectar um PS2 real por SMB (Priority: P1)

Como usuário com um PlayStation 2 físico, quero iniciar o compartilhamento e conectar o Open PS2 Loader pelo modo ETH, para navegar pela biblioteca e iniciar a leitura de jogos sem erro de autenticação ou sessão.

**Why this priority**: A conexão com hardware real é a função central da área de rede e hoje falha em `SESSION_SETUP_ANDX`; conexão TCP, negociação isolada ou sucesso com outro cliente não entregam valor ao usuário de OPL.

**Independent Test**: Iniciar o compartilhamento, configurar um PS2 físico com uma versão OPL registrada, completar autenticação e conexão à árvore, listar jogos e iniciar a leitura de uma imagem, registrando o smoke test sem expor credenciais.

**Acceptance Scenarios**:

1. **Given** um compartilhamento configurado com uma combinação de autenticação declarada como suportada, **When** o OPL real negocia e envia `SESSION_SETUP_ANDX`, **Then** a sessão é aceita sem `0xc000006d`, recebe uma identidade válida e pode prosseguir para a árvore compartilhada.
2. **Given** uma sessão aceita no PS2 físico, **When** o usuário abre a biblioteca no OPL, **Then** o console lista os jogos e consegue iniciar a leitura de uma imagem grande sem erro de login, caminho ou tamanho.
3. **Given** credenciais ou modo de acesso não suportados, **When** o PS2 tenta autenticar, **Then** o acesso é recusado de modo compatível com o protocolo, o aplicativo mostra orientação acionável e nenhum segredo aparece nos logs.
4. **Given** o modo de debug detalhado está habilitado, **When** ocorre o handshake, **Then** os logs correlacionam cliente, comando, dialeto, modo de segurança, intenção guest/anônima, resultado e identificadores de sessão, mascarando usuário e senha.
5. **Given** o compartilhamento está ativo, **When** o PS2 desconecta e reconecta, **Then** recursos da sessão anterior são liberados e a nova sessão consegue navegar sem reiniciar o aplicativo.

---

### User Story 2 - Receber uma release coerente e atualizável (Priority: P1)

Como usuário da versão distribuída, quero instalar uma release cuja identidade, versão e artefatos sejam coerentes e receber atualizações dentro do aplicativo, para confiar que estou usando a versão oficial correta sem reinstalação manual.

**Why this priority**: Identidade, versionamento, empacotamento e atualização formam um único contrato de distribuição; inconsistências entre eles impedem suporte confiável e podem direcionar o usuário ao arquivo errado.

**Independent Test**: Produzir uma release candidata a partir da fonte de versão oficial, instalar a versão N em Windows limpo, publicar N+1, detectar, baixar e aplicar a atualização e confirmar versão e identidade após reinício.

**Acceptance Scenarios**:

1. **Given** uma instalação Windows limpa, **When** o usuário instala e abre o OPL Forge, **Then** instalador, executável, atalhos, menu Iniciar, lista de aplicativos e janela/barra de tarefas exibem a identidade oficial, sem ícone genérico do Electron.
2. **Given** uma release oficial, **When** a matriz de distribuição termina, **Then** tag, nome da release, versão exibida no aplicativo, metadados dos instaladores, nomes dos artefatos e metadados de atualização representam a mesma versão oficial.
3. **Given** os artefatos Windows de uma release, **When** o usuário consulta os downloads públicos, **Then** encontra somente o instalador suportado e os arquivos técnicos estritamente necessários à atualização, sem executável portátil ou intermediário concorrente.
4. **Given** a versão N instalada e uma release N+1 elegível, **When** o usuário verifica atualizações, **Then** vê versão atual, nova versão, notas e tamanho quando disponíveis, podendo baixar ou adiar conforme sua política.
5. **Given** a atualização foi baixada, **When** o usuário escolhe "Reiniciar e atualizar", **Then** ela é aplicada e o aplicativo retorna identificando-se como N+1.
6. **Given** não há atualização, há falha de rede ou a release é inelegível, **When** a verificação termina, **Then** o estado e a orientação correspondentes aparecem sem bloquear o uso normal.
7. **Given** um build para macOS ou Linux, **When** a identidade Windows é corrigida, **Then** os formatos anteriormente suportados continuam sendo gerados com identidade própria e sem regressão de inicialização.

---

### User Story 3 - Visualizar artes existentes e estados úteis (Priority: P1)

Como usuário com um dispositivo OPL preparado, quero ver na Biblioteca as capas já presentes em `ART/` e entender a causa real de cada alerta, para reconhecer jogos sem baixar arte novamente e agir apenas sobre problemas relevantes.

**Why this priority**: A Biblioteca é a principal superfície de uso e atualmente confunde falta de arte com problema de prontidão, além de não apresentar corretamente o asset já existente.

**Independent Test**: Abrir uma fixture com jogos e combinações conhecidas de arte, conferir a capa determinística em grade, lista e detalhe, os fallbacks e estados separados, e repetir com aproximadamente 500 jogos.

**Acceptance Scenarios**:

1. **Given** um jogo identificado e um `COV` válido correspondente em `ART/`, **When** o catálogo é lido, **Then** a capa aparece na grade, lista e detalhe sem download remoto.
2. **Given** não há `COV`, mas há `COV2` válido, **When** a Biblioteca escolhe a arte primária, **Then** usa `COV2`; havendo ambos, usa `COV` de forma determinística.
3. **Given** há apenas artes auxiliares ou nenhuma arte, **When** o card é exibido, **Then** aparece um placeholder consistente e a prontidão do jogo não é degradada apenas pela ausência de arte.
4. **Given** um arquivo de arte inválido, ambíguo ou incompatível, **When** o índice é atualizado, **Then** o arquivo não é apresentado como capa válida, a arte anterior válida é preservada e a causa fica disponível como estado de completude.
5. **Given** um jogo com nome inválido, fragmentação, validação pendente ou metadados ausentes, **When** seu estado é apresentado, **Then** a causa específica permanece no modelo e a interface não usa "Atenção" como explicação genérica.
6. **Given** aproximadamente 500 jogos com artes, **When** o usuário percorre e filtra a Biblioteca, **Then** a interface permanece utilizável sem carregar simultaneamente todas as imagens completas.

---

### User Story 4 - Baixar para o computador sem dispositivo OPL (Priority: P1)

Como usuário, quero escolher entre instalar um download em um dispositivo OPL ou mantê-lo em uma pasta do computador, para usar meu backup localmente, inclusive no PCSX2, sem conectar um dispositivo.

**Why this priority**: O acoplamento atual entre transferência e instalação bloqueia um caso de uso essencial e força uma dependência de hardware desnecessária.

**Independent Test**: Sem dispositivo conectado, escolher "Este computador", selecionar uma pasta autorizada, concluir a transferência e validação mínima e confirmar que o arquivo original permanece local sem estrutura ou renomeação OPL.

**Acceptance Scenarios**:

1. **Given** nenhum dispositivo OPL está conectado, **When** o usuário escolhe "Este computador" e uma pasta gravável, **Then** o download pode ser enfileirado e concluído nessa pasta.
2. **Given** "Este computador" foi escolhido, **When** a transferência termina, **Then** o arquivo mantém nome e formato adequados ao conteúdo original, não é movido para estrutura OPL e não abre automaticamente o PCSX2.
3. **Given** "Dispositivo OPL" foi escolhido, **When** a transferência termina, **Then** o pipeline existente de validação, planejamento, confirmação, instalação e verificação continua aplicável.
4. **Given** a pasta local deixa de estar disponível ou não tem espaço, **When** a tarefa tenta avançar, **Then** somente essa tarefa é suspensa ou falha com orientação e nenhum arquivo parcial é apresentado como concluído.
5. **Given** um download local válido e uma integração PCSX2 disponível, **When** o usuário abre suas ações posteriores, **Then** pode optar por testá-lo no PCSX2 sem que essa ação tenha ocorrido automaticamente.

---

### User Story 5 - Acompanhar importações locais (Priority: P1)

Como usuário que adiciona uma ou várias imagens existentes, quero acompanhar fases e progresso da cópia, para saber que o aplicativo continua funcionando e qual item requer ação.

**Why this priority**: Importações grandes são operações comuns, longas e sensíveis; uma interface aparentemente congelada viola a integridade operacional exigida pelo produto.

**Independent Test**: Importar um lote com arquivos de tamanhos conhecidos e observar, no fluxo de adição e no Activity Drawer, eventos monotônicos desde fila até conclusão, incluindo erro seguro em uma origem removida.

**Acceptance Scenarios**:

1. **Given** uma imagem válida, **When** a importação inicia, **Then** a interface mostra fase amigável, item, bytes processados e totais, percentual e velocidade, sem bloquear navegação.
2. **Given** vários jogos selecionados, **When** a operação avança, **Then** são mostrados progresso global, item atual, quantidade concluída e fila restante.
3. **Given** estimativa de tempo confiável, **When** há amostras suficientes, **Then** o tempo restante é exibido; caso contrário, ele é omitido em vez de inventado.
4. **Given** a origem some, o espaço acaba ou ocorre erro de leitura/escrita, **When** a importação falha, **Then** o estado final é controlado, o staging parcial é conciliado e uma instalação anterior permanece íntegra.
5. **Given** cancelamento seguro está disponível para a fase atual, **When** o usuário cancela, **Then** atividade futura cessa e o parcial é limpo ou preservado conforme a política apresentada; caso não seja seguro, a UI não oferece o comando.
6. **Given** o aplicativo é encerrado durante a importação, **When** é aberto novamente, **Then** a operação reaparece em estado reconciliado com instrução de recuperação, repetição ou limpeza segura.

---

### User Story 6 - Controlar a política de atualização (Priority: P2)

Como usuário, quero escolher como o OPL Forge verifica e baixa atualizações e poder verificar manualmente, para equilibrar conveniência, banda e controle sobre reinicializações.

**Why this priority**: A atualização integrada precisa ser previsível e consentida, mas suas políticas podem ser entregues depois do caminho básico de atualização da User Story 2.

**Independent Test**: Alternar cada política, reiniciar o aplicativo, simular uma nova versão e confirmar quando ocorre verificação, pergunta, download e instalação.

**Acceptance Scenarios**:

1. **Given** "Verificar automaticamente", **When** o aplicativo inicia em condição elegível, **Then** verifica sem bloquear e pede decisão antes de baixar.
2. **Given** "Perguntar antes de baixar", **When** uma atualização é encontrada, **Then** nenhum byte do pacote é baixado antes do consentimento.
3. **Given** "Baixar automaticamente", **When** uma atualização é encontrada, **Then** o download progride em segundo plano, mas a instalação/reinicialização ainda exige decisão explícita.
4. **Given** "Não verificar automaticamente", **When** o aplicativo inicia, **Then** não consulta releases; a ação "Verificar atualizações" continua disponível.
5. **Given** uma preferência salva, **When** o aplicativo reinicia, **Then** a mesma política permanece ativa.

---

### User Story 7 - Publicar releases previsíveis (Priority: P2)

Como mantenedor, quero uma única fonte de verdade de versão e uma release reproduzível, para identificar, dar suporte e atualizar cada build sem versões ou artefatos concorrentes.

**Why this priority**: Este fluxo sustenta a experiência da User Story 2, mas é uma jornada operacional independente do mantenedor.

**Independent Test**: Disparar a pipeline com uma versão `1.x.x.x` válida, conferir a matriz, artefatos e metadados, e rejeitar deliberadamente tags ou versões divergentes.

**Acceptance Scenarios**:

1. **Given** uma tag oficial válida, **When** a release inicia, **Then** a versão é validada antes do build e todas as plataformas recebem a mesma identidade de versão.
2. **Given** tag, fonte oficial ou metadados divergentes, **When** a validação prévia executa, **Then** a release falha antes de publicar qualquer artefato público.
3. **Given** a convenção pública `1.x.x.x`, **When** algum componente não aceita quatro segmentos, **Then** a regra de compatibilidade aprovada no planejamento é aplicada de modo explícito, documentado, reversível e verificável, sem transformação silenciosa.
4. **Given** um build válido, **When** a release é publicada, **Then** inclui instaladores suportados por plataforma e seus metadados de atualização, sem arquivos intermediários.
5. **Given** uma release draft ou prerelease não elegível pela política, **When** um aplicativo estável verifica atualizações, **Then** ela não é oferecida como atualização estável.

---

### User Story 8 - Diagnosticar conexão OPL com segurança (Priority: P2)

Como usuário ou mantenedor dando suporte, quero habilitar diagnóstico SMB detalhado e obter um roteiro de teste em hardware, para localizar falhas reais de dialeto, autenticação, árvore ou leitura sem expor credenciais.

**Why this priority**: A compatibilidade deve continuar verificável em hardware e não pode depender de logs insuficientes ou capturas que revelem segredos.

**Independent Test**: Reproduzir handshake aceito e rejeitado, conferir eventos correlacionados e exportar um registro sanitizado junto ao Hardware Smoke Test.

**Acceptance Scenarios**:

1. **Given** debug padrão, **When** há atividade SMB, **Then** são registrados marcos e falhas acionáveis com volume adequado ao uso normal.
2. **Given** debug detalhado habilitado, **When** há negociação, sessão, conexão à árvore e leitura, **Then** campos seguros necessários ao diagnóstico aparecem correlacionados por cliente e sessão.
3. **Given** qualquer nível de log, **When** usuário, senha ou resposta de autenticação transitam, **Then** credenciais e material reutilizável não são persistidos.
4. **Given** um teste em PS2 físico, **When** o mantenedor registra o resultado, **Then** versão OPL, configuração não secreta, passos, marcos, falha e evidência ficam documentados separadamente de testes com clientes de desktop.

### Edge Cases

- GitHub indisponível ou usuário offline durante uma verificação mantém o aplicativo utilizável, preserva a política e oferece nova tentativa sem tratar ausência de rede como ausência de atualização.
- Release draft, prerelease ou versão inferior não é oferecida fora da política de canal definida; metadados ausentes ou inconsistentes tornam a release inelegível.
- Download de update interrompido não produz estado pronto; retomada ou reinício segue a capacidade confirmada da fonte e nunca executa pacote incompleto.
- Update disponível durante importação, instalação ou outra gravação sensível pode ser baixado conforme a política, mas reinício não ocorre sem decisão explícita e aviso sobre operações ativas.
- Encerramento com update pronto preserva o estado; a próxima abertura volta a oferecer aplicação sem afirmar que a versão já foi instalada.
- Remoção ou troca de dispositivo durante scan de `ART/` interrompe a promoção do índice, mantém o último retrato completo e não publica associações parciais.
- Arte inválida, vazia, com assinatura divergente ou caminho inseguro é rejeitada; ausência de correspondência por Game ID usa placeholder.
- Duas artes candidatas são resolvidas pela precedência `COV`, depois `COV2`; duplicatas do mesmo tipo usam uma regra determinística a ser detalhada no plano e geram diagnóstico de ambiguidade.
- Importação sem espaço suficiente falha antes da cópia quando detectável; perda de espaço durante cópia mantém o destino anterior e reconcilia o parcial.
- Origem removida ou alterada durante cópia falha o item afetado, sem promover o arquivo incompleto ou interromper itens independentes.
- Fechamento durante importação não converte progresso parcial em conclusão e permite reconciliação segura na próxima execução.
- Username vazio, guest, acesso anônimo e senha vazia são aceitos ou rejeitados conforme a configuração de compatibilidade explicitamente suportada, sem fallback implícito que amplie acesso.
- Credenciais incorretas recebem falha genérica; debug não revela qual campo divergiu nem material de desafio/resposta reutilizável.
- Reconexão SMB libera identificadores, handles e locks antigos antes de criar nova sessão.
- Dois clientes SMB simultâneos recebem sessões isoladas e conflitos de escrita são bloqueados sem interferir em leituras independentes.
- Leitura de ISO interrompida libera handle e atividade, permitindo nova leitura do offset solicitado sem alterar o arquivo.
- Mudança da biblioteca selecionada com share ativo exige confirmação ou reinício controlado do compartilhamento; sessões existentes nunca mudam silenciosamente de raiz.
- Caminho de arte ou destino local contendo links, traversal, colisões, caracteres especiais ou diferença de caixa permanece confinado à raiz autorizada.
- Ausência de arte ou metadados não oculta problemas estruturais, e também não transforma isoladamente um jogo estruturalmente pronto em problema crítico.

## Requirements _(mandatory)_

### Functional Requirements

#### Compatibilidade SMB e diagnóstico em hardware

- **FR-001**: O compartilhamento SMB MUST completar com um PS2 físico e Open PS2 Loader real negociação, estabelecimento de sessão, conexão à árvore, listagem e leitura inicial de jogo em uma configuração documentada como suportada.
- **FR-002**: Compatibilidade MUST NOT ser declarada apenas por conexão TCP, resposta a negociação ou acesso bem-sucedido de cliente Windows/Linux.
- **FR-003**: A solução MUST interpretar e responder aos campos de negociação e `SESSION_SETUP_ANDX` efetivamente enviados pelo OPL suportado, incluindo dialeto, modo de segurança, flags, capabilities, comprimentos de senha, codificação de strings e forma de autenticação.
- **FR-004**: A solução MUST definir explicitamente quais combinações de usuário, senha, guest e anônimo são suportadas e MUST NOT habilitar acesso mais permissivo como fallback silencioso.
- **FR-005**: Sessões aceitas MUST receber identificadores válidos e manter ciclo de vida coerente de sessão, árvore, arquivos, buscas e desconexão, isolado por cliente.
- **FR-006**: O nome do compartilhamento, comparação de caixa, normalização de caminho e semântica de listagem/leitura MUST corresponder ao comportamento necessário para o OPL navegar e iniciar jogos sem escapar da biblioteca autorizada.
- **FR-007**: Leituras MUST respeitar offsets, limites, respostas de fim de arquivo, arquivos maiores que 4 GiB e status esperados pelo cliente, sem alterar o conteúdo compartilhado.
- **FR-008**: Erros SMB MUST usar status coerente com a fase e MUST NOT revelar se usuário ou senha individualmente causaram a falha.
- **FR-009**: O sistema MUST oferecer debug SMB configurável com, quando aplicável, cliente, comando, dialeto, modo de segurança, intenção guest/anônima, flags, status e identificadores, sem registrar credenciais ou material autenticador reutilizável.
- **FR-010**: MUST existir um Hardware Smoke Test documentado que registre PS2, versão exata do OPL, configuração não secreta, negociação, sessão, conexão à árvore, listagem e leitura de jogo.
- **FR-011**: Parsing e serialização dos comandos suportados MUST possuir testes de limites e regressão; a configuração OPL suportada MUST provar que `SESSION_SETUP_ANDX` não retorna `0xc000006d`.

#### Identidade e distribuição

- **FR-012**: Toda instalação Windows MUST usar os assets oficiais versionados do OPL Forge de forma determinística no instalador, executável, atalhos, menu Iniciar, lista de aplicativos e identidade da janela/barra de tarefas quando aplicável.
- **FR-013**: A identidade distribuída MUST NOT depender de fallback do runtime ou de asset presente somente na máquina do mantenedor.
- **FR-014**: A correção de identidade MUST preservar a geração e inicialização dos formatos macOS e Linux já suportados e documentar limitações de assinatura ou plataforma.
- **FR-015**: A release MUST ter uma única fonte de verdade para a versão pública e validar sua correspondência com tag, nome da release, aplicativo, instaladores, artefatos e metadados de update antes da publicação.
- **FR-016**: A convenção pública MUST seguir `1.x.x.x`; qualquer representação interna exigida por ferramenta incompatível com quatro segmentos MUST ser uma decisão explícita do plano, documentada e testada, nunca uma transformação silenciosa.
- **FR-017**: A pipeline MUST falhar antes da publicação quando versão, tag, artefato ou metadata de update divergir da versão oficial.
- **FR-018**: A release Windows MUST publicar somente o instalador escolhido e os arquivos técnicos necessários ao updater; executáveis portáteis, unpacked ou intermediários MUST permanecer fora da release pública.
- **FR-019**: A matriz de release MUST gerar os formatos Windows, macOS e Linux suportados em uma única execução lógica e MUST NOT manter jobs com versionamento conflitante.
- **FR-020**: Cada release MUST ser rastreável ao código-fonte, versão e conjunto de assets que a produziu, e builds repetidos desses mesmos insumos MUST manter identidade e nomenclatura equivalentes.

#### Atualização integrada

- **FR-021**: Uma instalação distribuída MUST conseguir consultar exclusivamente a origem oficial configurada, determinar atualização elegível, baixar, preparar e aplicar uma nova versão após consentimento aplicável.
- **FR-022**: O modelo de atualização MUST expor estados não ambíguos equivalentes a `IDLE`, `CHECKING`, `UPDATE_AVAILABLE`, `NO_UPDATE`, `DOWNLOADING`, `READY_TO_INSTALL`, `INSTALLING` e `ERROR`.
- **FR-023**: A UI MUST mostrar versão atual, nova versão, notas e tamanho quando disponíveis, progresso de download, ação de adiar e ação de reiniciar/aplicar quando pronta.
- **FR-024**: O usuário MUST poder escolher entre verificar automaticamente, perguntar antes de baixar, baixar automaticamente e não verificar automaticamente; a política MUST persistir localmente.
- **FR-025**: Independentemente da política automática, as Configurações MUST oferecer "Verificar atualizações" e apresentar conclusão ou falha acionável.
- **FR-026**: Nenhuma política MUST instalar ou reiniciar silenciosamente; aplicação do update exige ação explícita do usuário e deve alertar sobre operações longas ativas.
- **FR-027**: Verificação e download MUST ocorrer sem bloquear o uso normal; falha, interrupção ou metadata inválida MUST NOT impedir inicialização nem executar pacote incompleto.
- **FR-028**: O renderer MUST NOT fornecer URL arbitrária de update nem receber acesso privilegiado genérico; somente operações estreitas e validadas podem atravessar o limite da aplicação.
- **FR-029**: Drafts, prereleases, downgrades e canais diferentes MUST obedecer a uma política explícita e previsível.
- **FR-030**: O fluxo de release MUST provar, por cenário documentado ou automatizado, versão N instalada, detecção de N+1, download, reinício/aplicação e retorno em N+1.

#### Arte local e semântica da Biblioteca

- **FR-031**: O scan da biblioteca MUST indexar `ART/` de forma confinada ao dispositivo e associar assets válidos ao Game ID normalizado sem modificar arquivos.
- **FR-032**: O índice MUST reconhecer os tipos `ICO`, `COV`, `COV2`, `LAB`, `LGO`, `SCR`, `SCR2` e `BG` já suportados pelo produto e registrar tipo, validade e origem.
- **FR-033**: A arte primária do card MUST usar `COV` válido, depois `COV2` válido e, na ausência de ambos, um placeholder; arte auxiliar não pode ser apresentada como capa sem regra futura explícita.
- **FR-034**: A aplicação MUST disponibilizar a arte ao renderer por uma representação segura e confinada, sem expor acesso genérico ao sistema de arquivos e sem confundir caminho do jogo com caminho da capa.
- **FR-035**: Grade, lista e detalhe MUST apresentar a mesma associação de capa e refletir invalidação quando `ART/`, Game ID, dispositivo ou arquivo mudar.
- **FR-036**: Arquivos de arte inválidos MUST ser rejeitados sem substituir ou ocultar uma arte válida anterior; duplicatas MUST seguir precedência determinística e produzir evidência de ambiguidade.
- **FR-037**: A Biblioteca MUST manter navegação, filtro e carregamento utilizáveis com aproximadamente 500 jogos, evitando decodificar simultaneamente todas as imagens completas.
- **FR-038**: Remoção/troca de dispositivo durante indexação MUST impedir publicação de retrato parcial e liberar recursos associados ao dispositivo anterior.
- **FR-039**: O modelo MUST separar prontidão estrutural de completude de arte e metadados; ausência isolada de arte MUST NOT produzir estado crítico de prontidão.
- **FR-040**: O estado de cada jogo MUST preservar causas distinguíveis para pronto, validação necessária, nome inválido, fragmentação, incompletude, arte ausente, metadados ausentes e desconhecido, ainda que a UI agrupe causas de mesma ação.
- **FR-041**: Badges e detalhes MUST explicar a causa e próxima ação; "Atenção" MUST NOT ser usado como estado catch-all sem causa acessível.
- **FR-042**: Fixtures de teste MUST cobrir Game IDs conhecidos, `COV`, fallback `COV2`, artes auxiliares, ausência, arquivo inválido, duplicata e remoção de dispositivo.

#### Destino de download desacoplado

- **FR-043**: Ao enfileirar conteúdo, o usuário MUST escolher uma intenção clara entre "Dispositivo OPL" e "Este computador".
- **FR-044**: "Este computador" MUST permitir escolher uma pasta local autorizada e MUST NOT exigir dispositivo OPL ativo.
- **FR-045**: Downloads locais MUST usar transferência durável, staging quando necessário e validação mínima de conclusão antes da promoção ao destino escolhido.
- **FR-046**: No destino local, o arquivo MUST preservar nome e formato apropriados à origem e MUST NOT receber estrutura, renomeação ou finalização OPL implicitamente.
- **FR-047**: No destino OPL, o pipeline existente de inspeção, planejamento, confirmação, instalação e verificação MUST permanecer obrigatório.
- **FR-048**: O estado persistido da tarefa MUST distinguir intenção, destino local autorizado ou identidade do dispositivo, fase, progresso e resultado para permitir retomada e reconciliação corretas.
- **FR-049**: Falha de espaço, pasta removida, colisão, permissão ou validação MUST afetar somente a tarefa correspondente e MUST NOT promover parcial como concluído.
- **FR-050**: A escolha local MUST respeitar confirmação legal existente para conteúdo do catálogo e não altera a origem nem a responsabilidade registrada.
- **FR-051**: Download local MUST NOT iniciar PCSX2 automaticamente; uma ação posterior explícita MAY ser oferecida quando a integração estiver disponível.

#### Progresso de importação

- **FR-052**: Toda importação/cópia longa MUST possuir identidade de operação e emitir eventos correlacionados com origem, alvo, jogo quando conhecido, fase, bytes processados, bytes totais, percentual, status e timestamps; velocidade e estimativa são incluídas somente quando confiáveis.
- **FR-053**: As fases observáveis MUST corresponder ao trabalho real e representar, quando aplicáveis, fila, validação, cópia, verificação, finalização, conclusão, falha e cancelamento.
- **FR-054**: Percentual MUST permanecer entre 0 e 100, ser monotônico dentro de cada fase e concordar com bytes processados na conclusão.
- **FR-055**: A UI de adição e o Activity Drawer existente MUST refletir a mesma operação, mostrando item, fase, percentual, bytes e mensagem amigável sem bloquear o renderer.
- **FR-056**: Lotes MUST mostrar progresso global, posição/quantidade concluída, item atual e fila restante, preservando resultado individual de cada item.
- **FR-057**: Erro de origem, espaço, leitura, escrita, validação ou remoção do dispositivo MUST produzir estado final controlado, manter destino anterior válido e oferecer ação compatível de repetição ou recuperação.
- **FR-058**: Cancelamento MUST ser oferecido somente em fases em que possa interromper com segurança, fechar recursos e conciliar staging sem corromper destino anterior.
- **FR-059**: Encerramento ou crash MUST NOT transformar parcial em sucesso; na próxima abertura, a operação deve ser reconciliada e apresentar estado e ação disponíveis.
- **FR-060**: Eventos de progresso MUST ser limitados a uma frequência que mantenha feedback contínuo sem saturar a interface ou os logs.

#### Contratos, segurança e privacidade

- **FR-061**: Capacidades novas MUST preservar o limite renderer → API da aplicação → bridge isolada → IPC → serviço privilegiado; componentes de interface MUST NOT acessar filesystem, rede ou runtime diretamente.
- **FR-062**: Novos comandos e eventos MUST ter contratos compartilhados explícitos, inputs validados e erros serializáveis e controlados.
- **FR-063**: Paths de arte, importação, destino local e biblioteca compartilhada MUST ser normalizados, confinados à raiz autorizada e protegidos contra traversal, links, colisão e troca de dispositivo.
- **FR-064**: Operações que substituem conteúdo MUST preservar staging, confirmação aplicável, verificação e recuperação definidos pelas features anteriores.
- **FR-065**: Logs MUST permanecer locais; a feature MUST NOT adicionar telemetria remota obrigatória nem enviar informações da biblioteca ou jogos durante verificações de update.
- **FR-066**: A consulta de atualização MUST compartilhar somente os dados mínimos requeridos pelo mecanismo oficial e MUST NOT aceitar origem controlada pelo renderer.
- **FR-067**: Todos os testes afetados de regras, contratos, segurança, integração e regressão MUST acompanhar as mudanças, e os fluxos de hardware/release que não possam ser totalmente automatizados MUST ter roteiros e evidências explícitos.

### Key Entities

- **Release Identity**: Versão pública oficial e suas representações verificadas em tag, aplicativo, release, instaladores, artefatos e metadata de atualização.
- **Release Artifact**: Arquivo distribuível ou técnico associado a plataforma, arquitetura, versão, finalidade pública/interna e elegibilidade para publicação/update.
- **Update Policy**: Preferência local que define verificação e download automáticos, preservando sempre consentimento para instalação/reinício.
- **Update Session**: Estado de uma verificação/download/aplicação, com versões, progresso, release elegível, erro controlado e ações disponíveis.
- **SMB Compatibility Profile**: Comportamento documentado de uma versão OPL suportada, incluindo dialeto, segurança, autenticação, strings, capabilities e comandos necessários, sem guardar segredos.
- **SMB Client Session**: Sessão isolada por cliente contendo fase, identificadores, árvore, handles, atividade e resultado sanitizado.
- **Hardware Smoke Record**: Evidência do teste em PS2 físico, incluindo hardware, versão OPL, configuração não secreta, marcos esperados e resultado.
- **Local Art Record**: Associação entre dispositivo, Game ID, tipo OPL, arquivo validado, precedência, validade e revisão do índice.
- **Library Health Cause**: Causa específica e acionável de prontidão, validação, nome, fragmentação, integridade, arte ou metadados.
- **Download Intent**: Escolha entre instalação OPL e retenção local, com destino autorizado, política de promoção e ações posteriores.
- **Import Operation**: Operação durável individual ou em lote, com itens, fases, bytes, progresso, estado, staging e recuperação.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% de pelo menos três instalações Windows limpas testadas exibem o ícone oficial no instalador, executável, atalho, menu Iniciar, lista de aplicativos e janela/barra de tarefas aplicável, sem ícone Electron.
- **SC-002**: 100% das releases candidatas aprovadas apresentam a mesma versão oficial na tag, nome da release, aplicativo, instaladores, artefatos e metadata de atualização; qualquer divergência bloqueia a publicação.
- **SC-003**: Cada release Windows pública contém exatamente um instalador destinado ao usuário, além apenas dos arquivos técnicos comprovadamente necessários ao updater, e nenhum executável alternativo ambíguo.
- **SC-004**: Em três ciclos consecutivos N → N+1, a instalação anterior detecta a release elegível, apresenta seus dados e alcança o estado pronta para instalar sem reinstalação manual.
- **SC-005**: Em três ciclos completos de update, o usuário baixa, confirma, reinicia e retorna na versão N+1; falhas simuladas de rede ou pacote nunca resultam em versão parcialmente aplicada.
- **SC-006**: Um PS2 físico executando a versão OPL suportada completa negociação, `SESSION_SETUP_ANDX`, conexão à árvore, listagem e leitura inicial de pelo menos um jogo em três tentativas consecutivas sem `0xc000006d`.
- **SC-007**: 100% dos jogos da fixture com `COV` ou fallback `COV2` válido exibem a capa correta em grade, lista e detalhe; 100% dos inválidos/ausentes usam placeholder sem degradar prontidão estrutural.
- **SC-008**: Com aproximadamente 500 jogos e suas artes, busca, filtro, abertura do detalhe e rolagem permanecem utilizáveis, sem congelamento superior a 2 segundos no ambiente de referência e sem carregar todas as imagens completas de uma vez.
- **SC-009**: Em 100% dos cenários locais válidos, o usuário enfileira e conclui download em pasta escolhida sem dispositivo OPL; nenhum deles recebe estrutura OPL ou abre o PCSX2 automaticamente.
- **SC-010**: Toda importação/cópia de teste superior a 256 MiB apresenta ao menos identificação, fase, bytes e percentual desde o início observável até sucesso, falha ou cancelamento.
- **SC-011**: Em 100% dos eventos de importação, `0 ≤ percentual ≤ 100`, o progresso é monotônico por fase e a conclusão concorda com o total de bytes; a interface não congela por mais de 2 segundos no ambiente de referência.
- **SC-012**: Em um lote de pelo menos sete jogos, a UI informa continuamente item atual, concluídos e restantes, e produz exatamente um resultado final por item mesmo com uma falha simulada.
- **SC-013**: 100% dos estados de Biblioteca avaliados apresentam uma causa específica; ausência de arte ou metadata nunca aparece isoladamente como alerta estrutural genérico.
- **SC-014**: 100% dos logs de autenticação e update inspecionados contêm contexto suficiente para correlacionar a falha e zero credenciais, tokens, respostas reutilizáveis ou nomes de jogos enviados remotamente.
- **SC-015**: Windows, macOS e Linux completam o smoke de empacotamento e inicialização da release candidata, ou uma limitação de assinatura/hardware é registrada com responsável e evidência antes da publicação.

## Assumptions

- A convenção pública desejada permanece `1.x.x.x`; a representação interna compatível com ferramentas de três segmentos será decidida no plano após validar limitações reais.
- A origem oficial de updates continua sendo a infraestrutura de releases do repositório do projeto; não haverá canais ou URLs arbitrárias configuradas pelo usuário nesta feature.
- A release Windows distribuída usa um instalador NSIS como único executável público; arquivos de metadata do updater não contam como executáveis concorrentes.
- O escopo de compatibilidade SMB é o cliente SMB1 usado pela versão OPL registrada no Hardware Smoke Test, sem promessa de servidor SMB geral, SMB2 ou SMB3.
- Guest/anônimo e credenciais vazias não serão habilitados por conveniência; somente serão suportados quando necessários ao perfil OPL validado e explicitamente selecionados pelo usuário.
- Assets OPL válidos usam os tipos e convenção de Game ID já reconhecidos pelo produto; `COV` precede `COV2` como capa principal.
- O limiar de 256 MiB para SC-010 define uma operação certamente longa sem dispensar progresso em cópias menores quando ele já for disponível.
- Downloads para o computador mantêm a confirmação legal e validação de origem existentes, mas não exigem planejamento de formato OPL.
- Activity Drawer, fila durável, staging, catálogo e índice de arte existentes serão evoluídos, não substituídos por infraestruturas paralelas.

## Scope Boundaries

### In Scope

- Os oito problemas originais: identidade Windows; SMB com OPL real; versão única; artefato Windows único; atualização in-app; artes locais na Biblioteca; destino local de download; progresso de importação.
- Auditoria e correção semântica do estado "Atenção" quando relacionada à prontidão, arte e metadata.
- Regressão cross-platform de identidade, empacotamento e inicialização nos formatos já suportados.
- Testes automatizados proporcionais e roteiros/evidências manuais para hardware e atualização instalada.

### Out of Scope

- Redesign completo da arquitetura de informação ou do design system.
- Android, cloud sync, contas, autenticação online ou telemetria remota obrigatória.
- Novo catálogo remoto, alteração do formato OPL ou substituição do framework da aplicação.
- Reescrita completa do SMB antes de investigar o defeito ou suporte SMB2/SMB3 sem necessidade comprovada.
- Estratégia específica de biblioteca SMB, updater ou cache de arte nesta fase de especificação.
- Mudanças destrutivas em dispositivo sem relação direta com estes fluxos.

## Dependencies

- Features 001–003: catálogo, Game ID, staging, instalação transacional, fila durável, progresso, arte e recuperação.
- Feature 004: Biblioteca unificada, grade/lista/detalhe e Activity Drawer.
- Feature 005: configuração, segurança local, observabilidade e servidores de compartilhamento.
- Infraestrutura atual de empacotamento multiplataforma, workflow de release e repositório oficial de releases.
- Assets oficiais versionados adequados aos formatos exigidos por cada plataforma.
- PS2 físico acessível, versão OPL identificada e rede local controlada para o teste definitivo.
- Duas versões publicáveis controladas para validar update N → N+1 sem afetar usuários estáveis.

## Risks

- O cliente SMB do OPL pode divergir da interpretação documental ou entre versões; mitigação: capturar comportamento seguro, criar perfil explícito e exigir teste físico.
- A convenção pública de quatro segmentos pode conflitar com ferramentas de empacotamento/update; mitigação: pesquisa obrigatória no plano e validação antes de fixar mapeamento.
- Update sem assinatura adequada pode ser bloqueado pelo sistema operacional; mitigação: documentar requisitos de assinatura/notarização e não classificar fluxo como aprovado sem evidência.
- Expor artes locais ao renderer pode ampliar acesso a arquivos; mitigação: representação estreita, confinada e revogada com o dispositivo.
- Indexação/decodificação de muitas capas pode degradar memória e UI; mitigação: limites mensuráveis e estratégia escolhida no plano.
- Destino local amplia combinações de recuperação, colisão e espaço; mitigação: intenção persistida, staging e promoção explícita.
- Eventos de cópia muito frequentes podem saturar IPC/UI; mitigação: progresso monotônico com frequência limitada e medição no plano.
- Alterar semântica de status pode afetar testes e consumidores existentes; mitigação: migração explícita de contratos e regressão de cada causa.

## Required Plan Investigations

- Validar a cadeia de assets e metadata de identidade em todas as etapas do instalador Windows e smoke cross-platform.
- Determinar a fonte única de versão e compatibilidade real da convenção `1.x.x.x` com aplicativo, instalador, updater e sistemas operacionais.
- Auditar triggers, permissões, matriz, uploads, publicação e metadata do workflow, eliminando versão e `.exe` redundantes.
- Escolher a estratégia de updater suportada e sua política de assinatura, canais, retomada, eventos e teste N → N+1.
- Comparar o handshake real do OPL com negociação, autenticação, codificação, flags, IDs, árvore, listagem e leitura atuais antes de decidir corrigir ou substituir componentes SMB.
- Definir a captura sanitizada e matriz de Hardware Smoke Test por versão OPL.
- Definir representação segura, thumbnails/lazy loading/cache e invalidação do índice local de arte sem escolher tecnologia prematuramente.
- Definir migração dos estados de Biblioteca e compatibilidade com retratos persistidos/consumidores atuais.
- Definir modelo durável de intenção/destino local e recuperação sem duplicar o pipeline existente.
- Definir contrato de progresso, frequência de eventos, progresso agregado e cancelamento seguro das importações.

## Constitutional Compliance

- **Principle I**: Downloads continuam exigindo confirmação legal; substituições, descartes e reinícios durante operações ativas exigem alvo e confirmação apropriados.
- **Principle II**: Atualização, filesystem, SMB e arte permanecem privilegiados; a interface recebe apenas contratos estreitos, sem URL arbitrária ou acesso Node.
- **Principle III**: Todas as capacidades atravessam os limites tipados existentes, com validação de novos inputs e eventos compartilhados.
- **Principle IV**: Download, importação e update possuem estados, staging, progresso, falha e recuperação; logs são locais, correlacionados e sanitizados.
- **Principle V**: Cada defeito reproduzível recebe regressão automatizada quando possível; hardware, clean install e update instalado recebem roteiros e evidências explícitos.

## Original Problem Traceability

| #   | Problema original             | User story | Requisitos principais | Critérios de sucesso   |
| --- | ----------------------------- | ---------- | --------------------- | ---------------------- |
| 1   | Identidade Windows incorreta  | US2        | FR-012–FR-014         | SC-001, SC-015         |
| 2   | Falha SMB com OPL real        | US1, US8   | FR-001–FR-011         | SC-006, SC-014         |
| 3   | Versionamento inconsistente   | US2, US7   | FR-015–FR-017, FR-020 | SC-002                 |
| 4   | Artefato Windows redundante   | US2, US7   | FR-018–FR-019         | SC-003                 |
| 5   | Ausência de update in-app     | US2, US6   | FR-021–FR-030         | SC-004, SC-005         |
| 6   | Capas locais ausentes         | US3        | FR-031–FR-042         | SC-007, SC-008, SC-013 |
| 7   | Download exige dispositivo    | US4        | FR-043–FR-051         | SC-009                 |
| 8   | Importação sem progresso útil | US5        | FR-052–FR-060         | SC-010–SC-012          |
