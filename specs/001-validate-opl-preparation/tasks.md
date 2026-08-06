# Tasks: Preparação OPL validada

**Input**: Design documents from `/specs/001-validate-opl-preparation/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/opl-api.md](contracts/opl-api.md), [quickstart.md](quickstart.md)

**Tests**: Obrigatórios para regras de domínio, contratos IPC, filesystem e fluxos críticos conforme FR-040 e a constituição. Em cada história, escrever os testes indicados e confirmar a falha antes da implementação.

**Organization**: Tarefas agrupadas pelas sete histórias da especificação. Cada fase termina em um incremento demonstrável e possui critério de teste independente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode ser executada em paralelo por alterar arquivos distintos e não depender de outra tarefa incompleta da mesma fase.
- **[Story]**: Mapeia diretamente para US1–US7 da especificação.
- Todos os itens possuem caminho de arquivo explícito.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar a estrutura de módulos, testes e fixtures sem alterar comportamento do produto.

- [x] T001 Criar os diretórios de serviços definidos no plano em electron/services/{persistence,opl,images,usbextreme,catalog,diagnostics,fragmentation,installation,pcsx2,reports}/ e os barrels mínimos index.ts
- [x] T002 [P] Criar a estrutura de testes tests/{unit,contract,integration,fixtures}/ com arquivos README.md descrevendo a política de fixtures legais e sintéticas
- [x] T003 [P] Configurar aliases e inclusão de tests no vite.config.ts e tsconfig.json para executar testes Node e jsdom sem acessar hardware real
- [x] T004 [P] Criar helpers de filesystem temporário, relógio e IDs determinísticos em tests/helpers/{temp-device.ts,fake-clock.ts,fake-id.ts}
- [x] T005 Adicionar scripts de testes unitários, contract e integration em package.json preservando pnpm test:run como gate agregado

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Estabelecer contratos, persistência e primitives de segurança compartilhados por todas as histórias.

**⚠️ CRITICAL**: Nenhuma história começa antes desta fase passar em typecheck e testes próprios.

- [x] T006 Expandir contratos compartilhados de DeviceIdentity, OplProfile, VerificationState, Finding, operations e erros serializáveis em src/types/opl.ts
- [x] T007 [P] Implementar schemas Zod para todas as entradas IPC privilegiadas em electron/ipc/schemas.ts
- [x] T008 [P] Implementar armazenamento JSON versionado com escrita temporária, fsync, rename e migração explícita em electron/services/persistence/json-store.service.ts
- [x] T009 [P] Implementar normalização/confinamento por realpath, detecção de escape e troca de mount em electron/services/persistence/safe-path.service.ts
- [x] T010 [P] Implementar registro persistente e sanitizado de logs/evidências em electron/services/persistence/audit-log.service.ts
- [x] T011 Implementar lock por deviceId, revisions e erro STALE_REVISION em electron/services/persistence/device-lock.service.ts
- [x] T012 [P] Implementar registro imutável, aquisição por release oficial, capability matrix e plano confirmado de atualização do OPL no memory card em electron/services/opl/opl-profile.service.ts
- [x] T013 [P] Criar fixtures e testes de origem oficial, version/commit/hash, rejeição de latest, confirmação e preservação do memory card anterior em tests/fixtures/opl-profiles.json e tests/unit/opl-profile.service.test.ts
- [x] T014 Atualizar a fachada de eventos de operação com operationId, sequence e estados completos em electron/services/logger.ts
- [x] T015 Implementar opl:profiles:list/get/register-official/update-plan/update-confirm em src/types/opl.ts, electron/ipc/schemas.ts, electron/ipc/opl.ipc.ts, electron/preload.ts e src/services/api.ts e registrar os handlers em electron/main.ts
- [x] T016 Criar testes de contrato para schemas, preload estreito, erros controlados e ausência de canais genéricos em tests/contract/base-ipc.contract.test.ts

**Checkpoint**: Fundação pronta; parsers, snapshots e operações podem evoluir sem quebrar isolamento ou persistência.

---

## Phase 3: User Story 1 — Preparar jogo íntegro e não fragmentado (Priority: P1) 🎯 MVP

**Goal**: Importar backup autorizado no formato correto usando staging, hashes, promoção segura e contiguidade comprovada.

**Independent Test**: Importar ISO válida abaixo do limite, imagem acima do FAT32 como USBExtreme, substituição por mesmo Game ID, fragmentação simulada e cancelamento; nenhum parcial pode ficar visível.

### Tests for User Story 1

- [x] T017 [P] [US1] Criar fixtures mínimas ISO9660, ZSO e SYSTEM.CNF válidas/inválidas em tests/fixtures/images/README.md e tests/fixtures/images/generate-fixtures.ts
- [x] T018 [P] [US1] Criar golden fixtures de ul.cfg e partes completas, órfãs e ausentes em tests/fixtures/usbextreme/README.md e tests/fixtures/usbextreme/generate-fixtures.ts
- [x] T019 [P] [US1] Escrever testes de parser de imagem, mídia, Game ID e nomes canônicos em tests/unit/image-inspection.test.ts
- [x] T020 [P] [US1] Escrever testes de round-trip/validação USBExtreme sem descartar registros desconhecidos em tests/unit/ul-cfg-codec.test.ts
- [x] T021 [P] [US1] Escrever testes dos adapters de contiguidade e estados unknown/fragmented/contiguous em tests/unit/fragmentation-adapters.test.ts
- [x] T022 [US1] Escrever integração de staging, substituição, promoção UL, cancelamento e recovery através de Ps2ImportPage → src/services/api.ts → preload/IPC → serviço em tests/integration/game-installation.test.ts

### Implementation for User Story 1

- [x] T023 [P] [US1] Implementar reader ISO9660, SYSTEM.CNF, Game ID e evidência CD/DVD em electron/services/images/iso9660.service.ts
- [x] T024 [P] [US1] Implementar reader ZSO com validação de header, índice, blocos e acesso a setores lógicos em electron/services/images/zso.service.ts
- [x] T025 [P] [US1] Implementar normalização AAAA_000.00, sanitização e nomes por perfil em electron/services/images/game-naming.service.ts
- [x] T026 [P] [US1] Implementar codec binário e validador de ul.cfg/partes em electron/services/usbextreme/ul-cfg.service.ts
- [x] T027 [P] [US1] Definir interface e adapters Linux, Windows e macOS com evidência explícita em electron/services/fragmentation/{fragmentation-adapter.ts,linux.adapter.ts,windows.adapter.ts,macos.adapter.ts}
- [x] T028 [US1] Implementar planejamento de formato/capacidade/colisão e hash SHA-256 streaming em electron/services/installation/installation-planner.service.ts
- [x] T029 [US1] Implementar manifest, journal, staging, fsync, promoção, rollback e recovery de inicialização em electron/services/installation/game-installation.service.ts
- [x] T030 [US1] Substituir files:copy-game pelo contrato installation:plan/confirm/cancel em src/types/opl.ts, electron/ipc/file.ipc.ts, electron/preload.ts e src/services/api.ts e registrar recovery em electron/main.ts
- [x] T031 [US1] Atualizar fluxo de importação com formato calculado, confirmação legal/substituição, progresso e resultado verificável em src/pages/Ps2ImportPage.tsx

**Checkpoint**: US1 entrega importação transacional independente, inclusive USBExtreme, sem falso estado pronto.

---

## Phase 4: User Story 2 — Diagnosticar a prontidão do dispositivo (Priority: P1)

**Goal**: Classificar dispositivo com evidências de filesystem, estrutura, integridade e contiguidade, usando not-verified quando necessário.

**Independent Test**: Diagnosticar fixtures ready, warning, requires-reorganization e incompatible em adapters conhecidos e desconhecidos.

### Tests for User Story 2

- [x] T032 [P] [US2] Escrever testes de filesystem, cluster, limite de arquivo e identidade de dispositivo por plataforma em tests/unit/device-capabilities.test.ts
- [x] T033 [P] [US2] Escrever tabela de decisão para as quatro classificações e condições not-verified em tests/unit/readiness-classifier.test.ts
- [x] T034 [US2] Escrever integração do diagnóstico com ISO, ZSO, USBExtreme, ul.cfg e fragmentation fake em tests/integration/device-diagnostics.test.ts

### Implementation for User Story 2

- [x] T035 [P] [US2] Evoluir detecção multiplataforma de identidade, filesystem, capacidade, cluster e acesso em electron/services/device.service.ts
- [x] T036 [P] [US2] Implementar inventário estrutural de diretórios OPL e coleta de evidências em electron/services/diagnostics/device-diagnostic.service.ts
- [x] T037 [US2] Implementar classificador ready/ready-with-warnings/requires-reorganization/incompatible em electron/services/diagnostics/readiness-classifier.ts
- [x] T038 [US2] Expor diagnostics:run e eventos validados em src/types/opl.ts, electron/ipc/device.ipc.ts, electron/preload.ts e src/services/api.ts
- [x] T039 [US2] Exibir evidências, condições not-verified e ações seguras em src/pages/DevicesPage.tsx e src/components/diagnostics/DiagnosticSummary.tsx

**Checkpoint**: US2 diagnostica sem depender de arte ou PCSX2 e nunca promove desconhecido a sucesso.

---

## Phase 5: User Story 3 — Visualizar biblioteca OPL existente (Priority: P1)

**Goal**: Ler recursivamente um HD/USB existente sem mutação, publicar snapshots completos e permitir correção manual persistente de Game ID.

**Independent Test**: Escanear fixture com DVD/CD/ZSO/USBExtreme, subdiretórios, links, duplicados e falhas; comparar hashes/mtimes antes/depois e atualizar mudanças externas.

### Tests for User Story 3

- [x] T040 [P] [US3] Escrever testes de scanner recursivo confinado, ciclos, links externos e arquivos desconhecidos em tests/unit/catalog-scanner.test.ts
- [x] T041 [P] [US3] Escrever testes de snapshots provisional/complete/failed, diff e preservação do último completo em tests/unit/catalog-snapshot.test.ts
- [x] T042 [P] [US3] Escrever testes de persistência/invalidação de override por device, path, size e conteúdo em tests/unit/game-id-override.test.ts
- [x] T043 [P] [US3] Escrever teste de contrato para scan/cancel/snapshot/override/hash e eventos sequenciados em tests/contract/catalog-ipc.contract.test.ts
- [x] T044 [US3] Escrever integração read-only, remoção, diretório inacessível e refresh através de GameLibraryPage → src/services/api.ts → preload/IPC → scanner em tests/integration/device-catalog.test.ts

### Implementation for User Story 3

- [x] T045 [P] [US3] Implementar entidades persistidas de scan, snapshot, item, file identity e override em electron/services/catalog/catalog-store.service.ts
- [x] T046 [P] [US3] Implementar scanner recursivo read-only para DVD/CD e descoberta ZSO/USBExtreme em electron/services/catalog/catalog-scanner.service.ts
- [x] T047 [US3] Implementar publicação progressiva, snapshot atômico, diff e cancelamento em electron/services/catalog/catalog.service.ts
- [x] T048 [US3] Implementar hash completo sob demanda e invalidação de cache/override em electron/services/catalog/catalog-hash.service.ts
- [x] T049 [US3] Expor canais catalog:scan/snapshot/override/hash e eventos em src/types/opl.ts, electron/ipc/catalog.ipc.ts, electron/preload.ts e src/services/api.ts
- [x] T050 [US3] Implementar biblioteca, filtros, provisional state, findings e correção de ID em src/pages/GameLibraryPage.tsx e src/components/library/GameLibraryTable.tsx
- [x] T051 [US3] Integrar seleção de dispositivo e invalidation de React Query em src/app/main.tsx e src/stores/device-store.ts

**Checkpoint**: US3 permite conectar dispositivo existente e navegar até 500 jogos sem reimportação ou mutação.

---

## Phase 6: User Story 4 — Instalar artes reconhecidas pelo OPL (Priority: P2)

**Goal**: Sincronizar artes válidas para todo item catalogado e calcular estados pelo conjunto realmente disponível.

**Independent Test**: Sincronizar DVD/CD/ZSO/USBExtreme contra fonte controlada com PNG, HTML, vazio, subdiretório e archive, preservando arte anterior.

### Tests for User Story 4

- [x] T052 [P] [US4] Criar fixtures PNG/HTML/vazio/archive e índice OPLM com disponibilidade variável em tests/fixtures/art/README.md e tests/fixtures/art/generate-fixtures.ts
- [x] T053 [P] [US4] Escrever testes de assinatura PNG, nomes/sufixos e estados missing/cover-ready/partial/complete em tests/unit/art-validation.test.ts
- [x] T054 [P] [US4] Escrever teste de contrato do plano/confirmação/eventos de arte em tests/contract/art-ipc.contract.test.ts
- [x] T055 [US4] Escrever integração de download, staging e preservação através de ArtManagerPage → src/services/api.ts → preload/IPC → art sync em tests/integration/art-sync.test.ts

### Implementation for User Story 4

- [x] T056 [P] [US4] Implementar indexação OPLM de subdiretórios/archives e disponibilidade por Game ID em electron/services/art/oplm-art.service.ts
- [x] T057 [P] [US4] Implementar validação HTTP/tamanho/extensão/assinatura PNG e naming final em electron/services/art/art-validation.service.ts
- [x] T058 [US4] Implementar plano e sincronização transacional baseada no CatalogSnapshot em electron/services/art/art-sync.service.ts
- [x] T059 [US4] Substituir syncDvdArts por art:index/plan/confirm em src/types/opl.ts, electron/ipc/art.ipc.ts, electron/preload.ts e src/services/api.ts
- [x] T060 [US4] Atualizar UI por jogo com origem do ID, tipos, erros, destino e preview COV/COV2 em src/pages/ArtManagerPage.tsx e src/components/art/ArtStatusBadge.tsx

**Checkpoint**: US4 funciona a partir do catálogo, rejeita falsos PNG e não usa contagem fixa.

---

## Phase 7: User Story 5 — Validar a preparação no PCSX2 (Priority: P2)

**Goal**: Executar validação PCSX2 isolada com BIOS do usuário, imagem mínima, checkpoints e evidências reproduzíveis.

**Independent Test**: Usar adapter fake para todas as etapas e um smoke homologado opcional; confirmar que originais não mudam e que falhas ficam failed/not-verified.

### Tests for User Story 5

- [x] T061 [P] [US5] Escrever testes de detecção/version/hash, allowlist de adapters e argumentos seguros do PCSX2 em tests/unit/pcsx2-profile.test.ts
- [x] T062 [P] [US5] Escrever testes de BIOS sanitizada, clone de memory card e imagem USB mínima em tests/unit/validation-assets.test.ts
- [x] T063 [P] [US5] Escrever testes de checkpoint, aprovação, timeout, crash e distinção ELF/memory-card em tests/unit/validation-run.test.ts
- [x] T064 [P] [US5] Escrever contrato validation:plan/start/checkpoint/stop e eventos em tests/contract/validation-ipc.contract.test.ts
- [x] T065 [US5] Escrever integração com processo fake, datapath, logs e cronômetro das 9 etapas com limite líquido de 20 minutos em tests/integration/pcsx2-validation.test.ts

### Implementation for User Story 5

- [x] T066 [P] [US5] Implementar detecção, -version, SHA-256, -testconfig e adapters versionados em electron/services/pcsx2/pcsx2-profile.service.ts
- [x] T067 [P] [US5] Implementar identificação segura de BIOS e clone verificável de memory card em electron/services/pcsx2/validation-assets.service.ts
- [x] T068 [US5] Implementar builder de imagem USB mínima com snapshot, arte e um jogo em electron/services/pcsx2/usb-image.service.ts
- [x] T069 [US5] Implementar supervisor de processo, datapath isolado, timeout, logs, screenshots e cleanup em electron/services/pcsx2/pcsx2-runner.service.ts
- [x] T070 [US5] Implementar ValidationRun e contratos IPC em electron/services/pcsx2/validation.service.ts, src/types/opl.ts, electron/ipc/validation.ipc.ts, electron/preload.ts e src/services/api.ts
- [x] T071 [US5] Implementar seleção/atualização confirmada do OPL, pré-requisitos PCSX2, execução e confirmação manual em src/pages/ValidationPage.tsx e src/components/validation/CheckpointPanel.tsx

**Checkpoint**: US5 valida conteúdo emulado com evidência, sem BIOS distribuída e sem confundir imagem virtual com fragmentação física.

---

## Phase 8: User Story 6 — Reorganizar com recuperação segura (Priority: P3)

**Goal**: Reorganizar dispositivo fragmentado somente após backup externo completo e verificável, com journal e recuperação.

**Independent Test**: Planejar com backup insuficiente/igual ao device, cancelar, falhar antes/depois do backup e concluir reescrita sequencial preservando metadados.

### Tests for User Story 6

- [x] T072 [P] [US6] Escrever testes de inventário, cálculo de espaço, identidade de backup externo e confirmação em tests/unit/reorganization-plan.test.ts
- [x] T073 [P] [US6] Escrever contrato reorganization:plan/confirm/cancel e device lock em tests/contract/reorganization-ipc.contract.test.ts
- [x] T074 [US6] Escrever integração de backup, hash, falhas induzidas, rewrite UL e recovery em tests/integration/device-reorganization.test.ts

### Implementation for User Story 6

- [x] T075 [P] [US6] Implementar inventário imutável de jogos, ART, CFG, VMC e APPS em electron/services/installation/reorganization-inventory.service.ts
- [x] T076 [US6] Implementar plano, backup externo, journal, reescrita sequencial e auditoria em electron/services/installation/reorganization.service.ts
- [x] T077 [US6] Integrar recovery de reorganização na inicialização sem acionar formatação em electron/main.ts
- [x] T078 [US6] Expor contratos e confirmações de reorganização em src/types/opl.ts, electron/ipc/file.ipc.ts, electron/preload.ts e src/services/api.ts
- [x] T079 [US6] Implementar revisão de inventário, alvos, riscos, progresso e recovery em src/components/diagnostics/ReorganizationWizard.tsx

**Checkpoint**: US6 nunca reescreve antes de backup verificado e mantém recuperação auditável.

---

## Phase 9: User Story 7 — Registrar smoke test em PS2 real (Priority: P3)

**Goal**: Gerar relatório verificável com resultados independentes e anexar teste físico manual sem reclassificar emulação.

**Independent Test**: Gerar relatório estrutural/PCSX2 sem hardware, anexar smoke físico e verificar separação, hashes e sanitização.

### Tests for User Story 7

- [x] T080 [P] [US7] Escrever testes de agregação dos três resultados e estados not-run/not-verified em tests/unit/readiness-report.test.ts
- [x] T081 [P] [US7] Escrever contrato de generate/get/record-hardware-smoke e revisions em tests/contract/report-ipc.contract.test.ts
- [x] T082 [US7] Escrever integração de relatório, artefatos, sanitização e smoke físico em tests/integration/readiness-report.test.ts

### Implementation for User Story 7

- [x] T083 [US7] Implementar relatório imutável, manifest de evidências e resultados independentes em electron/services/reports/readiness-report.service.ts
- [x] T084 [US7] Implementar HardwareSmokeTest e contratos reports em electron/services/reports/hardware-smoke.service.ts, src/types/opl.ts, electron/ipc/validation.ipc.ts, electron/preload.ts e src/services/api.ts
- [x] T085 [US7] Implementar visualização/exportação sanitizada e formulário de PS2 real em src/pages/ValidationPage.tsx e src/components/validation/ReadinessReportView.tsx

**Checkpoint**: US7 diferencia inequivocamente integridade, PCSX2 e hardware real.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Fechar desempenho, segurança, documentação e gates de distribuição após as histórias desejadas.

- [x] T086 [P] Criar benchmark/fixture de 500 jogos e validar latência de busca/seleção em tests/integration/catalog-performance.test.ts
- [x] T087 [P] Adicionar testes de regressão para traversal, symlink, troca de device, stale revision e redaction em tests/integration/security-regressions.test.ts
- [x] T088 [P] Documentar matriz real de suporte a contiguidade e PCSX2 por plataforma em docs/compatibility-validation.md
- [x] T089 Revisar todas as operações longas para progresso, cancelamento, history e logs persistentes em electron/services/logger.ts e electron/services/history.service.ts
- [ ] T090 Validar fluxos 1–10, incluindo cronômetro PCSX2 e dois testes moderados com pelo menos 20 participantes para SC-006/SC-017, e registrar evidências em specs/001-validate-opl-preparation/validation-results.md conforme specs/001-validate-opl-preparation/quickstart.md
- [x] T091 Executar pnpm lint, pnpm test:run e pnpm build e registrar qualquer exceção com impacto, responsável e prazo em specs/001-validate-opl-preparation/validation-results.md
- [x] T092 Verificar empacotamento e limitações declaradas para Windows, macOS e Linux em electron-builder.yml e specs/001-validate-opl-preparation/validation-results.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 — Setup**: sem dependências.
- **Phase 2 — Foundational**: depende da Phase 1 e bloqueia todas as histórias.
- **US1 (P1)**: começa após a fundação e entrega parsers/adapters compartilhados.
- **US2 (P1)**: depende dos parsers e adapters T023–T027 de US1 para o diagnóstico completo.
- **US3 (P1)**: depende de T023–T026 de US1 e da identidade de dispositivo T035 de US2; stores e testes sem integração podem começar antes usando fakes.
- **US4 (P2)**: depende de um CatalogSnapshot fornecido por US3; pode usar fixture/fake até a integração final.
- **US5 (P2)**: depende de perfis e contratos fundamentais; para validação real completa usa item/snapshot de US3 e arte opcional de US4.
- **US6 (P3)**: depende do diagnóstico de US2 e inventário/snapshot de US3; reutiliza journal/fragmentation de US1.
- **US7 (P3)**: depende de evidência estrutural de US2 e, para resultado PCSX2, de US5; hardware manual permanece independente.
- **Phase 10 — Polish**: depende das histórias incluídas no release.

### User Story Dependency Graph

```text
Setup → Foundation → US1 Importação → US2 Diagnóstico → US3 Biblioteca
                            │                │                ├→ US4 Artes
                            └────────────────┴────────────────┼→ US5 PCSX2
                                                             ├→ US6 Reorganização
                                                             └→ US7 Relatório/Hardware
