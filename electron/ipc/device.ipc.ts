import { ipcMain } from 'electron'
import { getDeviceSummary, listDevices } from '../services/device.service'

export function registerDeviceIpc() {
  ipcMain.handle('devices:list', () => listDevices())
  ipcMain.handle('devices:summary', (_event, devicePath?: string) => getDeviceSummary(devicePath))
}
