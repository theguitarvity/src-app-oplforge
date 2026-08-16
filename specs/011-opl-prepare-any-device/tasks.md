---
description: 'Task list for feature 007 — preparar OPL em qualquer dispositivo ou pasta local'
---

# Tasks: Preparar OPL em qualquer dispositivo ou pasta local

**Input**: Design documents from `specs/011-opl-prepare-any-device/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/opl-api.md

**Tests**: Incluídos — a constituição (Princípio V) exige testes automatizados para regras de
domínio, contratos IPC e fluxos críticos alterados.

**Organization**: Tarefas agrupadas por user story (US1-US4 de `spec.md`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência)
- **[Story]**: US1 (validar estrutura), US2 (escolher pasta local), US3 (preparar
  automaticamente), US4 (pular wizard quando já pronto)

## Phase 1: Setup

- [x] T001 Confirmar que `pnpm run test`, `pnpm run lint`, `pnpm run build` passam no estado
      atual (baseline antes das mudanças).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: fonte única de verdade da lista de pastas OPL — bloqueia US1 e US3.

- [x] T002 Atualizar `OPL_DIRS` em `electron/services/device.service.ts:10` para
      `['DVD', 'CD', 'PS1', 'APPS', 'ART', 'CFG', 'VMC', 'CHT', 'LNG', 'THM']`.
- [x] T003 [P] Atualizar teste(s) existente(s) de `device.service.ts` (estrutura
      completa/parcial/ausente) para cobrir as 10 pastas, incluindo casos onde só
      `CHT`/`LNG`/`THM` estão ausentes.
- [x] T004 [P] Confirmar que `device-diagnostic.service.ts` (já importa `OPL_DIRS` de
      `device.service.ts:2`) reporta `OPL_DIRECTORY_MISSING` corretamente para as 3 pastas
      novas — ajustar teste de diagnóstico se necessário.

**Checkpoint**: lista de pastas centralizada e testada — US1/US2/US3/US4 podem prosseguir.

---

## Phase 3: User Story 1 — Validar estrutura ao selecionar dispositivo ou pasta local (P1)

**Goal**: qualquer dispositivo ou pasta local selecionado é validado com o critério completo de
10 pastas.

**Independent Test**: selecionar dispositivo com estrutura completa, um com estrutura parcial, e
uma pasta local (via `getDeviceSummary`) e conferir a classificação de cada um.

### Implementation for User Story 1

- [x] T005 [US1] Confirmar que `getDeviceSummary(devicePath)`
      (`electron/services/device.service.ts:151-185`) continua funcionando com um `devicePath`
      arbitrário (não listado em `listDevices()`), agora validando as 10 pastas via `OPL_DIRS`
      atualizado (sem mudança de código esperada — apenas teste de regressão).
- [x] T006 [US1] Adicionar teste cobrindo `getDeviceSummary` chamado com um caminho de pasta
      local arbitrária (fora dos dispositivos auto-detectados) com estrutura completa e com
      estrutura parcial.

**Checkpoint**: validação funciona igualmente para dispositivos e pastas locais.

---

## Phase 4: User Story 2 — Escolher qualquer pasta local (P1)

**Goal**: usuário consegue abrir o diálogo nativo do SO e escolher qualquer pasta local no fluxo
de preparação.

**Independent Test**: abrir `PrepWizard`, acionar "Escolher pasta local", escolher uma pasta no
diálogo, confirmar que ela se torna o alvo selecionado.

### Implementation for User Story 2

- [x] T007a [US2] Adicionar campo opcional `restrictSystemRoots?: boolean` a
      `OpenPathDialogOptions` em `src/types/opl.ts:1338-1341` (aditivo — não quebra os 10+ call
      sites existentes que não passam esse campo).
- [x] T007 [US2] Em `electron/ipc/dialog.ipc.ts`, no handler `dialog:open-path` (linhas 7-19),
      quando `options?.restrictSystemRoots === true` (e **somente** nesse caso — nenhum outro
      chamador do canal é afetado), checar se o caminho escolhido é igual a `os.homedir()` ou a
      uma raiz de disco (`path.parse(resolved).root === resolved`); se for, lançar
      `ControlledError('SYSTEM_ROOT_FORBIDDEN', ...)` em vez de retornar o caminho.
- [x] T008 [P] [US2] Adicionar teste para o novo bloqueio opt-in em `electron/ipc/dialog.ipc.ts`
      (ou arquivo de teste correspondente em `tests/`), cobrindo: com `restrictSystemRoots:
    true` — raiz do disco bloqueada, home completa bloqueada, subpasta da home permitida; sem
      esse campo — nenhum outro comportamento muda (regressão dos call sites existentes).
- [x] T009 [US2] Em `src/components/device/PrepWizard.tsx`, Passo 1 (linhas 104-149), adicionar
      um botão/ação "Escolher pasta local" que chama
      `oplApi.openPathDialog({ mode: 'folder', restrictSystemRoots: true })` e, com o caminho
      retornado, monta um `DeviceInfo`-like a partir de `oplApi.getDeviceSummary`, definindo-o
      como `selectedDevice`; exibir um cartão de resumo da pasta local selecionada (fora da
      lista de dispositivos auto-detectados) quando ela não corresponder a nenhum item de
      `devices`.
- [x] T010 [P] [US2] Testes de componente para `PrepWizard.tsx` cobrindo: abrir diálogo,
      cancelar diálogo (nenhuma mudança de estado), selecionar pasta com sucesso (avança para
      Passo 2 ou para o estado "pronto" da US4).

**Checkpoint**: usuário escolhe pasta local e ela entra no mesmo fluxo dos dispositivos.

---

## Phase 5: User Story 3 — Preparar estrutura ausente automaticamente (P1)

**Goal**: ação "preparar" cria as 10 pastas esperadas sem apagar conteúdo existente, com
confirmação extra quando a pasta estiver fora da home do usuário.

**Independent Test**: preparar um dispositivo/pasta com estrutura ausente e parcial; conferir
criação aditiva e a confirmação extra fora da home.

### Implementation for User Story 3

- [x] T011a [US3] Adicionar campo opcional `isOutsideHome?: boolean` a `DeviceInfo`
      (`src/types/opl.ts:663-673`), calculado em `statDevice`
      (`electron/services/device.service.ts:20-42`) comparando o caminho resolvido contra
      `os.homedir()`.
- [x] T011 [US3] Confirmar que `prepareDevice` (`electron/services/file.service.ts:77-91`) usa
      `OPL_DIRS` atualizado (sem mudança de código, já itera a constante importada) — adicionar
      teste cobrindo que as 10 pastas são criadas e que pastas/arquivos pré-existentes não são
      alterados. Atualizar também a constante `README` (`file.service.ts`) para documentar
      `CHT`, `LNG`, `THM`.
- [x] T012 [US3] Em `src/components/device/PrepWizard.tsx`, Passo 3 (linhas 211-272), quando
      `selectedDevice.isOutsideHome === true` (T011a), exibir um segundo checkbox de confirmação
      explícita adicional antes de habilitar "Iniciar Preparação".
- [x] T013 [US3] Atualizar a lista de pastas exibida em `PrepWizard.tsx:191`
      (`DVD / CD / PS1 / APPS / ART / CFG / VMC`) para incluir `CHT / LNG / THM`.
- [x] T014 [P] [US3] Teste de componente cobrindo a confirmação extra exigida apenas quando a
      pasta está fora da home.

**Checkpoint**: preparo cria a estrutura completa de forma aditiva, com proteção extra fora da
home.

---

## Phase 6: User Story 4 — Não repetir preparo em algo já pronto (P2)

**Goal**: selecionar algo já com estrutura completa mostra "pronto" sem passar pelas etapas de
gravação.

**Independent Test**: selecionar dispositivo/pasta com `status: 'ready'` e confirmar que a UI
pula direto para o resultado "pronto".

### Implementation for User Story 4

- [x] T015 [US4] Em `PrepWizard.tsx`, ao definir `selectedDevice` (Passo 1, tanto para
      dispositivos auto-detectados quanto para pasta local escolhida via T009), se
      `selectedDevice.status === 'ready'`, pular para uma nova tela de resultado "Estrutura já
      está pronta" em vez de avançar para o Passo 2 (configuração de filesystem).
- [x] T016 [P] [US4] Teste de componente cobrindo: seleção de item com `status: 'ready'` não
      avança para os passos de configuração/gravação; seleção de item com `status:
    'missing-structure'` continua o fluxo normal.

**Checkpoint**: todas as 4 user stories funcionam de forma independente e combinada.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T017 Rodar `quickstart.md` manualmente (`pnpm run dev`) cobrindo os 9 passos descritos.
- [x] T018 [P] Revisar mensagens de erro/copy em português para o bloqueio de raiz e a
      confirmação extra fora da home, consistentes com o tom já usado em `PrepWizard.tsx`.
- [x] T019 Rodar `pnpm run test`, `pnpm run lint`, `pnpm run build` — todos devem passar.

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: sem dependências.
- **Foundational (Phase 2)**: depende de Setup; bloqueia todas as user stories (T002 é
  pré-requisito de T004, T005, T006, T011, T013).
- **US1 (Phase 3)** e **US2 (Phase 4)**: podem rodar em paralelo após Foundational.
- **US3 (Phase 5)**: depende de US2 (T009) para ter uma pasta local selecionável antes de
  preparar; pode reaproveitar dispositivos auto-detectados para progredir em paralelo.
- **US4 (Phase 6)**: depende de US1 (classificação correta) e de US2 (seleção de pasta local
  produzindo o mesmo shape `DeviceInfo`); é o último incremento antes do polish.
- **Polish (Phase 7)**: depende de todas as user stories completas.

## Parallel Example: Foundational + US1/US2

```bash
Task: "Atualizar OPL_DIRS em electron/services/device.service.ts:10"
Task: "Adicionar checagem de diretório raiz proibido em electron/ipc/dialog.ipc.ts"
```

## Notes

- Nenhuma tarefa cria novo canal IPC — T007 estende `dialog:open-path` já existente.
- Nenhuma tarefa introduz nova dependência externa.
- Commits pequenos por tarefa ou grupo lógico, conforme constituição (Fluxo de Desenvolvimento).
