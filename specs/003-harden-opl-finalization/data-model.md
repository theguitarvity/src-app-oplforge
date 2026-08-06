# Data Model: Finalização OPL confiável e resiliente

## Conventions

- Identificadores persistentes são UUIDs; chaves de cache e identidades derivadas usam SHA-256 de representação canônica.
- Datas são ISO 8601 UTC; bytes, revisões, sequências e tentativas são inteiros não negativos.
- Paths persistidos no dispositivo são relativos a um `SafeRoot`; paths absolutos internos nunca atravessam o contrato IPC.
- Game ID canônico segue `^[A-Z]{4}_[0-9]{3}\.[0-9]{2}$`.
- Hashes SHA-256 são hexadecimais com 64 caracteres; ETag e Last-Modified são validadores remotos, não hashes de conteúdo.
- Toda entidade persistida possui `schemaVersion`, `revision`, `createdAt` e `updatedAt`, salvo value objects embutidos.

## Enums

### PipelinePhase

`queued | probing | transferring | paused | downloaded | validating | planning | awaiting-confirmation | installing | verifying | cataloging | queueing-art | ready | waiting-device | failed | cancelled | recovery-pending`

### TransferKind

`http | torrent`

### ResumeCapability

`unknown | supported | unsupported | invalidated`

### InstallationFormat

`ISO | ZSO | USBExtreme`

### IdentitySource

`system-cnf | ul-cfg | user-override | filename-hint | catalog-hint`

Ordem de confiança: `system-cnf`/`ul-cfg` → `user-override` → hints. Um hint isolado não autoriza promoção automática.

### FragmentationResult

`contiguous | fragmented | not-verified`

### ArtType

`ICO | COV | COV2 | LAB | LGO | SCR | SCR2 | BG`

### ArtReplacePolicy

`missing-only | replace-invalid | replace-all`

### ArtItemState

`pending | downloading | cached | staged | validated | installed | skipped | failed | cancelled`

## DurableDownloadTask

Autoridade persistente para um item desde o enfileiramento até o jogo pronto.

| Field              | Type                   | Rules                                                      |
| ------------------ | ---------------------- | ---------------------------------------------------------- |
| taskId             | UUID                   | Imutável; correlaciona eventos, logs, plano e resultado    |
| source             | TransferSource         | Origem sanitizada e metadados retomáveis                   |
| legalConfirmation  | LegalReceipt           | Obrigatório para Essentials; não contém conteúdo remoto    |
| targetDeviceId     | string                 | Identidade física, não mount path                          |
| targetProfileId    | string                 | Perfil OPL exato                                           |
| requestedTitle     | string                 | Hint da fonte, máximo 128 caracteres                       |
| requestedMedia     | `CD \| DVD`?           | Hint; mídia inspecionada prevalece                         |
| selectedFiles      | string[]               | Paths relativos normalizados para torrent                  |
| phase              | PipelinePhase          | Segue máquina de estados válida                            |
| phaseProgress      | number                 | 0–1, monotônico dentro da fase                             |
| overallProgress    | number                 | 0–1; não chega a 1 antes de `ready` ou terminal falho      |
| transfer           | TransferCheckpoint     | Bytes e identidade remota confirmados                      |
| reservation        | SpaceReservation?      | Reserva local e no dispositivo                             |
| validatedImageId   | UUID?                  | Presente depois de `validating`                            |
| finalizationPlanId | UUID?                  | Presente depois de `planning`                              |
| installationId     | string?                | Presente após promoção válida                              |
| artJobId           | UUID?                  | Job automático; sua ausência/falha não invalida instalação |
| lastError          | SerializableTaskError? | Código estável, retryable e efeito sobre dados             |
| attempt            | integer                | Incrementa em retry explícito/automático                   |
| nextRetryAt        | datetime?              | Apenas para erro transitório                               |
| lastSequence       | integer                | Eventos monotônicos                                        |

### TransferSource

| Field             | Type         | Rules                                                      |
| ----------------- | ------------ | ---------------------------------------------------------- |
| kind              | TransferKind | Discriminador                                              |
| sourceRef         | string       | URL sanitizada, magnet ou path interno da cópia `.torrent` |
| originalFileName  | string?      | Não controla destino final                                 |
| expectedBytes     | integer?     | Hint revalidado                                            |
| finalUrl          | string?      | Sem credenciais persistidas                                |
| etag/lastModified | string?      | Validadores de retomada HTTP                               |
| infoHash          | string?      | Torrent após metadata                                      |

### TransferCheckpoint

