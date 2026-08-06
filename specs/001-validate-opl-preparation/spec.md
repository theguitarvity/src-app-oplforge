# Feature Specification: Preparação OPL validada

**Feature Branch**: `001-validate-opl-preparation`

**Created**: 2026-08-02

**Status**: Draft

**Input**: User description: "Preparar e validar dispositivos para OPL sem jogos fragmentados ou incompletos, com artes reconhecidas, validação reproduzível via PCSX2, registro separado de teste em hardware real e catalogação automática, somente leitura, dos jogos já presentes em um HD/USB."

## Clarifications

### Session 2026-08-02

- Q: Na primeira entrega, em quais plataformas a verificação real de contiguidade deve ser obrigatoriamente suportada? → A: O diagnóstico estará disponível em todas as plataformas do projeto, mas o estado "pronto" somente será permitido onde a contiguidade puder ser verificada com confiança; nas demais, será registrado "não verificado".
- Q: Quando já existir no dispositivo um jogo com o mesmo Game ID, qual comportamento deve ser adotado? → A: Oferecer substituição confirmada, mantendo o jogo anterior até a validação completa do novo.
- Q: A ausência de capa ou de validação pelo PCSX2 deve impedir a classificação estrutural "pronto" do dispositivo? → A: A integridade estrutural define a prontidão; arte ausente ou PCSX2 não executado resulta em "pronto com alertas".
- Q: Para reorganizar um dispositivo fragmentado, onde o backup verificável deve ser armazenado antes da reescrita? → A: Em armazenamento diferente do dispositivo reorganizado, selecionado pelo usuário e com espaço previamente verificado.
- Q: Qual conteúdo a imagem usada pelo PCSX2 deve incluir por padrão? → A: Uma imagem mínima verificável com a estrutura OPL, metadados, artes e somente o jogo selecionado para teste.
- Q: A correção manual de Game ID deve continuar válida depois de atualizar o catálogo ou reconectar o mesmo dispositivo? → A: A correção persiste para o mesmo dispositivo e arquivo, mas é invalidada quando o arquivo correspondente muda.
- Q: Durante uma leitura longa, quando os jogos encontrados devem aparecer na biblioteca? → A: Os resultados aparecem progressivamente como provisórios; o último catálogo concluído permanece atual e o novo retrato só é promovido após a leitura integral.
- Q: A leitura de `DVD` e `CD` deve procurar jogos dentro de subdiretórios? → A: Sim, deve percorrer recursivamente todos os subdiretórios e catalogar os jogos encontrados.
- Q: Qual tamanho de biblioteca a primeira entrega deve catalogar sem degradação perceptível da navegação? → A: Até 500 jogos por dispositivo.
- Q: A leitura automática deve calcular o hash completo de todos os jogos existentes? → A: Não; a leitura automática faz validação estrutural e o hash completo é calculado sob demanda.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Preparar jogo íntegro e não fragmentado (Priority: P1)

Como usuário que possui um backup autorizado, quero importá-lo no formato adequado ao dispositivo e receber evidência de integridade e contiguidade para que o OPL possa listá-lo e iniciá-lo sem erro de fragmentação.

**Why this priority**: A instalação confiável do jogo é o valor central da preparação; sem ela, artes e validação de execução não têm utilidade.

**Independent Test**: Importar uma imagem válida menor que o limite do filesystem e outra que exceda esse limite, verificar formato, nome, Game ID, hashes, estrutura e contiguidade, e simular cancelamento antes da promoção final.

**Acceptance Scenarios**:

1. **Given** uma imagem ISO9660 legível e menor que o limite do filesystem, **When** o usuário confirma a importação, **Then** o jogo é instalado em `DVD` ou `CD`, conforme seu conteúdo, com nome baseado no Game ID normalizado, hashes coincidentes e contiguidade verificada.
2. **Given** uma imagem que excede o limite de arquivo do destino, **When** ela é importada, **Then** a instalação usa USBExtreme, todas as partes e o `ul.cfg` são consistentes e o diagnóstico reconhece o jogo.
3. **Given** uma gravação cujo arquivo ou parte ficou fragmentado, **When** a validação pós-gravação termina, **Then** o jogo não recebe estado pronto e o usuário recebe uma ação segura de reorganização.
4. **Given** uma importação interrompida ou inválida, **When** a operação falha ou é cancelada, **Then** nenhum jogo parcial se torna visível como instalação válida e a versão funcional anterior permanece intacta.

---

### User Story 2 - Diagnosticar a prontidão do dispositivo (Priority: P1)

Como usuário, quero um diagnóstico explícito do dispositivo e de seu conteúdo para saber o que está pronto, o que exige correção e o que não pôde ser verificado.

**Why this priority**: O diagnóstico impede declarações enganosas de prontidão e orienta todas as operações posteriores.

