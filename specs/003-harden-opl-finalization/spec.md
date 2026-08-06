# Feature Specification: Finalização OPL confiável e resiliente

**Feature Branch**: `003-harden-opl-finalization`

**Created**: 2026-08-06

**Status**: Draft

**Input**: User description: "Investigar os problemas de fragmentação e crashes em downloads simultâneos do Essentials, adequar automaticamente jogos baixados ao padrão de nomes aceito pelo OPL, sincronizar artes em massa e usar o OPL Manager V24 como referência funcional confiável."

## Contexto e análise de lacunas

Esta especificação trata o download como o início de uma instalação e não como uma simples cópia de arquivo. Um jogo só está concluído quando o conteúdo foi validado, transformado para o formato compatível com o dispositivo, gravado de modo seguro, nomeado de forma canônica, verificado no destino, catalogado e associado às artes disponíveis.

A análise comparativa do OPL Forge atual com o OPL Manager V24 identificou as seguintes lacunas observáveis:

1. **Gravações concorrentes no dispositivo**: todos os itens selecionados no Essentials começam a gravar simultaneamente no mesmo dispositivo. As alocações físicas podem ficar intercaladas e o rename posterior mantém essa distribuição, tornando plausíveis os alertas de fragmentação no PS2.
2. **Finalização ignora a capacidade do filesystem**: o fluxo direto do Essentials não passa pelo planejamento de instalação já existente. Em especial, uma imagem acima de 4 GiB pode ser destinada como arquivo único a FAT32 em vez de ser instalada no formato multipartes aceito pelo OPL.
3. **Sucesso prematuro**: conclusão da transferência pode ser apresentada como conclusão do jogo antes de validar imagem, Game ID, tamanho, integridade, formato de destino e distribuição física.
4. **Nome remoto preservado no destino**: o arquivo baixado é movido com o nome fornecido pela origem, mesmo quando não segue o formato canônico `<GAME_ID>.<TÍTULO>.<extensão>`, por exemplo `SLUS_123.45.Nome do Jogo.iso`.
5. **Detecção de identidade insuficiente no caminho de download**: a identificação pode depender do nome ou de uma leitura superficial, enquanto o OPL Manager usa o conteúdo da mídia como fonte autoritativa para o ID no formato moderno.
6. **Normalização existente não é aplicada de ponta a ponta**: o Forge já possui regras canônicas no importador, mas o Essentials contorna esse fluxo e não oferece correção em lote dos jogos legados já presentes.
7. **Fila volátil**: tarefas, progresso detalhado e vínculo com arquivos parciais ficam somente em memória. Reiniciar ou sofrer um crash perde o estado operacional necessário para retomar ou explicar o resultado.
8. **Concorrência sem limite operacional claro**: lotes grandes iniciam transferências sem um limite por dispositivo, aumentando pressão de memória, rede, descritores e I/O, além de agravar fragmentação.
9. **Cancelamento incompleto**: a transferência direta não possui controle equivalente ao torrent para pausa, cancelamento e retomada; resíduos podem permanecer sem reconciliação.
10. **Artes em massa com alto custo de memória e rede**: o índice atual pode carregar arquivos compactados inteiros e a instalação pode baixar novamente o mesmo pacote para cada arte, favorecendo consumo excessivo e crashes.
11. **Sincronização de artes desacoplada da instalação**: o usuário precisa iniciar outro fluxo, e jogos recém-finalizados permanecem com arte ausente mesmo quando há correspondência segura por Game ID.
12. **Recuperação parcial**: importação e reparo possuem conceitos de staging e diário, mas a fila de downloads e sua transição para instalação não compartilham uma recuperação única de ponta a ponta.

O OPL Manager V24 fornece as referências funcionais adotadas: descoberta do Game ID dentro da imagem, suporte aos formatos antigo e novo de nomes, conversão em lote com prévia, catálogo USBExtreme por `ul.cfg` e partes, associação de oito categorias de arte pelo Art ID/Game ID e consulta de artes em lotes de até 500 jogos. Suas fragilidades de arquitetura, memória e tratamento de erro não devem ser reproduzidas.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Baixar e instalar sem provocar fragmentação (Priority: P1)

Como usuário do Essentials, quero selecionar vários jogos, inclusive maiores que 4 GiB, e receber instalações adequadas ao meu dispositivo sem que gravações concorrentes tornem os jogos fragmentados.

