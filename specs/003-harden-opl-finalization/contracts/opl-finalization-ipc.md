# IPC Contract: Durable Downloads, OPL Finalization, Naming and Art Sync

## Boundary

Todos os canais são registrados no processo principal, validados com schemas Zod `strict` e expostos por métodos nomeados de `OplApi`. O renderer envia IDs opacos, seleção e decisões do usuário; não fornece paths internos de cache, staging, partes USBExtreme, backup, arte candidata ou promoção.

O processo principal resolve `deviceId` para o mount atual, revalida a identidade física e confina todos os paths. Rejeições usam `SerializableTaskError`. Operações longas publicam `opl-pipeline:event`; snapshots revisionados continuam sendo a autoridade após perda de eventos, reload ou restart.

## Shared constraints

- IDs: string não vazia com no máximo 128 caracteres.
- Revisões: inteiro não negativo; mutações usam compare-and-swap.
- Game ID: `^[A-Z]{4}_[0-9]{3}\.[0-9]{2}$`.
- Arrays de IDs: valores únicos; paginação máxima 500.
- Art types: subconjunto não vazio e único de `ICO,COV,COV2,LAB,LGO,SCR,SCR2,BG`.
- URLs: somente esquemas/fontes permitidos pelo provider; credenciais não retornam em snapshots/eventos.
- Inputs rejeitam propriedades desconhecidas.
- Planos consumidos, stale ou pertencentes a dispositivo diferente são rejeitados sem escrita.
- Confirmação legal do Essentials é registrada antes do enfileiramento.

## Download queue

### `downloads:enqueue`

Request:

```ts
interface EnqueueDownloadInput {
  source:
    | { kind: 'http'; url: string; expectedBytes?: number; originalFileName?: string }
    | { kind: 'torrent'; magnet?: string; torrentToken?: string; selectedFiles?: string[] }
  deviceId: string
  profileId: string
  title?: string
  mediaHint?: 'CD' | 'DVD'
  legalReceiptId?: string
}
```

Response: `Promise<DurableDownloadTask>` com fase `queued`.

Rules:

- `legalReceiptId` é obrigatório para origem Essentials e resolvido server-side.
- `.torrent` local é selecionado por dialog autorizado e copiado para cache; paths arbitrários não entram neste contrato.
- Enfileirar não inicia escrita no dispositivo nem implica reserva definitiva.
- Duplicata exata retorna tarefa existente não terminal ou conflito explícito, nunca inicia duas cópias silenciosas.

Errors: `INVALID_INPUT`, `SOURCE_NOT_ALLOWED`, `LEGAL_CONFIRMATION_REQUIRED`, `DEVICE_NOT_FOUND`, `PROFILE_NOT_FOUND`, `DUPLICATE_TASK`.

### `downloads:list`

Request:

```ts
interface ListDownloadsInput {
  deviceId?: string
  phases?: PipelinePhase[]
  cursor?: string
  limit?: number // 1..500
}
```

Response: `Promise<Page<DurableDownloadTaskSummary>>`.

### `downloads:get`

Request: `{ taskId: string }`.

Response: `Promise<DurableDownloadTask | undefined>`.

### `downloads:pause`

Request: `{ taskId: string; expectedRevision: number }`.

Response: `Promise<DurableDownloadTask>` após abortar/pausar a transferência, sincronizar o parcial e persistir checkpoint. É idempotente para `paused`.

### `downloads:resume`

Request: `{ taskId: string; expectedRevision: number }`.

Response: `Promise<DurableDownloadTask>` reencolocada no scheduler. A validação de Range/ETag ou peças ocorre antes de anexar bytes.

### `downloads:cancel`

Request:

```ts
interface CancelDownloadInput {
  taskId: string
  expectedRevision: number
  partialPolicy: 'keep-for-resume' | 'discard'
  confirmation?: 'DESCARTAR DOWNLOAD PARCIAL'
}
```

Response: `Promise<DurableDownloadTask>`.

`discard` exige literal quando remove bytes materiais. Cancelamento durante promoção solicita rollback seguro e pode retornar `recovery-pending`.

### `downloads:retry`

