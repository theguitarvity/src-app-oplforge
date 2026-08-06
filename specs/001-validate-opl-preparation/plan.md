# Implementation Plan: Preparação OPL validada

**Branch**: `001-validate-opl-preparation` | **Date**: 2026-08-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-validate-opl-preparation/spec.md`

## Summary

Evoluir o OPL Forge para catalogar dispositivos existentes sem mutação, importar jogos por transações verificáveis, diagnosticar estrutura e contiguidade, sincronizar artes válidas e produzir evidências separadas de integridade, PCSX2 e hardware real. A solução preserva a arquitetura Electron existente: contratos compartilhados em TypeScript, I/O privilegiado e processos externos no processo principal, API estreita no preload, React Query para snapshots/operações e Zustand apenas para estado efêmero da UI.

O domínio será separado em scanners/parsers puros, serviços transacionais e adaptadores de plataforma. Catálogos e relatórios serão snapshots versionados gravados atomicamente em `userData`; jogos e dispositivos reais nunca serão expostos diretamente ao renderer. Operações mutáveis usarão staging, manifesto/journal, validação e promoção; qualquer evidência indisponível produzirá `not-verified` em vez de sucesso presumido.

## Technical Context

**Language/Version**: TypeScript 6.0.3, Node.js 22.x, ECMAScript 2022

**Primary Dependencies**: Electron 42.4.1, React 19.2.7, TanStack Query 5.101.0, Zustand 5.0.14, Zod 4.4.3, Vite 8.0.16

**Storage**: JSON versionado e escrita atômica em Electron `userData`; staging `/_OPL_FORGE_STAGING/` no dispositivo para promoção no mesmo filesystem; backup de reorganização em armazenamento externo escolhido

**Testing**: Vitest 4.1.9, jsdom, Testing Library; fixtures binárias e de filesystem; testes de integração dos serviços e contratos IPC; smoke tests PCSX2/hardware condicionais

**Target Platform**: Aplicação desktop distribuída para Windows x64/arm64, macOS Intel/Apple Silicon e Linux AppImage/DEB; verificação de contiguidade habilitada apenas por adaptadores homologados

**Project Type**: Desktop Electron com renderer React e serviços Node no processo principal

**Performance Goals**: Navegação, busca e seleção em até 1 s para 95% das ações em catálogos de 500 jogos; resultados provisórios progressivos; hash completo sob demanda e em streaming

**Constraints**: Renderer sandboxed; operações destrutivas confirmadas; leitura inicial estritamente somente leitura; nenhum falso estado pronto; BIOS/jogos não distribuídos; caminhos confinados; arquivos anteriores preservados até validação; PCSX2 não equivale a hardware real

**Scale/Scope**: Até 500 jogos por dispositivo na escala homologada, com leitura sem truncamento acima disso; ISO, ZSO e USBExtreme; oito tipos de arte; uma execução PCSX2 e um jogo de teste por imagem mínima

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design._

| Gate                                           | Pre-design | Post-design evidence                                                                                                                                     |
| ---------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Segurança em operações sensíveis            | PASS       | Importação, substituição, arte, reorganização e OPL têm confirmação adequada; formatação permanece separada e protegida; conteúdo legal não é fornecido. |
| II. Isolamento e menor privilégio              | PASS       | Scanner, filesystem, hash, comandos de plataforma, downloads e PCSX2 ficam no processo principal; preload expõe somente contratos nominados e validados. |
| III. Contratos tipados e limites               | PASS       | `src/types/opl.ts` continua como contrato compartilhado; `src/services/api.ts` é o único acesso da UI; React Query modela snapshots e operações.         |
| IV. Integridade, rastreabilidade e recuperação | PASS       | Journals, manifests, staging, hashes, promoção ordenada, snapshots, logs persistentes e evidências permitem rollback e auditoria.                        |
| V. Evolução incremental verificada             | PASS       | Parsers, seleção de formato, caminhos, IPC e estados terão testes unitários/integração; quickstart cobre os fluxos críticos.                             |
| Compatibilidade arquitetural                   | PASS       | Mantém Electron + React + TypeScript + Node 22; não exige emenda ou nova base de dados.                                                                  |
| Estrutura OPL e confinamento                   | PASS       | Preserva diretórios canônicos; realpath e identidade de dispositivo evitam traversal, ciclos, troca de mount e escrita fora do alvo.                     |
| Distribuição multiplataforma                   | PASS       | Todas as plataformas recebem diagnóstico; adapters não homologados retornam `not-verified` e bloqueiam prontidão.                                        |

Não há violações constitucionais nem exceções a justificar.

## Project Structure

### Documentation (this feature)

```text
specs/001-validate-opl-preparation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── opl-api.md
└── tasks.md
```

### Source Code (repository root)

```text
electron/
├── main.ts
├── preload.ts
├── ipc/
│   ├── catalog.ipc.ts
│   ├── device.ipc.ts
│   ├── file.ipc.ts
│   ├── art.ipc.ts
│   ├── opl.ipc.ts                     # novo
│   └── validation.ipc.ts              # novo
└── services/
    ├── device.service.ts              # detecção + identidade; delega diagnóstico
    ├── diagnostics/                   # diagnóstico e agregação de prontidão
    ├── catalog/                       # scanner, snapshots e overrides
    ├── images/                        # ISO9660/ZSO, Game ID e mídia
    ├── usbextreme/                    # codec ul.cfg e partes
    ├── installation/                  # staging, journal, promoção e recuperação
    ├── fragmentation/                 # interface + adapters Linux/Windows/macOS
    ├── art/                           # índice, PNG, staging e promoção
    ├── opl/                           # perfis/versionamento/capabilities
    ├── pcsx2/                         # detecção, perfil isolado e supervisor
    ├── reports/                       # readiness report e smoke test físico
    └── persistence/                   # JSON versionado e escrita atômica