**Why this priority**: É o defeito central relatado e pode deixar jogos incompatíveis com o OPL mesmo quando a transferência termina com sucesso.

**Independent Test**: Selecionar simultaneamente pelo menos dez imagens, incluindo três acima de 4 GiB, para dispositivos FAT32 e não FAT32, concluir o lote e verificar formato, integridade e estado físico de cada instalação.

**Acceptance Scenarios**:

1. **Given** vários downloads para o mesmo dispositivo, **When** os dados são finalizados no destino OPL, **Then** somente uma instalação por dispositivo realiza a fase de gravação física por vez.
2. **Given** uma imagem maior que o limite de arquivo do dispositivo, **When** ela é finalizada, **Then** é instalada no formato multipartes aceito pelo perfil OPL, com catálogo e partes consistentes.
3. **Given** uma imagem que cabe como arquivo único e um dispositivo que suporta seu tamanho, **When** ela é finalizada, **Then** é instalada na pasta de mídia correta e sua distribuição física é verificada quando a plataforma oferecer verificação confiável.
4. **Given** uma instalação cuja verificação física acusa fragmentação, **When** a finalização termina, **Then** ela não é declarada pronta; o sistema tenta a correção segura aplicável ou a apresenta como falha acionável.
5. **Given** downloads de rede simultâneos para dispositivos distintos, **When** avançam, **Then** a política de escrita de um dispositivo não bloqueia desnecessariamente o outro.

---

### User Story 2 - Receber nomes canônicos reconhecidos pelo OPL (Priority: P1)

Como usuário, quero que todo jogo baixado ou importado seja salvo automaticamente no padrão `<GAME_ID>.<TÍTULO>.<extensão>`, com ID real obtido da mídia, para que o OPL o reconheça de forma previsível.

**Why this priority**: Um download íntegro continua inutilizável ou difícil de associar a metadados quando o nome e a identidade não seguem a convenção esperada.

**Independent Test**: Finalizar imagens com nomes remotos arbitrários, acentos, símbolos, IDs incorretos e títulos longos, e verificar os nomes propostos e finais sem alterar o conteúdo da mídia.

**Acceptance Scenarios**:

1. **Given** uma imagem válida com `SYSTEM.CNF` identificável, **When** a finalização é planejada, **Then** o Game ID interno normalizado é usado como autoridade e o nome final segue `AAAA_999.99.Título.iso` ou a extensão compatível.
2. **Given** o nome remoto contém um ID diferente do ID interno, **When** a imagem é validada, **Then** a divergência é registrada, o ID interno prevalece e o usuário vê a correção proposta.
3. **Given** um título com caracteres inválidos ou comprimento excessivo, **When** o nome canônico é criado, **Then** ele é sanitizado e truncado sem remover o ID, a extensão nem criar bytes inválidos para o destino.
4. **Given** o nome canônico já existe, **When** a finalização é planejada, **Then** nenhum arquivo é sobrescrito silenciosamente e o usuário recebe uma decisão segura baseada na identidade e integridade dos dois itens.
5. **Given** jogos existentes fora do padrão, **When** o usuário executa a adequação em lote, **Then** recebe uma prévia reversível com nome atual, nome proposto, ID detectado, conflitos e itens bloqueados antes de confirmar.

---

### User Story 3 - Retomar a fila depois de crash ou reinicialização (Priority: P1)

Como usuário, quero reabrir o Forge depois de um crash, queda de energia ou remoção do dispositivo e continuar do último ponto seguro sem perder o progresso dos demais jogos.

**Why this priority**: Lotes grandes levam horas; perder estado e progresso reduz severamente a confiabilidade do produto e pode deixar arquivos ambíguos no dispositivo.

**Independent Test**: Encerrar forçadamente a aplicação em cada fase de um lote, reabri-la e verificar reconciliação, retomada segura, integridade dos parciais e resultados independentes por item.

**Acceptance Scenarios**:

