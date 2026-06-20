import { app, BrowserWindow, shell } from 'electron'
import path from 'node:path'
import { registerArtIpc } from './ipc/art.ipc'
import { registerCatalogIpc } from './ipc/catalog.ipc'
import { registerDeviceIpc } from './ipc/device.ipc'
import { registerDialogIpc } from './ipc/dialog.ipc'
import { registerDownloadIpc } from './ipc/download.ipc'
import { registerFileIpc } from './ipc/file.ipc'
import { registerGameIpc } from './ipc/game.ipc'
import { registerHistoryIpc } from './ipc/history.ipc'
import { registerSourceIpc } from './ipc/source.ipc'

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL)

function registerIpc() {
  registerArtIpc()
  registerCatalogIpc()
  registerDeviceIpc()
  registerDialogIpc()
  registerDownloadIpc()
  registerFileIpc()
  registerGameIpc()
  registerHistoryIpc()
  registerSourceIpc()
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

app.whenReady().then(() => {
  registerIpc()
  void createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
