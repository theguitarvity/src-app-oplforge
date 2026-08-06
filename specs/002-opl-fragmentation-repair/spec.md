# Feature Specification: Diagnóstico e correção de fragmentação OPL

**Feature Branch**: `002-opl-fragmentation-repair`

**Created**: 2026-08-02

**Status**: Draft

**Input**: User description: "Criar uma funcionalidade independente de diagnóstico e correção de fragmentação para dispositivos HD/USB preparados para Open PS2 Loader."

## Clarifications

### Session 2026-08-02

- Q: Na ação “Corrigir todos”, o espaço temporário deve ser calculado para processar um jogo por vez ou reservar cópias de todo o lote simultaneamente? → A: Processar um jogo por vez, revalidando o espaço antes de cada jogo.
- Q: A correção pode tentar regravar quando o filesystem não garante contiguidade antecipadamente, mas permite verificá-la de forma confiável antes da promoção? → A: Permitir a tentativa quando houver verificação física confiável; promover somente se a cópia ficar contígua.
- Q: Quando dois jogos possuem o mesmo Game ID, como o sistema deve distingui-los no diagnóstico, no plano e no relatório? → A: Usar dispositivo, formato e caminhos como identidade; sinalizar Game IDs duplicados.
- Q: Ao detectar uma correção interrompida em uma nova inicialização ou reconexão, o sistema deve retomar automaticamente, restaurar o estado seguro ou aguardar uma decisão do usuário? → A: Preservar ou restaurar a versão válida; nunca retomar nem promover automaticamente.
- Q: Durante a correção de fragmentação, quais arquivos auxiliares podem ser modificados? → A: Somente arquivos do jogo; `ul.cfg` apenas quando necessário.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Diagnosticar sem alterar o dispositivo (Priority: P1)

Como usuário, quero examinar um dispositivo OPL e compreender a condição física e estrutural de cada jogo antes de decidir se farei qualquer alteração.

**Why this priority**: O diagnóstico confiável e somente leitura é a base da funcionalidade e já entrega valor mesmo quando a correção não é possível.

**Independent Test**: Selecionar um dispositivo contendo jogos em ISO, ZSO e USBExtreme, executar somente o diagnóstico e verificar classificações, resumo e ausência de alterações no dispositivo.

**Acceptance Scenarios**:

1. **Given** um dispositivo conectado com jogos em `/DVD`, `/CD`, ZSO e instalações descritas por `ul.cfg`, **When** o usuário inicia o diagnóstico, **Then** todos os jogos reconhecidos são inventariados e recebem uma classificação sustentada por evidências, sem arquivos criados, removidos ou modificados.
2. **Given** um jogo cujos arquivos estão todos contíguos e estruturalmente válidos, **When** ele é diagnosticado, **Then** seu estado é `contíguo`.
3. **Given** um jogo de arquivo único distribuído em mais de um extent, **When** ele é diagnosticado, **Then** seu estado é `fragmentado` e os arquivos afetados são identificados.
4. **Given** uma instalação com múltiplos arquivos na qual somente parte dos arquivos está fragmentada, **When** ela é diagnosticada, **Then** seu estado é `parcialmente fragmentado` e cada arquivo afetado é discriminado.
5. **Given** um jogo com arquivos obrigatórios ausentes ou partes USBExtreme faltantes, **When** ele é diagnosticado, **Then** seu estado é `incompleto` e as ausências são informadas.
6. **Given** um jogo que viola a estrutura ou cujos dados obrigatórios são inconsistentes, **When** ele é diagnosticado, **Then** seu estado é `inválido` e as inconsistências são informadas.
7. **Given** uma plataforma ou filesystem sem verificação física confiável, **When** o diagnóstico é executado, **Then** os itens afetados são classificados como `não verificável`, a limitação é explicada e nenhuma conclusão de contiguidade é apresentada.
8. **Given** o diagnóstico concluído, **When** o usuário consulta o resumo, **Then** visualiza total de jogos, quantidade fragmentada ou parcialmente fragmentada, espaço livre, espaço temporário necessário e arquivos afetados.

---

### User Story 2 - Corrigir um jogo com segurança (Priority: P1)

Como usuário, quero corrigir um jogo fragmentado individualmente sem perder a instalação válida, seus dados associados ou sua capacidade de recuperação.

**Why this priority**: A correção individual limita o risco e atende diretamente ao problema central depois que o diagnóstico identifica um jogo afetado.

