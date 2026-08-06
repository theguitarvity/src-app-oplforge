import { app, ipcMain } from 'electron'
import type {
  AppInstallInput,
  GameImportInput,
  InstallationPlanInput,
  OperationConfirmation,
  PrepareDeviceInput,
  Ps1ImportInput
} from '../../src/types/opl'
import {
  copyGame,
  copyPs1Game,
  installApp,
  listInstalledApps,
  prepareDevice,
  removeApp
} from '../services/file.service'
import { InstallationPlannerService } from '../services/installation/installation-planner.service'
import { GameInstallationService } from '../services/installation/game-installation.service'
import { LinuxFragmentationAdapter } from '../services/fragmentation/linux.adapter'
import { MacOsFragmentationAdapter } from '../services/fragmentation/macos.adapter'
import { getOplProfileService } from './opl.ipc'
import { parseInput } from './schemas'
import { ReorganizationInventoryService } from '../services/installation/reorganization-inventory.service'
import { ReorganizationService } from '../services/installation/reorganization.service'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const installation = new GameInstallationService(
  process.platform === 'linux' ? new LinuxFragmentationAdapter() : new MacOsFragmentationAdapter()
)
const planner = new InstallationPlannerService()
const knownDevices = new Set<string>()
const reorganization = new ReorganizationService(
  new ReorganizationInventoryService(),
  process.platform === 'linux' ? new LinuxFragmentationAdapter() : new MacOsFragmentationAdapter()
)
const recoveryRegistry = () => path.join(app.getPath('userData'), 'reorganization-recovery')

export async function recoverKnownInstallations(): Promise<void> {
  await Promise.all([...knownDevices].map((device) => installation.recover(device)))
}
export async function recoverKnownReorganizations(): Promise<void> {
  const names = await readdir(recoveryRegistry()).catch(() => [])
  for (const name of names)
    try {
      const backupRoot = await readFile(path.join(recoveryRegistry(), name), 'utf8')
      await reorganization.recover(backupRoot)
      await rm(path.join(recoveryRegistry(), name), { force: true })
    } catch {
      /* recovery remains registered for the next startup */
    }
}

export function registerFileIpc() {
  ipcMain.handle('files:prepare-device', (_event, input: PrepareDeviceInput) =>
    prepareDevice(input.devicePath)
  )
  ipcMain.handle('files:copy-game', (_event, input: GameImportInput) => copyGame(input))
  ipcMain.handle('installation:plan', async (_event, input: InstallationPlanInput) => {
    const parsed = parseInput('installationPlan', input)
    const profile = await getOplProfileService().get(parsed.oplProfileId)
    if (!profile)
      throw Object.assign(new Error('OPL profile not found'), { code: 'PROFILE_NOT_FOUND' })
    knownDevices.add(parsed.devicePath)
    return installation.remember(
      await planner.plan({ ...parsed, fileSystem: input.fileSystem, profile })
    )
  })
  ipcMain.handle('installation:confirm', (_event, input: OperationConfirmation) => {
    const parsed = parseInput('operationConfirm', input)
    return installation.confirm(parsed.operationId, parsed.expectedRevision, parsed.confirmation)
  })
  ipcMain.handle('installation:cancel', (_event, input: { operationId: string }) => {
    const parsed = parseInput('operationCancel', input)
    installation.cancel(parsed.operationId)
  })
  ipcMain.handle(
    'reorganization:plan',
    async (_event, input: { deviceId: string; devicePath: string; backupPath: string }) => {
      const parsed = parseInput('reorganizationPlan', input)
      const plan = await reorganization.plan(parsed.deviceId, parsed.devicePath, parsed.backupPath)
      await mkdir(recoveryRegistry(), { recursive: true })
      await writeFile(path.join(recoveryRegistry(), plan.id), plan.backupRoot, { mode: 0o600 })
      return plan
    }
  )
  ipcMain.handle('reorganization:confirm', async (_event, input: OperationConfirmation) => {
    const parsed = parseInput('operationConfirm', input)
    const result = await reorganization.confirm(
      parsed.operationId,
      parsed.expectedRevision,
      parsed.confirmation
    )
    await rm(path.join(recoveryRegistry(), parsed.operationId), { force: true })
    return result
  })
  ipcMain.handle('reorganization:cancel', (_event, input: { operationId: string }) => {
    const id = parseInput('operationCancel', input).operationId
    reorganization.cancel(id)
  })
  ipcMain.handle('files:copy-ps1-game', (_event, input: Ps1ImportInput) => copyPs1Game(input))
  ipcMain.handle('files:install-app', (_event, input: AppInstallInput) => installApp(input))
  ipcMain.handle('files:list-apps', (_event, devicePath: string) => listInstalledApps(devicePath))
  ipcMain.handle('files:remove-app', (_event, devicePath: string, appName: string) =>
    removeApp(devicePath, appName)
  )
}