```

### Within Each User Story

1. Escrever os testes da fase e confirmar que falham pela ausência da feature.
2. Implementar entidades/parsers/adapters puros.
3. Implementar serviço privilegiado e persistência.
4. Implementar IPC/preload com schemas e erros controlados.
5. Integrar renderer via `src/services/api.ts`/React Query.
6. Executar o critério independente antes de avançar.

## Parallel Opportunities

- T002–T004 podem avançar em paralelo após T001.
- T007–T010 e T012 podem avançar em arquivos distintos antes da integração T011/T014–T016.
- Em US1, fixtures/testes T017–T021 e parsers/adapters T023–T027 são trilhas paralelas; T022 deve permanecer falhando até T028–T030.
- Após T023–T027, US2 pode avançar em paralelo com o restante de US1; após T035, os módulos próprios de US3 podem avançar em paralelo com a conclusão de US2.
- Em US3, testes T040–T043 e stores/scanner T045–T046 podem avançar paralelamente antes de T047–T051.
- US4 permite paralelizar T052–T054 e T056–T057; US5 permite T061–T064 e T066–T067.
- Testes/modelos de US6 e US7 podem começar com fakes antes das integrações dependentes.
- T086–T088 podem executar em paralelo; T090–T092 são gates finais ordenados pela disponibilidade dos builds.

## Parallel Example: User Story 3

```text
Task T040: testes do scanner recursivo em tests/unit/catalog-scanner.test.ts
Task T041: testes de snapshots em tests/unit/catalog-snapshot.test.ts
Task T042: testes de overrides em tests/unit/game-id-override.test.ts
Task T043: contrato do catálogo em tests/contract/catalog-ipc.contract.test.ts
Task T045: store do catálogo em electron/services/catalog/catalog-store.service.ts
Task T046: scanner em electron/services/catalog/catalog-scanner.service.ts
```

## Parallel Example: User Story 5

```text
Task T061: perfil PCSX2 em tests/unit/pcsx2-profile.test.ts
Task T062: assets de validação em tests/unit/validation-assets.test.ts
Task T063: estados/checkpoints em tests/unit/validation-run.test.ts
Task T064: contrato IPC em tests/contract/validation-ipc.contract.test.ts
Task T066: detector/adapters em electron/services/pcsx2/pcsx2-profile.service.ts
Task T067: BIOS/memory card em electron/services/pcsx2/validation-assets.service.ts
```

## Implementation Strategy

### MVP First — User Story 1

1. Completar Setup e Foundational.
2. Implementar US1 com testes primeiro.
3. Parar no checkpoint e demonstrar ISO pequena, USBExtreme grande, cancelamento, substituição e fragmentação.
4. Não declarar o dispositivo integralmente pronto antes de US2; o MVP comprova instalação individual segura.

### P1 Operational Increment

1. Acrescentar US2 para diagnóstico confiável.
2. Acrescentar US3 para dispositivos e bibliotecas preexistentes.
3. Validar as três histórias P1 juntas antes de iniciar mutações de arte ou emulação.

### Incremental Delivery

1. Setup + Foundation → contratos e segurança.
2. US1 → importação segura.
3. US2 → diagnóstico e prontidão estrutural.
4. US3 → biblioteca existente read-only.
5. US4 → artes transacionais.
6. US5 → validação PCSX2.
7. US6 → reorganização com backup.
8. US7 → relatório e hardware real.
9. Polish → desempenho, matriz multiplataforma e gates.

## Notes

- `[P]` significa arquivos distintos e ausência de dependência imediata, não autorização para ignorar locks do dispositivo.
- Tasks de teste precedem a implementação e devem falhar pela razão esperada.
- Nenhuma fixture pode conter BIOS, jogo comercial ou conteúdo sem autorização.
- Commits devem ser pequenos e preservar typecheck/lint/testes das fases concluídas.
- Toda limitação de plataforma deve produzir `not-verified` e ser documentada, nunca sucesso presumido.
