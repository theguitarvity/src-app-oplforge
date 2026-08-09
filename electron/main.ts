import { app, BrowserWindow, ipcMain, protocol, shell } from 'electron'
import path from 'node:path'
import { queueAutomaticArtSync, registerArtIpc } from './ipc/art.ipc'
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
import { registerNetworkShareIpc } from './ipc/network-share.ipc'
import { NetworkShareService } from './services/network-share/network-share.service'
import { SmbProtocolServer } from './services/network-share/smb/smb-server'
import { FtpProtocolServer } from './services/network-share/ftp/ftp-server'
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
import { DownloadCacheCleanupService } from './services/downloads/download-cache-cleanup.service'
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
import { operationEvents } from './services/operations/operation-event.publisher'
import { registerLocalArtProtocol } from './services/art/local-art-protocol.service'
import { LocalDestinationService } from './services/downloads/local-destination.service'
import { UpdatePolicyStore } from './services/updates/update-policy.store'
import { UpdateService } from './services/updates/update.service'
import { registerUpdateIpc } from './ipc/update.ipc'
import { ImportJobService } from './services/imports/import-job.service'
import { registerImportIpc } from './ipc/import.ipc'

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL)

app.setAppUserModelId('com.oplforge.app')
protocol.registerSchemesAsPrivileged([
  { scheme: 'opl-art', privileges: { standard: true, secure: true, supportFetchAPI: true } }
])

function registerIpc(
  fragmentationRepairRuntime: FragmentationRepairRuntime,
  downloads: DownloadCoordinatorService,
  networkShare: NetworkShareService
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
  registerNetworkShareIpc(ipcMain, networkShare)
  ipcMain.handle('operations:list', () => operationEvents.list())
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
let networkShareService: NetworkShareService | undefined
let coordinatedShutdown = false

app.whenReady().then(async () => {
  registerLocalArtProtocol()
  const userDataPath = app.getPath('userData')
  const taskStore = new DownloadTaskStore(
    path.join(userDataPath, 'opl-finalization', 'download-tasks.json')
  )
  const downloadCacheRoot = path.join(userDataPath, 'opl-finalization', 'cache')
  const cacheCleanup = new DownloadCacheCleanupService(downloadCacheRoot)
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
  const cleanupResults = await cacheCleanup
    .reconcile((await taskStore.list()).items)
    .catch((error) => {
      sendLog(
        'WARNING',
        `Não foi possível limpar todo o cache concluído: ${error instanceof Error ? error.message : 'falha desconhecida'}`
      )
      return []
    })
  const recoveredBytes = cleanupResults.reduce((sum, result) => sum + result.freedBytes, 0)
  if (recoveredBytes > 0)
    sendLog(
      'SUCCESS',
      `Cache de jogos concluídos removido: ${(recoveredBytes / 1024 / 1024 / 1024).toFixed(2)} GB liberados.`
    )
  const fragmentationRepairRuntime = createFragmentationRepairRuntime(app.getPath('userData'))
  const http = new HttpTransferService()
  const installationPlanner = new InstallationPlannerService()
  const installation = new GameInstallationService(fragmentationRepairRuntime.adapter)
  const localDestination = new LocalDestinationService()
  networkShareService = new NetworkShareService(new SmbProtocolServer(), new FtpProtocolServer())
  registerIpc(fragmentationRepairRuntime, downloads, networkShareService)
  const updates = new UpdateService(() => operationEvents.list())
  const updatePolicies = new UpdatePolicyStore(path.join(userDataPath, 'updates', 'policy.json'))
  registerUpdateIpc(ipcMain, updates, updatePolicies)
  void updatePolicies.get().then((policy) => updates.applyStartupPolicy(policy))
  registerImportIpc(ipcMain, new ImportJobService(path.join(userDataPath, 'imports', 'jobs.json')))
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
        const partPath = path.join(downloadCacheRoot, task.transfer.partialRelativePath)
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
        if (current.target?.kind === 'local-folder') {
          await downloads.advance(task.taskId, 'validating', 100)
          await downloads.advance(task.taskId, 'promoting')
          await localDestination.promote(
            path.join(downloadCacheRoot, current.transfer.partialRelativePath),
            current.target,
            current.source.originalFileName
          )
          await downloads.advance(task.taskId, 'verifying', 100)
          await downloads.advance(task.taskId, 'ready', 100)
          return
        }
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
        const sourcePath = path.join(downloadCacheRoot, current.transfer.partialRelativePath)
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
        await queueAutomaticArtSync(device.path).catch((error) => {
          sendLog(
            'WARNING',
            `Jogo instalado, mas a sincronização automática de artes falhou: ${error instanceof Error ? error.message : 'falha desconhecida'}`
          )
        })
        const ready = await downloads.advance(task.taskId, 'ready', 100)
        try {
          const cleaned = await cacheCleanup.cleanupReady(ready)
          if (cleaned.removed)
            sendLog(
              'SUCCESS',
              `Arquivo local de ${ready.requestedTitle} removido após instalação verificada; ${(cleaned.freedBytes / 1024 / 1024).toFixed(0)} MB liberados.`
            )
        } catch (error) {
          sendLog(
            'WARNING',
            `Jogo instalado, mas o cache local não pôde ser removido: ${error instanceof Error ? error.message : 'falha desconhecida'}`
          )
        }
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
  void Promise.all([
    finalizationRuntime.stop().catch(() => undefined),
    // FR-007/US3: sharing MUST stop even if the user never explicitly
    // disabled it — it must not outlive the app process.
    networkShareService?.stop().catch(() => undefined)
  ]).finally(() => app.quit())
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