**Independent Test**: Diagnosticar e corrigir separadamente uma ISO e um ZSO fragmentados, conferindo plano, confirmação, preservação de dados, validações, novo diagnóstico e relatório.

**Acceptance Scenarios**:

1. **Given** uma ISO fragmentada em `/DVD` ou `/CD`, espaço suficiente e verificação física suportada, **When** o usuário escolhe corrigir o jogo, revisa o plano e confirma explicitamente, **Then** a cópia candidata é validada por tamanho e hash, regravada, diagnosticada novamente e promovida somente após ser comprovadamente íntegra e contígua.
2. **Given** um ZSO fragmentado e válido, **When** a correção individual termina com sucesso, **Then** nome, Game ID, conteúdo, configurações, artes e metadados permanecem preservados e o relatório registra o estado final `contíguo`.
3. **Given** uma correção pronta para execução, **When** o plano é apresentado, **Then** ele identifica jogo, arquivos, ações, espaço temporário, riscos e estratégia de recuperação antes de habilitar a confirmação.
4. **Given** um plano apresentado, **When** o usuário cancela ou não confirma, **Then** nenhuma alteração é feita e o cancelamento é registrado sem classificar o jogo como corrigido.
5. **Given** uma cópia regravada que continua fragmentada, **When** o novo diagnóstico é concluído, **Then** a versão original permanece válida, a candidata não é promovida, o jogo não é declarado corrigido e o relatório explica a fragmentação persistente e a recuperação.
6. **Given** um jogo com artes, configurações e metadados associados, **When** sua correção é executada, **Then** somente os arquivos fragmentados do jogo e, quando indispensável, o `ul.cfg` podem ser escritos; os demais arquivos auxiliares permanecem inalterados.

---

### User Story 3 - Corrigir todos os jogos elegíveis (Priority: P2)

Como usuário, quero corrigir em uma única ação todos os jogos fragmentados elegíveis, com visibilidade do impacto total e resultado individual por jogo.

**Why this priority**: A correção em lote reduz esforço em bibliotecas grandes, mas depende do diagnóstico e das garantias da correção individual.

**Independent Test**: Usar um dispositivo com jogos contíguos, fragmentados, parcialmente fragmentados e não elegíveis, executar `Corrigir todos os jogos fragmentados` e verificar seleção, confirmação única do plano completo, isolamento de falhas e relatório por jogo.

**Acceptance Scenarios**:

1. **Given** vários jogos fragmentados ou parcialmente fragmentados e elegíveis, **When** o usuário seleciona `Corrigir todos os jogos fragmentados`, **Then** recebe um plano consolidado com ordem, arquivos, espaço temporário e jogos excluídos antes de confirmar.
2. **Given** um plano em lote confirmado, **When** as correções são executadas, **Then** cada jogo passa pelas mesmas garantias da correção individual e somente jogos comprovadamente íntegros e contíguos são declarados corrigidos.
3. **Given** um lote contendo um arquivo bloqueado, **When** esse item é alcançado, **Then** ele falha sem alterar sua versão válida, a falha é registrada e os demais jogos seguros e independentes podem continuar.
4. **Given** um lote concluído ou interrompido, **When** o relatório final é exibido, **Then** cada jogo possui resultado próprio e o resumo distingue corrigidos, inalterados, ignorados, falhos e pendentes.
5. **Given** um lote confirmado com vários jogos elegíveis, **When** a execução avança, **Then** apenas um jogo mantém cópia temporária ativa por vez e o espaço é revalidado antes de iniciar cada jogo.

---

### User Story 4 - Preservar instalações USBExtreme (Priority: P2)

Como usuário de USBExtreme, quero que todas as partes do jogo e seu registro permaneçam consistentes durante diagnóstico e correção.

**Why this priority**: Uma instalação multipartes exige tratamento como unidade indivisível; inconsistência entre partes e catálogo pode inutilizar o jogo.

**Independent Test**: Corrigir uma instalação USBExtreme válida com múltiplas partes, provocar falha antes da promoção completa e verificar integridade das partes originais e do `ul.cfg`.

**Acceptance Scenarios**:

