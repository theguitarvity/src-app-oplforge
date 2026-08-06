# Implementation Plan: Diagnóstico e correção de fragmentação OPL

**Branch**: `002-opl-fragmentation-repair` | **Date**: 2026-08-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-opl-fragmentation-repair/spec.md`

## Summary

Implementar um fluxo independente que diagnostica ISO, ZSO e instalações USBExtreme, planeja correções individuais ou sequenciais em lote e promove somente candidatas íntegras e fisicamente contíguas. A solução cria um contexto de domínio `fragmentation-repair`, reutiliza descoberta e parsers existentes, verifica extents por adaptadores com capacidade comprovada no volume e executa uma transação durável por jogo. Candidatos e backups ficam no mesmo filesystem do alvo; o journal e os relatórios ficam no diretório de dados da aplicação. A reorganização global existente não será reutilizada porque remove originais antes da prova da candidata e modifica arquivos fora do escopo.

## Technical Context

**Language/Version**: TypeScript strict, ECMAScript 2022, Node.js 22

**Primary Dependencies**: Electron, React, React Router, TanStack React Query, Zustand para estado de UI, Zod para contratos IPC, APIs `node:fs`/`node:crypto`; ferramentas nativas `filefrag` no Linux e `fsutil` no Windows quando aprovadas por uma matriz estática, versionada e conservadora e pelo probe do volume

**Storage**: JSON versionado e escrito atomicamente em `app.getPath('userData')` para diagnósticos, planos, journals e relatórios; candidatos/backups temporários no mesmo filesystem dos arquivos do jogo; matriz de homologação somente leitura versionada junto ao código

**Testing**: Vitest com testes unitários, contratuais e de integração; Testing Library para UI; fixtures/fakes de filesystem, adaptadores e injeção de falhas; certificação manual/automatizada em volumes FAT32 e exFAT reais

**Target Platform**: Aplicação desktop Electron para Windows x64/arm64 e Linux AppImage/DEB; macOS Intel/Apple Silicon mantém diagnóstico `não verificável` e bloqueia correção até existir verificador público homologado

**Project Type**: Aplicação desktop Electron com renderer React, preload tipado e serviços privilegiados no processo principal

**Performance Goals**: Indicar progresso em até 2 segundos; suportar diagnóstico de até 500 jogos com progresso por item; streaming e hash com memória limitada ao tamanho do buffer, nunca ao tamanho do jogo; lote estritamente sequencial

**Constraints**: Operação offline; renderer sem Node; nenhuma escrita fora do dispositivo selecionado e do app-data; somente arquivos fragmentados e `ul.cfg` indispensável podem mudar; SHA-256 e tamanho devem coincidir; nenhuma promoção sem extent verificado e contíguo; um jogo por vez; espaço mínimo por jogo igual aos bytes das candidatas mais `max(64 MiB, 2%)`; rollback idempotente; nenhuma retomada ou promoção automática; combinações ausentes da matriz de homologação são bloqueadas por padrão

**Scale/Scope**: Um dispositivo ativo por operação, até 500 instalações por diagnóstico, ISO/ZSO em `DVD`/`CD` e USBExtreme multipartes; sem formatação, desfragmentação genérica, instalação de conteúdo ou reparo lógico

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design._

| Gate constitucional              | Decisão de conformidade                                                                                                                                | Status pré/pós-design |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| Confirmação de operação sensível | Plano imutável mostra dispositivo resolvido, arquivos, espaço, riscos e recuperação; confirmação literal e revisão vigente são obrigatórias            | PASS / PASS           |
| Isolamento e menor privilégio    | Todo I/O e execução de ferramentas ficam no processo principal; preload expõe apenas métodos/eventos dedicados; entradas IPC usam Zod                  | PASS / PASS           |
| Contratos tipados e limites      | Tipos compartilhados em `src/types/opl.ts`, acesso da UI por `src/services/api.ts`, React Query para operações externas e estado local somente para UI | PASS / PASS           |
| Integridade e recuperação        | Candidata validada antes da promoção, journal atômico fora do dispositivo, backup até commit, rollback idempotente, auditoria e relatório por jogo     | PASS / PASS           |
| Evolução verificada              | Regras, caminhos, capacidade, estados, IPC e falhas terão testes unitários, contratuais, integração e fault injection                                  | PASS / PASS           |
| Caminhos e escopo de escrita     | `SafeRoot`, identidade de dispositivo, caminhos normalizados e rejeição de symlinks/traversal precedem qualquer escrita                                | PASS / PASS           |
| Compatibilidade de distribuição  | Windows/Linux habilitados por capacidade; limitação macOS explícita e testável                                                                         | PASS / PASS           |

Não há violações que exijam exceção constitucional.

## Phase 0: Research Decisions

As decisões e alternativas estão consolidadas em [research.md](./research.md). Todos os pontos inicialmente incertos foram resolvidos antes do design:

- capacidade e parsing de extents por plataforma;
- tentativa de alocação contígua e verificação posterior;
- protocolo de journal, promoção e rollback;
- identidade estável de instalação e duplicidade de Game ID;
- limites de reutilização dos serviços existentes;
- atomicidade lógica de USBExtreme e escopo de arquivos escritos.

## Phase 1: Design

### Domain and persistence

O [data-model.md](./data-model.md) define diagnóstico, instalação, arquivo avaliado, plano, item transacional, journal, evento e relatório. Diagnósticos e planos são snapshots revisionados. Cada transação por jogo segue estados monotônicos e registra intenção durável antes de renames. Journals corrompidos ou estados ambíguos resultam em `recovery-pending`, nunca em promoção inferida.

### Service decomposition

- `diagnostic.service.ts`: descobre instalações, agrega estrutura/extents e calcula resumo sem escrita no dispositivo.
- `capability.service.ts`: testa suporte real do volume e seleciona Linux, Windows ou adaptador não verificável.
- `capability-matrix.ts`: declara combinações versionadas de OS, filesystem, driver/ferramenta e versão homologadas; ausência ou incompatibilidade resulta em bloqueio conservador.
- `identity.ts`: deriva identidades estáveis e normaliza caminhos relativos sem usar Game ID como chave.
- `diagnostic-classifier.ts`: aplica precedência dos seis estados e concilia o resumo.
- `plan.service.ts`: valida snapshot/revisão, elegibilidade, ordem, espaço de pico e exclusões.
- `candidate.service.ts`: grava, sincroniza e valida candidatas no mesmo filesystem.
- `transaction.service.ts`: cria e valida candidatas, registra commit intent, promove e faz rollback por jogo.
- `journal.store.ts`: persiste transições monotônicas com escrita temporária, sync, rename e sync do diretório.
- `store.ts`: persiste snapshots, planos, operações e relatórios versionados.
- `recovery.service.ts`: restaura a última versão válida; nunca retoma ou promove automaticamente.
- `batch.service.ts`: serializa transações por jogo e revalida espaço entre itens.
- `report.service.ts`: exige novo diagnóstico dos itens acessíveis em todo estado terminal antes de conciliar estados anterior/final, hashes, mudanças, falhas e instruções.
- `audit.service.ts`: registra eventos redigidos sem conteúdo dos jogos.
- `runtime.ts`: compõe dependências e mantém uma instância por processo.

O fluxo não depende de `ReorganizationService`; ele permanece legado e inalterado.

### Interface contract

O contrato detalhado está em [contracts/fragmentation-repair-ipc.md](./contracts/fragmentation-repair-ipc.md). A UI usa canais dedicados para diagnosticar, cancelar, planejar, confirmar, cancelar correção, consultar operação/relatório e receber eventos sequenciados. O processo principal resolve caminhos e identidades; o renderer nunca fornece caminhos de arquivos internos a promover.

### Validation design

O [quickstart.md](./quickstart.md) define os comandos e cenários end-to-end. A cobertura combina:

- unitários para agregação, identidade, espaço, extents, máquina de estados e rollback;
- contratos para schemas, canais, confirmação literal e serialização;
- integração para ISO/ZSO/USBExtreme, lote, unplug, ENOSPC, locks, hashes, fragmentação persistente e restart;
- UI para diagnóstico somente leitura, plano, confirmação, progresso e mensagens acionáveis;
- certificação de volumes reais por OS/filesystem antes de habilitar correção.

## Project Structure

### Documentation (this feature)

```text
specs/002-opl-fragmentation-repair/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── fragmentation-repair-ipc.md
└── tasks.md
```

### Source Code (repository root)

```text
electron/
├── ipc/
│   ├── fragmentation-repair.ipc.ts
│   └── schemas.ts
├── services/
│   ├── fragmentation/
│   │   ├── fragmentation-adapter.ts
│   │   ├── linux.adapter.ts
│   │   ├── windows.adapter.ts
│   │   └── macos.adapter.ts
│   ├── fragmentation-repair/
│   │   ├── audit.service.ts
│   │   ├── batch.service.ts
│   │   ├── candidate.service.ts
│   │   ├── capability-matrix.ts
│   │   ├── capability.service.ts
│   │   ├── diagnostic-classifier.ts
│   │   ├── diagnostic.service.ts
│   │   ├── identity.ts
│   │   ├── journal.store.ts
│   │   ├── plan.service.ts
│   │   ├── recovery.service.ts
│   │   ├── report.service.ts
│   │   ├── runtime.ts
│   │   ├── store.ts
│   │   └── transaction.service.ts
│   ├── catalog/
│   ├── persistence/
│   └── usbextreme/
├── main.ts
└── preload.ts

src/
├── components/fragmentation-repair/
│   ├── DiagnosticSummary.tsx
│   ├── GameDiagnosticTable.tsx
│   ├── RepairPlanDialog.tsx
│   └── RepairProgress.tsx
├── pages/FragmentationRepairPage.tsx
├── services/api.ts
└── types/opl.ts

tests/
├── contract/fragmentation-repair-ipc.contract.test.ts
├── integration/fragmentation-diagnosis.test.ts
├── integration/fragmentation-repair.test.ts
├── integration/fragmentation-recovery.test.ts
├── unit/fragmentation-capability.test.ts
├── unit/fragmentation-diagnostic.test.ts
├── unit/fragmentation-journal.test.ts
├── unit/fragmentation-plan.test.ts
└── unit/fragmentation-transaction.test.ts
```

**Structure Decision**: Manter a arquitetura Electron existente e adicionar um bounded context no processo principal, uma página independente no renderer e contratos tipados compartilhados. Reutilizar parsers e segurança existentes sem acoplar a feature à reorganização global.

## Complexity Tracking

Nenhuma violação constitucional ou estrutura adicional fora da arquitetura vigente requer justificativa.
