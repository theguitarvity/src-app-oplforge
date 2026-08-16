# API Contracts: Preparar OPL em qualquer dispositivo ou pasta local

Nenhum canal IPC novo é criado. Contratos existentes reutilizados:

## `oplApi.openPathDialog(options?: OpenPathDialogOptions): Promise<string[]>`

Já existente (`src/types/opl.ts:1313`, `electron/preload.ts:196-197`,
`electron/ipc/dialog.ipc.ts:7-19`), reutilizado por 10+ pontos da UI. Usado com
`{ mode: 'folder' }` para abrir o diálogo nativo de seleção de diretório. Retorna `[]` se
cancelado, ou `[caminhoEscolhido]`.

**Extensão desta feature (aditiva, opt-in)**: novo campo `restrictSystemRoots?: boolean` em
`OpenPathDialogOptions`. Apenas `PrepWizard.tsx` passa `restrictSystemRoots: true`; os demais
call sites (`SourcesPage`, `Ps2ImportPage`, `DevicesPage`, `ReorganizationWizard`,
`ReadinessReportView`, `LocalLibraryChooser`, `EssentialsCatalogPage`, `GameDetailDrawer`,
`ValidationPage`) continuam sem esse campo e mantêm o comportamento atual inalterado. Quando
`restrictSystemRoots: true` e o caminho escolhido for uma raiz de disco ou a home completa do
usuário, o handler rejeita a chamada com um `ControlledError` (`electron/services/errors/
controlled-error.ts`, mesmo padrão já usado em `local-folder-authorization.service.ts`), com
código `SYSTEM_ROOT_FORBIDDEN` e mensagem explicativa — o chamador (`PrepWizard.tsx`) captura o
erro e exibe a mensagem, distinguindo esse caso de um cancelamento normal do diálogo
(`[]`).

## `oplApi.listDevices(): Promise<DeviceInfo[]>`

Já existente. Continua listando apenas dispositivos auto-detectados (sem mudança de contrato).

## `oplApi.listDevices()` / `oplApi.getDeviceSummary` — `DeviceInfo.isOutsideHome`

`DeviceInfo` (`src/types/opl.ts:663-673`) ganha o campo opcional `isOutsideHome?: boolean`,
calculado no processo principal (`statDevice`, que já tem acesso a `os.homedir()`). O renderer
usa esse campo — não `openPathDialog` — para decidir se exibe a confirmação extra de FR-010,
evitando expor `os.homedir()` diretamente ao renderer ou alterar o contrato de
`openPathDialog`.

## `oplApi.prepareDevice(input: PrepareDeviceInput): Promise<HistoryEntry>`

Já existente (`src/types/opl.ts:780,1279`, `electron/ipc/file.ipc.ts:15,57`). `devicePath` passa
a poder ser tanto um `DeviceInfo.path` de um dispositivo auto-detectado quanto um caminho
retornado por `openPathDialog` — nenhuma mudança de assinatura necessária, apenas a UI passa a
alimentar esse mesmo input a partir de duas origens.

## Resumo das duas checagens de path (nenhum novo canal IPC)

1. **Bloqueio de raiz** (FR-009): feito dentro do handler `dialog:open-path`, opt-in via
   `restrictSystemRoots: true` — só afeta a seleção feita pelo `PrepWizard`.
2. **Confirmação extra fora da home** (FR-010): feito via `DeviceInfo.isOutsideHome`, já
   calculado por `getDeviceSummary`/`statDevice` quando a pasta escolhida é resolvida para um
   `DeviceInfo` — nenhuma checagem adicional no renderer.
