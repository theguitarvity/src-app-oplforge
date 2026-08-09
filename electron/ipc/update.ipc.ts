import { BrowserWindow, type IpcMain } from 'electron'
import type { UpdatePolicyStore } from '../services/updates/update-policy.store'
import type { UpdateService } from '../services/updates/update.service'
import { parseInput } from './schemas'
export function registerUpdateIpc(
  main: IpcMain,
  updates: UpdateService,
  policies: UpdatePolicyStore
): void {
  main.handle('updates:get', () => updates.get())
  main.handle('updates:get-policy', () => policies.get())
  main.handle('updates:set-policy', (_e, input) => {
    const value = parseInput('updateSetPolicy', input)
    return policies.set(value.mode, value.expectedRevision)
  })
  main.handle('updates:check', (_e, input) => {
    parseInput('updateCheck', input ?? {})
    return updates.check()
  })
  main.handle('updates:download', (_e, input) => {
    const value = parseInput('updateDownload', input)
    return updates.download(value.sessionId, value.expectedRevision)
  })
  main.handle('updates:install', (_e, input) => {
    const value = parseInput('updateInstall', input)
    return updates.install(value.sessionId, value.expectedRevision)
  })
  updates.subscribe((session) => {
    for (const window of BrowserWindow.getAllWindows())
      window.webContents.send('updates:event', session)
  })
}
