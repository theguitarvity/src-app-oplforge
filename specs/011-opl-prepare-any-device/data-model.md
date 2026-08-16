# Data Model: Preparar OPL em qualquer dispositivo ou pasta local

Nenhuma nova entidade persistente é introduzida. Esta feature estende entidades e constantes já
existentes.

## `OPL_DIRS` (constante, `electron/services/device.service.ts`)

Antes: `['DVD', 'CD', 'PS1', 'APPS', 'ART', 'CFG', 'VMC']`

Depois: `['DVD', 'CD', 'PS1', 'APPS', 'ART', 'CFG', 'VMC', 'CHT', 'LNG', 'THM']`

Usada por: `hasOplStructure` (validação), `prepareDevice` (criação),
`device-diagnostic.service.ts` (diagnóstico `OPL_DIRECTORY_MISSING`), UI (`PrepWizard.tsx`,
lista exibida).

## `DeviceInfo` (`src/types/opl.ts:663-673`)

Ganha um campo opcional aditivo: `isOutsideHome?: boolean`, calculado em `statDevice`
(`electron/services/device.service.ts:20-42`) comparando `candidate.path` resolvido contra
`os.homedir()`. Continua com `status: DeviceStatus` (`'ready' | 'missing-structure' |
'readonly' | 'unknown'`) e `sourceKind?: 'opl-device' | 'local-folder'`. Uma pasta local
escolhida manualmente via `openPathDialog` é convertida no mesmo shape via
`getDeviceSummary(devicePath)` → `statDevice`, já trazendo `isOutsideHome` calculado no processo
principal (onde `os.homedir()` está disponível) — o renderer não precisa calculá-lo.

## `OpenPathDialogOptions` (`src/types/opl.ts:1338-1341`)

Novo campo opt-in, sem quebrar os 10+ call sites existentes:

```ts
export interface OpenPathDialogOptions {
  mode?: 'file' | 'folder' | 'multiFile'
  filters?: Array<{ name: string; extensions: string[] }>
  restrictSystemRoots?: boolean // novo — só usado por PrepWizard.tsx (US2)
}
```

## Regra de proteção de caminho (nova, não persistida)

Verificação em memória, executada no handler `dialog:open-path` **somente quando
`restrictSystemRoots: true`** for passado pelo chamador:

- `isForbiddenRoot(path)`: verdadeiro se `path` resolvido for igual à raiz do disco (`/`,
  `C:\`, etc.) ou igual a `os.homedir()`.
- `isOutsideHome(path)`: verdadeiro se `path` resolvido não estiver contido em `os.homedir()`;
  usado no renderer (Passo 3 do wizard) para decidir se exige a confirmação extra.

Nenhuma dessas verificações é persistida — são calculadas a cada seleção/preparo, e não afetam
nenhum outro chamador de `openPathDialog` que não passe `restrictSystemRoots: true`.