1. **Given** um jogo USBExtreme válido com múltiplas partes, algumas fragmentadas, **When** o diagnóstico é executado, **Then** todas as partes e a entrada correspondente em `ul.cfg` são avaliadas como uma única instalação e o estado reflete os arquivos afetados.
2. **Given** uma instalação USBExtreme elegível, **When** a correção é confirmada, **Then** todas as partes são validadas como um conjunto antes de qualquer substituição definitiva, somente as partes fragmentadas recebem candidatas e são regravadas, e o `ul.cfg` permanece consistente com a instalação final.
3. **Given** uma falha antes de todas as partes candidatas serem validadas, **When** a operação é encerrada, **Then** nenhuma mistura de partes antigas e novas fica ativa, a instalação original válida permanece utilizável e o `ul.cfg` não aponta para um estado parcial.

---

### User Story 5 - Interromper com recuperação segura (Priority: P1)

Como usuário, quero que condições inseguras ou interrupções parem a operação sem eliminar a última versão válida do jogo.

**Why this priority**: Evitar perda ou corrupção de dados é uma obrigação constitucional e mais importante que concluir uma correção.

**Independent Test**: Simular espaço insuficiente, arquivo bloqueado, remoção do dispositivo, falhas de leitura e escrita e interrupção durante a substituição, verificando bloqueio, preservação e instruções de recuperação.

**Acceptance Scenarios**:

1. **Given** espaço livre menor que o espaço temporário requerido com a margem operacional informada, **When** o usuário tenta confirmar a correção, **Then** a operação é bloqueada antes de escrever e o déficit é explicado.
2. **Given** um arquivo de origem bloqueado ou ilegível, **When** a correção o valida, **Then** ela é interrompida para esse jogo antes da promoção, preserva a versão original e informa o arquivo e a ação recomendada.
3. **Given** uma correção em andamento, **When** o dispositivo é removido, **Then** nenhuma nova promoção ocorre, o estado conhecido é preservado e o relatório informa como reconectar e recuperar ou limpar candidatos temporários.
4. **Given** uma falha de escrita ou interrupção durante a tentativa de substituição, **When** a aplicação volta a avaliar a operação, **Then** restaura ou mantém a última versão validada, não apresenta instalação parcial como ativa e registra todas as ações de recuperação.
5. **Given** um filesystem que não garante contiguidade antecipadamente, mas permite verificação física confiável, **When** uma correção é solicitada, **Then** o sistema pode preparar e testar uma cópia candidata, mas só a promove se o novo diagnóstico comprovar contiguidade.
6. **Given** plataforma sem verificação física confiável, **When** uma correção é solicitada, **Then** a operação é bloqueada, o jogo permanece `não verificável` e não é declarado corrigido.
7. **Given** uma operação interrompida detectada após reinicialização ou reconexão, **When** o sistema recupera seu registro, **Then** preserva ou restaura automaticamente a última versão válida, não retoma nem promove candidatas e exige novo plano e confirmação antes de qualquer nova escrita.

### Edge Cases

