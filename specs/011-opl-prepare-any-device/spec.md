# Feature Specification: Preparar OPL em qualquer dispositivo ou pasta local

**Feature Branch**: `011-opl-prepare-any-device`

**Created**: 2026-08-15

**Status**: Draft

**Input**: User description: "Precisamos da opção de preparar dispositivo OPL em qualquer dispositivo selecionado. Ao selecionar uma pasta local ou um dispositivo, validar se o mesmo possui a estrutura de pastas que o OPL espera para reconhecer jogos/dados (ex: pastas DVD, CD, APPS, ART, CFG, CHT, LNG, THM, VMC, langs, etc). Se a estrutura não existir, oferecer a opção de 'preparar' o dispositivo, criando a estrutura de pastas esperada pelo OPL automaticamente."

## Clarifications

### Session 2026-08-15

- Q: Se o usuário escolher, pelo diálogo de pasta local, um diretório raiz sensível do sistema
  (ex: `C:\`, `/`, ou a pasta do usuário inteira), o app deve impedir/alertar antes de permitir
  "preparar" ali? → A: Bloquear seleção de raiz absoluta do sistema (`C:\`, `/`, `/home/<user>`
  inteira) e exigir uma confirmação adicional explícita ao preparar qualquer pasta fora da pasta
  pessoal do usuário.
- Q: "langs" citado no pedido original corresponde a qual pasta esperada pelo OPL? → A: `LNG`,
  consistente com a convenção de nomes curtos já usada nas demais pastas (`DVD`, `CD`, `PS1`,
  `APPS`, `ART`, `CFG`, `VMC`, `CHT`, `THM`).

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Validar estrutura ao selecionar dispositivo ou pasta local (Priority: P1)

Como usuário, quero que, ao selecionar um dispositivo detectado automaticamente OU uma pasta
local qualquer escolhida por mim, o aplicativo valide se essa pasta/dispositivo já possui a
estrutura completa de pastas que o OPL espera, para saber imediatamente se posso usá-lo ou se
preciso prepará-lo primeiro.

**Why this priority**: É o requisito central do pedido — sem a validação, não há como decidir se
o preparo é necessário nem para dispositivos nem para pastas locais.

**Independent Test**: Selecionar um dispositivo auto-detectado com estrutura completa, um
dispositivo com estrutura parcial, e uma pasta local escolhida manualmente (vazia e já
preparada), e conferir que cada caso recebe o resultado de validação correto.

**Acceptance Scenarios**:

1. **Given** um dispositivo auto-detectado com todas as pastas OPL esperadas, **When** o usuário
   o seleciona, **Then** o sistema classifica como estrutura completa/pronto.
2. **Given** um dispositivo auto-detectado com uma ou mais pastas OPL ausentes, **When** o
   usuário o seleciona, **Then** o sistema classifica como estrutura incompleta e identifica
   quais pastas faltam.
3. **Given** uma pasta local escolhida manualmente pelo usuário (não listada como dispositivo
   auto-detectado), **When** o usuário a seleciona, **Then** o sistema aplica o mesmo critério de
   validação de estrutura usado para dispositivos.

---

### User Story 2 - Escolher qualquer pasta local, não apenas dispositivos detectados (Priority: P1)

Como usuário, quero poder escolher manualmente uma pasta local no meu sistema (além dos
dispositivos que o aplicativo detecta automaticamente), para preparar/validar uma pasta que
ainda não está conectada como dispositivo físico ou que o sistema não detectou.

**Why this priority**: Sem essa capacidade, "qualquer dispositivo selecionado" fica restrito
aos poucos dispositivos que o sistema operacional expõe como montados, o que não atende ao
pedido original.

**Independent Test**: Abrir a tela de preparação, escolher a opção de selecionar pasta local,
navegar até uma pasta qualquer via diálogo do sistema operacional, e confirmar que ela entra no
mesmo fluxo de validação/preparo usado para dispositivos.

**Acceptance Scenarios**:

1. **Given** a tela de preparação de dispositivo, **When** o usuário aciona a opção de escolher
   pasta local, **Then** um diálogo nativo do sistema operacional é aberto para seleção de
   diretório.
2. **Given** que o usuário escolheu uma pasta local no diálogo, **When** a seleção é confirmada,
   **Then** essa pasta passa a ser tratada como o alvo selecionado, com sua estrutura validada
   da mesma forma que um dispositivo.
3. **Given** que o usuário cancela o diálogo de seleção de pasta, **When** o diálogo é fechado
   sem escolha, **Then** nenhuma alteração de estado ocorre e a seleção anterior (se houver) é
   mantida.

---

### User Story 3 - Preparar estrutura ausente automaticamente (Priority: P1)

Como usuário, quero que, quando a validação encontrar estrutura ausente ou incompleta em um
dispositivo ou pasta local selecionado, o aplicativo ofereça uma ação clara de "preparar" que
cria automaticamente todas as pastas esperadas pelo OPL, sem apagar ou alterar o que já existe.

**Why this priority**: É a ação que resolve o problema identificado pela validação; sem ela, o
diagnóstico de estrutura ausente não tem utilidade prática.

**Independent Test**: Selecionar um dispositivo/pasta com estrutura ausente ou parcial, acionar
"preparar", e confirmar que todas as pastas esperadas (incluindo as previamente ausentes) são
criadas, sem afetar arquivos ou pastas pré-existentes.

**Acceptance Scenarios**:

1. **Given** um dispositivo ou pasta local com estrutura ausente, **When** o usuário aciona
   "preparar", **Then** todas as pastas esperadas pelo OPL são criadas
   (`DVD`, `CD`, `PS1`, `APPS`, `ART`, `CFG`, `VMC`, `CHT`, `LNG`, `THM`).
2. **Given** um dispositivo com estrutura parcial (algumas pastas já existentes com conteúdo),
   **When** o usuário aciona "preparar", **Then** apenas as pastas ausentes são criadas e o
   conteúdo das pastas já existentes permanece intacto.
3. **Given** um dispositivo ou pasta local cuja estrutura já está completa, **When** o usuário o
   seleciona, **Then** o sistema não oferece a ação de "preparar" — em vez disso, mostra que a
   estrutura já está pronta (ver User Story 4).

---

### User Story 4 - Não repetir preparo em algo já pronto (Priority: P2)

Como usuário, quero que, ao selecionar um dispositivo ou pasta local que já tem a estrutura OPL
completa, o aplicativo mostre esse resultado diretamente como "pronto", sem me conduzir pelas
etapas de confirmação de gravação, para evitar confusão sobre se algo será alterado
desnecessariamente.

**Why this priority**: Reduz risco de confusão e fricção desnecessária, mas depende das User
Stories 1-3 já estarem implementadas — não bloqueia o valor central da feature.

**Independent Test**: Selecionar um dispositivo/pasta já com estrutura completa e confirmar que
a interface mostra o estado "pronto" sem abrir o fluxo de confirmação de gravação.

**Acceptance Scenarios**:

1. **Given** um dispositivo ou pasta local com estrutura já completa, **When** o usuário o
   seleciona no fluxo de preparação, **Then** a interface mostra diretamente o estado
   "validado/pronto", sem apresentar as etapas de confirmação de gravação.
2. **Given** um dispositivo ou pasta local com estrutura ausente ou parcial, **When** o usuário o
   seleciona, **Then** o fluxo de preparação (com confirmação de gravação) continua sendo
   oferecido normalmente.

### Edge Cases

- O que acontece se o usuário escolher, via diálogo de pasta local, um caminho ao qual o
  aplicativo não tem permissão de leitura/escrita? O sistema deve reportar erro controlado sem
  travar a interface.
- O que acontece se a pasta selecionada for removida ou desconectada durante a validação ou o
  preparo? A operação deve ser interrompida com erro controlado, sem deixar estrutura parcial
  não sinalizada como incompleta.
- Se o usuário selecionar a raiz de um disco do sistema (ex: `C:\`, `/`) como pasta local, a
  seleção é bloqueada com mensagem explicativa (ver FR-009).
- Se o usuário selecionar qualquer pasta fora de sua pasta pessoal (home), a ação de "preparar"
  exige uma confirmação adicional explícita antes de criar a estrutura ali (ver FR-010).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: O sistema MUST permitir que o usuário valide a estrutura de pastas OPL de
  qualquer dispositivo auto-detectado.
- **FR-002**: O sistema MUST permitir que o usuário escolha manualmente uma pasta local via
  diálogo nativo do sistema operacional, além dos dispositivos auto-detectados.
- **FR-003**: O sistema MUST validar a pasta local escolhida manualmente com o mesmo critério de
  estrutura OPL usado para dispositivos auto-detectados.
- **FR-004**: A validação de estrutura MUST considerar todas as pastas esperadas pelo OPL:
  `DVD`, `CD`, `PS1`, `APPS`, `ART`, `CFG`, `VMC`, `CHT`, `LNG`, `THM`.
- **FR-005**: Quando a validação encontrar estrutura ausente ou incompleta, o sistema MUST
  oferecer uma ação explícita de "preparar" que cria as pastas ausentes.
- **FR-006**: A ação de "preparar" MUST NOT apagar, sobrescrever ou alterar conteúdo já existente
  nas pastas do dispositivo/pasta selecionado — apenas criar o que estiver ausente.
- **FR-007**: Quando a validação encontrar estrutura já completa, o sistema MUST apresentar esse
  resultado como "pronto" sem conduzir o usuário pelas etapas de confirmação de gravação do
  fluxo de preparo.
- **FR-008**: O sistema MUST identificar, por pasta, quais itens da estrutura esperada estão
  ausentes, para orientar o usuário sobre o que será criado.
- **FR-009**: O sistema MUST bloquear a seleção de diretórios raiz absolutos do sistema (ex:
  `C:\`, `/`, ou a pasta pessoal do usuário em sua totalidade) no diálogo de escolha de pasta
  local, com mensagem explicando o motivo.
- **FR-010**: Ao preparar uma pasta local fora da pasta pessoal do usuário, o sistema MUST exigir
  uma confirmação adicional explícita, além da confirmação padrão já usada no fluxo de preparo,
  antes de criar a estrutura.

### Key Entities _(include if feature involves data)_

- **Dispositivo/Pasta selecionado**: representa o alvo da validação/preparo — pode ser um
  dispositivo auto-detectado (montagem USB/HD) ou uma pasta local escolhida manualmente; possui
  caminho, e um estado de validação (pronto / estrutura incompleta).
- **Estrutura OPL esperada**: conjunto de pastas (`DVD`, `CD`, `PS1`, `APPS`, `ART`, `CFG`,
  `VMC`, `CHT`, `LNG`, `THM`) que o OPL usa para reconhecer jogos e dados.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: O usuário consegue validar a estrutura de uma pasta local escolhida manualmente em
  até 3 interações (abrir diálogo, escolher pasta, ver resultado).
- **SC-002**: 100% das pastas esperadas pelo OPL (`DVD`, `CD`, `PS1`, `APPS`, `ART`, `CFG`,
  `VMC`, `CHT`, `LNG`, `THM`) são verificadas na validação e criadas no preparo.
- **SC-003**: Nenhum conteúdo pré-existente é perdido ou sobrescrito em preparo de estrutura
  parcial, em 100% dos casos testados.
- **SC-004**: Um dispositivo/pasta já pronto é identificado como tal sem exigir nenhuma etapa
  adicional de confirmação de gravação.

## Assumptions

- "langs" citado pelo usuário corresponde à pasta `LNG`, confirmado pelo usuário na fase de
  clarificação (sessão 2026-08-15).
- O mecanismo de seleção de pasta local usa a API nativa de diálogo do Electron
  (`dialog.showOpenDialog`, `openDirectory`), consistente com o runtime já adotado pelo projeto.
- Dispositivos/pastas com estrutura parcial continuam sendo preparados de forma aditiva
  (comportamento já existente de `prepareDevice`), sem necessidade de nova confirmação além da
  já usada no fluxo atual.
- Fora de escopo: importação de jogos, sincronização de artes, reparo de fragmentação —
  cobertos por specs 001-006 já existentes.
