# Data Model: Diagnóstico e correção de fragmentação OPL

## Conventions

- Identificadores persistentes são UUIDs; identidades derivadas usam SHA-256 de uma representação canônica.
- Bytes são inteiros não negativos; datas são ISO 8601 UTC.
- Caminhos persistidos para arquivos do jogo são relativos ao `SafeRoot`; caminhos absolutos só existem durante uma operação validada no processo principal.
- SHA-256 é hexadecimal com 64 caracteres.
- Game ID é metadado opcional e não exclusivo.

## Enums

### DiagnosticState

`contiguous | fragmented | partially-fragmented | incomplete | invalid | unverifiable`

Precedência agregada: `invalid` → `incomplete` → `unverifiable` → `partially-fragmented` → `fragmented` → `contiguous`. `partially-fragmented` só se aplica a instalações multipartes com ao menos um arquivo contíguo e ao menos um fragmentado. Uma instalação de arquivo único verificável nunca recebe estado parcial.

### VerificationCapability

`supported | unsupported | unavailable | permission-denied | unrecognized-output | not-homologated`

### RepairOutcome

`corrected | unchanged | skipped | failed | cancelled | recovery-pending`

### OperationStatus

`planned | awaiting-confirmation | running | cancelling | completed | failed | cancelled | recovery-pending`

### TransactionState

`planned | preflight-validated | staging | candidate-verified | commit-intent | promoting | active-validating | committed | cleanup-pending | cleanup-complete | aborted-unchanged | rollback-required | rolling-back | restored | recovery-pending`

## DeviceCapability

Representa a capacidade observada no volume selecionado.

| Field                | Type                   | Rules                                               |
| -------------------- | ---------------------- | --------------------------------------------------- |
| deviceId             | string                 | Identidade da unidade/volume, não apenas mount path |
| mountPath            | string                 | Resolvido somente no processo principal             |
| realPath             | string                 | Capturado no momento do probe                       |
| volumeId             | string?                | Obrigatório quando disponível na plataforma         |
| fileSystem           | string                 | Nome normalizado ou `unknown`                       |
| totalBytes/freeBytes | integer                | Snapshot do probe                                   |
| extentVerification   | VerificationCapability | Deve ser `supported` para tentativa de correção     |
| method               | string                 | Ferramenta/API e versão observada                   |
| homologated          | boolean                | Combinação OS/filesystem/driver aprovada            |
| limitations          | string[]               | Motivos acionáveis                                  |
| observedAt           | datetime               | Expira quando o mount muda                          |

## InstallationIdentity

Identidade canônica de uma instalação, independente de Game ID.

| Field          | Type                       | Rules                                                  |
| -------------- | -------------------------- | ------------------------------------------------------ |
| installationId | string                     | SHA-256 de `deviceId + format + sorted(relativePaths)` |
| deviceId       | string                     | Deve coincidir com a capacidade e o diagnóstico        |
| format         | `ISO \| ZSO \| USBExtreme` | Formato reconhecido                                    |
| relativePaths  | string[]                   | Normalizados, únicos, ordenados e confinados ao root   |
| gameId         | string?                    | Não exclusivo; duplicidades são findings               |
| title          | string                     | Preservado, não integra identidade                     |
| media          | `CD \| DVD`                | Derivado da estrutura                                  |

Relações: um `DeviceCapability` possui muitas instalações; uma instalação possui um ou mais `EvaluatedFile`.

## EvaluatedFile

| Field              | Type                                                         | Rules                                                |
| ------------------ | ------------------------------------------------------------ | ---------------------------------------------------- |
| relativePath       | string                                                       | Único dentro da instalação                           |
| role               | `game \| usb-part \| ul-cfg \| auxiliary`                    | `auxiliary` é somente leitura                        |
| sizeBytes          | integer?                                                     | Ausente apenas quando o arquivo esperado não existe  |
| modifiedAt         | datetime?                                                    | Evidência para stale detection                       |
| sha256             | string?                                                      | Obrigatório antes de correção                        |
| structuralState    | `valid \| incomplete \| invalid \| unverifiable`             | Com motivo associado                                 |
| extentState        | `contiguous \| fragmented \| unverifiable \| not-applicable` | Auxiliares podem ser `not-applicable`                |
| extentCount        | integer?                                                     | Maior ou igual a 1 quando verificado                 |
| physicalRanges     | range[]?                                                     | Cobertura lógica e física validada quando disponível |
| verificationMethod | string?                                                      | Ferramenta/API usada                                 |
| findings           | Finding[]                                                    | Códigos estáveis e mensagens acionáveis              |

