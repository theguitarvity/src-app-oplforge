import { dialog, ipcMain } from 'electron'
import os from 'node:os'
import path from 'node:path'
import type { OpenPathDialogOptions } from '../../src/types/opl'
import { localFolderAuthorizations } from '../services/paths/local-folder-authorization.service'
import { ControlledError } from '../services/errors/controlled-error'
import { parseInput } from './schemas'

function isSystemRoot(candidatePath: string): boolean {
  const resolved = path.resolve(candidatePath)
  const home = path.resolve(os.homedir())
  return resolved === home || path.parse(resolved).root === resolved
}

function isWithinRoot(candidatePath: string, root: string): boolean {
  const resolvedRoot = path.resolve(root)
  const resolvedCandidate = path.resolve(candidatePath)
  return resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(resolvedRoot + path.sep)
}

export function registerDialogIpc() {
  ipcMain.handle('dialog:open-path', async (_event, options?: OpenPathDialogOptions) => {
    const properties: Array<'openFile' | 'openDirectory' | 'multiSelections'> = []
    if (options?.mode === 'folder') properties.push('openDirectory')
    else properties.push('openFile')
    if (options?.mode === 'multiFile') properties.push('multiSelections')

    const result = await dialog.showOpenDialog({
      properties,
      filters: options?.filters,
      defaultPath: options?.defaultPath
    })

    if (result.canceled) return []

    if (options?.restrictSystemRoots && result.filePaths.some((p) => isSystemRoot(p)))
      throw new ControlledError(
        'SYSTEM_ROOT_FORBIDDEN',
        'Não é possível selecionar a raiz do disco ou a pasta pessoal inteira. Escolha uma subpasta.'
      )

    if (options?.withinRoot && result.filePaths.some((p) => !isWithinRoot(p, options.withinRoot!)))
      throw new ControlledError(
        'OUTSIDE_ROOT_FORBIDDEN',
        'A pasta escolhida precisa estar dentro do dispositivo selecionado.'
      )

    return result.filePaths
  })
  ipcMain.handle('dialog:authorize-local-folder', async (_event, input: unknown) => {
    const parsed = parseInput('localFolderAuthorize', input)
    return localFolderAuthorizations.authorize(parsed.selectedPath)
  })
  ipcMain.handle('dialog:create-local-folder', async (_event, input: unknown) => {
    const parsed = parseInput('localFolderCreate', input)
    return localFolderAuthorizations.createChild(
      parsed.authorizationId,
      parsed.rootToken,
      parsed.folderName
    )
  })
}