| Field               | Type             | Rules                                   |
| ------------------- | ---------------- | --------------------------------------- |
| cacheKey            | string           | SHA-256 da identidade estável da origem |
| partialRelativePath | string           | Confinado ao cache da aplicação         |
| bytesConfirmed      | integer          | Nunca maior que total observado         |
| totalBytes          | integer?         | Atualizado por probe/metadata           |
| resumeCapability    | ResumeCapability | Define ação após restart                |
| sourceFingerprint   | string?          | ETag/Last-Modified/infoHash canônico    |
| checkpointedAt      | datetime         | Último fsync/checkpoint                 |

### Valid transitions

```text
queued -> probing -> transferring -> downloaded -> validating -> planning
planning -> awaiting-confirmation -> installing -> verifying -> cataloging
cataloging -> queueing-art -> ready

probing|transferring|validating|planning|installing|verifying -> waiting-device
transferring -> paused -> transferring
queued|probing|transferring|paused|downloaded|validating|planning -> cancelled
qualquer fase não terminal -> failed | recovery-pending
waiting-device -> fase segura reconciliada
failed -> queued (retry explícito e revisionado)
```

`downloaded` significa somente transferência completa. `ready` exige instalação válida; arte pode continuar em job separado.

## SpaceReservation

| Field             | Type                                                 | Rules                                       |
| ----------------- | ---------------------------------------------------- | ------------------------------------------- |
| reservationId     | UUID                                                 | Um por tarefa/fase                          |
| taskId/deviceId   | string                                               | Correlação obrigatória                      |
| scope             | `local-cache \| device-staging \| final-destination` | Reserva separada por recurso                |
| bytes             | integer                                              | Inclui candidata, backup e margem aplicável |
| state             | `held \| consumed \| released \| expired`            | `held` concorre no cálculo global           |
| observedFreeBytes | integer                                              | Snapshot revalidado antes da escrita        |
| expiresAt         | datetime?                                            | Só reserva que ainda não iniciou I/O        |

Invariante: soma de reservas `held` no mesmo recurso não pode exceder o espaço livre revalidado menos margem operacional.

## ValidatedGameImage

| Field             | Type                             | Rules                                        |
| ----------------- | -------------------------------- | -------------------------------------------- |
| imageId           | UUID                             | Imutável para o fingerprint inspecionado     |
| taskId            | UUID?                            | Ausente em adequação de biblioteca existente |
| cacheRelativePath | string                           | Confinado à raiz aprovada                    |
| sizeBytes         | integer                          | Igual ao arquivo validado                    |
| sha256            | string                           | Obrigatório antes de instalar                |
| extension         | `iso \| zso`                     | Conteúdo e header compatíveis                |
| media             | `CD \| DVD`                      | Derivada da imagem                           |
| gameIdentity      | GameIdentity                     | Inclui fontes e conflitos                    |
| structure         | `valid \| invalid \| incomplete` | Somente `valid` permite plano                |
| inspectedAt       | datetime                         | Fingerprint stale invalida o plano           |

## GameIdentity

| Field               | Type               | Rules                                                       |
| ------------------- | ------------------ | ----------------------------------------------------------- |
| gameId              | string?            | Normalizado; obrigatório para promoção automática           |
| authoritativeSource | IdentitySource?    | Deve ser `system-cnf` ou `ul-cfg`, salvo override explícito |
| title               | string             | Título sanitizado proposto                                  |
| titleBytes          | integer            | Máximo 32 no padrão conservador                             |
| evidence            | IdentityEvidence[] | Valor, fonte e confiança                                    |
| conflicts           | IdentityConflict[] | Divergências nunca suprimidas                               |

## FinalizationPlan

Snapshot imutável que transforma uma imagem validada em instalação OPL.

| Field                    | Type                                                                   | Rules                                              |
| ------------------------ | ---------------------------------------------------------------------- | -------------------------------------------------- |
| planId                   | UUID                                                                   | Consumível uma vez                                 |
| taskId/imageId           | UUID                                                                   | Referências revisionadas                           |
| expectedTaskRevision     | integer                                                                | Rejeita plano stale                                |
| device                   | DeviceSnapshot                                                         | Identidade, filesystem, espaço e mount observado   |
| profileId                | string                                                                 | Perfil exato                                       |
| format                   | InstallationFormat                                                     | FAT32 + tamanho incompatível implica USBExtreme    |
| media                    | `CD \| DVD`                                                            | Define diretório para arquivo único                |
| canonicalName            | string?                                                                | `GAME_ID.Título.ext`; ausente para USBExtreme      |
| destinationRelativePaths | string[]                                                               | Resolvidos server-side, únicos e confinados        |
| usbExtreme               | UsbExtremeLayout?                                                      | Obrigatório quando `format=USBExtreme`             |
| requiredBytes            | integer                                                                | Cache/candidata/backup/margem discriminados        |
| collision                | DestinationCollision?                                                  | Bloqueia execução sem resolução explícita          |
| verificationCapability   | string                                                                 | Snapshot da feature de fragmentação                |
| status                   | `awaiting-confirmation \| confirmed \| stale \| consumed \| cancelled` | Monotônico                                         |
| warnings                 | string[]                                                               | Inclui divergência de identidade e não verificável |

