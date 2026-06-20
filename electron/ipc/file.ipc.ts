import { ipcMain } from 'electron'
import type { AppInstallInput, GameImportInput, PrepareDeviceInput, Ps1ImportInput } from '../../src/types/opl'
import { copyGame, copyPs1Game, installApp, prepareDevice, removeApp } from '../services/file.service'

export function registerFileIpc() {
  ipcMain.handle('files:prepare-device', (_event, input: PrepareDeviceInput) => prepareDevice(input.devicePath))
  ipcMain.handle('files:copy-game', (_event, input: GameImportInput) => copyGame(input))
  ipcMain.handle('files:copy-ps1-game', (_event, input: Ps1ImportInput) => copyPs1Game(input))
  ipcMain.handle('files:install-app', (_event, input: AppInstallInput) => installApp(input))
  ipcMain.handle('files:remove-app', (_event, devicePath: string, appName: string) => removeApp(devicePath, appName))
}
