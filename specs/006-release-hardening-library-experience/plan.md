# Implementation Plan: Release Hardening, OPL Connectivity and Library Experience

**Branch**: `006-release-hardening-library-experience` | **Date**: 2026-08-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/006-release-hardening-library-experience/spec.md`

## Summary

Endurecer a distribuição e os fluxos cotidianos do OPL Forge sem redesenhar o produto: criar identidade/versionamento/release/updater determinísticos; corrigir o servidor SMB1 conforme o cliente real do OPL e validar em hardware; integrar artes locais de forma segura e separar completude visual de prontidão; ramificar a fila durável entre instalação OPL e destino local; e tornar importações locais duráveis, canceláveis quando seguro e observáveis no Activity Drawer.

A execução permanece incremental sobre os serviços atuais. Decisões centrais da pesquisa: manifesto com versão pública `1.A.B.C` mapeada reversivelmente para SemVer interno; NSIS como único `.exe`; `electron-updater` no main process; perfil SMB share-level autenticado no tree connect, com `OPEN_ANDX` e offsets de 64 bits; índice de `ART/` por scan e protocolo `opl-art:`; download target discriminado; e `ImportJob` próprio consumido pelo contrato comum de operações.

## Technical Context

**Language/Version**: TypeScript 6.0, Node.js 22, Electron 42, React 19

**Primary Dependencies**: Electron/electron-builder 26, electron-updater 6, React Query, Zustand, Zod 4, Node networking/filesystem/crypto primitives, existing custom SMB1 and durable pipeline services

**Storage**: Versioned JSON stores under Electron `userData` with atomic writes; staging on destination filesystem; release manifest committed to repository; device content under OPL directories

**Testing**: Vitest unit/contract/integration suites, TypeScript checks, ESLint, Vite/tsup build, platform packaging/resource/signature inspection, clean-install/update VM scenarios and mandatory physical PS2 smoke

**Target Platform**: Windows x64 NSIS; macOS x64/arm64 DMG; Linux AppImage/DEB; PS2 physical client running pinned Open PS2 Loader over SMB1

**Project Type**: Sandboxed cross-platform desktop application with privileged Electron main process and React renderer

**Performance Goals**: Library remains interactive at ~500 games without >2 s UI freeze; import feedback at least every 1 s/16 MiB; bounded SMB frames/list pages; downloads/imports stream rather than buffer whole images

**Constraints**: `contextIsolation=true`, `nodeIntegration=false`, `sandbox=true`; no renderer paths/feed URLs; legal confirmation retained; no partial promotion; one device writer; no credential/auth payload logging; explicit update install/restart; OPL hardware evidence required

**Scale/Scope**: Eight integrated problems, 67 requirements, 15 success criteria; existing desktop repository and workflows; libraries around 500 games; ISO/DVD9 reads beyond 4 GiB; batches of at least seven imports and 100 persisted downloads remain supported

## Constitution Check

_Gate before Phase 0: PASS. Re-evaluated after Phase 1: PASS._

| Principle/gate                            | Design response                                                                                                                                                                                                      | Result |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| I. Sensitive operations and legal posture | Existing per-item legal receipt remains for both download targets. Local collision defaults never overwrite. Update install/restart and discard/collision actions require explicit consent.                          | PASS   |
| II. Isolation and least privilege         | Updater, SMB, art protocol, paths and copy operations stay in main process. IPC exposes identifiers/commands, never arbitrary path, feed or Node capability.                                                         | PASS   |
| III. Typed contracts/layers               | Shared discriminated targets, update/import/art models and strict schemas flow through `src/services/api.ts`, preload, IPC and services. React Query owns external snapshots; Activity UI consumes summaries/events. | PASS   |
| IV. Integrity/recovery/observability      | Local download/import use destination staging, checkpoints, journal, validation and atomic promotion. Update/import/download/SMB emit sanitized correlated state.                                                    | PASS   |
| V. Incremental verified evolution         | Existing services are extended by bounded adapters/entities. Reproducible bugs receive regression tests; hardware, signing and installed update receive explicit manual gates.                                       | PASS   |
| Platform/build constraint                 | Matrix retains Windows, macOS and Linux targets; signature limitations block public approval rather than being hidden.                                                                                               | PASS   |
| OPL/storage compatibility                 | OPL directory contract is unchanged; ART is read-only during local indexing; device installation pipeline remains canonical.                                                                                         | PASS   |

No constitutional exception or complexity waiver is required. New persisted schemas require versioned migration tests. Production signing credentials remain CI secrets.

## Project Structure

### Documentation (this feature)

```text
specs/006-release-hardening-library-experience/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── ipc.md
│   ├── release.md
│   └── smb-compatibility.md
└── tasks.md                 # generated later by speckit-tasks
```

### Source Code (repository root)

```text
build/
├── icon.png
├── icon.ico
└── platform identity assets/generation inputs