- O dispositivo fica sem espaço depois do plano por uma alteração externa, mas antes ou durante a criação da cópia candidata.
- O conteúdo de origem muda entre o diagnóstico, a confirmação e a cópia; o plano fica obsoleto e deve ser revalidado.
- Dois jogos com o mesmo Game ID permanecem instalações distintas por dispositivo, formato e caminhos; a duplicidade é sinalizada sem compartilhar arquivos ou resultados entre elas.
- Duas entradas reivindicam o mesmo conjunto de partes USBExtreme; ambas são classificadas como inválidas até que a colisão seja resolvida fora desta funcionalidade.
- O `ul.cfg` existe, mas está truncado, possui entrada duplicada ou referencia partes inexistentes.
- Uma ISO ou ZSO válida usa caixa, caracteres ou nomes incomuns que precisam ser preservados.
- A arte ou configuração associada muda durante a operação; a correção não pode sobrescrever silenciosamente a versão mais recente.
- O dispositivo é reconectado com o mesmo nome, mas identidade ou conteúdo diferente.
- A cópia candidata tem tamanho correto, mas hash diferente da origem.
- O novo diagnóstico encontra fragmentação persistente, parcial ou um estado não verificável.
- O usuário solicita cancelamento antes, durante ou depois da cópia, inclusive no limite da promoção.
- Resíduos temporários de uma execução anterior são encontrados ao iniciar um novo diagnóstico.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: O sistema MUST oferecer o diagnóstico de fragmentação como funcionalidade independente e executável sem iniciar qualquer correção.
- **FR-002**: O sistema MUST exigir a seleção explícita de um dispositivo HD/USB conectado e suportado antes do diagnóstico ou correção.
- **FR-003**: O diagnóstico MUST examinar jogos reconhecidos em `/DVD`, `/CD`, arquivos ISO e ZSO, além de instalações USBExtreme descritas por `ul.cfg`.
- **FR-004**: O diagnóstico MUST correlacionar cada jogo com todos os arquivos obrigatórios e auxiliares que determinam sua integridade, identificação e uso pelo OPL.
- **FR-005**: Cada jogo MUST receber exatamente um estado agregado entre `contíguo`, `fragmentado`, `parcialmente fragmentado`, `incompleto`, `inválido` e `não verificável`, acompanhado das evidências que justificam o estado.
- **FR-006**: `Fragmentado` MUST indicar que o arquivo único do jogo, ou todos os arquivos relevantes de uma instalação multipartes, possuem distribuição física não contígua; `parcialmente fragmentado` MUST indicar que somente parte dos arquivos relevantes de uma instalação multipartes está fragmentada.
- **FR-007**: Estados de incompletude ou invalidade MUST prevalecer sobre uma conclusão de contiguidade, e ausência de verificação física confiável MUST impedir uma conclusão de contiguidade.
- **FR-008**: O resultado MUST listar, por jogo, formato, localização, arquivos avaliados, arquivos afetados, estado, motivo, tamanho e disponibilidade da verificação física.
- **FR-009**: O resumo MUST apresentar total de jogos, contagem por estado, quantidade fragmentada ou parcialmente fragmentada, espaço livre atual, espaço temporário necessário e arquivos afetados.
- **FR-010**: O diagnóstico sem correção MUST ser somente leitura em relação ao dispositivo selecionado.
- **FR-011**: O usuário MUST poder solicitar correção individual para um jogo fragmentado ou parcialmente fragmentado elegível.
- **FR-012**: O usuário MUST poder solicitar `Corrigir todos os jogos fragmentados`, abrangendo todos os jogos fragmentados ou parcialmente fragmentados que sejam elegíveis no diagnóstico vigente.
- **FR-013**: Antes de qualquer escrita, o sistema MUST apresentar um plano que identifique alvo, arquivos, ordem, ações, espaço temporário, espaço livre, riscos, exclusões e estratégia de recuperação.
- **FR-014**: Toda correção MUST exigir confirmação explícita do plano vigente; cancelar, fechar ou omitir a confirmação MUST resultar em nenhuma alteração.
- **FR-015**: O sistema MUST revalidar identidade do dispositivo, conteúdo de origem, bloqueios, espaço e elegibilidade imediatamente antes de iniciar a correção e MUST invalidar o plano se as premissas tiverem mudado.
- **FR-016**: A correção MUST preparar uma cópia candidata isolada da versão ativa antes de promover qualquer alteração definitiva.
- **FR-017**: O sistema MUST comparar tamanho e hash da origem e da cópia candidata e MUST rejeitar a candidata se qualquer validação divergir.
- **FR-018**: O sistema MUST regravar a cópia candidata visando distribuição física contígua e MUST executar novo diagnóstico físico antes da promoção definitiva.
- **FR-019**: O sistema MUST promover uma candidata somente quando integridade, tamanho, hash, estrutura e contiguidade tiverem sido comprovados.
- **FR-020**: A última versão original válida MUST permanecer recuperável até que a nova versão esteja integralmente promovida e validada; uma falha MUST NOT deixar uma instalação parcial como versão ativa.
- **FR-021**: A correção MUST preservar nomes, Game IDs, configurações, artes, metadados e conteúdo de cada jogo; artes, configurações e demais metadados auxiliares MUST permanecer somente leitura.
- **FR-022**: Uma instalação USBExtreme MUST ser tratada como unidade indivisível, com todas as partes validadas e com `ul.cfg` consistente antes e depois da promoção.
- **FR-023**: O sistema MUST bloquear a correção antes da escrita quando o espaço livre não cobrir os bytes das candidatas do jogo corrente mais uma margem operacional igual ao maior valor entre 64 MiB e 2% desses bytes; renomear o original como backup não adiciona seu tamanho ao cálculo, pois não duplica sua alocação, e qualquer cópia adicional que a implementação venha a exigir MUST ser somada integralmente e exibida no plano.
- **FR-024**: O sistema MAY tentar a correção sem garantia antecipada de alocação contígua somente quando puder verificar de forma confiável a distribuição física da cópia candidata; MUST bloquear a correção quando essa verificação não estiver disponível e MUST NOT promover uma candidata que permaneça fragmentada.
- **FR-025**: Jogos incompletos, inválidos ou não verificáveis MUST NOT ser declarados corrigidos por esta funcionalidade.
- **FR-026**: Arquivo bloqueado, falha de leitura, falha de escrita, remoção do dispositivo, cancelamento ou interrupção MUST interromper novas promoções e preservar ou restaurar a última versão validada de cada jogo afetado.
- **FR-027**: Em lote, a falha de um jogo MUST ser isolada dos demais; o sistema só pode continuar com itens independentes quando isso não reduz as garantias de segurança e MUST registrar a decisão.
- **FR-027a**: A correção em lote MUST processar um jogo por vez, limitar o espaço temporário ativo ao jogo corrente e revalidar o espaço disponível antes de iniciar cada jogo.
- **FR-028**: Ao final, após sucesso, falha, cancelamento ou interrupção recuperável, o sistema MUST repetir o diagnóstico dos itens acessíveis antes de apresentar estados finais.
- **FR-029**: O relatório MUST registrar por jogo estado anterior e final, hashes, tamanhos, arquivos modificados, resultado, falhas, decisões de recuperação e instruções para qualquer ação manual restante.
- **FR-030**: O sistema MUST distinguir claramente `corrigido`, `inalterado`, `ignorado`, `falhou`, `cancelado` e `recuperação pendente`, sem inferir sucesso apenas pela conclusão da cópia.
- **FR-031**: O sistema MUST manter registro persistente do plano confirmado, progresso e relatório suficiente para explicar e recuperar uma operação interrompida, sem registrar conteúdo desnecessário dos jogos.
- **FR-032**: A funcionalidade MUST NOT formatar o dispositivo, desabilitar verificações de fragmentação do OPL, executar desfragmentação genérica ou alterar jogos sem autorização específica.
- **FR-033**: Limitações deliberadas de plataforma e filesystem MUST ser apresentadas no diagnóstico e no plano em linguagem acionável.
- **FR-034**: O sistema MUST identificar cada instalação pela combinação do dispositivo selecionado, formato e conjunto normalizado de caminhos físicos; Game ID MUST ser tratado como metadado não exclusivo, e duplicidades MUST ser sinalizadas sem mesclar jogos, arquivos, planos ou resultados.
- **FR-035**: Ao detectar uma operação interrompida, o sistema MUST preservar ou restaurar automaticamente a última versão válida quando isso não exigir promover uma candidata; MUST NOT retomar cópias, promover candidatas ou iniciar nova escrita sem gerar um novo plano e obter nova confirmação explícita.
- **FR-036**: A correção MUST limitar escritas aos arquivos fragmentados do jogo; `ul.cfg` MAY ser modificado somente quando indispensável para manter uma instalação USBExtreme consistente e MUST participar da mesma garantia transacional da instalação.

