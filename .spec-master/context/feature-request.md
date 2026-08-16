# Contexto da feature: Preparar/validar estrutura OPL em qualquer dispositivo ou pasta local

## Pedido original do usuário

"Precisamos da opção de preparar dispositivo OPL em qualquer dispositivo selecionado. Ao
selecionar uma pasta local ou um dispositivo, validar se o mesmo possui a estrutura de pastas
que o OPL (Open PS2 Loader) espera para reconhecer jogos/dados (ex: pastas DVD, CD, APPS, ART,
CFG, CHT, LNG, THM, VMC, langs, etc). Se a estrutura não existir, oferecer a opção de
'preparar' o dispositivo, criando a estrutura de pastas esperada pelo OPL automaticamente."

## Estado atual do código (DISCOVERED_FROM_CODEBASE)

Levantamento no repositório mostrou que grande parte do fluxo já existe:

- `electron/services/device.service.ts:10` define `OPL_DIRS = ['DVD','CD','PS1','APPS','ART','CFG','VMC']`
  e `hasOplStructure()` (linhas 44-56) verifica se cada pasta existe, definindo
  `DeviceInfo.status` como `'ready'` ou `'missing-structure'` (linhas 26-38).
- `electron/services/diagnostics/device-diagnostic.service.ts:17-27` também itera `OPL_DIRS` e
  emite achados `OPL_DIRECTORY_MISSING` por pasta ausente.
- `electron/services/file.service.ts:77-91` (`prepareDevice`) já cria todas as `OPL_DIRS` e
  grava um README — fluxo ponta a ponta via IPC `files:prepare-device`
  (`electron/ipc/file.ipc.ts:15,57`), preload (`electron/preload.ts:151`), API do renderer
  (`src/services/api.ts:108`, `oplApi.prepareDevice`), tipos (`src/types/opl.ts:1279`,
  `prepareDevice(input: PrepareDeviceInput)`), e UI (`src/components/device/PrepWizard.tsx`,
  wizard de 5 passos, e `src/pages/PreparePage.tsx`).
- `device.service.ts:151-185` (`getDeviceSummary`) já aceita um `devicePath` arbitrário (não
  precisa estar na lista de dispositivos auto-detectados) e distingue `sourceKind:
'opl-device' | 'local-folder'` — mas hoje esse `sourceKind` é derivado apenas de
  `hasOplStructure`, não de uma escolha explícita do usuário entre "dispositivo" e "pasta
  local".

## Gaps confirmados (decisão do usuário via AskUserQuestion)

Escopo definido: **estender o fluxo existente**, não recriar do zero.

1. **Seleção de pasta local arbitrária**: `PrepWizard.tsx` (linhas 28-31, 104-148) hoje só lista
   dispositivos auto-detectados via `oplApi.listDevices()` (montagens USB/HD). Não há opção de
   abrir um diálogo do SO para escolher qualquer pasta local. Isso precisa ser adicionado —
   incluindo o handler Electron (`dialog.showOpenDialog` no main process) e a integração com o
   fluxo de validação/preparo já existente.
2. **Estrutura de pastas incompleta**: `OPL_DIRS` (`device.service.ts:10`) e a lista exibida em
   `PrepWizard.tsx:191` (`DVD / CD / PS1 / APPS / ART / CFG / VMC`) não incluem `CHT`, `LNG`,
   `THM` — pastas que o usuário explicitamente pediu para reconhecer. `LANG`/`langs` mencionado
   pelo usuário deve ser mapeado para a pasta real esperada pelo OPL (`LANG`) — confirmar contra
   documentação/uso real do OPL durante a fase de `clarify`/`plan`, não assumir sem verificação.
3. **UX de validação antes de oferecer "preparar"**: quando a pasta/dispositivo selecionado já
   possui a estrutura completa (`status: 'ready'`), a UI deve mostrar esse resultado como
   "validado/pronto" e não conduzir o usuário pelo wizard de preparação (que hoje sempre pede
   confirmação de "gravação no dispositivo" mesmo quando nada precisa ser escrito). O wizard de
   preparação só deve ser oferecido quando a validação encontrar estrutura ausente ou parcial.

## Fora de escopo

- Reescrever `prepareDevice`/`hasOplStructure`/o wizard do zero.
- Qualquer lógica de importação de jogos, artes, fragmentação — não faz parte deste pedido
  (tratado em specs 001-006 já existentes, sem sobreposição confirmada).

## Fontes normalizadas existentes

- `stakeholder-documents/context.md`, `featuremap.md`, `techstack.md` já descrevem a
  "Preparação de dispositivo" como funcionalidade existente (seção 3 do featuremap) — este
  pedido é uma extensão/correção dessa funcionalidade, não uma nova área de produto.