.github/workflows/
├── ci.yml
└── release.yml

scripts/
├── release identity validator/generator
└── artifact inventory/signature checks

electron/
├── main.ts
├── preload.ts
├── ipc/
│   ├── schemas.ts
│   ├── update.ipc.ts
│   ├── import.ipc.ts
│   ├── download.ipc.ts
│   ├── catalog.ipc.ts
│   └── network-share.ipc.ts
└── services/
    ├── updates/
    │   ├── update.service.ts
    │   ├── update-policy.store.ts
    │   └── update-event.publisher.ts
    ├── network-share/smb/
    │   ├── command-handlers.ts
    │   ├── protocol-constants.ts
    │   ├── frame-codec.ts
    │   └── smb-server.ts
    ├── catalog/
    │   ├── catalog-scanner.service.ts
    │   └── local-art-index.service.ts
    ├── art/
    │   └── local-art-protocol.service.ts
    ├── downloads/
    │   ├── download-coordinator.service.ts
    │   ├── download-state-machine.ts
    │   ├── download-task.store.ts
    │   └── local-destination.service.ts
    └── imports/
        ├── import-job.service.ts
        ├── import-job.store.ts
        ├── import-state-machine.ts
        ├── import-journal.service.ts
        └── import-event.publisher.ts

src/
├── types/
│   ├── opl.ts
│   └── opl-finalization.ts
├── services/api.ts
├── pages/
│   ├── SettingsPage.tsx
│   ├── GameLibraryPage.tsx
│   ├── EssentialsCatalogPage.tsx
│   ├── DownloadsPage.tsx
│   └── Ps2ImportPage.tsx
├── components/
│   ├── activity/
│   ├── catalog/
│   ├── downloads/
│   ├── library/
│   └── updates/
└── stores/
    └── UI-only reactive state

tests/
├── unit/
│   ├── release-version.test.ts
│   ├── update-state.test.ts
│   ├── local-art-index.test.ts
│   ├── local-destination.test.ts
│   └── import-state-machine.test.ts
├── contract/
│   ├── update-ipc.contract.test.ts
│   ├── import-ipc.contract.test.ts
│   └── catalog-ipc.contract.test.ts
├── integration/
│   ├── update-flow.test.ts
│   ├── smb-opl-handshake.test.ts
│   ├── local-art-library.test.ts
│   ├── local-download-recovery.test.ts
│   └── import-progress-recovery.test.ts
└── fixtures/
    ├── art/
    ├── catalog/
    ├── smb/
    └── release/
```

**Structure Decision**: Manter o projeto desktop único e seus limites atuais. Serviços novos são agrupados por domínio no main process; os contratos continuam nos módulos compartilhados existentes; a UI evolui páginas/componentes atuais; scripts e workflows cuidam da distribuição. Nenhum backend, daemon ou projeto adicional é introduzido.

## Phase 0: Research Decisions

Pesquisa consolidada em [research.md](research.md). Todos os desconhecidos da specification foram resolvidos sem pendências de esclarecimento:

1. versão pública de quatro componentes usa manifesto e mapeamento SemVer reversível;
2. release por tag, allowlist, assinatura e único NSIS público;
3. updater usa provider empacotado e main process, com consentimento explícito;
4. SMB share-level autentica no tree connect, depois cobre superfície real OPL/64-bit;
5. prova definitiva SMB permanece hardware gate, não desconhecido de design;
6. arte local usa índice linear e protocolo opaco;
7. download target vira união discriminada com migração v1→v2;
8. import usa job/journal próprio e evento de operação unificado.

## Phase 1: Design

### Release/identity/update

1. Introduzir manifesto e utilitário puro de parse/mapeamento/validação, com testes de limites e ordenação.
2. Tornar workflow público tag-only e executar validação antes da matriz; manter branch builds apenas como CI smoke.
3. Configurar assets/NSIS/App User Model ID e inventário explícito por plataforma.
4. Configurar provider GitHub e preservar metadata/blockmaps ao agregar artefatos.
5. Implementar serviço/store/eventos de updater no main process e IPC revisionado; integrar política e modal nas Configurações.
6. Tornar signing/notarization e verificação de assinaturas gates de release pública; executar N→N+1 instalado.

### SMB/OPL

1. Criar fixtures do trace real e testes que reproduzam `0xc000006d` antes da correção.
2. Corrigir coerência share-level: session setup estabelece sessão; tree connect valida share password.
3. Alocar/validar UID, TID, FID e search IDs por conexão e liberar recursos em todos os encerramentos.
4. Implementar `OPEN_ANDX`, `ECHO` e subcomandos/info levels observados; limitar paginação aos buffers negociados.
5. Combinar offsets altos/baixos em read/write, testar boundary 4 GiB/DVD9 e manter streaming.
6. Substituir logs de payload por eventos estruturados sanitizados e debug configurável.
7. Executar matriz de captura e Hardware Smoke Test; somente evidência física promove perfil suportado.

### Biblioteca/artes/status

1. Construir índice local de `ART/` uma vez por scan, validando nome, assinatura, confinamento e duplicidade.
2. Associar snapshot de arte ao snapshot do catálogo e selecionar `COV→COV2` determinístico.
3. Registrar protocolo `opl-art:` antes de `ready`, restringir CSP e resolver apenas assets promovidos/revisionados.
4. Migrar `CatalogItem`/`UnifiedGameItem` para art view e health causes; remover `file://` e o catch-all por arte ausente.
5. Usar lazy image loading/cache revisionado e medir fixture de 500 jogos.

