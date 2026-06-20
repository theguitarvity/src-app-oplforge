import { ipcMain, shell } from 'electron'
import { promises as fs } from 'node:fs'
import type { TorrentInput } from '../../src/types/opl'
import { p2pDownloadService } from '../services/downloads/p2p-download.service'

export function registerDownloadIpc() {
  ipcMain.handle('downloads:add-p2p', (_event, input: TorrentInput) => p2pDownloadService.addTorrent(input))
  ipcMain.handle('downloads:pause', (_event, taskId: string) => p2pDownloadService.pause(taskId))
  ipcMain.handle('downloads:resume', (_event, taskId: string) => p2pDownloadService.resume(taskId))
  ipcMain.handle('downloads:cancel', (_event, taskId: string) => p2pDownloadService.cancel(taskId))
  ipcMain.handle('downloads:queue', () => p2pDownloadService.getQueue())
  ipcMain.handle('downloads:progress', (_event, taskId: string) => p2pDownloadService.getProgress(taskId))
  ipcMain.handle('downloads:torrent-files', (_event, taskId: string) => p2pDownloadService.listTorrentFiles(taskId))
  ipcMain.handle('downloads:select-files', (_event, taskId: string, fileNames: string[]) =>
    p2pDownloadService.selectFiles(taskId, fileNames)
  )
  ipcMain.handle('downloads:start', (_event, taskId: string, destinationPath: string) =>
    p2pDownloadService.start(taskId, destinationPath)
  )
  ipcMain.handle('shell:open-folder', async (_event, folderPath: string) => {
    const stat = await fs.stat(folderPath)
    if (!stat.isDirectory()) throw new Error('O caminho informado nao e uma pasta.')
    const error = await shell.openPath(folderPath)
    if (error) throw new Error(error)
  })
}