**Independent Test**: Analisar dispositivos de teste prontos, fragmentados, incompletos e incompatíveis, incluindo um ambiente onde a contiguidade não possa ser consultada, e conferir classificação e evidências.

**Acceptance Scenarios**:

1. **Given** um dispositivo suportado com jogos e metadados consistentes, **When** o diagnóstico é executado, **Then** ele apresenta filesystem, capacidade, espaço, recursos relevantes, inventário OPL e classificação fundamentada.
2. **Given** uma condição estrutural obrigatória que a plataforma não consegue verificar, **When** o diagnóstico é concluído, **Then** essa condição aparece como "não verificado" e o dispositivo não é declarado pronto.
3. **Given** arquivos incompletos, `ul.cfg` inconsistente ou fragmentação, **When** o dispositivo é diagnosticado, **Then** os itens afetados são identificados e a classificação é "requer reorganização" ou "incompatível", conforme a possibilidade de recuperação.
4. **Given** integridade estrutural aprovada, mas arte ausente ou validação PCSX2 não executada, **When** o diagnóstico é concluído, **Then** o dispositivo recebe "pronto com alertas" e os resultados complementares permanecem independentes.

---

### User Story 3 - Visualizar biblioteca OPL existente (Priority: P1)

Como usuário que já possui um HD/USB preparado para OPL, quero conectar ou selecionar o dispositivo e visualizar automaticamente todos os jogos existentes para administrar minha biblioteca sem precisar reimportá-los.

**Why this priority**: A leitura de dispositivos existentes é o ponto de entrada para diagnóstico, artes e validação, além de impedir que o produto seja útil apenas para jogos importados por ele próprio.

**Independent Test**: Selecionar um dispositivo de teste contendo ISO em `DVD` e `CD`, ZSO suportado, USBExtreme segmentado, arquivos desconhecidos e instalações problemáticas, e verificar a biblioteca sem qualquer alteração no dispositivo.

**Acceptance Scenarios**:

1. **Given** um dispositivo com ISO válida em `DVD`, **When** ele é conectado ou selecionado, **Then** a biblioteca mostra título, Game ID, mídia DVD, formato ISO, tamanho, caminho, arte, integridade estrutural, estado do hash e fragmentação.
2. **Given** um dispositivo com ISO válida em `CD`, **When** a leitura é concluída, **Then** o jogo aparece com mídia CD e os demais dados catalogáveis.
3. **Given** um arquivo ZSO e um perfil OPL que o suporta, **When** o dispositivo é lido, **Then** o jogo aparece como formato ZSO; sem suporte no perfil, aparece com alerta de incompatibilidade e não é ocultado.
4. **Given** uma instalação USBExtreme segmentada e descrita corretamente pelo `ul.cfg`, **When** o catálogo é atualizado, **Then** suas partes aparecem como um único jogo com tamanho total, caminho lógico e integridade consolidada.
5. **Given** arquivos desconhecidos, jogo sem Game ID, duplicado, incompleto ou entrada inconsistente no `ul.cfg`, **When** a leitura termina, **Then** cada item permanece visível com a anomalia específica e estado "com alertas" ou "inválido".
6. **Given** um jogo cujo Game ID não foi detectado, **When** o usuário informa explicitamente um ID válido, **Then** o catálogo registra a associação manual sem alterar o arquivo, permite usar o item em artes e validação e reaplica a associação após atualização ou reconexão somente enquanto dispositivo e arquivo permanecerem correspondentes.
7. **Given** que o dispositivo é removido ou um diretório fica inacessível durante a leitura, **When** a falha ocorre, **Then** a leitura é interrompida com erro controlado, nenhum arquivo é alterado e resultados incompletos não são apresentados como catálogo atual.
8. **Given** que jogos foram incluídos ou removidos externamente, **When** o usuário solicita atualização manual, **Then** a biblioteca reflete o conteúdo atual, identifica inclusões e remoções e invalida estados derivados que não correspondam mais ao dispositivo.
9. **Given** uma leitura ainda em andamento, **When** novos itens são encontrados, **Then** eles podem ser exibidos como provisórios enquanto o último catálogo concluído permanece identificado como atual; somente a conclusão integral promove o novo catálogo.
10. **Given** jogos ou arquivos candidatos dentro de subdiretórios de `DVD` ou `CD`, **When** a leitura recursiva é executada, **Then** eles aparecem com o caminho real e recebem alerta ou estado inválido quando sua localização não for reconhecida pelo perfil OPL selecionado.

---

### User Story 4 - Instalar artes reconhecidas pelo OPL (Priority: P2)

Como usuário, quero localizar e instalar capas e artes válidas para todos os formatos de jogo reconhecidos para que elas apareçam corretamente no OPL sem substituir arquivos bons por conteúdo inválido.

**Why this priority**: A arte torna o catálogo utilizável, mas depende de jogos corretamente identificados e instalados.