### Downloads locais

1. Migrar persisted task schema para target discriminado mantendo v1 como `opl-device`.
2. Atualizar validação, coordinator, scheduler, recovery e filtros para distinguir targets.
3. Emitir autorização opaca de pasta pelo diálogo privilegiado e revalidar identidade/espaço.
4. Fazer staging na raiz local, sanitizar basename, aplicar `fail|rename`, promover atomicamente e verificar.
5. Preservar integralmente o ramo OPL, legal receipt e ação PCSX2 somente explícita.

### Importação/progresso

1. Introduzir job/item/store/state machine/journal com versões e recovery idempotente.
2. Stream de cópia recebe abort signal, checkpoints throttled e staging; promotion commit é não cancelável.
3. Publicar Operation Summary/Event comum e reconciliar snapshot+sequence no renderer.
4. Exibir item/lote, bytes, percent, velocidade e ETA confiável no fluxo de import e Activity Drawer.
5. Cobrir falhas por item, batch cancel, origem mutável, ENOSPC e crash em cada journal boundary.
6. Remover/encaminhar fluxos legados diretos somente após paridade e testes de regressão.

## Contracts and Persistence

- [IPC contract](contracts/ipc.md): operações estreitas, targets, updater, art e imports.
- [Release contract](contracts/release.md): identidade, allowlist e publication gates.
- [SMB compatibility contract](contracts/smb-compatibility.md): perfil wire-level e hardware evidence.
- [Data model](data-model.md): schemas, migrações e state machines.

Persistência continua em JSON atômico sob `userData`. Cada novo store tem `schemaVersion`, migração idempotente e revision/sequence. Caminhos autoritativos permanecem no main process. Nenhum snapshot parcial substitui um completo.

## Validation Strategy

- **Pure/unit**: version mapping/manifest, state machines, SMB parsing/encoding/offsets/auth placement, art precedence/validation, path/collision, progress math and migrations.
- **Contract**: schemas e round-trip renderer API → preload → IPC para update/import/download/art; rejected unknown fields and controlled errors.
- **Integration**: SMB handshake fixture, local art scan/protocol, local destination/crash recovery, import journal/event ordering, update state/provider adapter.
- **UI**: update policies/dialog, correct cover/placeholder/status causes, local target without device, Activity Drawer restore and batch progress.
- **Platform**: build/resource/signature/artifact inventory, clean Windows install, macOS/Linux startup.
- **System/manual**: signed N→N+1 and physical PS2/OPL listing/read/DVD9. See [quickstart.md](quickstart.md).

## Post-Design Constitution Re-check

Phase 1 introduces no violation. The custom image protocol narrows rather than expands renderer authority; update source is packaged and immutable from UI; paths use authorizations/tokens; downloads/imports retain legal receipt, staging and recovery; logs redact secrets; release/hardware evidence closes previously unverified claims. PASS.

## Delivery Gates and Ordering

1. Contracts/migrations/test fixtures land before behavior changes.
2. SMB and release regression tests demonstrate current failures before fixes.
3. Each slice is independently buildable and keeps legacy persisted data readable.
4. No public updater activation before signatures, metadata allowlist and N→N+1 pass.
5. No OPL compatibility claim before physical smoke including DVD9 boundary.
6. No legacy import/download path removal before recovery and UI parity.
7. Full lint, typecheck, affected tests and build pass before integration; platform/hardware exceptions require owner, impact and expiry.

## Complexity Tracking

No constitutional violations require justification. `ImportJob` is a separate domain entity because local batch import has source/journal semantics incompatible with a remote download task; it reuses persistence/event/scheduler primitives rather than creating a second UI infrastructure. The `opl-art:` protocol replaces a broader `file://` capability and is therefore a security reduction.
