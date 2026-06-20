import { ipcMain } from 'electron'
import type { GameLibraryEntry } from '../../src/types/opl'
import { detectGameId, getGameLibrary, saveGameLibraryEntry } from '../services/games/game-id.service'

export function registerGameIpc() {
  ipcMain.handle('games:detect-id', (_event, filePathOrName: string) => detectGameId(filePathOrName))
  ipcMain.handle('games:library:get', () => getGameLibrary())
  ipcMain.handle('games:library:save-entry', (_event, entry: GameLibraryEntry) => saveGameLibraryEntry(entry))
}