**Independent Test**: Sincronizar jogos em `DVD`, `CD`, USBExtreme e ZSO usando respostas válidas, ausentes, compactadas, em subdiretórios, HTML e PNG inválido, verificando nomes, preservação e estados.

**Acceptance Scenarios**:

1. **Given** jogos descobertos em formatos habilitados, **When** a sincronização é executada, **Then** cada jogo tem Game ID e origem identificados e seus assets válidos são gravados em `ART` com ID e sufixos reconhecidos pelo OPL.
2. **Given** uma resposta vazia, HTML ou arquivo com extensão PNG mas assinatura inválida, **When** o asset é validado, **Then** ele é rejeitado, o erro é exibido por arquivo e uma arte válida preexistente não é alterada.
3. **Given** que a fonte oferece apenas alguns tipos para um Game ID, **When** a sincronização termina, **Then** o estado de completude é calculado pelos tipos realmente disponíveis, e não por uma quantidade fixa.
4. **Given** que o Game ID automático está ausente ou incorreto, **When** o usuário informa a correção, **Then** uma nova busca pode ser feita e o relatório preserva a origem manual do ID.

---

### User Story 5 - Validar a preparação no PCSX2 (Priority: P2)

Como usuário, quero executar um teste local, isolado e reproduzível com minha própria BIOS para observar se o OPL abre, reconhece o dispositivo, mostra jogo e capa e inicia o backup até um marco definido.

**Why this priority**: A validação emulada fornece evidência repetível antes do teste físico, sem colocar os arquivos reais em risco.

**Independent Test**: Executar o assistente com uma instalação suportada, BIOS fornecida pelo usuário, memory card com OPL e clone do dispositivo, passando por todas as etapas e por ao menos um checkpoint manual.

**Acceptance Scenarios**:

1. **Given** PCSX2 suportado, BIOS legalmente extraída, OPL identificado e um jogo escolhido, **When** o usuário inicia a validação, **Then** um perfil isolado usa uma imagem mínima verificável com a estrutura OPL, metadados, artes e apenas o jogo selecionado, inicia o OPL e preserva os arquivos reais.
2. **Given** que a automação visual não consegue confirmar uma etapa com confiança, **When** o checkpoint é alcançado, **Then** o assistente solicita confirmação, registra o resultado manual e anexa screenshot.
3. **Given** uma execução concluída, **When** o relatório é gerado, **Then** versões, hashes, logs, screenshots, etapas aprovadas e limitações ficam associados à preparação.
4. **Given** uma validação PCSX2 aprovada, **When** o resultado é apresentado, **Then** ele não é descrito como garantia de funcionamento em hardware real.

---

### User Story 6 - Reorganizar com recuperação segura (Priority: P3)

Como usuário com um dispositivo fragmentado, quero reorganizá-lo transacionalmente para obter arquivos contíguos sem perder jogos, artes, configurações, VMCs ou aplicativos.

**Why this priority**: É um fluxo de recuperação importante, porém só é necessário quando a instalação individual segura não resolve a fragmentação.

**Independent Test**: Usar um dispositivo propositalmente fragmentado, conferir inventário e estimativa, cancelar antes da confirmação, executar reorganização e provocar falha durante a reescrita para validar recuperação.

**Acceptance Scenarios**:

1. **Given** que a instalação individual não produz contiguidade, **When** o usuário escolhe reorganizar, **Then** seleciona armazenamento temporário diferente, vê inventário, espaço necessário, alvos resolvidos, riscos e pedido de confirmação explícita antes de qualquer substituição.
2. **Given** uma reorganização confirmada, **When** os dados são reescritos sequencialmente, **Then** os hashes são validados antes de remover temporários, os metadados são restaurados e um novo diagnóstico é executado.
3. **Given** falha antes da validação da nova cópia, **When** a recuperação é acionada, **Then** o conteúdo anterior verificável continua disponível e o sistema informa o estado e os passos restantes.

---

### User Story 7 - Registrar smoke test em PS2 real (Priority: P3)

Como usuário, quero associar ao relatório um teste manual em console real para distinguir compatibilidade observada em hardware da aprovação estrutural e emulada.

**Why this priority**: O hardware real é a evidência final de compatibilidade, mas exige recursos externos e pode ser registrado depois das demais validações.

**Independent Test**: Registrar modelo do console, adaptador, OPL, detecção, arte, fragmentação e marco de boot, e confirmar que as três classificações permanecem independentes.

**Acceptance Scenarios**:

1. **Given** uma preparação com validação estrutural e PCSX2, **When** o usuário registra um teste real completo, **Then** os dados do console e os resultados ficam associados ao mesmo relatório e a aprovação de hardware é calculada separadamente.
2. **Given** que nenhum teste físico foi realizado, **When** o relatório é consultado, **Then** hardware real aparece como não validado, sem reduzir nem ampliar indevidamente os outros resultados.

