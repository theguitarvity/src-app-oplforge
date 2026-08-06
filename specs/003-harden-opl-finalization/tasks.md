# Tasks: Finalização OPL confiável e resiliente

**Input**: Design documents from `/specs/003-harden-opl-finalization/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/opl-finalization-ipc.md](./contracts/opl-finalization-ipc.md), [quickstart.md](./quickstart.md)

**Tests**: Obrigatórios pela especificação, constituição e plano. Em cada história, criar os testes indicados e confirmar que falham pelo motivo esperado antes da implementação.

**Organization**: Tasks are grouped by user story so each story can be implemented, reviewed and validated as an incremental slice.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode executar em paralelo porque altera arquivos distintos e não depende de tarefa incompleta no mesmo grupo.
- **[Story]**: Mapeia a tarefa à história correspondente da especificação.
- Cada tarefa informa arquivos concretos e o resultado verificável esperado.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar dependência, estrutura e fixtures sem mudar o comportamento produtivo.

- [x] T001 Adicionar e fixar `yauzl` e seus tipos, documentar licença/auditoria e atualizar `package.json` e `pnpm-lock.yaml`
- [x] T002 Criar os diretórios planejados em `electron/services/finalization/`, `electron/services/naming/`, `src/components/downloads/` e `src/components/naming/` com arquivos `index.ts` de exportação controlada
- [x] T003 [P] Criar fixtures HTTP retomáveis e servidor controlável em `tests/fixtures/http/server.ts` e `tests/fixtures/http/generate-fixtures.ts`
- [x] T004 [P] Criar fixtures diferenciais ISO/ZSO, USBExtreme e ZIP hostil em `tests/fixtures/images/generate-fixtures.ts`, `tests/fixtures/usbextreme/generate-fixtures.ts` e `tests/fixtures/art/generate-fixtures.ts`
- [x] T005 Registrar a baseline de `pnpm build`, `pnpm lint` e `pnpm test:run` em `specs/003-harden-opl-finalization/baseline.md`, distinguindo falhas preexistentes de regressões da feature

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Definir contratos, persistência, segurança e runtime compartilhados por todas as histórias.

**⚠️ CRITICAL**: Nenhuma história começa antes da conclusão desta fase.

- [x] T006 Definir `PipelinePhase`, tarefas, checkpoints, reservas, identidades, planos, jobs, eventos e erros serializáveis em `src/types/opl-finalization.ts` e reexportar os contratos públicos em `src/types/opl.ts`
- [x] T007 Criar schemas Zod strict, paginação, IDs revisionados, confirmações literais e unions discriminadas em `electron/ipc/schemas.ts`
- [x] T008 [P] Adicionar testes de migração, compare-and-swap, fsync e recuperação de JSON corrompido em `tests/unit/opl-finalization-store.test.ts`
- [x] T009 Implementar store de entidades versionadas com write queue e migrations sobre `JsonStore` em `electron/services/persistence/atomic-entity-store.service.ts`
- [x] T010 [P] Adicionar testes de identidade física, alias de mount e exclusão mútua em `tests/unit/device-operation-lock.test.ts`
- [x] T011 Evoluir `DeviceLockService` para chave canônica de `deviceId`, preservando compatibilidade dos chamadores atuais em `electron/services/persistence/device-lock.service.ts`
- [x] T012 [P] Adicionar testes de confinamento do cache local, staging do dispositivo, symlink e traversal em `tests/unit/finalization-safe-path.test.ts`
- [x] T013 Implementar resolução de cache/staging e helpers de paths relativos seguros em `electron/services/persistence/finalization-paths.service.ts`
- [x] T014 [P] Adicionar testes de sequência, revisão, redaction e coalescência máxima de 4 Hz em `tests/unit/pipeline-event-publisher.test.ts`
- [x] T015 Implementar publisher de eventos revisionados e redigidos em `electron/services/downloads/download-event-publisher.ts`
- [x] T016 Criar composição singleton e ciclo `initialize/reconcile/start/stop` em `electron/services/finalization/runtime.ts` sem ainda registrar workers produtivos
- [x] T017 Adicionar contrato-base de segurança para inputs strict, paths server-side e preload estreito em `tests/contract/opl-finalization-ipc.contract.test.ts`

**Checkpoint**: Tipos, schemas, stores, paths, locks e runtime estão prontos para os slices de usuário.

---

## Phase 3: User Story 1 - Baixar e instalar sem provocar fragmentação (Priority: P1) 🎯 MVP

**Goal**: Finalizar vários jogos no formato compatível, com exatamente um writer por dispositivo e sem declarar fragmentação como sucesso.

**Independent Test**: Enfileirar pelo menos dez imagens para o mesmo dispositivo, incluindo três acima de 4 GiB, e provar formato correto, um writer, hash preservado e contiguidade verificada ou limitação explícita.

### Tests for User Story 1

- [x] T018 [P] [US1] Criar testes da máquina de estados, impedindo `downloaded -> ready` e transições inválidas, em `tests/unit/download-state-machine.test.ts`
- [x] T019 [P] [US1] Criar testes de scheduler, concorrência global, um writer por `deviceId` e paralelismo entre dispositivos em `tests/unit/download-scheduler.test.ts`
- [x] T020 [P] [US1] Criar testes de reservas agregadas, revalidação de espaço e liberação idempotente em `tests/unit/space-reservation.test.ts`
- [x] T021 [P] [US1] Criar fixtures/tests diferenciais para registro de 64 bytes, CRC32, suffix do Game ID, partes `0x3ff00000` e bytes desconhecidos em `tests/unit/usbextreme-compatibility.test.ts`
- [x] T022 [P] [US1] Criar regressão do instalador para candidata/ativo fragmentado, rollback e estado `not-verified` em `tests/integration/game-installation-fragmentation.test.ts`
- [x] T023 [P] [US1] Criar integração Essentials com 20 tarefas, fronteiras FAT32 e timeline de writer em `tests/integration/essentials-finalization.test.ts`
- [x] T024 [P] [US1] Completar testes dos contratos `downloads:enqueue/list/get` e `finalization:get-plan/confirm/cancel` em `tests/contract/opl-finalization-ipc.contract.test.ts`

### Implementation for User Story 1

- [x] T025 [US1] Implementar transições, progresso por fase e cálculo de estado agregado em `electron/services/downloads/download-state-machine.ts`
- [x] T026 [P] [US1] Implementar reservas de cache, staging e destino com contabilização por recurso em `electron/services/downloads/space-reservation.service.ts`
- [x] T027 [US1] Implementar semáforos de rede, fila prioritária e writer exclusivo por dispositivo em `electron/services/downloads/download-scheduler.service.ts`
- [x] T028 [US1] Implementar codec USBExtreme único com CRC32, encode/decode, layout e correlação exata em `electron/services/usbextreme/codec.service.ts`
- [x] T029 [US1] Migrar `decodeUlCfg`, `encodeUlCfg` e `validateUlParts` para o codec compatível, removendo correlação por `includes(gameId)`, em `electron/services/usbextreme/ul-cfg.service.ts`
- [x] T030 [US1] Corrigir seleção FAT32/ISO/ZSO/USBExtreme usando filesystem real, tamanho máximo e perfil em `electron/services/installation/installation-planner.service.ts`
- [x] T031 [US1] Fortalecer staging, hash concatenado, promoção de partes, `ul.cfg` por último, verificação pré/pós-promoção e rollback em `electron/services/installation/game-installation.service.ts`
- [x] T032 [US1] Implementar coordenação `imagem validada -> plano -> instalação -> verificação -> catálogo` em `electron/services/finalization/finalization-coordinator.service.ts`
- [x] T033 [US1] Implementar o coordenador inicial de tarefas, encaminhamento ao scheduler e snapshot da fila em `electron/services/downloads/download-coordinator.service.ts`
- [x] T034 [US1] Registrar handlers strict para enqueue/list/get e finalização confirm/cancel em `electron/ipc/download.ipc.ts` e `electron/ipc/finalization.ipc.ts`
- [x] T035 [US1] Migrar `addCatalogGamesToQueue` para enfileirar no coordenador, preservar recibo legal e remover início imediato de URLs em `electron/services/catalog/essentials-catalog.service.ts`
- [x] T036 [US1] Substituir a promoção por basename e o caminho `finalizeOplFiles` por adapter para a pipeline unificada em `electron/services/downloads/p2p-download.service.ts`

**Checkpoint**: O MVP instala lotes sem writes concorrentes no mesmo dispositivo, respeita FAT32/USBExtreme e não mascara fragmentação.

---

## Phase 4: User Story 2 - Receber nomes canônicos reconhecidos pelo OPL (Priority: P1)

**Goal**: Extrair Game ID autoritativo da mídia e aplicar `GAME_ID.Título.ext` de forma segura a novos downloads/importações.

**Independent Test**: Finalizar ISO/ZSO com nomes arbitrários, IDs divergentes, símbolos e títulos longos; verificar `SYSTEM.CNF`, nome de até 32 bytes e bloqueio de colisões/identidade insuficiente.

### Tests for User Story 2

- [x] T037 [P] [US2] Criar testes ISO9660 para `SYSTEM.CNF` fora dos primeiros 4 MiB, sintaxes de boot e mídia em `tests/unit/iso9660-system-cnf.test.ts`
- [x] T038 [P] [US2] Criar testes de leitura randômica ZSO e identidade interna independente do filename em `tests/unit/zso-game-identity.test.ts`
- [x] T039 [P] [US2] Criar testes de normalização, charset, limite de 32 bytes, extensão e colisões em `tests/unit/opl-canonical-naming.test.ts`
- [x] T040 [P] [US2] Criar integração de divergência entre ID interno, filename e catálogo em `tests/integration/opl-identity-finalization.test.ts`
- [x] T041 [P] [US2] Completar contratos de consulta, override e confirmação de conflito de finalização em `tests/contract/opl-finalization-ipc.contract.test.ts`

### Implementation for User Story 2

- [x] T042 [US2] Evoluir o leitor ISO9660 para localizar diretórios e ler `SYSTEM.CNF` por extent em `electron/services/images/iso9660.service.ts`
- [x] T043 [US2] Expor leitor randômico ZSO compatível com o inspetor ISO9660 em `electron/services/images/zso.service.ts`
- [x] T044 [US2] Implementar agregação de evidências, confiança e conflitos de Game ID em `electron/services/images/game-identity.service.ts`
- [x] T045 [US2] Aplicar política OLD canônica, charset conservador e truncamento de 32 bytes em `electron/services/images/game-naming.service.ts`
- [x] T046 [US2] Integrar identidade autoritativa, nome canônico e collision preflight ao plano em `electron/services/finalization/finalization-coordinator.service.ts`
- [x] T047 [US2] Implementar `finalization:get-plan`, `finalization:set-game-id` e resolução revisionada de colisão em `electron/ipc/finalization.ipc.ts`
- [x] T048 [P] [US2] Criar diálogo acessível de identidade/conflito e confirmação em `src/components/downloads/FinalizationConflictDialog.tsx`
- [x] T049 [US2] Migrar o importador PS2 para a pipeline comum e remover naming divergente em `electron/ipc/file.ipc.ts` e `src/pages/Ps2ImportPage.tsx`

**Checkpoint**: Novos jogos têm ID interno confiável e nome canônico, sem sobrescrita silenciosa.

---

## Phase 5: User Story 3 - Retomar a fila depois de crash ou reinicialização (Priority: P1)

**Goal**: Persistir e retomar transferências/fases no último ponto seguro, isolando falhas e dispositivos ausentes.

**Independent Test**: Encerrar o processo em cada fase, reabrir e provar reaparecimento da fila, reutilização de bytes válidos, rollback de promoção e `waiting-device` para volume ausente.

### Tests for User Story 3

- [x] T050 [P] [US3] Criar testes HTTP para `206`, `200` fallback, ETag alterado, range incoerente, timeout, pause e abort em `tests/unit/http-resume.test.ts`
- [x] T051 [P] [US3] Criar testes de persistência coalescida por 1 segundo/16 MiB, migrations e reconstrução de snapshot em `tests/unit/download-task-store.test.ts`
- [x] T052 [P] [US3] Criar integração HTTP com desconexão/restart e reutilização de 99% dos bytes confirmados em `tests/integration/durable-download-recovery.test.ts`
- [x] T053 [P] [US3] Criar integração torrent com metadata/seleção persistidas e rechecagem de peças após restart em `tests/integration/torrent-download-recovery.test.ts`
- [x] T054 [P] [US3] Criar fault injection por child process nos boundaries de download, commit, USBExtreme e verificação em `tests/integration/pipeline-crash-recovery.test.ts`
- [x] T055 [P] [US3] Completar contratos de pause/resume/cancel/retry/retry-failed e stale revision em `tests/contract/opl-finalization-ipc.contract.test.ts`

### Implementation for User Story 3

- [x] T056 [US3] Implementar store versionado de tarefas, checkpoints coalescidos e migrações em `electron/services/downloads/download-task.store.ts`
- [x] T057 [US3] Implementar probe, `.part`, Range/If-Range, AbortController, timeout, retry e fsync em `electron/services/downloads/http-transfer.service.ts`
- [x] T058 [US3] Implementar persistência de magnet/`.torrent`, infoHash, seleção, rechecagem de peças e teardown em `electron/services/downloads/torrent-transfer.service.ts`
- [x] T059 [US3] Implementar reconciliação de estados ativos, cache parcial, validators remotos e `waiting-device` em `electron/services/downloads/download-recovery.service.ts`
- [x] T060 [US3] Implementar reconciliação de journal de instalação e bloqueio `recovery-pending` em `electron/services/finalization/finalization-recovery.service.ts`
- [x] T061 [US3] Integrar persistência, transfer adapters, retry isolado e recuperação ao coordenador em `electron/services/downloads/download-coordinator.service.ts`
- [x] T062 [US3] Implementar pause/resume/cancel/retry/retry-failed revisionados em `electron/ipc/download.ipc.ts`
- [x] T063 [US3] Ordenar recovery antes do start dos workers e adicionar shutdown coordenado com checkpoint/WebTorrent timeout em `electron/main.ts`
- [x] T064 [US3] Capturar rejeições de callbacks e registrar shutdown seguro/redigido em `electron/services/downloads/download-coordinator.service.ts` e `electron/main.ts`

**Checkpoint**: Crash, restart, falha isolada e remoção não perdem a fila nem promovem estado ambíguo.

---

## Phase 6: User Story 4 - Sincronizar artes em massa após a instalação (Priority: P2)

**Goal**: Sincronizar oito categorias para até 500 jogos por lote com cache compartilhado, streaming, limites e retomada.

**Independent Test**: Executar biblioteca de 500 jogos com ZIP compartilhado, PNG/JPEG, existentes e falhas; provar um download por revisão, memória limitada, resultados por asset e retomada após crash.

### Tests for User Story 4

- [x] T065 [P] [US4] Criar testes de índice por `GAME_ID:TYPE`, TTL, paginação, stale-if-error e revisão em `tests/unit/art-index.test.ts`
- [x] T066 [P] [US4] Criar testes de cache `.part`, single-flight, quota/LRU, ETag e referências ativas em `tests/unit/art-cache.test.ts`
- [x] T067 [P] [US4] Criar testes ZIP para Range/EOCD, CRC, traversal, symlink, tamanho falso e zip-bomb em `tests/unit/art-archive-security.test.ts`
- [x] T068 [P] [US4] Criar testes de oito tipos, políticas de replace, checkpoint, retry e contagens em `tests/unit/art-sync-job.test.ts`
- [x] T069 [P] [US4] Criar integração de 500+ jogos, ZIP único, RSS limitado e restart em `tests/integration/art-batch-sync.test.ts`
- [x] T070 [P] [US4] Completar contratos do índice e jobs de arte, paginação e confirmações em `tests/contract/opl-finalization-ipc.contract.test.ts`

### Implementation for User Story 4

- [x] T071 [P] [US4] Definir provider de manifesto, assets diretos e entries de archive em `electron/services/art/art-source.adapter.ts`
- [x] T072 [US4] Implementar store e índice persistente paginado por Game ID/tipo em `electron/services/art/art-index.store.ts` e `electron/services/art/art-index.service.ts`
- [x] T073 [P] [US4] Implementar leitura EOCD/central directory por Range com fallback a cache em `electron/services/art/art-archive-index.service.ts`
- [x] T074 [US4] Implementar cache streaming, single-flight, validators, quota/LRU e fsync em `electron/services/art/art-cache.service.ts`
- [x] T075 [US4] Implementar extração lazy com `yauzl`, CRC e limites zip-slip/zip-bomb em `electron/services/art/art-archive.service.ts`
- [x] T076 [P] [US4] Implementar validação PNG/JPEG e conversão para PNG fora da thread principal em `electron/services/art/art-image.service.ts`
- [x] T077 [US4] Implementar plano por scope, oito tipos e política de replace em `electron/services/art/art-sync-plan.service.ts`
- [x] T078 [US4] Implementar job/item persistidos, batch 500, concorrência 3, checkpoint e promoção serial por device em `electron/services/art/art-sync-job.service.ts`
- [x] T079 [US4] Implementar reconciliação de cache/staging e retry apenas de pendentes/falhos em `electron/services/art/art-sync-recovery.service.ts`
- [x] T080 [US4] Substituir indexação buffer-based e planos voláteis pelos novos serviços em `electron/services/art/oplm-art.service.ts` e `electron/services/art/art-sync.service.ts`
- [x] T081 [US4] Registrar refresh/query/plan/start/get/list/pause/resume/cancel/retry-failed em `electron/ipc/art.ipc.ts`
- [x] T082 [US4] Enfileirar job `missing-only` após instalação íntegra sem bloquear `ready` em `electron/services/finalization/finalization-coordinator.service.ts`
- [x] T083 [P] [US4] Criar componentes de plano e progresso persistente em `src/components/art/ArtSyncPlanDialog.tsx` e `src/components/art/ArtSyncJobProgress.tsx`
- [x] T084 [US4] Migrar a página para índice paginado, tipos, políticas e jobs retomáveis em `src/pages/ArtManagerPage.tsx`

**Checkpoint**: Artes são sincronizadas sem ZIP integral em memória, download redundante ou perda de progresso.

---

## Phase 7: User Story 5 - Acompanhar um pipeline único e confiável (Priority: P2)

**Goal**: Exibir fase real, snapshot autoritativo, erro acionável e retry seletivo para todo item.

**Independent Test**: Executar lote com sucesso, falha de rede, imagem inválida, conflito, fragmentação e arte ausente; recarregar a janela e reconciliar exatamente um resultado por tarefa.

### Tests for User Story 5

- [x] T085 [P] [US5] Criar testes de projeção da fila por snapshot, gap de eventos e reload em `src/stores/download-store.test.ts`
- [x] T086 [P] [US5] Criar testes acessíveis de fases, progresso, erros e ações em `src/pages/DownloadsPage.test.tsx`
- [x] T087 [P] [US5] Criar integração de 100 tarefas para event rate, responsividade e conciliação de resultados em `tests/integration/pipeline-observability.test.ts`
- [x] T088 [P] [US5] Completar contrato do evento unificado, redaction e reconstrução por list/get em `tests/contract/opl-finalization-ipc.contract.test.ts`

### Implementation for User Story 5

- [x] T089 [US5] Consolidar métodos revisionados e listener `onOplPipelineEvent` no preload em `electron/preload.ts`
- [x] T090 [US5] Atualizar `OplApi`, fallback e wrappers de migração em `src/types/opl.ts` e `src/services/api.ts`
- [x] T091 [US5] Transformar Zustand em projeção de UI por revision/sequence, sem autoridade de fila, em `src/stores/download-store.ts`
- [x] T092 [P] [US5] Criar card acessível com fases, bytes, ação e erro acionável em `src/components/downloads/DownloadPipelineCard.tsx`
- [x] T093 [US5] Migrar a página para React Query list/get, assinatura após snapshot e refetch em gap em `src/pages/DownloadsPage.tsx`
- [x] T094 [US5] Atualizar confirmação em lote e retorno de tarefas persistidas em `src/pages/EssentialsCatalogPage.tsx`
- [x] T095 [US5] Correlacionar histórico/logs por operation ID e redigir URLs/paths internos em `electron/services/history.service.ts` e `electron/services/logger.ts`
- [x] T096 [US5] Implementar relatório reconciliado de lote e exposição de estado de arte independente em `electron/services/downloads/download-coordinator.service.ts`

**Checkpoint**: A UI distingue transferência de instalação, sobrevive a reload e apresenta estado/ação confiáveis.

---

## Phase 8: User Story 6 - Adequar biblioteca existente com segurança (Priority: P3)

**Goal**: Auditar e renomear jogos existentes com prévia, confirmação, journal e recuperação, sem alterar conteúdo ou mesclar duplicatas.

**Independent Test**: Auditar uma biblioteca mista, cancelar sem mudanças, confirmar itens seguros e injetar crash entre renames; verificar hashes/extents preservados e resultado individual.

### Tests for User Story 6

- [x] T097 [P] [US6] Criar testes de classificação `canonical/correctable/collision/missing-id/unsupported` em `tests/unit/naming-audit.test.ts`
- [x] T098 [P] [US6] Criar testes de collision graph, ordem de rename e duplicidade de Game ID em `tests/unit/naming-plan.test.ts`
- [x] T099 [P] [US6] Criar testes de journal, stale fingerprint, rollback idempotente e nomes temporários em `tests/unit/naming-transaction.test.ts`
- [x] T100 [P] [US6] Criar integração de auditoria/rename/crash preservando hash e extents em `tests/integration/opl-naming-migration.test.ts`
- [x] T101 [P] [US6] Completar contratos naming audit/plan/confirm/get-operation e confirmações em `tests/contract/opl-finalization-ipc.contract.test.ts`

### Implementation for User Story 6

- [x] T102 [US6] Implementar inventário somente leitura e classificação por instalação em `electron/services/naming/naming-audit.service.ts`
- [x] T103 [US6] Implementar plano revisionado, collision graph, exclusões e ordem segura em `electron/services/naming/naming-plan.service.ts`
- [x] T104 [US6] Implementar journal por item, intents/outcomes, rename e verificação de hash/extents em `electron/services/naming/naming-transaction.service.ts`
- [x] T105 [US6] Implementar recovery que restaura ou conclui somente estado provado em `electron/services/naming/naming-recovery.service.ts`
- [x] T106 [US6] Registrar `naming:audit/plan/confirm/get-operation` com paths resolvidos server-side em `electron/ipc/naming.ipc.ts`
- [x] T107 [P] [US6] Criar tabela acessível de classificação, filtros e seleção em `src/components/naming/NamingAuditTable.tsx`
- [x] T108 [P] [US6] Criar diálogo de plano, conflitos, exclusões e literal de confirmação em `src/components/naming/NamingPlanDialog.tsx`
- [x] T109 [US6] Criar página de adequação e integrar navegação em `src/pages/OplNamingPage.tsx`, `src/app/App.tsx` e `src/components/Sidebar.tsx`

**Checkpoint**: Bibliotecas legadas podem ser adequadas sem download novamente e com recuperação segura.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Remover caminhos legados, reforçar segurança/desempenho e produzir evidência final multiplataforma.

- [x] T110 [P] Adicionar regressões de traversal, symlink, URL não permitida, secrets em eventos e confirmações legais em `tests/integration/security-regressions.test.ts`
- [x] T111 [P] Adicionar benchmark instrumentado de heap/RSS, event rate e throughput para 100 downloads/500 jogos em `tests/integration/opl-pipeline-performance.test.ts`
- [x] T112 Inventariar staging legado `_OPL_FORGE_STAGING` sem remoção automática e oferecer importação/limpeza confirmada em `electron/services/downloads/legacy-staging.service.ts`
- [x] T113 Remover `tasks` Map autoritativo, `finalizeOplFiles`, cache de arte somente em memória e IPCs posicionais após migração em `electron/services/downloads/p2p-download.service.ts`, `electron/services/art/oplm-art.service.ts` e `electron/ipc/download.ipc.ts`
- [x] T114 Revisar licença, advisories, limites e empacotamento de `yauzl` e registrar resultado em `docs/opl-finalization-security.md`
- [x] T115 [P] Documentar operação, cache, retomada, nomes, artes e limitações de plataforma em `README.md` e `docs/opl-finalization.md`
- [x] T116 Executar todos os cenários automatizados de `specs/003-harden-opl-finalization/quickstart.md` e registrar comandos/resultados em `specs/003-harden-opl-finalization/validation-results.md`
- [x] T117 Certificar FAT32/exFAT/NTFS descartáveis e fragmentação nas plataformas disponíveis, registrando matriz e evidências em `docs/opl-finalization-platform-matrix.md`
- [x] T118 Executar `pnpm build`, `pnpm lint`, `pnpm test:run` e a build Electron produtiva do SO atual, corrigindo regressões e anexando resumo em `specs/003-harden-opl-finalization/validation-results.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependências; T003 e T004 podem ocorrer em paralelo depois da criação do workspace atual.
- **Foundational (Phase 2)**: Depende de Setup e bloqueia todas as histórias.
- **US1 (Phase 3)**: Depende de Foundational; é o MVP e estabelece scheduler/instalação.
- **US2 (Phase 4)**: Depende de Foundational e integra-se ao coordenador de US1; parser/naming podem iniciar em paralelo com parte de US1, mas T046/T049 aguardam T032.
- **US3 (Phase 5)**: Depende do coordenador e scheduler de US1; testes HTTP/store podem iniciar após Foundational.
- **US4 (Phase 6)**: Índice/cache podem iniciar após Foundational; auto-enqueue T082 depende da finalização US1/US2.
- **US5 (Phase 7)**: Depende dos snapshots/eventos de US1/US3 e dos contratos de arte de US4 para representar o pipeline completo.
- **US6 (Phase 8)**: Depende dos serviços de identidade/nome de US2; não depende da fila ou artes para auditoria/rename.
- **Polish (Phase 9)**: Depende das histórias incluídas no release; remoção legada T113 só ocorre após migração de US5.