1. **Given** uma transferência parcial com origem retomável, **When** a aplicação reinicia, **Then** a tarefa reaparece com bytes confirmados e pode continuar sem baixar novamente a parte válida.
2. **Given** uma transferência parcial cuja origem não permite retomada segura, **When** a aplicação reinicia, **Then** o usuário é informado e pode reiniciar somente aquele item sem perder o restante da fila.
3. **Given** uma interrupção durante validação ou instalação, **When** a recuperação é executada, **Then** a última versão válida é preservada, nenhuma candidata parcial é promovida e a tarefa retorna a um estado explícito.
4. **Given** um dispositivo ausente na reabertura, **When** a fila é reconciliada, **Then** seus itens aguardam reconexão sem serem redirecionados automaticamente para outro dispositivo de nome semelhante.
5. **Given** um item falha ou é cancelado, **When** o lote continua, **Then** os demais itens independentes mantêm seu progresso e o erro não derruba o processo principal.

---

### User Story 4 - Sincronizar artes em massa após a instalação (Priority: P2)

Como usuário, quero baixar em massa as artes disponíveis dos jogos instalados e ter a sincronização iniciada automaticamente para jogos recém-finalizados, sem travamentos ou downloads redundantes.

**Why this priority**: A arte completa melhora a experiência no OPL e depende diretamente da identidade e nomenclatura corrigidas nas histórias anteriores.

**Independent Test**: Sincronizar uma biblioteca de 500 jogos com artes completas, parciais, ausentes, inválidas e já existentes, interromper a execução e retomá-la conferindo arquivos e relatório.

**Acceptance Scenarios**:

1. **Given** uma biblioteca catalogada, **When** o usuário solicita sincronização em massa, **Then** o sistema consulta e processa os jogos em lotes limitados, mostrando progresso por jogo e por categoria.
2. **Given** artes disponíveis, **When** a sincronização é confirmada, **Then** podem ser instaladas as categorias `ICO`, `COV`, `COV2`, `LAB`, `LGO`, `SCR`, `SCR2` e `BG` usando o Game ID/Art ID correto.
3. **Given** uma arte válida já instalada, **When** a política é preservar existentes, **Then** ela não é baixada nem sobrescrita.
4. **Given** uma arte inválida ou uma substituição autorizada, **When** a nova arte é instalada, **Then** a candidata é validada antes da troca e a versão anterior não é perdida em caso de falha.
5. **Given** vários itens usam o mesmo pacote remoto, **When** são sincronizados, **Then** os bytes compartilhados são transferidos no máximo uma vez por sessão válida e reutilizados de forma segura.
6. **Given** um jogo acaba de ser instalado e possui Game ID confiável, **When** a finalização termina, **Then** a busca de artes é enfileirada automaticamente sem bloquear a declaração de integridade do jogo.
7. **Given** a sincronização é interrompida, **When** o Forge reinicia, **Then** artes já validadas permanecem instaladas e somente itens pendentes ou falhos são elegíveis para nova tentativa.

---

### User Story 5 - Acompanhar um pipeline único e confiável (Priority: P2)

Como usuário, quero distinguir download, validação, instalação, verificação, nomenclatura e artes para saber se cada jogo está realmente pronto para o OPL.

**Why this priority**: Estados claros evitam falsos sucessos e permitem agir sobre erros sem compreender detalhes internos.

**Independent Test**: Executar um lote misto com sucessos, falhas de rede, imagem inválida, ID ausente, conflito de nome, fragmentação e arte ausente, conciliando todos os estados apresentados.

**Acceptance Scenarios**:

1. **Given** uma tarefa ativa, **When** o usuário consulta a fila, **Then** visualiza fase atual, progresso, destino, bytes, ação pendente e última atualização.
2. **Given** a transferência atingiu 100%, **When** a validação ou instalação ainda não terminou, **Then** o item não aparece como `pronto`.
3. **Given** a arte não foi encontrada, **When** o jogo foi instalado e verificado, **Then** o jogo permanece pronto com estado de arte ausente, sem transformar ausência de arte em falha da instalação.
4. **Given** um erro, **When** o usuário abre os detalhes, **Then** vê a fase, causa, efeito sobre os dados, possibilidade de retomada e ação recomendada.

---

### User Story 6 - Adequar biblioteca existente com segurança (Priority: P3)

Como usuário com um dispositivo já preenchido, quero diagnosticar e corrigir nomes e artes fora do padrão sem baixar novamente os jogos nem misturar instalações duplicadas.

**Why this priority**: Permite recuperar o acervo criado por versões anteriores, mas depende das regras seguras de identidade e transação.

