import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'node:path'
import { registerArtIpc } from './ipc/art.ipc'
import { registerCatalogIpc } from './ipc/catalog.ipc'
import { registerDeviceIpc } from './ipc/device.ipc'
import { registerDialogIpc } from './ipc/dialog.ipc'
import { registerDurableDownloadIpc, registerShellIpc } from './ipc/download.ipc'
import {
  recoverKnownInstallations,
  recoverKnownReorganizations,
  registerFileIpc
} from './ipc/file.ipc'
import { registerGameIpc } from './ipc/game.ipc'
import { registerHistoryIpc } from './ipc/history.ipc'
import { registerSourceIpc } from './ipc/source.ipc'
import { registerOplIpc } from './ipc/opl.ipc'
import { registerValidationIpc } from './ipc/validation.ipc'
import { registerFragmentationRepairIpc } from './ipc/fragmentation-repair.ipc'
import { registerNamingIpc } from './ipc/naming.ipc'
import {
  createFragmentationRepairRuntime,
  type FragmentationRepairRuntime
} from './services/fragmentation-repair/runtime'
import { DownloadTaskStore } from './services/downloads/download-task.store'
import {
  configureDownloadCoordinator,
  DownloadCoordinatorService
} from './services/downloads/download-coordinator.service'
import { DownloadRecoveryService } from './services/downloads/download-recovery.service'
import {
  createFinalizationRuntime,
  type FinalizationRuntime
} from './services/finalization/runtime'
import { listDevices } from './services/device.service'
import { sendLog } from './services/logger'
import { HttpTransferService } from './services/downloads/http-transfer.service'
import {
  DEFAULT_INSTALLATION_PROFILE,
  InstallationPlannerService
} from './services/installation/installation-planner.service'
import { GameInstallationService } from './services/installation/game-installation.service'
import { getOplProfileService } from './ipc/opl.ipc'

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL)

function registerIpc(
  fragmentationRepairRuntime: FragmentationRepairRuntime,
  downloads: DownloadCoordinatorService
) {
  registerArtIpc()
  registerCatalogIpc()
  registerDeviceIpc()
  registerDialogIpc()
  registerDurableDownloadIpc(ipcMain, downloads)
  registerShellIpc(ipcMain)
  registerFileIpc()
  registerGameIpc()
  registerHistoryIpc()
  registerSourceIpc()
  registerOplIpc()
  registerValidationIpc()
  registerNamingIpc(ipcMain)
  registerFragmentationRepairIpc(
    // Electron owns the singleton IPC boundary; runtime recovery is intentionally
    // not started until the dedicated recovery phase is implemented.
    ipcMain,
    fragmentationRepairRuntime
  )
}

async function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.cjs')

  const mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1120,
    minHeight: 720,
    title: 'OPL Forge',
    backgroundColor: '#09090f',
    icon: isDev
      ? path.join(process.cwd(), 'build', 'icon.png')
      : path.join(process.resourcesPath, 'icon.png'),
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

let finalizationRuntime: FinalizationRuntime | undefined
let coordinatedShutdown = false