## UsbExtremeLayout

| Field            | Type     | Rules                                                     |
| ---------------- | -------- | --------------------------------------------------------- |
| titleBytes       | string   | Mesmo valor gravado em `ul.cfg`; base do CRC              |
| crc32            | string   | Oito hex uppercase                                        |
| gameIdSuffix     | string   | Game ID sem os três primeiros caracteres                  |
| partSize         | integer  | Exatamente `0x3ff00000` salvo última parte                |
| partCount        | integer  | `ceil(sourceBytes / partSize)`, cabe no campo do registro |
| partNames        | string[] | `ul.<CRC8>.<suffix>.<NN>` em ordem                        |
| mediaCode        | integer  | Valor compatível com CD/DVD                               |
| preservedUnknown | byte[15] | Preservado ao substituir entrada existente                |

## InstallationJournal

Reutiliza as garantias transacionais da instalação e da feature 002.

| Field                  | Type                 | Rules                                               |
| ---------------------- | -------------------- | --------------------------------------------------- |
| journalId              | UUID                 | Um por plano                                        |
| taskId/planId/deviceId | string               | Correlação obrigatória                              |
| state                  | TransactionState     | Transições monotônicas                              |
| candidates             | JournalFile[]        | Hash, tamanho, path relativo e extents pré-promoção |
| backups                | JournalFile[]        | Última versão válida recuperável                    |
| intents/outcomes       | JournalStep[]        | Intent persistido antes de cada rename              |
| ulCfgAction            | `none \| replace`    | `replace` sempre por último                         |
| activeVerification     | FragmentationResult? | Prova depois da promoção                            |
| recoveryInstructions   | string[]             | Obrigatório em ambiguidade                          |

Invariantes:

1. Nenhum path ativo aponta para candidata não validada.
2. Toda candidata tem tamanho e SHA-256 esperados.
3. Quando verificável, candidata e ativo precisam ser contíguos.
4. USBExtreme promove todas as partes antes de `ul.cfg`; rollback restaura o conjunto inteiro.
5. Um device possui no máximo um journal em fase de escrita/promoção.

## NamingAudit and NamingPlan

### NamingAuditItem

| Field                 | Type                                                                 | Rules                                         |
| --------------------- | -------------------------------------------------------------------- | --------------------------------------------- |
| itemId                | string                                                               | Identidade da instalação, não Game ID isolado |
| currentRelativePath   | string                                                               | Confinado a `CD`/`DVD`                        |
| currentFingerprint    | FileFingerprint                                                      | Tamanho, mtime e hash quando necessário       |
| identity              | GameIdentity                                                         | Extraída sem alterar arquivo                  |
| canonicalRelativePath | string?                                                              | Destino proposto                              |
| classification        | `canonical \| correctable \| collision \| missing-id \| unsupported` | Exatamente um                                 |
| findings              | Finding[]                                                            | Explicações acionáveis                        |

### NamingPlan

Contém `planId`, snapshot/revisão do dispositivo, itens incluídos, exclusões, renames ordenados, conflitos, confirmação e status. Cada item possui journal próprio. Rename no mesmo filesystem deve preservar hash e evidência física anterior.

## ArtIndexSnapshot

| Field                   | Type                                     | Rules                                   |
| ----------------------- | ---------------------------------------- | --------------------------------------- |
| snapshotId              | UUID                                     | Versão imutável do índice               |
| sourceId/sourceRevision | string                                   | Fonte e ETag/data/hash canônicos        |
| status                  | `refreshing \| ready \| stale \| failed` | `stale` pode servir leitura com aviso   |
| assetsByKey             | map                                      | Chave `GAME_ID:TYPE`, valores ordenados |
| archives                | ArtSourceArchive[]                       | Metadata para cache/range               |
| generatedAt/expiresAt   | datetime                                 | TTL explícito                           |

## ArtAssetRecord

