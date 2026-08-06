# IPC Contract: Fragmentation Repair

## Boundary

Todos os canais são registrados no processo principal, validados por schemas Zod estritos e expostos pelo preload como métodos nomeados de `OplApi`. O renderer fornece o dispositivo selecionado e identificadores opacos; não fornece caminhos internos de arquivos para staging, backup, promoção ou recuperação.

Erros rejeitam a Promise com `SerializableError`. Operações longas publicam eventos em `fragmentation-repair:event` com `operationId` e `sequence` monotônica.

## Shared constraints

- IDs: string não vazia, máximo 128 caracteres.
- Revisões: inteiro não negativo.
- Caminho do dispositivo: absoluto; é resolvido, confinado e revalidado no processo principal.
- `installationIds`: únicos, entre 1 e 500.
- Confirmação: literal `CORRIGIR FRAGMENTAÇÃO`.
- Inputs rejeitam propriedades desconhecidas.
- Planos e diagnósticos stale retornam `STALE_REVISION` sem escrita.

## Diagnose

### `fragmentation-repair:diagnose`

Request:

```ts
interface FragmentationDiagnoseInput {
  devicePath: string
  oplProfileId?: string
}
```

Response: `Promise<FragmentationDiagnostic>`.

Behavior:

1. Resolve e identifica o dispositivo.
2. Inicia probe da capacidade e inventário somente leitura.
3. Publica eventos de progresso.
4. Persiste o snapshot terminal.
5. Não cria qualquer arquivo no dispositivo.

Errors: `INVALID_INPUT`, `INVALID_DEVICE_ROOT`, `DEVICE_CHANGED`, `DEVICE_INACCESSIBLE`, `CANCELLED`, `DIAGNOSTIC_FAILED`.

### `fragmentation-repair:cancel-diagnosis`

Request: `{ operationId: string }`.

Response: `Promise<void>`.

Cancelamento é idempotente. Diagnóstico já terminal permanece inalterado.

## Plan

### `fragmentation-repair:plan`

Request:

```ts
interface FragmentationRepairPlanInput {
  diagnosticId: string
  expectedRevision: number
  mode: 'single' | 'batch'
  installationIds?: string[]
}
```

Rules:

- `single`: exatamente um `installationId`.
- `batch`: ausência de IDs seleciona todos os itens elegíveis; IDs presentes restringem o lote.
- O processo principal recupera caminhos e arquivos do diagnóstico persistido.
- Estados `incomplete`, `invalid` e `unverifiable` viram exclusões, nunca itens executáveis.
- Pico temporário é o maior requisito individual porque o lote é sequencial; cada item requer bytes das candidatas mais `max(64 MiB, 2% desses bytes)` e toda cópia adicional que não seja rename.

Response: `Promise<RepairPlan>`.

Errors: `DIAGNOSTIC_NOT_FOUND`, `STALE_REVISION`, `NO_ELIGIBLE_GAMES`, `DEVICE_CHANGED`, `CAPABILITY_UNAVAILABLE`, `INVALID_SELECTION`.

## Confirm and execute

### `fragmentation-repair:confirm`

Request:

```ts
interface FragmentationRepairConfirmation {
  planId: string
  expectedRevision: number
  confirmation: 'CORRIGIR FRAGMENTAÇÃO'
}
```

Response: `Promise<RepairOperation>` após aceitar e iniciar a operação. Progresso e término chegam por eventos e consultas.

Preconditions under device lock:

- plano existe, aguarda confirmação e não foi consumido;
- revisão, dispositivo, volume, paths e fingerprints ainda coincidem;
- capacidade física continua suportada/homologada;
- fontes podem ser lidas e não estão bloqueadas;
- espaço cobre candidato, backup e margem do primeiro item.

Errors before writing: `PLAN_NOT_FOUND`, `PLAN_ALREADY_USED`, `CONFIRMATION_REQUIRED`, `STALE_REVISION`, `DEVICE_CHANGED`, `SOURCE_CHANGED`, `FILE_LOCKED`, `INSUFFICIENT_SPACE`, `CAPABILITY_UNAVAILABLE`.

### `fragmentation-repair:cancel`

Request: `{ operationId: string }`.

Response: `Promise<void>`.

Behavior:

- Antes de `commit-intent`: marca cancelamento e aborta inalterado.
- Depois de `commit-intent`: solicita rollback seguro; não interrompe entre renames deixando estado arbitrário.
- Idempotente em estado terminal.

### `fragmentation-repair:get-operation`

Request: `{ operationId: string }`.

Response: `Promise<RepairOperation | undefined>`.

### `fragmentation-repair:get-report`

Request: `{ reportId: string }`.

Response: `Promise<RepairReport | undefined>`. Um relatório terminal só contém estado final comprovado depois de novo diagnóstico dos itens acessíveis; itens inacessíveis incluem limitação e recuperação sem inferência de sucesso.

### `fragmentation-repair:get-report-by-operation`

Request: `{ operationId: string }`.