### Edge Cases

- O espaço livre é suficiente para o jogo final, mas o armazenamento temporário externo não possui capacidade para staging, backup ou reorganização; a reescrita deve permanecer bloqueada.
- O filesystem, o tamanho de cluster ou a contiguidade não podem ser determinados com segurança pela plataforma.
- O dispositivo é removido, fica somente leitura ou perde espaço durante uma operação.
- A origem muda depois do hash inicial, contém ISO9660 inválido, Game ID ausente ou múltiplos identificadores conflitantes.
- Já existe um jogo com o mesmo Game ID: o sistema trata a nova importação como substituição, exige confirmação e mantém a instalação anterior até a validação e promoção completas da nova; colisões apenas de nome ou case também devem ser apresentadas antes da gravação.
- Uma instalação USBExtreme possui partes ausentes, extras, fora de ordem ou divergentes do `ul.cfg`.
- A versão selecionada do OPL não suporta ZSO, formato de instalação ou filesystem encontrado.
- A fonte de artes está indisponível, redireciona para erro, oferece arquivo compactado malformado ou contém caminhos inseguros.
- COV e COV2 coexistem, a fonte oferece zero assets ou uma arte válida local diverge da fonte.
- PCSX2, BIOS, memory card ou recurso USB emulado não são compatíveis com o perfil escolhido.
- Um checkpoint visual é inconclusivo, o jogo trava antes do marco ou o usuário cancela a execução.
- Logs ou screenshots podem revelar caminhos pessoais; o relatório deve evitar conteúdo sensível desnecessário.
- O dispositivo contém subdiretórios profundamente aninhados, ciclos por links, arquivos com nomes inválidos, extensões em case diferente ou itens fora de `DVD`, `CD` e das entradas válidas do `ul.cfg`; a leitura recursiva deve permanecer confinada ao dispositivo e não seguir ciclos nem caminhos externos.
- Uma atualização manual encontra conteúdo diferente enquanto uma ação baseada no catálogo anterior está aberta; a ação deve exigir dados atuais antes de prosseguir.
- Dois arquivos ou uma ISO e uma entrada USBExtreme resolvem para o mesmo Game ID; ambos permanecem visíveis e recebem anomalia de duplicidade, sem serem mesclados automaticamente.
- Um arquivo com associação manual de Game ID muda de caminho, tamanho ou conteúdo; a associação deixa de ser aplicada e o usuário deve confirmá-la novamente.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: O sistema MUST identificar filesystem, capacidade, espaço disponível, tamanho de cluster quando consultável, limite de arquivo, modo OPL aplicável e diretórios OPL existentes no dispositivo selecionado.
- **FR-002**: O sistema MUST inventariar jogos em ISO, ZSO e USBExtreme, incluindo arquivos incompletos, estruturalmente inválidos ou com hash divergente de uma referência disponível, consistência do `ul.cfg`, artes existentes e associação por Game ID; ausência de hash de referência MUST ser apresentada como "não calculado" ou "não verificado", nunca como corrupção presumida.
- **FR-003**: O diagnóstico MUST classificar o dispositivo como "pronto" quando todas as condições estruturais obrigatórias e evidências complementares estiverem aprovadas, "pronto com alertas" quando a integridade estrutural estiver aprovada mas faltar arte válida ou validação PCSX2, "requer reorganização" quando uma correção segura puder torná-lo estruturalmente íntegro, ou "incompatível" quando não houver preparação suportada; cada classificação MUST apresentar evidências e razões.
- **FR-004**: O sistema MUST registrar como "não verificado" qualquer condição obrigatória que não consiga confirmar e MUST NOT declarar pronto um dispositivo com condição obrigatória não verificada.
- **FR-005**: Antes da importação, o sistema MUST confirmar que a origem é arquivo regular e legível, possui ISO9660 válido, identificar CD ou DVD pela estrutura, extrair e normalizar o Game ID como `AAAA_000.00` e calcular hash da origem.
- **FR-006**: Antes da gravação, o sistema MUST verificar filesystem, limite de arquivo, espaço necessário para operação completa e apresentar ao usuário o formato de instalação selecionado.
- **FR-007**: Imagens compatíveis dentro do limite do filesystem MUST ser instaláveis em `DVD` ou `CD` com nome `<GAME_ID>.<Título>.iso`, respeitando limites de nome e comportamento de case do OPL.
- **FR-008**: Imagens que excedam o limite de arquivo MUST ser instaladas como USBExtreme, com todas as partes e `ul.cfg` coerentes e verificáveis.
- **FR-009**: ZSO MUST ser oferecido somente quando a versão exata do OPL selecionada declarar suporte ao formato.
- **FR-010**: Toda nova instalação MUST ser escrita em staging e promovida somente após validação de tamanho, hash, estrutura e formato.
- **FR-011**: Falha ou cancelamento MUST NOT deixar uma instalação parcial visível como válida nem substituir uma instalação funcional antes da validação da substituta.
- **FR-012**: Em todas as plataformas distribuídas pelo projeto, o sistema MUST executar o diagnóstico e MUST tentar verificar fisicamente a contiguidade de cada ISO ou parte USBExtreme por um método compatível com a plataforma e o filesystem.
- **FR-013**: Jogo fragmentado ou com contiguidade desconhecida MUST NOT receber estado pronto; o sistema MUST explicar a limitação e as opções seguras disponíveis.
- **FR-014**: O sistema MUST NOT tratar conclusão de cópia como prova de contiguidade, desabilitar a verificação de fragmentação do OPL nem executar desfragmentação genérica sem backup verificável.
- **FR-015**: O fluxo de reorganização MUST inventariar jogos, artes, configurações, VMCs e aplicativos, calcular espaço temporário, exigir armazenamento diferente do dispositivo reorganizado, verificar sua capacidade, exibir ambos os alvos e riscos e exigir confirmação explícita.
- **FR-016**: A reorganização MUST criar no armazenamento externo selecionado um backup verificável, reescrever sequencialmente, validar hashes antes da remoção de temporários, restaurar metadados e repetir o diagnóstico.
- **FR-017**: Formatação ou recriação de partição MUST permanecer separada da reorganização, exigir confirmação específica e a proteção adicional de segurança adotada pelo projeto.
- **FR-018**: O sincronizador de artes MUST descobrir jogos em `DVD`, `CD`, USBExtreme descrito no `ul.cfg` e ZSO quando habilitado.
- **FR-019**: Para cada jogo, o sistema MUST determinar e normalizar o Game ID a partir da imagem, nome, `ul.cfg` ou correção manual, registrando a origem escolhida.
- **FR-020**: O sistema MUST consultar o índice OPLM ART configurado e reconhecer assets em subdiretórios e arquivos compactados sem permitir caminhos fora do staging autorizado.
- **FR-021**: Cada asset MUST ser baixado para staging e validado quanto a sucesso da resposta, tamanho não vazio, extensão permitida e assinatura real de PNG antes da promoção.
- **FR-022**: HTML, páginas de erro, vazios e PNG inválidos MUST ser rejeitados e MUST NOT substituir arte válida existente.
- **FR-023**: Assets válidos MUST ser promovidos como `ART/<GAME_ID>_<TIPO>.png`, preservando exatamente os tipos `ICO`, `SCR`, `SCR2`, `BG`, `LGO`, `COV`, `LAB` e `COV2`.
- **FR-024**: O estado de arte MUST ser "missing" sem asset válido, "cover-ready" com COV ou COV2 válido, "partial" com capa e parte dos opcionais disponíveis, ou "complete" quando todos os tipos disponíveis na fonte para o Game ID estiverem instalados.
- **FR-025**: A interface MUST mostrar, por jogo, Game ID, origem do ID, artes encontradas, baixadas e existentes, erros por arquivo, destino, prévia da capa e opção de corrigir o ID.
- **FR-026**: Cada perfil OPL MUST registrar versão ou commit exato, variante, origem oficial, SHA-256 do ELF, data de obtenção e compatibilidades esperadas de formato e filesystem.
- **FR-027**: Atualização do OPL MUST usar somente releases oficiais e exigir confirmação antes de modificar a imagem de memory card.
- **FR-028**: O assistente de validação MUST detectar uma instalação suportada do PCSX2 e registrar sua versão exata.
- **FR-029**: O assistente MUST solicitar BIOS legalmente extraída pelo usuário, identificar somente hash e região e MUST NOT baixar, distribuir, copiar para o relatório ou versionar a BIOS.
- **FR-030**: A validação MUST usar perfil isolado e reproduzível, aceitar memory card com OPL e criar por padrão uma imagem mínima verificável contendo a estrutura OPL, os metadados, as artes e somente o jogo selecionado, preservando os arquivos reais.
- **FR-031**: O assistente MUST configurar o dispositivo USB emulado e iniciar o OPL pelo memory card ou ELF correspondente ao perfil selecionado.
- **FR-032**: O teste MUST registrar, separadamente, inicialização com BIOS, abertura do OPL, detecção USB, carregamento da lista, presença de ID e título, exibição de COV/COV2, seleção do jogo, ausência de erro de fragmentação e alcance de marco configurável.
- **FR-033**: Quando uma etapa visual não puder ser confirmada com confiança, o assistente MUST pausar em checkpoint, solicitar confirmação e armazenar screenshot e resultado manual.
- **FR-034**: O relatório MUST conter identificação do dispositivo, filesystem, capacidade, OPL e hash, PCSX2, BIOS apenas por hash e região, jogos, formatos, hashes de origem e destino, fragmentação, artes, boot, alertas, limitações e data.
- **FR-035**: O relatório MUST classificar de forma independente integridade estrutural, validação PCSX2 e validação em hardware real, sem apresentar aprovação emulada como garantia física.
- **FR-036**: O usuário MUST poder registrar smoke test real com modelo do console, adaptador ou dispositivo, OPL, detecção, arte, ausência de erro de fragmentação e alcance do marco escolhido.
- **FR-037**: Operações destrutivas ou de substituição MUST exibir o alvo resolvido, validar que é suportado e exigir confirmação explícita; falhas de validação MUST interromper a alteração do destino.
- **FR-038**: O sistema MUST manter histórico, progresso e logs das operações relevantes, com dados suficientes para auditoria e recuperação e sem conteúdo pessoal ou legalmente restrito desnecessário.
- **FR-039**: O fluxo MUST exigir que o usuário reconheça sua autorização sobre jogos e demais conteúdos importados e MUST NOT fornecer BIOS ou jogos comerciais.
- **FR-040**: A validação automatizada do produto MUST cobrir detecção de filesystem, seleção de formato, nomes, Game ID, `ul.cfg`, PNG, staging, rollback, fragmentação simulada, estados do relatório, leitura somente leitura do catálogo, formatos catalogados, atualização externa, remoção do dispositivo e diretório inacessível.
- **FR-041**: O Game ID normalizado MUST identificar unicamente um jogo no dispositivo; ao importar o mesmo Game ID, o sistema MUST oferecer substituição mediante confirmação explícita e MUST manter a instalação anterior íntegra até a nova instalação ser completamente validada e promovida.
- **FR-042**: Ao conectar ou selecionar um dispositivo suportado, o sistema MUST iniciar uma leitura automática e recursiva de `DVD` e `CD`, além de instalações USBExtreme descritas pelo `ul.cfg` e arquivos ZSO quando reconhecidos pelo perfil OPL selecionado.
- **FR-043**: A leitura inicial e toda atualização do catálogo MUST ser somente leitura e MUST NOT renomear, mover, corrigir, excluir ou reescrever jogos, partes, `ul.cfg`, artes ou outros arquivos sem uma ação explícita posterior do usuário.
- **FR-044**: O sistema MUST apresentar uma biblioteca com título, Game ID, origem do ID, tipo de mídia, formato de instalação, tamanho, caminho, estado da arte, integridade e fragmentação de cada jogo ou item candidato.
- **FR-045**: O catálogo MUST consolidar as partes de uma instalação USBExtreme válida em um único jogo e MUST identificar partes ausentes, extras, fora de ordem ou divergentes do `ul.cfg`.
- **FR-046**: Arquivos desconhecidos e instalações com Game ID ausente, duplicidade, conteúdo incompleto, estrutura inválida ou inconsistência no `ul.cfg` MUST permanecer visíveis com sua anomalia e evidência, sem serem tratados como jogos válidos.
- **FR-047**: Cada item catalogado MUST ser classificado como "pronto" quando todas as condições estruturais verificáveis estiverem aprovadas, "com alertas" quando for reconhecido mas possuir condição não bloqueante ou não verificada, ou "inválido" quando estiver incompleto, inconsistente ou não puder ser usado com segurança pelo OPL selecionado.
- **FR-048**: O usuário MUST poder solicitar atualização manual do catálogo; a atualização MUST refletir inclusões, alterações e remoções externas e invalidar resultados derivados que tenham ficado obsoletos.
- **FR-049**: Se o dispositivo for removido, mudar de identidade ou um diretório necessário ficar inacessível durante a leitura, o sistema MUST interromper a operação, informar a causa e MUST NOT publicar o resultado parcial como catálogo atual.
- **FR-050**: Quando a detecção automática do Game ID falhar, o usuário MUST poder registrar explicitamente uma associação manual validada, sem alteração do arquivo de jogo; ela MUST persistir após atualização e reconexão para o mesmo dispositivo e arquivo, MUST ser invalidada se caminho, tamanho ou conteúdo observável mudar, e sua origem manual MUST ficar visível e ser usada pelo diagnóstico, artes e PCSX2.
- **FR-051**: Jogos catalogados, inclusive os preexistentes, MUST poder alimentar o diagnóstico do dispositivo, a sincronização de artes e a seleção do jogo para validação PCSX2 sem exigir reimportação.
- **FR-052**: Antes de executar uma ação mutável a partir do catálogo, o sistema MUST confirmar que o dispositivo e o item ainda correspondem à leitura vigente ou exigir atualização do catálogo.
- **FR-053**: Durante uma leitura, o sistema MAY exibir itens encontrados progressivamente, mas MUST identificá-los como provisórios, manter o último catálogo concluído como retrato atual e promover o novo catálogo somente após a leitura integral bem-sucedida.
- **FR-054**: A leitura recursiva MUST permanecer confinada a `DVD` e `CD` no dispositivo selecionado, MUST NOT seguir ciclos ou caminhos que escapem desses diretórios e MUST catalogar itens em subdiretórios com o caminho real e a compatibilidade dessa localização segundo o perfil OPL selecionado.
- **FR-055**: O catálogo MUST manter navegação e atualização utilizáveis com até 500 jogos por dispositivo; itens além dessa escala MUST NOT ser omitidos, mas limitações observadas MAY ser apresentadas como alerta.
- **FR-056**: A leitura automática MUST validar estrutura, formato e consistência de partes sem calcular obrigatoriamente o hash completo de cada jogo; o catálogo MUST distinguir integridade estrutural do estado do hash e MUST permitir solicitar o hash completo sob demanda.