app.whenReady().then(async () => {
  const userDataPath = app.getPath('userData')
  const taskStore = new DownloadTaskStore(
    path.join(userDataPath, 'opl-finalization', 'download-tasks.json')
  )
  const downloads = configureDownloadCoordinator(
    new DownloadCoordinatorService(undefined, taskStore)
  )
  const recovery = new DownloadRecoveryService(
    taskStore,
    async (deviceId) =>
      (await listDevices()).find((device) => device.id === deviceId || device.path === deviceId)
        ?.path
  )
  finalizationRuntime = createFinalizationRuntime({
    userDataPath,
    components: [
      {
        initialize: () => downloads.initialize(),
        stop: async () => {
          downloads.stop()
          await downloads.flush()
        }
      },
      {
        reconcile: async () => {
          await recovery.reconcile()
        }
      }
    ]
  })
  await finalizationRuntime.initialize()
  await finalizationRuntime.reconcile()
  const fragmentationRepairRuntime = createFragmentationRepairRuntime(app.getPath('userData'))
  const http = new HttpTransferService()
  const installationPlanner = new InstallationPlannerService()
  const installation = new GameInstallationService(fragmentationRepairRuntime.adapter)
  registerIpc(fragmentationRepairRuntime, downloads)
  void fragmentationRepairRuntime.recovery.reconcile().catch(() => undefined)
  void recoverKnownInstallations()
  void recoverKnownReorganizations()
  void createWindow()
  await finalizationRuntime.start()
  await downloads.start(async (task, source) => {
    await downloads.process(
      task.taskId,
      async (_source, _current, signal) => {
        if (source.kind !== 'http')
          throw Object.assign(new Error('Durable torrent worker awaits metadata adapter'), {
            code: 'TORRENT_WORKER_UNAVAILABLE',
            retryable: true
          })
        const partPath = path.join(
          userDataPath,
          'opl-finalization',
          'cache',
          task.transfer.partialRelativePath
        )
        const result = await http.transfer({
          url: source.url,
          partPath,
          signal,
          checkpoint: {
            bytesConfirmed: task.transfer.bytesConfirmed,
            etag: task.source.etag,
            lastModified: task.source.lastModified
          },
          onProgress: (bytes, total) => {
            void downloads.checkpointTransfer(task.taskId, bytes, total).catch(() => undefined)
          }
        })
        await downloads.checkpointTransfer(task.taskId, result.bytesConfirmed, result.totalBytes)
      },
      async () => {
        const current = await downloads.get(task.taskId)
        if (!current) throw Object.assign(new Error('Task disappeared'), { code: 'TASK_NOT_FOUND' })
        const device = (await listDevices()).find(
          (item) => item.id === current.targetDeviceId || item.path === current.targetDeviceId
        )
        if (!device)
          throw Object.assign(new Error('Target device is not mounted'), {
            code: 'DEVICE_NOT_FOUND',
            retryable: true
          })
        const profileService = getOplProfileService()
        const profile =
          (await profileService.get(current.targetProfileId)) ??
          (current.targetProfileId === 'opl-default'
            ? DEFAULT_INSTALLATION_PROFILE
            : (await profileService.list())[0])
        if (!profile)
          throw Object.assign(new Error('The selected OPL profile is not registered'), {
            code: 'PROFILE_NOT_FOUND',
            retryable: true
          })
        await downloads.advance(task.taskId, 'validating')
        await downloads.advance(task.taskId, 'planning')
        const sourcePath = path.join(
          userDataPath,
          'opl-finalization',
          'cache',
          current.transfer.partialRelativePath
        )
        const plan = installation.remember(
          await installationPlanner.plan({
            sourcePath,
            sourceFileName: current.source.originalFileName,
            devicePath: device.path,
            title: current.requestedTitle,
            profile,
            fileSystem: device.fileSystem
          })
        )
        await downloads.advance(task.taskId, 'installing')
        await installation.confirm(
          plan.id,
          plan.expectedRevision,
          plan.replaces ? 'SUBSTITUIR BACKUP AUTORIZADO' : 'INSTALAR BACKUP AUTORIZADO'
        )
        await downloads.advance(task.taskId, 'verifying', 100)
        await downloads.advance(task.taskId, 'cataloging', 100)
        await downloads.advance(task.taskId, 'queueing-art', 100)
        await downloads.advance(task.taskId, 'ready', 100)
      }
    )
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
})

app.on('before-quit', (event) => {
  if (coordinatedShutdown || !finalizationRuntime) return
  event.preventDefault()
  coordinatedShutdown = true
  void finalizationRuntime
    .stop()
    .catch(() => undefined)
    .finally(() => app.quit())
})

process.on('unhandledRejection', () => {
  sendLog('ERROR', 'Falha interna assíncrona; checkpoints seguros serão preservados.')
})
process.on('uncaughtException', () => {
  sendLog('ERROR', 'Falha interna inesperada; iniciando encerramento coordenado.')
  app.quit()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