**Independent Test**: Usar uma biblioteca com nomes antigos, novos, arbitrários, IDs duplicados, USBExtreme e artes parciais; gerar plano, cancelar sem alterações e depois confirmar verificando rollback e relatório.

**Acceptance Scenarios**:

1. **Given** uma biblioteca existente, **When** o diagnóstico é executado, **Then** cada jogo é classificado como canônico, corrigível, conflitante, sem ID ou não suportado.
2. **Given** correções sem conflito, **When** o plano é confirmado, **Then** os renames preservam conteúdo, distribuição física e associações por Game ID.
3. **Given** Game IDs duplicados em instalações distintas, **When** o plano é criado, **Then** os jogos não são mesclados e o conflito exige decisão explícita.
4. **Given** uma falha no meio do lote, **When** a operação termina ou é recuperada, **Then** cada rename tem resultado próprio e nenhuma instalação fica com nome temporário como versão ativa.

### Edge Cases

- O servidor altera conteúdo, tamanho, ETag ou data durante uma retomada.
- O servidor informa tamanho ausente ou incorreto, ou ignora uma solicitação de continuação.
- O espaço livre muda entre planejamento, download, transformação e promoção.
- A raiz de staging local e o dispositivo final estão em filesystems diferentes.
- Um arquivo de exatamente 4 GiB, `4 GiB - 1 byte` ou `4 GiB + 1 byte` é destinado a FAT32.
- A imagem usa camada dupla, mídia CD identificada como DVD pela origem, ZSO suportado ou extensão em caixa incomum.
- O `SYSTEM.CNF` está ausente, corrompido, usa variação válida de sintaxe ou contém ID divergente do catálogo remoto.
- O título sanitizado fica vazio, dois títulos geram o mesmo nome ou o limite do caminho completo é excedido.
- `ul.cfg` está ausente, truncado, duplicado ou referencia partes incompletas.
- O dispositivo é removido durante gravação, verificação, rename, atualização de `ul.cfg` ou instalação de arte.
- O mesmo dispositivo reaparece com ponto de montagem, letra ou rótulo diferente; ou outro dispositivo aparece com o mesmo rótulo.
- O usuário pausa ou cancela no limite entre duas fases.
- O processo encerra antes ou depois de persistir um checkpoint, mas antes de emitir a atualização visual.
- A arte remota é inválida, excede limites seguros, tem extensão enganosa, falha no meio ou tenta escapar do diretório `ART`.
- Duas fontes oferecem artes diferentes para o mesmo ID e categoria.
- O pacote remoto de artes muda entre a indexação e a extração.
- A biblioteca contém 500 ou mais jogos e milhares de artes sem memória suficiente para manter pacotes inteiros.
- O diagnóstico físico não está disponível ou não é confiável na plataforma/filesystem atual.
- Um antivírus ou outro processo bloqueia um arquivo parcial, final ou de arte.

## Requirements _(mandatory)_

### Functional Requirements

#### Orquestração, fragmentação e compatibilidade

- **FR-001**: O sistema MUST tratar cada item do Essentials como um pipeline durável composto por fila, transferência, validação, planejamento, instalação, verificação, catalogação e sincronização de arte.
- **FR-002**: O estado `pronto` MUST ser atribuído somente após validação e instalação final; 100% de transferência MUST NOT implicar instalação concluída.
- **FR-003**: O sistema MUST limitar a uma única gravação de instalação ativa por dispositivo físico, independentemente de quantas transferências de rede estejam ativas.
- **FR-004**: O sistema MUST permitir limites configuráveis e seguros para transferências simultâneas, aplicando contrapressão ao restante da fila.
- **FR-005**: Tarefas destinadas a dispositivos físicos distintos MAY avançar em paralelo, desde que respeitem os limites globais de recursos.
- **FR-006**: Antes da transferência e novamente antes da instalação, o sistema MUST verificar filesystem, limite de arquivo, perfil OPL, espaço livre, espaço temporário e identidade do dispositivo.
- **FR-007**: Para mídia cujo tamanho excede o limite de arquivo do destino, o sistema MUST selecionar automaticamente um formato multipartes suportado pelo OPL e MUST NOT tentar promover um arquivo único incompatível.
- **FR-008**: Instalações multipartes MUST manter partes, quantidade, nomes, ordem e entrada de catálogo como uma única transação recuperável.
- **FR-009**: Quando o destino aceitar a imagem em arquivo único, o sistema MUST selecionar a pasta `CD` ou `DVD` a partir da mídia validada, e não apenas da classificação fornecida pela origem.
- **FR-010**: A gravação final MUST usar uma candidata isolada e MUST preservar a última instalação válida até que conteúdo, estrutura e metadados da candidata sejam aprovados.
- **FR-011**: Quando houver verificação física confiável, cada arquivo de jogo promovido MUST ser verificado quanto à contiguidade antes de ser declarado pronto.
- **FR-012**: Uma instalação verificada como fragmentada MUST NOT ser declarada pronta e MUST ser encaminhada à correção segura existente ou marcada com orientação acionável.
- **FR-013**: Quando a verificação física não estiver disponível, o sistema MUST declarar `não verificável`, informar a limitação e MUST NOT afirmar que o arquivo está contíguo.
- **FR-014**: A promoção por rename ou movimentação no mesmo filesystem MUST NOT ser tratada como correção de fragmentação sem nova evidência física.
- **FR-015**: O resultado final MUST registrar o formato instalado, paths, tamanhos, hashes disponíveis, identificação, estado físico e capacidade de verificação.