### Key Entities

- **Dispositivo preparado**: Destino selecionado, com identificação, filesystem, capacidade, espaço, cluster, recursos, inventário e classificação atual.
- **Jogo**: Backup autorizado cuja identidade única no dispositivo é o Game ID normalizado, com título, mídia, formato, origem, destino, tamanhos, hashes, partes e estados de integridade e contiguidade; uma nova importação com o mesmo ID constitui uma substituição controlada.
- **Instalação USBExtreme**: Conjunto de partes de um jogo e sua entrada correspondente no `ul.cfg`, tratado como unidade verificável.
- **Asset de arte**: Arquivo associado a Game ID e tipo reconhecido, com origem, validações, destino e estado de instalação.
- **Perfil OPL**: Versão imutavelmente identificada do OPL, incluindo variante, origem, hash, data e matriz declarada de compatibilidade.
- **Sessão PCSX2**: Execução isolada identificada por versão, perfil, BIOS anonimizada, jogo selecionado, imagem mínima verificável, etapas, checkpoints e evidências.
- **Relatório de prontidão**: Registro verificável que agrega dispositivo, jogos, artes, perfis, evidências, alertas e três resultados independentes de validação.
- **Smoke test físico**: Registro manual associado ao relatório, com contexto do hardware e resultados observados até o marco definido.
- **Catálogo do dispositivo**: Retrato somente leitura de uma leitura concluída, ligado à identidade do dispositivo e ao momento da varredura, contendo jogos reconhecidos, itens candidatos, anomalias, associações manuais persistentes e estados derivados; resultados de uma leitura em andamento formam uma prévia provisória e não substituem esse retrato.
- **Item catalogado**: Jogo reconhecido ou arquivo candidato, com identidade observada, localização, formato, mídia, tamanho, Game ID e origem, arte, integridade estrutural, estado e valor do hash quando calculado, fragmentação, anomalias e classificação; partes USBExtreme relacionadas formam um único item lógico.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Em 100% das importações de teste concluídas, o formato, diretório, nome e Game ID correspondem às regras aplicáveis ao conteúdo e ao limite do dispositivo.
- **SC-002**: Em 100% dos testes com falha ou cancelamento antes da promoção, nenhuma instalação parcial aparece como jogo válido e qualquer versão preexistente permanece íntegra.
- **SC-003**: Em 100% das amostras propositalmente fragmentadas ou não verificáveis, o jogo não recebe estado pronto e a razão é apresentada ao usuário.
- **SC-004**: Em 100% das instalações USBExtreme de teste, todas as partes e entradas de catálogo são reconhecidas pelo diagnóstico, ou a inconsistência exata é indicada.
- **SC-005**: Em 100% dos assets válidos de teste, COV/COV2 e demais tipos disponíveis são instalados com nomes reconhecidos; em 100% das respostas HTML, vazias ou PNG inválidas, o conteúdo é rejeitado sem perda de arte válida.
- **SC-006**: Em um teste moderado com pelo menos 20 participantes representativos e ambiente suportado, pelo menos 95% conseguem concluir o fluxo guiado completo, desde a importação até a geração do relatório, sem intervenção do moderador; tempos de cópia e checkpoints manuais permanecem registrados, mas não contam como assistência.
- **SC-007**: Uma validação local completa permite verificar e registrar as 9 etapas de execução descritas em até 20 minutos, medidos do início do perfil PCSX2 até o registro do último checkpoint, excluindo somente o tempo de criação/cópia inicial da imagem e períodos em que o assistente aguarda uma ação manual solicitada.
- **SC-008**: 100% dos relatórios exibem separadamente os três resultados — estrutural, PCSX2 e hardware real — e nunca inferem aprovação física a partir da emulação.
- **SC-009**: Em 100% dos testes de reorganização com falha induzida, o conteúdo previamente validado permanece recuperável e o estado de recuperação fica explícito.
- **SC-010**: Nenhum cenário automatizado baixa, distribui, incorpora ou versiona BIOS, jogos comerciais ou conteúdo sem autorização.
- **SC-011**: 100% dos relatórios concluídos contêm versões, hashes, data, alertas e evidências suficientes para uma segunda pessoa reproduzir ou auditar o resultado com os mesmos insumos autorizados.
- **SC-012**: Em 100% dos dispositivos de aceitação, jogos válidos preexistentes em `DVD`, `CD`, ZSO suportado e USBExtreme aparecem na biblioteca sem reimportação e com todos os campos obrigatórios disponíveis ou explicitamente marcados como não verificados.
- **SC-013**: Em 100% das leituras iniciais e atualizações de catálogo, os arquivos do dispositivo permanecem inalterados até que o usuário confirme uma ação mutável separada.
- **SC-014**: Em 100% das amostras desconhecidas, duplicadas, incompletas, sem Game ID ou inconsistentes com o `ul.cfg`, o item permanece visível e recebe anomalia e classificação coerentes.
- **SC-015**: Após inclusão ou remoção externa, uma atualização manual concluída reflete 100% das mudanças observáveis no escopo catalogado e não mantém resultados derivados obsoletos como atuais.
- **SC-016**: Em 100% dos testes com remoção do dispositivo ou diretório inacessível durante a leitura, nenhum catálogo parcial substitui o último retrato concluído e nenhuma alteração é feita no dispositivo.
- **SC-017**: Em um teste de descoberta separado, com pelo menos 20 participantes representativos e dispositivo de até 500 jogos, pelo menos 95% conseguem selecionar o dispositivo existente e localizar um jogo indicado na biblioteca em até 3 minutos, sem reimportá-lo nem receber ajuda do moderador.
- **SC-018**: Em um dispositivo com 500 jogos catalogados, pelo menos 95% das ações de navegação, busca e seleção respondem ao usuário em até 1 segundo enquanto nenhuma falha de leitura estiver ativa.
- **SC-019**: Em 100% das leituras automáticas, o catálogo diferencia integridade estrutural de hash não calculado e nenhum jogo recebe hash verificado sem que todo o seu conteúdo tenha sido processado com sucesso.

