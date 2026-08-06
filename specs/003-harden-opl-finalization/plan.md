# Implementation Plan: Finalização OPL confiável e resiliente

**Branch**: `003-harden-opl-finalization` | **Date**: 2026-08-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-harden-opl-finalization/spec.md`

## Summary

Unificar Essentials, Download Manager e importação PS2 em uma pipeline durável que separa transferência de instalação, limita concorrência, mantém um writer por dispositivo e só declara um jogo pronto depois de validar identidade/estrutura, instalar no formato compatível, comprovar integridade e avaliar fragmentação. A pipeline persiste fila e checkpoints em JSON atômico, retoma HTTP/torrent, usa cache local para impedir gravações concorrentes no USB, corrige o codec USBExtreme para a convenção CRC32 do OPL, extrai Game ID de `SYSTEM.CNF`, aplica `GAME_ID.Título.ext`, oferece adequação transacional da biblioteca existente e inicia um job de artes em massa persistente, streaming e reutilizável.

O desenho reaproveita os serviços de instalação, catálogo, safe paths, locks e reparo de fragmentação já existentes, mas remove a finalização ad hoc do downloader. A semântica de nomes, USBExtreme e oito tipos de arte vem do OPL Manager V24; suas escolhas WinForms, SOAP, byte arrays integrais e `async void` não são transportadas.

## Technical Context

**Language/Version**: TypeScript 6 strict, ECMAScript 2022, Node.js 22

**Primary Dependencies**: Electron 42, React 19, React Router, TanStack React Query, Zustand apenas para projeção de UI, Zod 4 para contratos IPC, WebTorrent 3, APIs `node:fs`/`node:stream`/`node:crypto`/Fetch; `yauzl` como nova dependência auditada para ZIP lazy/streaming; adaptadores de fragmentação e serviços OPL existentes

**Storage**: JSON versionado, revisionado e escrito atomicamente em `app.getPath('userData')` para fila, índice, jobs, planos e checkpoints; cache local em disco para payloads e archives; staging/candidatas/backups transacionais no filesystem do dispositivo; árvore OPL final em `CD`, `DVD`, `ART` e raiz USBExtreme

**Testing**: Vitest 4 com unitários, contratos e integração; Testing Library para renderer; servidores HTTP/torrent locais, fixtures ISO/ZSO/USBExtreme/ZIP, fake clock/fs/device/adapters, child process e fault injection; certificação em volumes descartáveis reais

**Target Platform**: Aplicação desktop Electron para Windows x64/arm64, Linux AppImage/DEB e macOS Intel/Apple Silicon; contiguidade só é afirmada em combinações OS/filesystem homologadas pela feature 002

**Project Type**: Aplicação desktop Electron com renderer React sandboxed, preload tipado e serviços privilegiados no processo principal

**Performance Goals**: Confirmação de enfileiramento em até 2 segundos; até 500 jogos por lote/página; concorrência de rede padrão 2 e de arte 3; exatamente um writer por dispositivo; eventos no máximo 4 Hz por operação; interface sem bloqueio superior a 2 segundos; pico inferior a 512 MiB sobre baseline em lote de artes; memória O(buffer), não O(payload/archive)

**Constraints**: Node 22; renderer sem Node; confirmação legal por item; paths remotos não confiáveis e confinados; nenhuma sobrescrita/limpeza sensível sem plano e confirmação; FAT32 usa limite real e USBExtreme para imagem incompatível; nome canônico com título conservador de 32 bytes; CRC32 e registro USBExtreme compatíveis; hash/estrutura obrigatórios; nenhuma promoção de candidata comprovadamente fragmentada; rollback idempotente; snapshots são autoridade após restart; sem banco nativo; sem bytes integrais de imagem/ZIP em memória

**Scale/Scope**: Uma fila global com até 500 tarefas visíveis por consulta e múltiplos dispositivos, uma operação de escrita por dispositivo, bibliotecas de ao menos 500 jogos, oito tipos de arte, ISO/ZSO/USBExtreme; sem formatação, reparticionamento, CFG/cheats/VMC ou fontes não autorizadas

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design._

| Gate constitucional                        | Decisão de conformidade                                                                                                                                        | Status pré/pós-design |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Segurança em operações sensíveis           | Confirmação legal continua por item; colisão, replace, rename e descarte mostram plano/alvo e exigem literal apropriado                                        | PASS / PASS           |
| Isolamento e menor privilégio              | Rede, WebTorrent, ZIP, cache, dispositivo e filesystem ficam no main; preload expõe métodos estreitos; renderer usa IDs opacos                                 | PASS / PASS           |
| Contratos tipados e limites                | Tipos compartilhados e Zod strict; `src/services/api.ts` é único acesso; snapshots externos ficam em React Query e Zustand só projeta UI                       | PASS / PASS           |
| Integridade, rastreabilidade e recuperação | Cache parcial, checkpoints, journals, fsync, candidata, verificação, backup e rollback preservam última versão válida; eventos e histórico são correlacionados | PASS / PASS           |
| Evolução incremental verificada            | Migração em slices, testes de regressão da causa, IPC, Range, codec, crash, ZIP e volumes reais; build/lint/test obrigatórios                                  | PASS / PASS           |
| Estrutura e paths OPL                      | Paths são resolvidos server-side por SafeRoot; `CD`, `DVD`, `ART`, `ul.cfg` e partes seguem convenções compatíveis                                             | PASS / PASS           |
| Staging constitucional                     | Transferência usa cache local durável; antes da promoção, candidata fica em staging do dispositivo e somente bytes validados chegam à árvore ativa             | PASS / PASS           |
| Compatibilidade de distribuição            | APIs portáveis; nova biblioteca ZIP é JavaScript; extents mantêm matriz conservadora por plataforma                                                            | PASS / PASS           |
| Nova dependência                           | `yauzl` substitui parser manual inseguro/buffer integral; versão, licença, advisories e lockfile serão revisados; testes cobrem limites e ZIP hostil           | PASS / PASS           |

Não há violação constitucional ou clarificação pendente. O uso de cache local mais staging do dispositivo reforça, e não reduz, a exigência de staging antes da promoção.

## Phase 0: Research Decisions

As decisões e alternativas estão consolidadas em [research.md](./research.md). Todos os pontos técnicos foram resolvidos antes do design:

- causa da fragmentação por streams concorrentes e rename que preserva extents;
- persistência JSON e reconciliação sem dependência nativa;
- scheduler, reservas de espaço, locks e identidade física do volume;
- protocolo de retomada HTTP Range/If-Range e recuperação de torrents;
- unificação da finalização com o instalador transacional;
- fronteira FAT32, split e naming USBExtreme por CRC32;
- leitura ISO9660/ZSO de `SYSTEM.CNF` e política canônica de 32 bytes;
- verificação pré/pós-promoção e rollback de fragmentação persistente;
- índice de arte persistente, Range/fallback e cache single-flight;
- extração ZIP lazy/streaming, limites e saída PNG;
- jobs de arte duráveis em lotes de até 500;
- shutdown, eventos, erros e portabilidade.

## Phase 1: Design

### Domain boundaries and ownership

O [data-model.md](./data-model.md) define tarefa durável, checkpoint, reserva, imagem validada, identidade, plano, layout USBExtreme, journal, auditoria de nomes, índice/cache e job de artes. Os domínios ficam separados, mas vinculados por IDs:

1. `downloads` possui origem, transferência, cache parcial, scheduler e lifecycle da tarefa.
2. `finalization` possui inspeção, plano, instalação, verificação, catálogo e gatilho de arte.
3. `images` possui leitura ISO9660/ZSO, Game ID e nome canônico.
4. `usbextreme` possui o único codec de registro, CRC32, nomes e correlação das partes.
5. `art` possui provider/index/cache/extraction/job e promoção de imagens.
6. `fragmentation-repair` continua autoridade de capacidade, evidência e reparo; finalização consome seus contratos, não duplica adaptadores.
7. `persistence` possui JSON atômico, safe roots, locks por device identity e migrations.

### Durable download coordinator

- `download-coordinator.service.ts`: runtime singleton; restaura snapshots antes de liberar workers, agenda rede e encaminha tarefas baixadas para finalização.
- `download-task.store.ts`: esquema versionado, fila de escrita e migrations; persiste transições e checkpoints coalescidos.
- `download-state-machine.ts`: valida transições e separa `downloaded` de `ready`.
- `download-scheduler.service.ts`: semáforos globais, writer por `deviceId`, prioridade, retry e contrapressão.
- `space-reservation.service.ts`: soma reservas locais/do dispositivo e revalida em boundaries.
- `http-transfer.service.ts`: probe, `.part`, AbortController, Range/If-Range, timeout, backoff, fsync e identidade remota.
- `torrent-transfer.service.ts`: metadata persistível, seleção, rechecagem de peças e ciclo de vida WebTorrent.
- `download-recovery.service.ts`: reconcilia estados ativos, partial size, source identity, cache e dispositivo.
- `download-event-publisher.ts`: eventos revisionados/coalescidos e redigidos.

O `p2p-download.service.ts` atual torna-se adapter temporário ou é removido após migração. Nenhum fluxo novo chama `finalizeOplFiles`.

### OPL inspection, naming and USBExtreme

- `iso9660.service.ts`: evolui de scan bruto para leitor de diretório/arquivo `SYSTEM.CNF`; expõe leitura randômica comum a ISO e ZSO.
- `game-identity.service.ts`: agrega evidências, aplica confiança e registra conflitos.
- `game-naming.service.ts`: política OLD padrão, charset conservador e máximo de 32 bytes; nome novo permanece somente compatibilidade de leitura.
- `usbextreme/codec.service.ts`: concentra encode/decode, CRC32 sobre bytes do título final, part layout e preservação dos 15 bytes.
- `usbextreme/ul-cfg.service.ts`: deixa de correlacionar por `includes(gameId)` e usa stem derivado/validado.
- `naming-audit.service.ts`, `naming-plan.service.ts` e `naming-transaction.service.ts`: diagnóstico somente leitura, prévia, collision graph, journal, rename e recovery.

Fixtures diferenciais serão derivadas dos comportamentos observados do OPL Manager e validadas contra registros/partes reais autorizados; nenhum binário do OPL Manager é embarcado.

### Transactional finalization

- `finalization-coordinator.service.ts`: consome imagem baixada/importada e coordena inspeção → plano → instalação → verificação → catálogo → arte.
- `installation-planner.service.ts`: recebe filesystem real e `deviceId`, não presume FAT quando desconhecido; calcula cache, candidata, backup e margem.
- `game-installation.service.ts`: usa codec USBExtreme único, candidate verification antes do commit, active verification depois e rollback obrigatório em `STILL_FRAGMENTED`.
- `device-lock.service.ts`: chaveia por identidade física normalizada; o scheduler persiste ownership lógico e o lock em processo protege execução.
- `finalization-recovery.service.ts`: reconcilia download, journal de instalação, catálogo e resultado, sem promover automaticamente estado ambíguo.

A feature 002 é integrada por interfaces de capacidade/inspect/repair action. Finalização não inicia reparo destrutivo sem novo plano/confirmação.

### Art index, cache and jobs

- `art-source.adapter.ts`: abstrai manifesto, metadata, direct asset e archive entry.
- `art-index.store.ts` / `art-index.service.ts`: índice persistente por `GAME_ID:TYPE`, revisões, TTL, paginação e stale-if-error.
- `art-archive-index.service.ts`: EOCD/central directory por Range quando possível; fallback para cache único em disco.
- `art-cache.service.ts`: `.part`, validators, quota/LRU, referências e single-flight por cache key.
- `art-archive.service.ts`: `yauzl` lazyEntries, stream por entry, CRC e limites de zip-slip/zip-bomb.
- `art-image.service.ts`: valida PNG/JPEG, converte JPEG fora da thread principal e produz PNG canônico.
- `art-sync-plan.service.ts`: scope, oito tipos, política de replace, snapshot e ações/exclusões.
- `art-sync-job.service.ts`: job/item persistidos, consulta em blocos de até 500, concorrência de download 3, promoção serial por device, checkpoint/retry/cancel/recovery.
- `art-sync-recovery.service.ts`: preserva instalados, revalida staging/cache e reencoloca apenas pendentes.

O `oplm-art.service.ts` deixa de usar cache em memória e `arrayBuffer()` de ZIP; `art-sync.service.ts` deixa de manter planos somente em `Map` e de remover staging recuperável incondicionalmente.

### Interface contract

O contrato está em [contracts/opl-finalization-ipc.md](./contracts/opl-finalization-ipc.md). Ele substitui chamadas posicionais por objetos revisionados e contempla:

- enqueue/list/get/pause/resume/cancel/retry da fila;
- consulta/confirmação/override/cancelamento de finalização;
- auditoria, plano e execução de nomes;
- refresh/query paginado do índice de artes;
- plano/start/get/list/pause/resume/cancel/retry de jobs de artes;
- um evento `opl-pipeline:event` sequenciado e limitado.

Durante migração, APIs antigas permanecem wrappers internos curtos. UI e novos testes usam apenas os contratos novos. Todos os handlers passam por `parseInput` e resolvem paths server-side.

### Renderer and UX

- `DownloadsPage` projeta snapshots persistidos, agrupa fases e oferece pause/resume/cancel/retry coerentes.
- `DownloadPipelineCard` diferencia transferência, validação, instalação, verificação e arte.
- `FinalizationConflictDialog` apresenta ID conflitante, nome, destino, integridade e confirmação.
- `OplNamingPage` ou seção dedicada oferece auditoria, filtros, prévia e confirmação em lote.
- `ArtManagerPage` passa a operar jobs persistidos, tipos/políticas e resumo por estado.
- React Query mantém snapshots do main; Zustand pode guardar seleção/filtro, nunca a fila autoritativa.
- Reload consulta list/get e só depois assina eventos; gap de sequência dispara refetch.

### Startup and shutdown

Ordem de startup:

1. criar stores e runtimes;
2. reconciliar journals de instalação/naming/art;
3. reconciliar cache e tarefas ativas;
4. registrar IPC e criar janela;
5. liberar schedulers.

No `before-quit`, schedulers recusam novo trabalho, abortam/pausam transfers, sincronizam checkpoints e encerram WebTorrent dentro de timeout. Promessas de callbacks são sempre capturadas. `unhandledRejection`/`uncaughtException` registram erro redigido e iniciam saída controlada; não são usados para mascarar estado inválido.

### Migration strategy

1. Introduzir tipos, schemas, stores, state machine e coordinator atrás de wrappers, sem mudar UI.
2. Implementar transferência HTTP retomável e migrar Essentials para `enqueue` sem promoção automática antiga.
3. Corrigir identity/naming/USBExtreme e fortalecer instalação; migrar importador e finalização.
4. Adicionar auditoria de nomes existentes e integração com fragmentação.
5. Substituir índice/cache de arte e depois jobs persistentes/automáticos.
6. Migrar renderer para snapshots/evento unificado.
7. Remover Map de tarefas, `finalizeOplFiles`, cache de artes em memória e IPCs antigos após testes de compatibilidade.

Cada slice mantém build e testes verdes. Migração de dados aceita ausência de fila antiga porque ela nunca foi persistida; staging legado é inventariado e apresentado para recuperação/importação, não removido silenciosamente.

### Validation design

O [quickstart.md](./quickstart.md) define comandos e cenários end-to-end. A cobertura exige:

- unitários para máquina de estados, scheduler, reservas, Range, migrations, naming, CRC32/codec, parser/identidade, cache e jobs;
- contratos para Zod strict, revisões, confirmações, paginação, preload e eventos;
- integração com servidor HTTP/torrent, restart por child process, FAT32, USBExtreme, fragmentação persistente e artifacts stale;
- segurança para traversal, symlink, URL, ZIP bomb, CRC, tamanho real e redaction;
- UI para reload, fases, conflito, retry seletivo e acessibilidade;
- carga de 100 downloads e artes de 500 jogos com timeline, heap/RSS e eventos;
- certificação Windows/Linux/macOS em volumes descartáveis.

## Project Structure

### Documentation (this feature)

```text
specs/003-harden-opl-finalization/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── opl-finalization-ipc.md
└── tasks.md
```

### Source Code (repository root)

```text
electron/
├── ipc/
│   ├── download.ipc.ts
│   ├── finalization.ipc.ts
│   ├── naming.ipc.ts
│   ├── art.ipc.ts
│   └── schemas.ts
├── services/
│   ├── downloads/
│   │   ├── download-coordinator.service.ts
│   │   ├── download-event-publisher.ts
│   │   ├── download-recovery.service.ts
│   │   ├── download-scheduler.service.ts
│   │   ├── download-state-machine.ts
│   │   ├── download-task.store.ts
│   │   ├── http-transfer.service.ts
│   │   ├── space-reservation.service.ts
│   │   └── torrent-transfer.service.ts
│   ├── finalization/
│   │   ├── finalization-coordinator.service.ts
│   │   └── finalization-recovery.service.ts
│   ├── installation/
│   │   ├── game-installation.service.ts
│   │   └── installation-planner.service.ts
│   ├── images/
│   │   ├── game-identity.service.ts
│   │   ├── game-naming.service.ts
│   │   ├── iso9660.service.ts
│   │   └── zso.service.ts
│   ├── naming/
│   │   ├── naming-audit.service.ts
│   │   ├── naming-plan.service.ts
│   │   ├── naming-transaction.service.ts
│   │   └── naming-recovery.service.ts
│   ├── usbextreme/
│   │   ├── codec.service.ts
│   │   └── ul-cfg.service.ts
│   ├── art/
│   │   ├── art-archive-index.service.ts
│   │   ├── art-archive.service.ts
│   │   ├── art-cache.service.ts
│   │   ├── art-image.service.ts
│   │   ├── art-index.service.ts
│   │   ├── art-index.store.ts
│   │   ├── art-source.adapter.ts
│   │   ├── art-sync-job.service.ts
│   │   ├── art-sync-plan.service.ts
│   │   └── art-sync-recovery.service.ts
│   ├── fragmentation/
│   ├── fragmentation-repair/
│   ├── catalog/
│   └── persistence/
│       ├── device-lock.service.ts
│       ├── json-store.service.ts
│       └── safe-path.service.ts
├── main.ts
└── preload.ts