src/
├── types/opl.ts                       # contratos compartilhados expandidos
├── services/api.ts                    # única fachada renderer → preload
├── pages/
│   ├── GameLibraryPage.tsx            # nova biblioteca do dispositivo
│   ├── DevicesPage.tsx
│   ├── Ps2ImportPage.tsx
│   ├── ArtManagerPage.tsx
│   └── ValidationPage.tsx             # novo assistente PCSX2/relatório
├── components/
│   ├── library/
│   ├── diagnostics/
│   └── validation/
└── stores/device-store.ts             # somente seleção/estado efêmero

tests/
├── unit/                              # parsers, codecs, naming, PNG e estados
├── contract/                          # IPC/preload/Zod
├── integration/                       # filesystem temporário, journal e rollback
└── fixtures/                          # ISO/ZSO/ul.cfg/PNG/dispositivos sintéticos
```

**Structure Decision**: Estender o projeto Electron único existente. Novos módulos ficam no processo principal por domínio; contratos permanecem compartilhados em `src/types/opl.ts`; o renderer recebe dados serializáveis e nunca caminhos operacionais genéricos ou acesso Node.

## Design Sequence

1. Definir tipos, schemas de validação e persistência versionada.
2. Implementar parsers puros ISO/ZSO/USBExtreme, normalização de identidade e adapters de contiguidade.
3. Substituir cópia direta por instalação transacional e recuperação.
4. Implementar identidade/capabilities do dispositivo e diagnóstico.
5. Implementar scanner somente leitura e snapshots progressivos sobre os parsers e a identidade concluídos.
6. Reescrever sincronização de artes sobre o catálogo e staging validado.
7. Introduzir perfis OPL imutáveis e matriz de capabilities.
8. Implementar imagem mínima, adapter/supervisor PCSX2 e checkpoints.
9. Agregar relatório e smoke test físico.
10. Integrar páginas/React Query e executar a matriz de testes do quickstart.

## Complexity Tracking

Nenhuma violação constitucional requer justificativa. A separação por domínio evita um serviço monolítico e corresponde diretamente a fronteiras de risco e teste exigidas pela feature.