### Key Entities

- **Dispositivo OPL**: Unidade HD/USB selecionada, identificada de forma estável, com filesystem, capacidade, espaço livre e capacidades de verificação e correção.
- **Jogo diagnosticado**: Instalação lógica identificada pela combinação de dispositivo, formato e conjunto normalizado de caminhos físicos, com Game ID não exclusivo, nome, arquivos associados, tamanho, estado agregado, evidências e eventual sinalização de Game ID duplicado.
- **Arquivo avaliado**: Arquivo principal, parte USBExtreme ou auxiliar relevante, com caminho, tamanho, hash, disponibilidade de leitura e estado de distribuição física.
- **Diagnóstico**: Retrato somente leitura e datado do dispositivo, contendo inventário, classificações, evidências, resumo e limitações.
- **Plano de correção**: Conjunto imutável de alvos e ações propostos, estimativas de espaço, ordem, riscos, exclusões, premissas e estratégia de recuperação aguardando confirmação.
- **Operação de correção**: Execução individual ou em lote vinculada a um plano confirmado, com progresso e resultado por jogo.
- **Cópia candidata**: Versão isolada preparada para substituir um arquivo ou instalação, ainda sem autoridade para se tornar ativa até passar por todas as validações.
- **Relatório de correção**: Evidência final por jogo e da operação completa, incluindo estados, hashes, mudanças, falhas e recuperação.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Em um conjunto de teste com ISO, ZSO e USBExtreme representando todos os seis estados, 100% dos jogos recebem a classificação esperada e evidências correspondentes sem alteração do dispositivo durante diagnóstico.
- **SC-002**: Em 100% das tentativas de correção, nenhuma escrita começa sem plano visível e confirmação explícita do usuário.
- **SC-003**: Em testes de correção bem-sucedida de ISO, ZSO e USBExtreme multipartes, 100% dos jogos mantêm conteúdo, nome, Game ID, configurações, artes e metadados e terminam comprovadamente contíguos.
- **SC-004**: Em simulações de cancelamento, espaço insuficiente, arquivo bloqueado, remoção, falha de leitura, falha de escrita e interrupção durante promoção, 100% dos jogos preservam ou recuperam a última versão válida e nenhuma instalação parcial é apresentada como ativa.
- **SC-005**: Em 100% dos casos de fragmentação persistente, filesystem sem garantia ou plataforma sem verificação física, o jogo não é declarado corrigido e o motivo é apresentado com orientação acionável.
- **SC-006**: O resumo e o relatório conciliam 100% dos jogos do diagnóstico com um resultado final individual, sem itens omitidos ou contagens divergentes.
- **SC-007**: Em teste moderado com pelo menos 10 usuários representativos e o mesmo roteiro, pelo menos 90% conseguem identificar jogos afetados, revisar o impacto e iniciar ou cancelar a ação desejada sem ajuda externa; o resultado MUST registrar amostra, roteiro, conclusão por participante e taxa agregada.
- **SC-008**: Para uma biblioteca de até 500 jogos, o usuário recebe indicação inicial de progresso em até 2 segundos e consegue acompanhar o item atual durante todo o diagnóstico e a correção.