Request: `{ taskId: string; expectedRevision: number }`.

Response: `Promise<DurableDownloadTask>`. Somente tarefa terminal retryable é reenfileirada; itens prontos não são repetidos.

### `downloads:retry-failed`

Request: `{ deviceId?: string; expectedQueueRevision: number }`.

Response: `Promise<{ queuedTaskIds: string[]; skippedTaskIds: string[] }>`.

## Finalization and conflict resolution

Transferências válidas entram automaticamente em inspeção e planejamento. O renderer só intervém quando a fonte não é Essentials autoautorizada, há colisão, identidade insuficiente ou substituição de dados existentes.

### `finalization:get-plan`

Request: `{ planId: string }`.

Response: `Promise<FinalizationPlan | undefined>`.

### `finalization:confirm`

Request:

```ts
interface ConfirmFinalizationInput {
  planId: string
  expectedRevision: number
  collisionResolution?: 'keep-existing' | 'replace-identical' | 'replace-authorized'
  confirmation: 'FINALIZAR BACKUP PARA OPL'
}
```

Response: `Promise<DurableDownloadTask>` após aceitar o plano e colocá-lo no writer do dispositivo.

Preconditions sob lock de `deviceId`:

- imagem, hash, perfil, volume, filesystem, espaço e revisão ainda coincidem;
- Game ID é autoritativo ou override foi confirmado;
- formato e paths foram derivados server-side;
- colisão está resolvida sem sobrescrita silenciosa;
- recovery anterior não está pendente.

### `finalization:set-game-id`

Request:

```ts
interface SetFinalizationGameIdInput {
  planId: string
  expectedRevision: number
  gameId: string
  confirmation: 'USAR GAME ID INFORMADO'
}
```

Response: `Promise<FinalizationPlan>` revisionado, com a divergência preservada como finding.

### `finalization:cancel`

Request: `{ taskId: string; expectedRevision: number }`.

Response: `Promise<DurableDownloadTask>`. Antes do commit aborta inalterado; depois do commit intent aciona rollback.

## Existing-library naming

### `naming:audit`

Request: `{ deviceId: string; profileId: string }`.

Response: `Promise<NamingAudit>`.

É somente leitura. Examina ISO/ZSO em `CD`/`DVD`, lê identidade do conteúdo e classifica cada item.

### `naming:plan`

Request:

```ts
interface CreateNamingPlanInput {
  auditId: string
  expectedRevision: number
  itemIds?: string[] // únicos, 1..500; ausente = todos correctable
}
```

Response: `Promise<NamingPlan>` com nome atual, nome canônico, conflitos e exclusões.

### `naming:confirm`

Request:

```ts
interface ConfirmNamingPlanInput {
  planId: string
  expectedRevision: number
  confirmation: 'ADEQUAR NOMES OPL'
}
```

Response: `Promise<NamingOperation>`. Renames são serializados pelo lock do dispositivo e journal por item.

### `naming:get-operation`

Request: `{ operationId: string }`.

Response: `Promise<NamingOperation | undefined>`.

## Art index

### `art:index:refresh`

Request: `{ force?: boolean }`.

Response: `Promise<ArtIndexSummary>`; operação continua por eventos quando não puder concluir rapidamente.

### `art:index:query`

Request:

```ts
interface QueryArtIndexInput {
  gameIds?: string[] // únicos, até 500
  types?: ArtType[]
  cursor?: string
  limit?: number // 1..500
}
```

Response: `Promise<Page<ArtAssetRecord>>`. O renderer nunca recebe path do cache nem URL com segredo.

## Art synchronization

### `art:sync:plan`

Request:

```ts
interface CreateArtSyncPlanInput {
  deviceId: string
  catalogSnapshotId: string
  scope: 'single' | 'selected' | 'missing' | 'library'
  gameIds?: string[]
  types: ArtType[]
  replacePolicy: 'missing-only' | 'replace-invalid' | 'replace-all'
}
```

Response: `Promise<ArtSyncPlanSummary>`.

Rules:

- `single` exige exatamente um ID; `selected` exige 1..500 por página de plano.
- `replace-all` inclui risco e exige confirmação na execução.
- Catálogo e índice stale retornam erro antes de escrever.

