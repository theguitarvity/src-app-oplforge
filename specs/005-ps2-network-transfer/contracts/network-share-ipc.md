# IPC Contract: PS2 Network Library Sharing

## Boundary

Todos os canais são registrados no processo principal (`electron/ipc/network-share.ipc.ts`), validados por schemas Zod estritos (`electron/ipc/schemas.ts`) e expostos pelo preload como métodos nomeados de `OplApi`. O renderer nunca recebe nem manipula sockets ou portas do SO — mas, diferente de outras superfícies desta feature, ele **é** a fonte de verdade de _qual_ dispositivo compartilhar: o processo principal nunca tenta redescobrir "o" dispositivo sozinho (isso já causou um bug real — ver Nota de Design abaixo). O renderer envia o `libraryRootPath` do dispositivo já ativo em `useDeviceStore`, igual a todo outro fluxo desta base (`copyGame`, `runDiagnostics`, etc.).

> **Nota de Design (pós-implementação)**: a v1 desta feature tentava resolver o dispositivo a compartilhar chamando `listDevices()` de dentro do processo principal, independente do dispositivo que o usuário já tinha selecionado na tela Dispositivos. Isso causava `LIBRARY_STRUCTURE_INVALID`/dispositivo errado sempre que a heurística de auto-descoberta não escolhia o mesmo dispositivo do resto do app. Corrigido tornando `libraryRootPath` um campo explícito de `SaveNetworkShareConfigInput`, preenchido pelo renderer a partir de `useDeviceStore().activeDevice.path`.

Erros rejeitam a Promise com `SerializableError`. Mudanças de estado publicam eventos em `network-share:event` (ver `data-model.md` → `NetworkShareEvent`), seguindo o mesmo padrão de `onDownloadProgress`/`onFragmentationRepairEvent` já existente na base.

## Shared constraints

- `username`/`password`: string não vazia quando qualquer protocolo está habilitado (FR-010). Senha nunca é logada nem incluída em `HistoryEntry`/logs (Constitution Principle IV).
- `enabledProtocols`: subconjunto não vazio de `['smb', 'ftp']` para iniciar o serviço.
- `libraryRootPath`: caminho absoluto do dispositivo ativo no momento (`useDeviceStore().activeDevice.path` no renderer) — enviado explicitamente em `save-config`, não redescoberto pelo processo principal.
- Toda porta MUST estar livre no momento do start; conflito retorna `PORT_IN_USE` com a porta específica na mensagem (FR-008).
- Conexões cuja origem não esteja em `10.0.0.0/8`, `172.16.0.0/12` ou `192.168.0.0/16` MUST ser rejeitadas antes de qualquer negociação de protocolo (FR-006).
- Tentativas de autenticação SMB/FTP inválidas MUST retornar uma mensagem genérica única (sem indicar se usuário ou senha estava errado) e MUST NOT aparecer na lista de `ConnectedClient` (FR-015).

## Configure

### `network-share:get-config`

Response: `Promise<NetworkShareConfig>` — configuração persistida atual (sem retornar a senha em texto puro; campo `password` omitido/mascarado na resposta, escrita é write-only).

### `network-share:save-config`

Request:

```ts
interface SaveNetworkShareConfigInput {
  libraryRootPath: string // caminho absoluto do dispositivo ativo — obrigatório
  enabledProtocols: ('smb' | 'ftp')[]
  shareName: string
  username: string
  password?: string // omitido = mantém a senha atual
  smbPort?: number
  ftpPort?: number
  autoStartOnLaunch: boolean
}
```

Trocar de dispositivo (um `libraryRootPath` diferente do salvo anteriormente) revoga o reconhecimento de acesso de escrita (FR-014) — o usuário precisa confirmar de novo para o novo dispositivo.

Response: `Promise<NetworkShareConfig>` (sem senha).

Errors: `INVALID_INPUT`.

### `network-share:acknowledge-write-access`

Request: `{}`.

Response: `Promise<NetworkShareConfig>` — grava `writeAccessAcknowledgedAt` (FR-014). Chamado uma única vez, antes do primeiro `network-share:start`, a partir do diálogo de confirmação explícita exibido na UI (distinto do formulário de usuário/senha).

## Start / Stop

### `network-share:start`

Request: `{}` (usa a config salva).

Response: `Promise<NetworkShareStatus>`.

Behavior:

1. Valida que a config salva tem um `libraryRootPath` não vazio; caso contrário retorna `DEVICE_NOT_SELECTED` (nenhum dispositivo foi escolhido ainda na tela de compartilhamento).
2. Valida que esse caminho ainda existe e contém ao menos uma pasta OPL esperada; caso contrário retorna `LIBRARY_STRUCTURE_INVALID` sem iniciar nenhum listener (dispositivo foi removido/trocado desde a última configuração).
3. Faz bind somente no(s) endereço(s) de rede local do host (R5) — nunca `0.0.0.0`.
4. Inicia cada protocolo habilitado de forma independente; falha em um não impede o outro (ex.: porta SMB ocupada não bloqueia o FTP).
5. Publica `network-share:event` a cada mudança de `ProtocolStatus`.

Errors: `DEVICE_NOT_SELECTED`, `LIBRARY_STRUCTURE_INVALID`, `PORT_IN_USE`, `BIND_FAILED`, `ALREADY_RUNNING`, `WRITE_ACCESS_NOT_ACKNOWLEDGED` (FR-014 — `writeAccessAcknowledgedAt` not set; call `network-share:acknowledge-write-access` first).

### `network-share:stop`

Request: `{}`.

Response: `Promise<NetworkShareStatus>`.

Behavior: para ambos os protocolos, encerra conexões ativas de forma limpa, e MUST ser chamado automaticamente no `before-quit` do app (FR-007/US3 cenário 3) independentemente de o usuário ter chamado explicitamente.

## Status

### `network-share:get-status`

Response: `Promise<NetworkShareStatus>` — snapshot atual sob demanda (além dos eventos push), para quando a UI monta depois do serviço já estar rodando.

### Evento `network-share:event`

Payload: `NetworkShareEvent` (ver `data-model.md`). Emitido em: start/stop/erro de qualquer protocolo, conexão/desconexão de cliente, mudança de atividade do cliente, e conflito de escrita (FR-013).

## Setup Tutorial

### `network-share:get-setup-instructions`

Request: `{ protocol: 'smb' | 'ftp' }`.

Response:

```ts
interface SetupInstructions {
  protocol: 'smb' | 'ftp'
  steps: Array<{ label: string; value: string }> // ex.: [{label: 'Endereço', value: '192.168.15.20'}, ...]
  oplMenuPath: string[] // ex.: ['Configurações', 'Configurações de Rede', 'Servidor SMB']
}
```

Gera os valores atuais (endereço vinculado, porta, usuário/senha configurados) formatados para exibição direta no tutorial guiado (FR-012) — não requer que o usuário monte isso manualmente a partir do status bruto.

Errors: `SERVICE_NOT_RUNNING` (não há endereço/porta vinculados para mostrar até o serviço estar ativo).
