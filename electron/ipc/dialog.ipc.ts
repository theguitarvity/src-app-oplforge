import { dialog, ipcMain } from 'electron'
import type { OpenPathDialogOptions } from '../../src/types/opl'
import { localFolderAuthorizations } from '../services/paths/local-folder-authorization.service'
import { parseInput } from './schemas'

export function registerDialogIpc() {
  ipcMain.handle('dialog:open-path', async (_event, options?: OpenPathDialogOptions) => {
    const properties: Array<'openFile' | 'openDirectory' | 'multiSelections'> = []
    if (options?.mode === 'folder') properties.push('openDirectory')
    else properties.push('openFile')
    if (options?.mode === 'multiFile') properties.push('multiSelections')

    const result = await dialog.showOpenDialog({
      properties,
      filters: options?.filters
    })

    return result.canceled ? [] : result.filePaths
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