#### Identidade e nomenclatura OPL

- **FR-016**: Para ISO, o sistema MUST extrair e validar o Game ID do conteúdo da mídia antes de formar o destino final.
- **FR-017**: O Game ID MUST ser normalizado no formato `AAAA_999.99`; um ID proveniente apenas do nome ou catálogo MUST ser tratado como provisório até confirmação pela mídia quando isso for possível.
- **FR-018**: O formato canônico padrão para imagens finalizadas MUST ser `<GAME_ID>.<TÍTULO_SANITIZADO>.<extensão>`, preservando a extensão compatível em caixa normalizada.
- **FR-019**: O título MUST ser sanitizado conforme as restrições do OPL e do filesystem, com limite em bytes que preserve integralmente Game ID, separadores e extensão.
- **FR-020**: Divergências entre ID interno, ID do nome e metadados remotos MUST ser exibidas e registradas; o ID interno validado MUST prevalecer por padrão.
- **FR-021**: Imagens sem ID confiável MUST permanecer em staging e MUST NOT ser promovidas automaticamente; o usuário MUST poder fornecer uma correção explícita sujeita à validação de formato.
- **FR-022**: Colisões de destino MUST bloquear sobrescrita silenciosa e apresentar, no mínimo, identidade, tamanho e integridade dos itens envolvidos.
- **FR-023**: O sistema MUST oferecer diagnóstico e adequação em lote para imagens existentes em `CD` e `DVD`, com prévia completa e confirmação antes de qualquer rename.
- **FR-024**: Adequação de nome MUST preservar bytes do conteúdo, distribuição física, mídia, configurações e artes associadas.
- **FR-025**: Renames em lote MUST ser transacionais por item, possuir registro recuperável e impedir que nomes temporários sejam catalogados como jogos ativos.
- **FR-026**: Game ID MUST NOT ser usado sozinho como identidade exclusiva; dispositivo, formato e paths MUST distinguir instalações duplicadas.
- **FR-027**: O sistema MUST manter compatibilidade de leitura com nomes antigos e novos reconhecidos pelo OPL Manager, mas MUST usar o formato canônico definido nesta feature para novas finalizações.

#### Fila durável, retomada e proteção contra crashes

