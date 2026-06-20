import { dialog, ipcMain } from 'electron'
import type { OpenPathDialogOptions } from '../../src/types/opl'

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
}
