import type { IpcMain } from 'electron'
import type { ImportJobService } from '../services/imports/import-job.service'
import { parseInput } from './schemas'
export function registerImportIpc(main: IpcMain, imports: ImportJobService): void {
  main.handle('imports:create', (_event, input) => {
    const value = parseInput('importCreate', input)
    return imports.create(value.sourcePaths, value.devicePath, value.mediaType)
  })
  main.handle('imports:get', (_event, input) => imports.get(parseInput('importGet', input).jobId))
  main.handle('imports:list', (_event, input) => {
    parseInput('importList', input ?? {})
    return imports.list()
  })
  main.handle('imports:cancel', (_event, input) => {
    const value = parseInput('importCancel', input)
    return imports.cancel(value.jobId, value.expectedRevision)
  })
}
