import type { IpcMain } from 'electron'
import type { FinalizationCoordinatorService } from '../services/finalization/finalization-coordinator.service'
import { parseInput } from './schemas'

export function registerFinalizationIpc(
  main: IpcMain,
  coordinator: FinalizationCoordinatorService
): void {
  main.handle('finalization:get-plan', (_event, input: unknown) =>
    coordinator.getPlan(parseInput('finalizationGetPlan', input).planId)
  )
  main.handle('finalization:confirm', (_event, input: unknown) => {
    const parsed = parseInput('finalizationConfirm', input)
    return coordinator.confirm(parsed.planId, parsed.expectedRevision)
  })
  main.handle('finalization:set-game-id', (_event, input: unknown) => {
    const parsed = parseInput('finalizationSetGameId', input)
    return coordinator.setGameId(parsed.planId, parsed.expectedRevision, parsed.gameId)
  })
  main.handle('finalization:cancel', (_event, input: unknown) => {
    const parsed = parseInput('finalizationCancel', input)
    return coordinator.cancel(parsed.taskId, parsed.expectedRevision)
  })
}