### User Story Dependency Graph

```text
Setup -> Foundation -> US1 (MVP: instalação segura)
                    ├-> US2 (identidade/nome) -> US6 (biblioteca existente)
                    └-> US3 (durabilidade/recovery)

Foundation --------> US4 (artes em massa)

US1 + US2 + US3 + US4 -> US5 (pipeline completo na UI)
US1 + US2 + US3 + US4 + US5 + US6 -> Polish
```

### Within Each User Story

- Escrever os testes da história e confirmar falha pelo comportamento ausente.
- Implementar entidades/regras puras antes de I/O e serviços.
- Implementar serviços antes de IPC/preload/UI.
- Validar o checkpoint independente da história antes de avançar.
- Não marcar tarefa de teste como concluída apenas porque compila; o comportamento-alvo deve passar.

### Parallel Opportunities

- Setup: T003 e T004 em paralelo.
- Foundation: testes T008/T010/T012/T014 em arquivos distintos; implementação segue suas dependências.
- US1: T018–T024 em paralelo; T026 pode avançar enquanto T025 é implementada; codec T028 pode avançar antes do planner.
- US2: T037–T041 em paralelo; parser ISO, ZSO e componente de conflito alteram arquivos distintos.
- US3: T050–T055 em paralelo; adapters HTTP/torrent podem ser implementados paralelamente após store.
- US4: T065–T070 em paralelo; provider, archive index e image service podem avançar em paralelo.
- US5: T085–T088 e o componente T092 são paralelizáveis.
- US6: T097–T101 e componentes T107/T108 são paralelizáveis.
- Polish: segurança, performance e documentação podem avançar em paralelo antes da validação final.