| Field                             | Type          | Rules                                     |
| --------------------------------- | ------------- | ----------------------------------------- |
| assetId                           | string        | Derivado de source revision + localização |
| gameId                            | string        | Normalizado                               |
| type                              | ArtType       | Um dos oito tipos                         |
| sourceId                          | string        | Provider permitido                        |
| directUrl                         | string?       | HTTPS permitido                           |
| archiveId/entryName               | string?       | Ambos presentes para ZIP                  |
| compressedBytes/uncompressedBytes | integer?      | Limites de segurança antes de extrair     |
| crc32/sha256                      | string?       | Integridade conhecida                     |
| sourceFormat                      | `png \| jpeg` | Saída será PNG                            |

## ArtCacheEntry

| Field             | Type                                          | Rules                                 |
| ----------------- | --------------------------------------------- | ------------------------------------- |
| cacheKey          | string                                        | URL + revision/validator canônico     |
| relativePath      | string                                        | Confinado ao cache local              |
| state             | `partial \| verified \| corrupt \| evictable` | Somente `verified` serve assets       |
| bytes/sha256      | integer/string?                               | Obrigatórios quando verificado        |
| etag/lastModified | string?                                       | Retomada e invalidação                |
| activeReferences  | integer                                       | Entrada com referência não é removida |
| lastAccessedAt    | datetime                                      | Política LRU/quota                    |

## ArtSyncPlan and ArtSyncJob

### ArtSyncPlan

| Field                                         | Type                                       | Rules                              |
| --------------------------------------------- | ------------------------------------------ | ---------------------------------- |
| planId                                        | UUID                                       | Consumível uma vez                 |
| deviceId/catalogSnapshotId/artIndexSnapshotId | string                                     | Todos revisionados                 |
| scope                                         | `single \| selected \| missing \| library` | Seleção explícita                  |
| gameIds                                       | string[]                                   | Únicos, até 500 por página interna |
| types                                         | ArtType[]                                  | Entre 1 e 8, únicos                |
| replacePolicy                                 | ArtReplacePolicy                           | `missing-only` padrão              |
| items                                         | ArtSyncPlanItem[]                          | Ações/exclusões por game/type      |
| expectedRevision                              | integer                                    | Confirmação CAS                    |

### ArtSyncJob

| Field                 | Type                                                                                             | Rules                            |
| --------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------- |
| jobId/planId/deviceId | UUID/string                                                                                      | Correlação                       |
| state                 | `queued \| running \| paused \| completed \| partial \| failed \| cancelled \| recovery-pending` | Agregado dos itens               |
| items                 | ArtSyncItem[]                                                                                    | Exatamente um por ação planejada |
| counts                | map<ArtItemState, integer>                                                                       | Soma igual ao total              |
| currentItemId         | UUID?                                                                                            | Observabilidade, não lock        |
| lastSequence          | integer                                                                                          | Eventos monotônicos              |

### ArtSyncItem

| Field                       | Type                   | Rules                                  |
| --------------------------- | ---------------------- | -------------------------------------- |
| itemId                      | UUID                   | Único no job                           |
| gameId/type                 | string/ArtType         | Define destino `${gameId}_${type}.png` |
| assetId/cacheKey            | string                 | Origem e bytes compartilháveis         |
| state                       | ArtItemState           | Checkpoint por asset                   |
| expectedBytes/receivedBytes | integer?               | Progresso limitado                     |
| attempts/nextRetryAt        | integer/datetime?      | Retry somente transitório              |
| destinationFingerprint      | FileFingerprint?       | Detecta mudança concorrente            |
| error                       | SerializableTaskError? | Falha isolada                          |

Invariantes:

1. Um job concluído possui todos os itens `installed` ou `skipped` conforme plano.
2. Uma chave de cache tem no máximo um download ativo (single-flight).
3. Arte final só existe após validação de imagem e rename da candidata.
4. `missing-only` nunca substitui arte válida.
5. Falha de arte não altera `DurableDownloadTask.phase=ready` de um jogo íntegro.

## PipelineEvent

| Field             | Type                                        | Rules                                          |
| ----------------- | ------------------------------------------- | ---------------------------------------------- |
| operationId       | UUID                                        | `taskId`, `jobId` ou `planId` conforme domínio |
| revision/sequence | integer                                     | Revisão persistida e ordem do stream           |
| kind              | `download \| finalization \| naming \| art` | Discriminador                                  |
| phase             | string                                      | Enum do domínio                                |
| progress          | number?                                     | 0–1                                            |
| currentItem       | string?                                     | ID/título seguro para UI                       |
| bytes             | `{done,total?}`?                            | Sem paths internos                             |
| message           | string                                      | Localizável e seguro                           |
| error             | SerializableTaskError?                      | Código, retryable, ação sugerida               |
| timestamp         | datetime                                    | UTC                                            |

Eventos são notificações descartáveis. Snapshots persistidos são sempre a fonte autoritativa após reload/restart.