src/
├── components/
│   ├── downloads/
│   │   ├── DownloadPipelineCard.tsx
│   │   └── FinalizationConflictDialog.tsx
│   ├── naming/
│   │   ├── NamingAuditTable.tsx
│   │   └── NamingPlanDialog.tsx
│   └── art/
│       ├── ArtSyncJobProgress.tsx
│       └── ArtSyncPlanDialog.tsx
├── pages/
│   ├── DownloadsPage.tsx
│   ├── EssentialsCatalogPage.tsx
│   ├── OplNamingPage.tsx
│   └── ArtManagerPage.tsx
├── services/api.ts
├── stores/download-store.ts
└── types/opl.ts

tests/
├── contract/
│   └── opl-finalization-ipc.contract.test.ts
├── integration/
│   ├── art-batch-sync.test.ts
│   ├── durable-download-recovery.test.ts
│   ├── essentials-finalization.test.ts
│   ├── opl-naming-migration.test.ts
│   └── pipeline-crash-recovery.test.ts
├── unit/
│   ├── art-cache.test.ts
│   ├── art-index.test.ts
│   ├── art-sync-job.test.ts
│   ├── download-scheduler.test.ts
│   ├── download-state-machine.test.ts
│   ├── http-resume.test.ts
│   ├── opl-canonical-naming.test.ts
│   └── usbextreme-compatibility.test.ts
└── fixtures/
    ├── art/
    ├── http/
    ├── images/
    └── usbextreme/
```

**Structure Decision**: Manter o monorepo/aplicação Electron existente e adicionar bounded contexts pequenos no processo principal. Não criar backend, banco ou processo de aplicação separado. Reutilizar contratos, parsers e transações existentes mediante interfaces explícitas e migrations, evitando novo monólito equivalente ao OPL Manager.

## Complexity Tracking

Nenhuma violação constitucional requer exceção. As duas complexidades materiais são justificadas e permanecem dentro da arquitetura existente:

| Decisão                                           | Por que é necessária                                                                         | Alternativa mais simples rejeitada porque                                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Cache local + staging transacional no dispositivo | Permite retomada, impede streams concorrentes no USB e suporta fonte bruta >4 GiB para FAT32 | Staging apenas no USB não comporta arquivo bruto >4 GiB e preserva risco de interleaving                        |
| Dependência ZIP lazy/streaming (`yauzl`)          | Evita ZIP integral em memória e delega parsing complexo/CRC a biblioteca auditável           | Parser manual atual é buffer-based e estendê-lo para ZIP64/data descriptors/segurança amplia risco e manutenção |