## FragmentationDiagnostic

Snapshot somente leitura de um dispositivo.

| Field                 | Type                                         | Rules                                    |
| --------------------- | -------------------------------------------- | ---------------------------------------- |
| diagnosticId          | UUID                                         | Imutável                                 |
| revision              | integer                                      | Incrementa a cada persistência           |
| device                | DeviceCapability                             | Snapshot completo                        |
| status                | `running \| complete \| cancelled \| failed` | Somente `complete` permite plano         |
| installations         | GameDiagnostic[]                             | Ordenação determinística por instalação  |
| summary               | DiagnosticSummary                            | Deve conciliar exatamente as instalações |
| startedAt/completedAt | datetime                                     | `completedAt` para estado terminal       |

`GameDiagnostic` combina `InstallationIdentity`, arquivos, estado anterior, bytes totais, bytes temporários e findings. `DiagnosticSummary` contém total e contagem por cada estado, jogos elegíveis, arquivos afetados, espaço livre e pico temporário sequencial.

## RepairPlan

Snapshot imutável apresentado para confirmação.

| Field              | Type                                                                   | Rules                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| planId             | UUID                                                                   | Chave da confirmação                                                                                                  |
| diagnosticId       | UUID                                                                   | Deve apontar para diagnóstico completo vigente                                                                        |
| diagnosticRevision | integer                                                                | Rejeita snapshot stale                                                                                                |
| deviceId           | string                                                                 | Revalidado no confirm                                                                                                 |
| mode               | `single \| batch`                                                      | `single` contém exatamente um item incluído                                                                           |
| status             | `awaiting-confirmation \| confirmed \| stale \| cancelled \| consumed` | Plano confirmado só pode ser consumido uma vez                                                                        |
| items              | RepairPlanItem[]                                                       | Ordem sequencial explícita                                                                                            |
| exclusions         | PlanExclusion[]                                                        | Instalação + código + explicação                                                                                      |
| peakTemporaryBytes | integer                                                                | Máximo por item: bytes das candidatas + `max(64 MiB, 2% desses bytes)` + qualquer cópia adicional que não seja rename |
| freeBytesObserved  | integer                                                                | Revalidado antes de cada item                                                                                         |
| confirmationText   | string                                                                 | Literal exibido/esperado                                                                                              |
| recoveryStrategy   | string                                                                 | Resumo da preservação/rollback                                                                                        |
| createdAt          | datetime                                                               | Auditoria                                                                                                             |

`RepairPlanItem` registra identidade, fingerprints das origens, arquivos a regravar, `ul.cfg` se indispensável, bytes temporários, margem operacional calculada como `max(64 MiB, 2% dos bytes das candidatas)`, riscos e ordem. Somente arquivos com extent `fragmented` entram em `filesToRewrite`; qualquer cópia adicional que não seja rename é somada integralmente ao requisito.

## RepairOperation

Execução de um plano confirmado.

| Field                  | Type               | Rules                                     |
| ---------------------- | ------------------ | ----------------------------------------- |
| operationId            | UUID               | Correlaciona journal, eventos e relatório |
| planId                 | UUID               | Um para um                                |
| expectedDeviceRevision | integer            | Conferido sob lock                        |
| status                 | OperationStatus    | Derivado dos itens                        |
| currentItemIndex       | integer?           | No máximo um item ativo                   |
| items                  | RepairItemResult[] | Um resultado por item incluído            |
| lastSequence           | integer            | Eventos monotônicos                       |
| startedAt/completedAt  | datetime           | Auditoria                                 |

## TransactionJournal

Journal durável por jogo, armazenado fora do dispositivo.