- **FR-028**: Tarefas e checkpoints MUST sobreviver ao fechamento, crash e reinicialização da aplicação, incluindo origem, destino, dispositivo, fase, bytes confirmados, tentativas, erro e timestamps.
- **FR-029**: O sistema MUST persistir transições críticas antes de apresentá-las como concluídas e MUST reconciliar estado persistido, arquivos parciais e dispositivo ao iniciar.
- **FR-030**: Retomada MUST validar que origem e conteúdo remoto continuam equivalentes ao download parcial; em caso de divergência, somente o item afetado MUST ser reiniciado.
- **FR-031**: Quando a origem não oferecer retomada segura, o sistema MUST informar a limitação e preservar o restante da fila.
- **FR-032**: Pausa e cancelamento MUST interromper atividade futura do item em todas as modalidades de transferência, fechar recursos e levar a tarefa a um estado persistente conhecido.
- **FR-033**: Cancelamento MUST distinguir preservar parcial para retomada de descartar parcial; descarte MUST exigir confirmação quando remover dados relevantes.
- **FR-034**: Uma falha de tarefa MUST ser isolada e MUST NOT encerrar o processo principal, apagar progresso de outras tarefas ou impedir continuidade de itens independentes.
- **FR-035**: O sistema MUST controlar consumo simultâneo de memória, conexões, arquivos abertos, banda e I/O, mantendo a interface responsiva durante lotes grandes.
- **FR-036**: Downloads e extrações MUST processar conteúdo incrementalmente; tamanho total de uma imagem ou pacote remoto MUST NOT determinar consumo equivalente de memória.
- **FR-037**: O sistema MUST detectar dispositivo ausente ou substituído e suspender tarefas associadas até validar a mesma identidade física.
- **FR-038**: Falha de espaço, leitura, escrita, rede, validação ou remoção MUST impedir novas promoções do item e preservar ou restaurar a última versão válida.
- **FR-039**: O sistema MUST fornecer repetição individual e repetição apenas dos falhos, sem recriar tarefas concluídas ou perder a ordem escolhida.
- **FR-040**: Retenção e limpeza de staging MUST usar estados explícitos; nenhum parcial ou candidato pode ser removido durante recuperação sem provar que não é a última cópia válida.

#### Artes em massa

- **FR-041**: O sistema MUST mapear artes por Game ID/Art ID normalizado e suportar `ICO`, `COV`, `COV2`, `LAB`, `LGO`, `SCR`, `SCR2` e `BG`.
- **FR-042**: A sincronização MUST oferecer escopo de jogo individual, selecionados, ausentes e biblioteca completa.
- **FR-043**: A busca remota MUST ser particionada em lotes de no máximo 500 jogos por solicitação lógica e MUST permitir cancelamento entre lotes.
- **FR-044**: O usuário MUST poder escolher categorias e política de `preservar existente`, `substituir inválida` ou `substituir confirmada`, com `preservar existente` como padrão.
- **FR-045**: Cada arte MUST ser validada quanto a tipo, conteúdo, tamanho seguro e nome final antes da promoção para `ART`.
- **FR-046**: A instalação de arte MUST usar candidata isolada e substituição recuperável; falha de uma arte MUST NOT corromper a existente nem interromper jogos independentes.
- **FR-047**: Pacotes remotos compartilhados MUST ser reutilizados dentro de uma execução válida e MUST NOT ser transferidos novamente para cada entrada.
- **FR-048**: Indexação e extração de artes MUST respeitar limites de memória e armazenamento, sem manter pacotes completos na memória quando o volume ultrapassar o limite operacional.
- **FR-049**: Após uma instalação com Game ID confiável, o sistema MUST enfileirar a busca de artes automaticamente; falha ou ausência de arte MUST NOT invalidar o jogo.
- **FR-050**: O sistema MUST apresentar por jogo categorias encontradas, existentes, instaladas, preservadas, ausentes e falhas, além de um resumo conciliado.
- **FR-051**: O progresso de sincronização e os resultados MUST sobreviver à reinicialização; itens já promovidos e validados MUST NOT ser repetidos sem necessidade.
- **FR-052**: Conteúdo remoto MUST ser confinado ao diretório autorizado e MUST NOT controlar paths ou nomes finais.

#### Observabilidade e segurança operacional

- **FR-053**: A fila MUST expor os estados `aguardando`, `transferindo`, `pausado`, `validando`, `planejando`, `instalando`, `verificando`, `sincronizando arte`, `pronto`, `falhou`, `cancelado` e `aguardando dispositivo`, com transições não ambíguas.
- **FR-054**: Cada tarefa MUST exibir progresso da fase e do pipeline total, item atual, velocidade quando aplicável, bytes, destino, última atualização e ação disponível.
- **FR-055**: Logs e histórico MUST correlacionar todas as fases pelo mesmo identificador de operação e registrar decisões de recuperação sem expor conteúdo ou segredos desnecessários.
- **FR-056**: Operações que substituem, renomeiam ou removem dados existentes MUST apresentar plano, alvo resolvido e conflitos e exigir confirmação explícita.
- **FR-057**: Paths de origem remota, título e nome de arquivo MUST ser tratados como não confiáveis, normalizados e confinados ao staging e dispositivo autorizados.
- **FR-058**: A confirmação legal existente MUST permanecer obrigatória por item antes de iniciar downloads do Essentials.
- **FR-059**: A solução MUST preservar isolamento entre interface e operações privilegiadas e MUST validar todos os comandos recebidos da interface.
- **FR-060**: O relatório de lote MUST conciliar todos os itens selecionados exatamente uma vez e distinguir transferência, instalação, fragmentação, nomenclatura e arte.