---

## Parallel Examples by User Story

### User Story 1

```text
Task T018: state machine tests
Task T019: scheduler tests
Task T021: USBExtreme compatibility tests
Task T022: fragmentation rollback integration
```

### User Story 2

```text
Task T037: ISO9660/SYSTEM.CNF tests
Task T038: ZSO identity tests
Task T039: canonical naming tests
Task T048: conflict dialog
```

### User Story 3

```text
Task T050: HTTP resume tests
Task T053: torrent recovery integration
Task T054: crash fault injection
```

### User Story 4

```text
Task T065: art index tests
Task T066: art cache tests
Task T067: archive security tests
Task T076: image validation/conversion
```

### User Story 5

```text
Task T085: snapshot/reload store tests
Task T086: accessible page tests
Task T087: observability load integration
Task T092: pipeline card
```

### User Story 6

```text
Task T097: audit classification tests
Task T098: naming plan tests
Task T099: transaction/recovery tests
Task T107: audit table
Task T108: plan dialog
```

---

## Implementation Strategy

### MVP First: User Story 1

1. Concluir Setup e Foundation.
2. Escrever e executar T018–T024, observando falhas esperadas.
3. Implementar T025–T036.
4. Executar o checkpoint de US1 em FAT32 e filesystem de arquivo único.
5. Demonstrar que dez downloads não geram writers simultâneos nem falso `ready`.