Response: `Promise<RepairReport | undefined>`.

## Recovery

### `fragmentation-repair:list-recovery`

Request: `{ deviceId?: string }`.

Response:

```ts
interface RecoveryItem {
  journalId: string
  revision: number
  operationId: string
  installationId: string
  deviceId: string
  state: 'restored' | 'recovery-pending' | 'cleanup-pending'
  instructions: string[]
  updatedAt: string
}
```

Este canal é somente leitura. Recovery automático pode apenas preservar/restaurar a versão original. Candidatas nunca são retomadas ou promovidas.

### `fragmentation-repair:resolve-recovery`

Request:

```ts
interface ResolveRecoveryInput {
  journalId: string
  expectedRevision: number
  action: 'restore-original' | 'clean-verified-residue'
  confirmation: 'RECUPERAR JOGO'
}
```

Response: `Promise<RecoveryItem>`.

`clean-verified-residue` só remove arquivo provado como não sendo a última versão válida. Estado ambíguo ou journal corrompido retorna `MANUAL_RECOVERY_REQUIRED` sem remoção.

## Event contract

Preload method:

```ts
onFragmentationRepairEvent(
  callback: (event: RepairEvent) => void
): () => void
```

O retorno remove exatamente o listener instalado.

Event payload:

```ts
interface RepairEvent {
  operationId: string
  sequence: number
  installationId?: string
  phase: string
  progress?: number
  message: string
  timestamp: string
  error?: SerializableError
}
```

Eventos fora de ordem são ignorados pela UI. A UI consulta `get-operation` após reconexão; eventos não são a fonte autoritativa de recovery.

## Error codes

| Code                     | Retryable | Meaning                                          |
| ------------------------ | --------- | ------------------------------------------------ |
| INVALID_INPUT            | false     | Schema ou combinação de campos inválida          |
| INVALID_DEVICE_ROOT      | false     | Alvo não é root suportado                        |
| DEVICE_CHANGED           | true      | Mount/volume não coincide mais                   |
| DEVICE_INACCESSIBLE      | true      | Dispositivo removido ou inacessível              |
| CAPABILITY_UNAVAILABLE   | false     | Extents não podem ser provados neste volume      |
| DIAGNOSTIC_NOT_FOUND     | false     | Snapshot ausente                                 |
| STALE_REVISION           | true      | Diagnóstico/plano/device mudou                   |
| INVALID_SELECTION        | false     | Seleção não atende modo/regras                   |
| NO_ELIGIBLE_GAMES        | false     | Nenhum alvo corrigível                           |
| CONFIRMATION_REQUIRED    | false     | Literal incorreto/ausente                        |
| PLAN_ALREADY_USED        | false     | Replay de plano                                  |
| SOURCE_CHANGED           | true      | Fingerprint/hash mudou                           |
| FILE_LOCKED              | true      | Origem ou destino em uso                         |
| INSUFFICIENT_SPACE       | true      | Espaço revalidado insuficiente                   |
| HASH_MISMATCH            | true      | Candidata/ativo divergiu                         |
| STRUCTURE_INVALID        | false     | Estrutura candidata inválida                     |
| STILL_FRAGMENTED         | true      | Candidata permanece não contígua                 |
| CANCELLED                | true      | Usuário cancelou                                 |
| ROLLBACK_FAILED          | false     | Original não pôde ser restaurado automaticamente |
| MANUAL_RECOVERY_REQUIRED | false     | Estado ambíguo exige instrução manual            |

## OplApi additions

```ts
interface OplApi {
  diagnoseFragmentation(input: FragmentationDiagnoseInput): Promise<FragmentationDiagnostic>
  cancelFragmentationDiagnosis(operationId: string): Promise<void>
  planFragmentationRepair(input: FragmentationRepairPlanInput): Promise<RepairPlan>
  confirmFragmentationRepair(input: FragmentationRepairConfirmation): Promise<RepairOperation>
  cancelFragmentationRepair(operationId: string): Promise<void>
  getFragmentationRepairOperation(operationId: string): Promise<RepairOperation | undefined>
  getFragmentationRepairReport(reportId: string): Promise<RepairReport | undefined>
  getFragmentationRepairReportByOperation(operationId: string): Promise<RepairReport | undefined>
  listFragmentationRecovery(deviceId?: string): Promise<RecoveryItem[]>
  resolveFragmentationRecovery(input: ResolveRecoveryInput): Promise<RecoveryItem>
  onFragmentationRepairEvent(callback: (event: RepairEvent) => void): () => void
}
```

## Security contract tests

- Rejeitar caminho relativo, traversal, symlink escape e propriedades extras.
- Rejeitar IDs vazios, revisões negativas, seleção duplicada e confirmação divergente.
- Provar que preload não expõe IPC genérico ou filesystem.
- Provar resolução server-side de installation IDs e caminhos.
- Provar que eventos e erros não contêm conteúdo de jogo, tokens ou caminhos absolutos desnecessários.
