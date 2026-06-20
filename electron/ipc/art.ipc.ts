import { ipcMain } from 'electron'
import { indexOplmArt, installArtForGame, syncDvdArts } from '../services/art/oplm-art.service'

export function registerArtIpc() {
  ipcMain.handle('art:index-oplm', () => indexOplmArt())
  ipcMain.handle('art:install-for-game', (_event, devicePath: string, gameId: string, title?: string) =>
    installArtForGame(devicePath, gameId, title)
  )
  ipcMain.handle('art:sync-dvd', (_event, devicePath: string) => syncDvdArts(devicePath))
}
