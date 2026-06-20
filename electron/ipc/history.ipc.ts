import { ipcMain } from 'electron'
import { clearHistory, getHistory } from '../services/history.service'

export function registerHistoryIpc() {
  ipcMain.handle('history:get', () => getHistory())
  ipcMain.handle('history:clear', () => clearHistory())
}
