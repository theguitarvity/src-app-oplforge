import { ipcMain } from 'electron'
import { getDeviceSummary, listDevices } from '../services/device.service'
import { DeviceDiagnosticService } from '../services/diagnostics/device-diagnostic.service'
import { getCatalogService } from '../services/catalog/catalog-runtime'
import { getOplProfileService } from './opl.ipc'
import { parseInput } from './schemas'

const diagnostics = new DeviceDiagnosticService(getCatalogService())

export function registerDeviceIpc() {
  ipcMain.handle('devices:list', () => listDevices())
  ipcMain.handle('devices:summary', (_event, devicePath?: string) => getDeviceSummary(devicePath))
  ipcMain.handle(
    'diagnostics:run',
    async (_event, input: { devicePath: string; oplProfileId?: string; fileSystem?: string }) => {
      const parsed = parseInput('catalogScan', input)
      const profile = parsed.oplProfileId
        ? await getOplProfileService().get(parsed.oplProfileId)
        : undefined
      return diagnostics.run(parsed.devicePath, profile, input.fileSystem)
    }
  )
}
