# Phase 0 Research: Preparar OPL em qualquer dispositivo ou pasta local

## R1 — Como já existe seleção de pasta local no projeto?

**Decisão**: Reutilizar o canal IPC genérico já existente `dialog:open-path`
(`electron/ipc/dialog.ipc.ts:6-19`), chamado via `oplApi.openPathDialog({ mode: 'folder' })`
(`electron/preload.ts:196-197`, `src/types/opl.ts:1313`), já implementado ponta a ponta
(preload real; `src/services/api.ts:142` só tem o stub de teste/mocked API).

**Rationale**: Esse canal já abre `dialog.showOpenDialog` com `properties: ['openDirectory']`
quando `mode: 'folder'`, e retorna o(s) caminho(s) escolhido(s) ou `[]` se cancelado — exatamente
o que a User Story 2 pede. Criar um novo canal duplicaria funcionalidade já testada.

**Alternativas rejeitadas**:

- Criar canal IPC dedicado `files:pick-local-folder` — rejeitado por duplicar `dialog:open-path`
  sem necessidade.
- Usar o fluxo de `LocalFolderAuthorizationService` (`electron/services/paths/
local-folder-authorization.service.ts`) — esse serviço resolve um problema diferente
  (autorização revogável e confinamento de escrita para o `LocalFolderProvider`, usado na
  importação de arquivos de fontes locais, feature #6 do featuremap). Preparo/validação de
  dispositivo já usa caminho absoluto direto (`devicePath`) em todo o fluxo existente
  (`prepareDevice(devicePath)`, `getDeviceSummary(devicePath)`), então introduzir tokens de
  autorização aqui criaria dois modelos de confiança para pastas locais no mesmo produto. Fica
  fora de escopo — não reaproveitado nesta feature.

## R2 — Onde adicionar CHT/LNG/THM sem duplicar a lista de pastas

**Decisão**: `OPL_DIRS` já é exportado de `electron/services/device.service.ts:10,187`
(`export { OPL_DIRS }`). `electron/services/diagnostics/device-diagnostic.service.ts:17-27` e
`electron/services/file.service.ts` (`prepareDevice`) devem importar essa mesma constante em vez
de manter listas próprias.

**Rationale**: Fonte única de verdade evita duplicação de lista, conforme já sinalizado na
constituição (`Restrições Técnicas e de Produto`, agora emendada para v1.1.0) e no
`tech-stack.md` desta feature.

**Verificação necessária**: confirmar, ao editar `device-diagnostic.service.ts` e
`file.service.ts`, que ambos já importam ou podem importar de `device.service.ts` sem criar
dependência circular (ambos já importam tipos de `src/types/opl`, não um do outro hoje).

## R3 — Como evitar o wizard de gravação quando já está pronto

**Decisão**: `DeviceInfo.status` (`src/types/opl.ts:663-673`) já distingue `'ready'` vs
`'missing-structure'`. `PrepWizard.tsx` deve consultar esse status assim que o
dispositivo/pasta é selecionado (Passo 1) e, se `status === 'ready'`, pular direto para uma tela
de resultado "pronto" em vez de avançar pelos Passos 2-4 (configuração de filesystem,
confirmação de gravação, execução).

**Rationale**: Não introduz novo campo de estado; reaproveita a classificação já calculada por
`hasOplStructure`/`statDevice`.

## R4 — Proteção contra seleção de diretório raiz do sistema

**Decisão**: `dialog:open-path` (`electron/ipc/dialog.ipc.ts:7-19`) é um canal genérico
reutilizado por pelo menos 10 outros pontos da UI (`SourcesPage.tsx`, `Ps2ImportPage.tsx`,
`DevicesPage.tsx`, `ReorganizationWizard.tsx`, `ReadinessReportView.tsx`,
`LocalLibraryChooser.tsx`, `EssentialsCatalogPage.tsx`, `GameDetailDrawer.tsx`,
`ValidationPage.tsx`), nenhum deles relacionado a preparo de dispositivo. Aplicar o bloqueio de
raiz diretamente no handler afetaria todos esses fluxos sem relação com esta feature — violaria
o princípio de escopo mínimo coerente da constituição.

Em vez disso, `OpenPathDialogOptions` (`src/types/opl.ts:1338-1341`) ganha um campo opt-in
`restrictSystemRoots?: boolean`. Quando `true`, o handler `dialog:open-path` aplica a checagem de
raiz proibida (raiz do disco ou `os.homedir()` completo) e retorna `[]` com um motivo de rejeição
sinalizado (ver `contracts/opl-api.md`) em vez do caminho. Apenas o novo call site em
`PrepWizard.tsx` (US2) passa `restrictSystemRoots: true`; todos os outros 10 call sites
existentes continuam sem esse campo (comportamento inalterado, `undefined` = sem restrição).

Confirmação extra fora da home continua resolvida no renderer, no momento de "preparar" (Passo 3
do wizard), usando a mesma informação de `homeDir` retornada pelo handler quando
`restrictSystemRoots` é usado.

**Rationale**: Atende às respostas de clarificação do usuário (bloquear raiz + confirmação extra
fora da home) sem alterar o comportamento de nenhum outro fluxo que reutiliza o canal genérico —
mudança aditiva e opt-in, consistente com o Princípio V (escopo mínimo coerente) da constituição.

## R5 — Plataformas

**Decisão**: Nenhuma lógica nova depende de plataforma. `dialog.showOpenDialog` e `fs.mkdir` já
funcionam de forma uniforme em Windows/macOS/Linux através do Electron/Node; a detecção de
dispositivos auto-detectados já é por plataforma (`device.service.ts:58-104`) e não muda nesta
feature.