## Assumptions

- O usuário possui autorização para todos os jogos, imagens de memory card, artes e demais conteúdos fornecidos ao sistema e confirma essa responsabilidade antes da importação.
- A BIOS é fornecida e mantida pelo usuário; apenas seu hash e região integram a sessão e o relatório.
- O suporte concreto a filesystem, contiguidade e PCSX2 pode variar por plataforma; ausência de método confiável resulta em "não verificado", nunca em sucesso presumido.
- A matriz de compatibilidade pertence a cada perfil OPL identificado de forma exata; não existe um perfil mutável chamado apenas "latest".
- O índice OPLM ART configurado é uma dependência externa e pode estar incompleto ou indisponível; isso gera estado e erro observáveis, não invalida a integridade do jogo.
- Checkpoints manuais são evidências aceitáveis quando acompanhados de resultado, autoria temporal e screenshot; não são apresentados como confirmação automatizada.
- O marco padrão de boot é selecionável antes do teste e pode ser a tela inicial ou o primeiro frame reconhecido.
- Reorganização exige armazenamento temporário diferente do dispositivo reorganizado, suficiente e verificável; se ele não existir, o sistema bloqueia a operação e orienta o usuário.
- Formatação, distribuição de conteúdo protegido, modificação do OPL ou PCSX2 e garantia universal de compatibilidade permanecem fora do escopo.
- A primeira entrega oferece diagnóstico em todas as plataformas distribuídas pelo projeto; limitações de verificação de contiguidade são aceitáveis somente quando produzem estado "não verificado", impedem o estado "pronto" e ficam registradas no relatório.
- A leitura automática é iniciada na seleção ou conexão reconhecida do dispositivo; mudanças externas posteriores são incorporadas por atualização manual, sem promessa de monitoramento contínuo.
- A associação manual de Game ID é metadado persistente do catálogo, vinculado ao dispositivo e à identidade observável do arquivo; não altera o nome nem o conteúdo do jogo e exige nova confirmação após mudança de caminho, tamanho ou conteúdo.
- O catálogo cobre recursivamente `DVD` e `CD` e os demais locais e formatos OPL declarados; outros arquivos podem ser exibidos como desconhecidos quando encontrados nesse escopo, mas não há varredura irrestrita de todo o dispositivo.
- A escala de aceitação da primeira entrega é de 500 jogos por dispositivo; coleções maiores continuam sendo lidas sem truncamento, mas podem receber alerta de desempenho fora da escala validada.
- O hash completo de jogos preexistentes é calculado sob demanda; ausência de hash aparece como "não calculado" e não é apresentada como falha nem como verificação concluída.
- Estados de evidência (`aprovado`, `falhou`, `não verificado`) alimentam a classificação de cada item (`pronto`, `com alertas`, `inválido`), que por sua vez alimenta a classificação distinta do dispositivo (`pronto`, `pronto com alertas`, `requer reorganização`, `incompatível`); esses vocabulários não são intercambiáveis.