O MVP resolve a causa de maior risco imediatamente. US2 deve seguir antes de considerar o pipeline adequado para distribuição ampla, pois garante reconhecimento e associação por Game ID.

### Incremental Delivery

1. **MVP**: US1 — instalação serializada, FAT32/USBExtreme e verificação.
2. **Compatibilidade**: US2 — identidade interna e nome canônico.
3. **Resiliência**: US3 — restart, HTTP/torrent e shutdown.
4. **Experiência OPL**: US4 — artes em massa persistentes.
5. **Transparência**: US5 — pipeline completo e reload da UI.
6. **Migração**: US6 — biblioteca existente.
7. **Release gate**: Polish, certificação e remoção legada.

### Safe Stopping Points

- Após Foundation: infraestrutura pronta, sem mudança de fluxo produtivo.
- Após US1: defeito de fragmentação prevenido no Essentials, com UI ainda parcialmente legada.
- Após US1+US2+US3: downloads confiáveis, nomeados e retomáveis — candidato mínimo para beta.
- Após US4+US5: experiência integrada completa.
- Após US6+Polish: release amplo e migração de acervos legados.

---

## Notes

- `[P]` significa apenas ausência de conflito/dependência direta nos arquivos indicados; coordene alterações no mesmo contrato compartilhado.
- Cada confirmação sensível deve ser testada com literal incorreto, revisão stale e replay.
- Fixtures de mídia e arte devem ser sintéticas ou legalmente autorizadas.
- Não incorporar binários, endpoints proprietários ou credenciais do OPL Manager.
- Commits devem corresponder a uma tarefa ou grupo lógico pequeno, mantendo build e testes afetados verdes.
- Uma combinação OS/filesystem sem prova de extents termina `not-verified`, nunca `contiguous` por inferência.