| Field                               | Type              | Rules                                             |
| ----------------------------------- | ----------------- | ------------------------------------------------- |
| journalId                           | UUID              | Um por item/operação                              |
| schemaVersion/revision              | integer           | Migração explícita; CAS na escrita                |
| operationId/installationId/deviceId | string            | Correlação obrigatória                            |
| state                               | TransactionState  | Transição monotônica válida                       |
| sourceFingerprints                  | FileFingerprint[] | Autoridade pré-operação                           |
| candidates                          | TransactionFile[] | Caminho relativo, hash, tamanho e prova física    |
| backups                             | TransactionFile[] | Cópias originais promovíveis em rollback          |
| ulCfgAction                         | `none \| replace` | `replace` somente com justificativa               |
| intents/outcomes                    | JournalStep[]     | Intent persistido antes, outcome após cada rename |
| recoveryInstructions                | string[]          | Obrigatório para `recovery-pending`               |
| updatedAt                           | datetime          | Auditoria                                         |

O arquivo físico do journal é escrito atomicamente. Journal ausente/corrompido ou fingerprints ambíguos nunca autorizam remoção; gera resultado `recovery-pending`.

## RepairEvent

| Field          | Type                                    | Rules                                          |
| -------------- | --------------------------------------- | ---------------------------------------------- |
| operationId    | UUID                                    | Obrigatório                                    |
| sequence       | integer                                 | Estritamente crescente por operação            |
| installationId | string?                                 | Presente em evento de item                     |
| phase          | TransactionState ou fase de diagnóstico | Canônico                                       |
| progress       | number?                                 | 0–1, nunca regressivo dentro da fase           |
| message        | string                                  | Seguro para UI                                 |
| error          | SerializableError?                      | Código, mensagem, detalhes seguros e retryable |
| timestamp      | datetime                                | UTC                                            |

## RepairReport

| Field                           | Type                                                              | Rules                                                  |
| ------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------ |
| reportId                        | UUID                                                              | Persistente                                            |
| operationId/planId/diagnosticId | UUID                                                              | Rastreabilidade                                        |
| device                          | identidade sem caminhos sensíveis desnecessários                  | Snapshot final                                         |
| result                          | `completed \| partial \| failed \| cancelled \| recovery-pending` | Agregado dos itens                                     |
| games                           | RepairGameReport[]                                                | Exatamente um por item planejado, incluído ou excluído |
| counts                          | mapa por RepairOutcome                                            | Soma igual ao total do relatório                       |
| startedAt/completedAt           | datetime                                                          | Auditoria                                              |
| limitations                     | string[]                                                          | Inclui verificação não disponível e resíduos           |

`RepairGameReport` contém identidade, estado anterior/final, outcome, hashes/tamanhos anterior/candidato/final, arquivos modificados, falhas, decisões de rollback e instruções de recuperação. Auxiliares preservados podem ser comprovados por fingerprints sem serem copiados.

## State Transitions

```text
planned
  -> preflight-validated
  -> staging
  -> candidate-verified
  -> commit-intent
  -> promoting
  -> active-validating
  -> committed
  -> cleanup-pending
  -> cleanup-complete

planned|preflight-validated|staging|candidate-verified
  -> aborted-unchanged

commit-intent|promoting|active-validating
  -> rollback-required
  -> rolling-back
  -> restored | recovery-pending

committed -> cleanup-pending -> cleanup-complete
```

Cancelamento antes de `commit-intent` aborta inalterado. Depois de `commit-intent`, cancelamento solicita rollback seguro. Recovery de startup nunca segue para `promoting`; restaura/preserva o original ou declara `recovery-pending`.

## Cross-Entity Invariants

1. Até `committed`, existe ao menos uma cópia integral e validada de todo arquivo afetado.
2. Nenhuma candidata recebe caminho ativo antes de `candidate-verified` e `commit-intent` durável.
3. Somente arquivos fragmentados e `ul.cfg` indispensável aparecem como modificáveis.
4. `ul.cfg` novo nunca referencia um conjunto parcial e é promovido por último.
5. Um lote possui no máximo uma transação de jogo ativa e revalida espaço entre itens.
6. Um resultado `corrected` exige hash/tamanho/estrutura válidos e novo extent `contiguous` no caminho ativo.
7. Diagnóstico, plano, operação e relatório conciliam a mesma identidade de instalação, nunca somente Game ID.
8. Todo relatório terminal repete o diagnóstico dos itens ainda acessíveis; item inacessível permanece sem estado final inferido e recebe limitação/recuperação explícita.