### Key Entities

- **Tarefa durável**: Intenção persistida de obter e finalizar um jogo, com origem, destino, identidade do dispositivo, prioridade, estado, fase, progresso, tentativas e erro.
- **Artefato parcial**: Bytes recebidos e confirmados de uma tarefa, vinculados à versão da origem e elegíveis ou não para retomada.
- **Imagem validada**: Conteúdo de jogo cuja estrutura, mídia, tamanho, Game ID e integridade conhecida foram inspecionados antes da instalação.
- **Identidade de jogo**: Game ID normalizado com fontes e nível de confiança, título e divergências; não substitui a identidade física da instalação.
- **Plano de finalização**: Decisão imutável sobre formato, mídia, nome, paths, espaço, conflitos, verificações e ações necessárias para promover uma imagem.
- **Instalação OPL**: Jogo ativo em arquivo único ou conjunto USBExtreme, identificado por dispositivo, formato e paths, com estado de integridade e fragmentação.
- **Checkpoint**: Registro durável de uma transição confirmada e dos artefatos que permitem reconciliar ou retomar uma operação.
- **Catálogo de artes**: Índice versionado das artes disponíveis por Game ID, categoria, localização, tamanho e integridade conhecida.
- **Plano de artes**: Seleção de jogos, categorias, políticas de substituição, origem, destino e ações previstas antes da escrita.
- **Resultado de lote**: Conciliação durável por item e fase, incluindo êxitos, falhas, pendências, retomadas e ações recomendadas.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Em três lotes consecutivos de pelo menos 20 jogos para o mesmo dispositivo, incluindo pelo menos cinco imagens acima de 4 GiB, 100% das instalações concluídas usam formato compatível e nenhuma é declarada pronta com fragmentação verificada.
- **SC-002**: Durante qualquer lote, há no máximo uma gravação de instalação ativa por dispositivo físico, comprovada em 100% dos eventos observados.
- **SC-003**: Em testes de fronteira em FAT32, imagens de `4 GiB - 1 byte`, `4 GiB` e `4 GiB + 1 byte` recebem corretamente formato compatível ou bloqueio acionável, sem tentativa de arquivo único acima do limite.
- **SC-004**: 100% das ISOs válidas com ID interno recebem nome final canônico e 100% das divergências entre nome, catálogo e mídia são reportadas antes da promoção.
- **SC-005**: Em uma biblioteca de pelo menos 500 imagens, o diagnóstico de nomes classifica todos os itens e nenhum rename confirmado altera hash ou distribuição física do conteúdo.
- **SC-006**: Em encerramentos forçados realizados em cada fase do pipeline, 100% das tarefas reaparecem em estado reconciliado, nenhuma instalação parcial é apresentada como ativa e nenhum item concluído é baixado novamente.
- **SC-007**: Em uma origem retomável, uma tarefa interrompida após pelo menos 50% continua reutilizando no mínimo 99% dos bytes já confirmados; uma origem alterada é detectada antes da combinação dos bytes.
- **SC-008**: Um lote com 100 tarefas, incluindo falhas simuladas de rede, espaço, mídia inválida e remoção de dispositivo, termina com exatamente um resultado por tarefa e sem encerramento inesperado do processo principal.
- **SC-009**: Durante downloads e sincronização de artes de 500 jogos, o consumo de memória permanece limitado e não cresce proporcionalmente ao tamanho total das imagens ou pacotes; o pico aceito no ambiente de referência é inferior a 512 MiB acima da linha de base.
- **SC-010**: Para 500 jogos, a sincronização consulta a disponibilidade em no máximo uma solicitação lógica por bloco de 500, instala todas as artes válidas selecionadas e não transfere o mesmo pacote compartilhado mais de uma vez por execução válida.
- **SC-011**: Em falhas e cancelamentos durante substituição de arte, 100% das artes existentes permanecem válidas e nenhum arquivo parcial aparece com o nome final.
- **SC-012**: Pelo menos 90% de dez usuários representativos conseguem distinguir `baixado`, `instalando`, `pronto`, `falhou` e `aguardando dispositivo`, corrigir um conflito de nome e repetir apenas itens falhos sem ajuda externa.
- **SC-013**: A interface apresenta confirmação de enfileiramento em até 2 segundos e continua atualizando o item atual durante lotes de 500 jogos, sem congelamento superior a 2 segundos no ambiente de referência.
- **SC-014**: Em 100% das tarefas prontas, relatório, catálogo e arquivos no dispositivo concordam quanto a Game ID, nome, formato, paths e estado de arte.