### `art:sync:start`

Request:

```ts
interface StartArtSyncInput {
  planId: string
  expectedRevision: number
  confirmation?: 'SUBSTITUIR ARTES EXISTENTES'
}
```

Response: `Promise<ArtSyncJob>`. A confirmação é obrigatória somente para ações que substituem arte válida.

### `art:sync:get` / `art:sync:list`

Requests:

```ts
{ jobId: string }

{ deviceId?: string; states?: ArtSyncJobState[]; cursor?: string; limit?: number }
```

Responses: `Promise<ArtSyncJob | undefined>` e `Promise<Page<ArtSyncJobSummary>>`.

### `art:sync:pause` / `art:sync:resume` / `art:sync:cancel`

Request: `{ jobId: string; expectedRevision: number }`.

Response: `Promise<ArtSyncJob>`. Item já instalado permanece instalado; candidatos incompletos são reconciliados antes de retomar.

### `art:sync:retry-failed`

Request: `{ jobId: string; expectedRevision: number }`.

Response: `Promise<ArtSyncJob>` contendo somente itens falhos retryable reenfileirados.

## Event contract

Preload method:

```ts
onOplPipelineEvent(callback: (event: PipelineEvent) => void): () => void
```

Channel: `opl-pipeline:event`.

```ts
interface PipelineEvent {
  operationId: string
  revision: number
  sequence: number
  kind: 'download' | 'finalization' | 'naming' | 'art'
  phase: string
  progress?: number
  currentItem?: string
  bytes?: { done: number; total?: number }
  message: string
  error?: SerializableTaskError
  timestamp: string
}
```

- `sequence` é estritamente crescente por operação.
- UI ignora evento mais antigo e consulta `get/list` ao detectar gap.
- Eventos de bytes são emitidos no máximo 4 vezes por segundo por operação; transições são imediatas.
- Eventos não contêm URL com credencial, cache path, backup path ou conteúdo de jogo.

## Error codes

| Code                        | Retryable | Meaning                                              |
| --------------------------- | --------- | ---------------------------------------------------- |
| INVALID_INPUT               | false     | Schema ou combinação inválida                        |
| SOURCE_NOT_ALLOWED          | false     | Provider/esquema não autorizado                      |
| LEGAL_CONFIRMATION_REQUIRED | false     | Recibo obrigatório ausente                           |
| TASK_NOT_FOUND              | false     | Tarefa não existe                                    |
| STALE_REVISION              | true      | Estado mudou desde a leitura                         |
| SOURCE_UNAVAILABLE          | true      | Origem temporariamente indisponível                  |
| SOURCE_CHANGED              | true      | ETag/mtime/infoHash divergiu do parcial              |
| RESUME_UNSUPPORTED          | true      | Origem exige reinício do item                        |
| RANGE_INVALID               | true      | Resposta de retomada incoerente                      |
| RATE_LIMITED                | true      | Origem solicitou espera                              |
| DEVICE_NOT_FOUND            | true      | Dispositivo ausente                                  |
| DEVICE_CHANGED              | true      | Identidade física/mount divergiu                     |
| INSUFFICIENT_SPACE          | true      | Reservas + necessidade excedem espaço                |
| IMAGE_INVALID               | false     | ISO/ZSO inválida ou incompleta                       |
| GAME_ID_REQUIRED            | false     | Identidade insuficiente para promoção                |
| GAME_ID_CONFLICT            | false     | Fontes de identidade divergem                        |
| DESTINATION_CONFLICT        | false     | Path canônico já ocupado                             |
| UNSUPPORTED_FILESYSTEM      | false     | Formato não pode ser instalado no volume             |
| INVALID_UL_CFG              | false     | Catálogo USBExtreme inconsistente                    |
| HASH_MISMATCH               | true      | Candidata divergiu da origem                         |
| STILL_FRAGMENTED            | true      | Candidata/ativo comprovadamente fragmentado          |
| RECOVERY_PENDING            | false     | Estado ambíguo bloqueia nova escrita                 |
| ART_ASSET_NOT_FOUND         | false     | Categoria não disponível                             |
| ART_SIZE_LIMIT              | false     | Asset/pacote excede limite                           |
| ARCHIVE_INVALID             | false     | ZIP/entry/CRC inválido                               |
| ZIP_BOMB                    | false     | Razão/tamanho/quantidade insegura                    |
| ART_IMAGE_INVALID           | false     | Conteúdo visual inválido                             |
| CANCELLED                   | true      | Usuário cancelou                                     |
| INTERNAL_FAILURE            | false     | Falha isolada registrada; pode exigir restart seguro |

