# Project Goals

## Purpose

Evoluir o OPL Forge (app desktop + Android para gerenciar bibliotecas de
jogos PS2 via rede) em três frentes de experiência do usuário: alcance
internacional (idioma), confiabilidade de atualização no Android, e
transparência/confiança durante o carregamento da biblioteca ao trocar de
dispositivo.

## Business / Product Context

O app hoje está 100% em português hardcoded, o que limita seu alcance a
usuários que leem pt-BR. O desktop já tem atualização automática via
`electron-updater`; o Android não tem paridade nesse ponto. Ao trocar de
dispositivo/biblioteca, o app pode momentaneamente parecer "vazio" antes do
carregamento terminar, o que passa uma impressão de perda de dados ou de
bug ao usuário — um problema de confiança, não só de UX.

## Problem Statement

1. UI apenas em pt-BR restringe o público do app.
2. Usuários Android não sabem quando há uma versão nova disponível nem têm
   como atualizar pelo próprio app.
3. Ao trocar de dispositivo/biblioteca, a ausência de feedback de
   carregamento pode "iludir" o usuário fazendo-o pensar que a biblioteca
   sumiu, quando na verdade ainda está carregando.

## Desired Outcome

- App com UI totalmente traduzível, com 7 idiomas disponíveis desde já
  (pt-BR, en, es, de, ru, zh, ja), selecionável no primeiro launch e a
  qualquer momento em Configurações, em desktop e Android.
- Android com checagem de atualização e ação de update em Configurações,
  em paridade com o desktop.
- Trocas de dispositivo/biblioteca sempre comunicadas ao usuário via popup
  de carregamento, e a splash screen do app com indicador de loading
  visível.

## Target Scope

Desktop (Electron/React, `src/` + `electron/`) e Android (React
Native/Expo, `mobile/`). Não inclui iOS neste pedido (spec `009-ios-...`
existe no repo mas não foi mencionada pelo usuário nesta solicitação).

## Delivery Approach

Workflow trunk-based (sem branch dedicada) via Spec Kit, tratado como uma
única feature abrangendo as três frentes (i18n, update Android, sync de
biblioteca/splash), por decisão explícita do usuário durante o setup deste
workflow.

## What "Done" Means

1. As 7 traduções estão disponíveis e selecionáveis em desktop e Android,
   sem strings hardcoded remanescentes nas telas migradas.
2. Android verifica atualização ao abrir e oferece update em Configurações.
3. Popup de carregamento aparece ao trocar de dispositivo/biblioteca, e a
   splash screen mostra loading.
4. Todas as acceptance criteria em `app-features.md` estão cobertas por
   plano, tarefas e testes rastreáveis.

## Success Criteria

- Nenhuma string de UI hardcoded remanescente nas telas cobertas pelas
  features 1-3.
- Checagem de update Android funcional (mesmo que o mecanismo exato de
  distribuição seja resolvido durante `clarify`/`plan`).
- Popup de troca de biblioteca e loading de splash implementados e
  testáveis manualmente.

## Constraints

- Constituição do projeto (`.specify/memory/constitution.md`) já define
  princípios de segurança, isolamento Electron (contextIsolation,
  sandbox), contratos tipados, integridade/rastreabilidade e evolução
  incremental verificada — toda mudança deve respeitá-los.
- Stack já estabelecida: desktop React+Vite+Tailwind+Radix+zustand;
  mobile React Native/Expo+zustand. Novas soluções (ex.: biblioteca de
  i18n) devem se integrar a essa stack, não substituí-la.

## Governance

- Mudanças que ampliem a superfície de acesso do preload/IPC do Electron
  (ex.: para checagem de update) exigem seguir o Princípio II da
  constituição (isolamento e menor privilégio) — desktop já tem esse
  padrão implementado em `update.service.ts`/`preload.ts` e deve ser
  reaproveitado como referência para Android quando aplicável.

## Risks

- Mecanismo de update Android não definido pelo usuário — risco de
  bloqueio até decisão de produto (Play Store vs. distribuição própria).
- Ausência de fingerprint de dispositivo hoje é risco técnico para a
  Feature 3 (detecção de troca de biblioteca) — precisa de decisão de
  design antes de implementar.
- Tradução de 7 idiomas é um volume grande de conteúdo; risco de
  qualidade/consistência se não houver processo definido de revisão.

## Stakeholders

- Usuário/dono do produto (victorllsilv.dev@gmail.com) — decisor de
  escopo e prioridade.

## Non-goals

- iOS (fora do escopo desta solicitação).
- Localização de conteúdo de terceiros (nomes/metadados de jogos).
- Redesenho do sistema de update do desktop (já existe e funciona).

## Stopping Conditions

O workflow deve ser considerado concluído quando:

- As 3 features (i18n, update Android, sync de biblioteca com loading)
  estiverem especificadas, planejadas, com tasks geradas, analisadas sem
  findings bloqueantes, implementadas e validadas.
- Todos os quality gates bloqueantes do repositório passarem.
- Não houver `SPEC_DRIFT` não resolvido.

## Source Traceability

| Goal / Constraint                                                 | Source                                              | Classification           |
| ----------------------------------------------------------------- | --------------------------------------------------- | ------------------------ |
| Alcance internacional via 7 idiomas                               | Pedido do usuário                                   | EXPLICIT                 |
| Paridade de update entre desktop e Android                        | Pedido do usuário                                   | EXPLICIT                 |
| Evitar iludir usuário com biblioteca "vazia" durante carregamento | Pedido do usuário                                   | EXPLICIT                 |
| Workflow trunk-based, feature única                               | Resposta do usuário ao AskUserQuestion desta sessão | EXPLICIT                 |
| Constituição exige isolamento Electron e contratos tipados        | `.specify/memory/constitution.md`                   | DISCOVERED_FROM_CODEBASE |
| Desktop já tem update via electron-updater                        | `electron/services/updates/update.service.ts`       | DISCOVERED_FROM_CODEBASE |
| iOS fora de escopo                                                | Não mencionado pelo usuário nesta solicitação       | INFERRED                 |
