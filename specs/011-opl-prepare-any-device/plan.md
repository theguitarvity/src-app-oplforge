# Implementation Plan: Preparar OPL em qualquer dispositivo ou pasta local

**Branch**: `master` (trunk-based, sem branch dedicada) | **Date**: 2026-08-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/011-opl-prepare-any-device/spec.md`

## Summary

Estender o fluxo existente de preparação/validação de dispositivo (`device.service.ts`,
`file.service.ts`, `PrepWizard.tsx`) para: (1) permitir escolher qualquer pasta local via o
diálogo nativo já disponível (`oplApi.openPathDialog({ mode: 'folder' })`), com proteção contra
seleção de diretórios raiz do sistema e confirmação extra fora da home; (2) completar `OPL_DIRS`
com `CHT`, `LNG`, `THM`, usados a partir de uma única fonte de verdade; (3) pular o wizard de
gravação quando a estrutura selecionada já estiver completa (`status: 'ready'`).

## Technical Context

**Language/Version**: TypeScript (Node 22 runtime no processo principal, React 18 no renderer)

**Primary Dependencies**: Electron (`dialog`, `fs/promises`), React, TanStack React Query

**Storage**: Sistema de arquivos local (sem banco de dados)

**Testing**: Vitest + Testing Library, seguindo os padrões já usados em `tests/`

**Target Platform**: Desktop (Windows, macOS, Linux) via Electron

**Project Type**: desktop-app (Electron + React)

**Performance Goals**: N/A — operação local de I/O de sistema de arquivos, sem requisito de
performance específico além do já implícito no fluxo de preparo atual

**Constraints**: Preparo MUST ser aditivo (nunca sobrescrever conteúdo existente); nenhuma nova
dependência externa

**Scale/Scope**: Alteração pontual em 4-5 arquivos existentes + 1 constante centralizada; sem
nova entidade persistente

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Constituição em `.specify/memory/constitution.md` v1.1.0 (emendada nesta sessão para incluir
`CHT`, `LNG`, `THM` na lista de diretórios obrigatórios — aprovado pelo usuário).

- **I. Segurança em Operações Sensíveis**: PASS — o preparo continua exigindo confirmação
  explícita (Passo 3 do wizard); a nova confirmação extra para pastas fora da home reforça essa
  garantia em vez de enfraquecê-la.
- **II. Isolamento e Menor Privilégio**: PASS — nenhum canal IPC novo; reutiliza `dialog:open-path`
  já exposto via `contextBridge` com API estreita.
- **III. Contratos Tipados e Limites de Camada**: PASS — nenhuma mudança de contrato em
  `src/types/opl.ts`; UI continua acessando apenas via `oplApi`/`src/services/api.ts`.
- **IV. Integridade, Rastreabilidade e Recuperação**: PASS — `prepareDevice` já usa `mkdir
{ recursive: true }` (idempotente/aditivo) e já registra histórico; nenhuma mudança nesse
  comportamento.
- **V. Evolução Incremental Verificada**: PASS — escopo mínimo, testes automatizados previstos
  para `hasOplStructure`/`OPL_DIRS` e para o novo fluxo de seleção de pasta local no
  `PrepWizard`.

Nenhuma violação — Complexity Tracking não se aplica.

## Project Structure

### Documentation (this feature)

```text
specs/011-opl-prepare-any-device/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   └── opl-api.md
└── tasks.md              # Phase 2 output (speckit-tasks)
```

### Source Code (repository root)

```text
electron/
├── services/
│   ├── device.service.ts                 # OPL_DIRS ampliado (CHT, LNG, THM); statDevice calcula isOutsideHome
│   └── diagnostics/
│       └── device-diagnostic.service.ts  # passa a importar OPL_DIRS de device.service.ts
├── ipc/
│   └── dialog.ipc.ts                     # checagem de raiz proibida no handler dialog:open-path, opt-in via novo campo restrictSystemRoots (não afeta os 10+ outros chamadores)

src/
├── components/device/
│   └── PrepWizard.tsx                    # novo passo/ação "escolher pasta local" (passa restrictSystemRoots: true); novo estado "já pronto" que pula gravação
├── pages/
│   └── PreparePage.tsx                   # ajuste de entrada, se necessário, para refletir a nova origem de seleção
└── types/opl.ts                          # OpenPathDialogOptions ganha restrictSystemRoots?; DeviceInfo ganha isOutsideHome? (ambos aditivos); PrepareDeviceInput sem mudança

tests/
└── (arquivos correspondentes já existentes para device.service, file.service, PrepWizard — estender cobertura, não criar nova suíte)
```

**Structure Decision**: Extensão in-place dos arquivos já responsáveis por preparo/validação de
dispositivo — sem novo módulo, serviço ou camada. Único ponto de atenção arquitetural é
centralizar `OPL_DIRS` como fonte única (hoje já exportado de `device.service.ts`; o diagnóstico
deve passar a importar de lá em vez de manter lista própria, se hoje ele tiver uma cópia local —
confirmar em tasks).

## Complexity Tracking

Não aplicável — nenhuma violação da constituição.
