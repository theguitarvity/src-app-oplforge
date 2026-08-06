import { shell, type IpcMain } from 'electron'
import { promises as fs } from 'node:fs'
import type { DownloadCoordinatorService } from '../services/downloads/download-coordinator.service'
import { parseInput } from './schemas'

export function registerDurableDownloadIpc(
  main: IpcMain,
  coordinator: DownloadCoordinatorService
): void {
  main.handle('downloads:enqueue', (_event, input: unknown) =>
    coordinator.enqueue(parseInput('downloadEnqueue', input))
  )
  main.handle('downloads:list', (_event, input: unknown) =>
    coordinator.list(parseInput('downloadList', input))
  )
  main.handle('downloads:get', (_event, input: unknown) =>
    coordinator.get(parseInput('downloadGet', input).taskId)
  )
  main.handle('downloads:pause-v2', (_event, input: unknown) =>
    coordinator.pause(parseInput('downloadPause', input))
  )
  main.handle('downloads:resume-v2', (_event, input: unknown) =>
    coordinator.resume(parseInput('downloadResume', input))
  )
  main.handle('downloads:retry', (_event, input: unknown) =>
    coordinator.retry(parseInput('downloadRetry', input))
  )
  main.handle('downloads:cancel-v2', (_event, input: unknown) => {
    const parsed = parseInput('downloadCancel', input)
    return coordinator.cancel({ taskId: parsed.taskId, expectedRevision: parsed.expectedRevision })
  })
  main.handle('downloads:retry-failed', (_event, input: unknown) => {
    const parsed = parseInput('downloadRetryFailed', input)
    return coordinator.retryFailed(parsed.expectedQueueRevision, parsed.deviceId)
  })
  main.handle('downloads:clear-terminal', (_event, input: unknown) => {
    const parsed = parseInput('downloadClearTerminal', input)
    return coordinator.clearTerminal(parsed.expectedQueueRevision, parsed.deviceId)
  })
}

export function registerShellIpc(main: IpcMain): void {
  main.handle('shell:open-external', async (_event, url: string) => {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') throw new Error('Somente links HTTPS podem ser abertos.')
    await shell.openExternal(parsed.toString())
  })
  main.handle('shell:open-folder', async (_event, folderPath: string) => {
    const stat = await fs.stat(folderPath)
    if (!stat.isDirectory()) throw new Error('O caminho informado nao e uma pasta.')
    const error = await shell.openPath(folderPath)
    if (error) throw new Error(error)
  })
}