## OplApi additions/replacements

```ts
interface OplApi {
  enqueueDownload(input: EnqueueDownloadInput): Promise<DurableDownloadTask>
  listDownloads(input?: ListDownloadsInput): Promise<Page<DurableDownloadTaskSummary>>
  getDownload(taskId: string): Promise<DurableDownloadTask | undefined>
  pauseDownload(input: RevisionedTaskRef): Promise<DurableDownloadTask>
  resumeDownload(input: RevisionedTaskRef): Promise<DurableDownloadTask>
  cancelDownload(input: CancelDownloadInput): Promise<DurableDownloadTask>
  retryDownload(input: RevisionedTaskRef): Promise<DurableDownloadTask>
  retryFailedDownloads(input: RetryFailedDownloadsInput): Promise<RetryBatchResult>
  getFinalizationPlan(planId: string): Promise<FinalizationPlan | undefined>
  confirmFinalization(input: ConfirmFinalizationInput): Promise<DurableDownloadTask>
  setFinalizationGameId(input: SetFinalizationGameIdInput): Promise<FinalizationPlan>
  cancelFinalization(input: RevisionedTaskRef): Promise<DurableDownloadTask>
  auditOplNames(input: NamingAuditInput): Promise<NamingAudit>
  planOplNaming(input: CreateNamingPlanInput): Promise<NamingPlan>
  confirmOplNaming(input: ConfirmNamingPlanInput): Promise<NamingOperation>
  getOplNamingOperation(operationId: string): Promise<NamingOperation | undefined>
  refreshArtIndex(force?: boolean): Promise<ArtIndexSummary>
  queryArtIndex(input: QueryArtIndexInput): Promise<Page<ArtAssetRecord>>
  planArtSync(input: CreateArtSyncPlanInput): Promise<ArtSyncPlanSummary>
  startArtSync(input: StartArtSyncInput): Promise<ArtSyncJob>
  getArtSyncJob(jobId: string): Promise<ArtSyncJob | undefined>
  listArtSyncJobs(input?: ListArtSyncJobsInput): Promise<Page<ArtSyncJobSummary>>
  pauseArtSync(input: RevisionedJobRef): Promise<ArtSyncJob>
  resumeArtSync(input: RevisionedJobRef): Promise<ArtSyncJob>
  cancelArtSync(input: RevisionedJobRef): Promise<ArtSyncJob>
  retryFailedArt(input: RevisionedJobRef): Promise<ArtSyncJob>
  onOplPipelineEvent(callback: (event: PipelineEvent) => void): () => void
}
```

Os métodos antigos de fila e arte permanecem somente durante uma migração interna curta; nenhuma UI nova deve depender deles. A migração deve preservar tarefas legadas observáveis ou encerrá-las com resultado explícito, nunca descartá-las silenciosamente.

## Contract and security tests

- Rejeitar propriedades extras, IDs vazios, revisões negativas, arrays duplicados e mais de 500 itens.
- Rejeitar path absoluto/traversal/symlink vindo da UI e URL/provider não autorizado.
- Provar que device/cache/staging paths são resolvidos server-side.
- Provar confirmação legal e confirmações literais de replace/rename/descarte.
- Provar stale revision e replay de plano sem escrita.
- Provar que preload não expõe IPC genérico, filesystem, WebTorrent ou AbortController.
- Provar paginação e payload limitado para fila, índice e jobs.
- Provar que eventos são sequenciados, coalescidos e redigidos.
- Provar que reload reconstrói a UI por snapshot sem depender do stream de eventos.