## Assumptions

- O usuário possui autorização para alterar os jogos e metadados presentes no dispositivo selecionado.
- ISO e ZSO em `/DVD` e `/CD` e instalações USBExtreme referenciadas por `ul.cfg` constituem o escopo inicial; outros formatos ou diretórios aparecem como não suportados sem serem alterados.
- Arquivos auxiliares relevantes são aqueles necessários para preservar identificação, configuração, artes e funcionamento do jogo no OPL; eles são preservados, mas somente arquivos cuja distribuição física afeta o jogo entram na classificação de fragmentação.
- `Parcialmente fragmentado` aplica-se a instalações compostas por múltiplos arquivos; jogos de arquivo único são `contíguos` ou `fragmentados` quando verificáveis.
- A margem operacional de espaço por jogo é `max(64 MiB, 2% dos bytes das candidatas)`; o cálculo inclui integralmente qualquer cópia adicional que não seja um rename no mesmo filesystem, é refeito antes de cada item e nunca é presumido como zero.
- A correção é oferecida quando a plataforma e o filesystem permitem regravar e verificar de forma confiável a distribuição física resultante; não é necessária garantia antecipada de contiguidade, mas suporte parcial nunca autoriza promoção ou alegação de sucesso.
- Resíduos temporários identificáveis podem ser limpos somente após o sistema comprovar que não são a última versão válida e obter autorização quando a limpeza alterar o dispositivo.

## Scope Boundaries

- A funcionalidade cobre diagnóstico físico e correção autorizada de jogos existentes; não instala jogos novos nem repara conteúdo logicamente corrompido ou partes ausentes.
- A funcionalidade não formata, reparticiona ou executa desfragmentação genérica do dispositivo.
- A funcionalidade não modifica nem contorna o comportamento de verificação de fragmentação do OPL.
- Um diagnóstico `não verificável` é um resultado válido; ele não pode ser convertido em `contíguo` por inferência.
- Testes de execução no emulador ou no console físico não fazem parte da declaração de correção de fragmentação.

## Dependencies

- A plataforma precisa oferecer identificação estável do dispositivo, leitura segura dos arquivos e consulta confiável da distribuição física para declarar contiguidade.
- O filesystem precisa permitir a estratégia de gravação e a plataforma precisa verificar a distribuição física resultante antes da promoção.
- O inventário de jogos precisa reconhecer formatos ISO, ZSO e USBExtreme e correlacionar corretamente Game IDs, partes e arquivos auxiliares.

## Constitutional Compliance

- Operações de escrita exibem o alvo resolvido, plano e riscos e exigem confirmação explícita.
- Diagnóstico é somente leitura; correções usam isolamento, validação e promoção tardia para preservar a última versão válida.
- Progresso, falhas, recuperação e resultados ficam observáveis e persistidos em relatório por jogo.
- Limitações de plataforma são declaradas, e ausência de garantia bloqueia a correção em vez de reduzir a segurança.