## Assumptions

- O formato canônico padrão solicitado é o formato antigo amplamente reconhecido pelo OPL: `<GAME_ID>.<TÍTULO>.<extensão>`, exemplificado por `SLUS_123.45.Nome do Jogo.iso`.
- ISOs permitem validar o Game ID no conteúdo; formatos em que isso não for possível usam a melhor fonte disponível com nível de confiança explícito e não são promovidos automaticamente quando a identidade for insuficiente.
- Em FAT32, conteúdo acima do limite de arquivo será instalado como USBExtreme multipartes; em filesystems e perfis compatíveis, ISO ou ZSO pode permanecer em arquivo único.
- Transferências de rede podem ocorrer em paralelo sob limites, mas finalização física é serializada por dispositivo para reduzir alocação intercalada.
- A verificação de fragmentação depende da capacidade confiável da plataforma e do filesystem; ausência de capacidade produz resultado `não verificável`, nunca um falso sucesso.
- As artes do conjunto OPLM ART e outras fontes legalmente configuradas continuam sendo fontes permitidas; esta feature não incorpora o serviço proprietário do OPL Manager nem pressupõe acesso ao seu endpoint.
- A sincronização automática de arte usa política de preservar existentes e não bloqueia um jogo íntegro quando nenhuma arte estiver disponível.
- A confirmação legal por item permanece inalterada.
- O comportamento funcional do OPL Manager é referência; seu monólito, chamadas síncronas, uso excessivo de memória, serviço SOAP e dependências específicas de Windows não são requisitos.

## Scope Boundaries

- Inclui Essentials, Download Manager, importação PS2, finalização no dispositivo, adequação de nomes existentes, sincronização de artes e recuperação desses fluxos.
- Inclui prevenção e detecção de fragmentação criada pela instalação; o reparo físico de bibliotecas já fragmentadas continua pertencendo à feature `002-opl-fragmentation-repair` e é apenas integrado como ação subsequente.
- Não inclui formatação, reparticionamento ou desfragmentação genérica do dispositivo.
- Não inclui download não autorizado, remoção da confirmação legal ou descoberta de novas fontes de jogos.
- Não inclui CFG, cheats, VMC, temas, FTP para PS2, HDD interno PS2 ou clonagem integral do OPL Manager.
- Não exige arte para considerar um jogo jogável e pronto.
- Não promete contiguidade onde a plataforma não fornece verificação física confiável.

## Dependencies

- Perfil OPL e capacidade do filesystem precisam ser identificados antes da instalação.
- O inspetor de mídia precisa extrair identidade e mídia de imagens suportadas.
- O instalador transacional e o diagnóstico de fragmentação existentes precisam ser reutilizados ou formalmente substituídos sem reduzir suas garantias.
- Uma raiz de staging durável e espaço suficiente precisam estar disponíveis para retomada e transformação segura.
- A fonte de artes precisa oferecer índice ou acesso legalmente permitido, com identidade/versionamento suficiente para cache seguro.
- O dispositivo precisa possuir identidade estável além de rótulo ou ponto de montagem para recuperação automática.

## Constitutional Compliance

- Substituição, rename e limpeza mostram alvo resolvido, conflitos e plano, e exigem confirmação explícita quando afetam dados existentes.
- Downloads continuam no limite privilegiado, com paths não confiáveis validados e confinados.
- Staging, checkpoints, integridade, promoção tardia e recuperação preservam a última versão válida.
- Progresso e resultado são observáveis e persistidos por item, sem falso sucesso após mera transferência.
- Confirmação legal do Essentials é preservada e a feature não amplia fontes não autorizadas.
- Regras de identidade, nome, limite de arquivo, fila e arte exigem testes de unidade, contrato, integração, recuperação e regressão proporcionais ao risco.
