import { create } from 'zustand'
import type { DurableDownloadTaskSummary, Page, PipelineEvent } from '@/types/opl-finalization'

interface DownloadProjectionState {
  tasks: Record<string, DurableDownloadTaskSummary>
  queueRevision: number
  lastSequenceByOperation: Record<string, number>
  setSnapshot(page: Page<DurableDownloadTaskSummary>): void
  applyEvent(event: PipelineEvent): boolean
  upsertTask(task: unknown): void
  updateProgress(progress: unknown): void
}

export const useDownloadStore = create<DownloadProjectionState>((set, get) => ({
  tasks: {},
  queueRevision: 0,
  lastSequenceByOperation: {},
  setSnapshot: (page) =>
    set({
      tasks: Object.fromEntries(page.items.map((task) => [task.taskId, task])),
      queueRevision: page.revision
    }),
  applyEvent: (event) => {
    const previous = get().lastSequenceByOperation[event.operationId] ?? 0
    if (event.sequence <= previous) return false
    const gap = previous > 0 && event.sequence !== previous + 1
    set((state) => {
      const task = state.tasks[event.operationId]
      if (!task || event.revision < task.revision)
        return {
          lastSequenceByOperation: {
            ...state.lastSequenceByOperation,
            [event.operationId]: event.sequence
          }
        }
      return {
        tasks: {
          ...state.tasks,
          [event.operationId]: {
            ...task,
            phase: event.phase as DurableDownloadTaskSummary['phase'],
            phaseProgress: event.progress ?? task.phaseProgress,
            revision: event.revision,
            lastError: event.error,
            lastSequence: event.sequence,
            updatedAt: event.timestamp
          }
        },
        lastSequenceByOperation: {
          ...state.lastSequenceByOperation,
          [event.operationId]: event.sequence
        }
      }
    })
    return gap
  },
  upsertTask: (candidate) => {
    if (!candidate || typeof candidate !== 'object' || !('taskId' in candidate)) return
    const task = candidate as DurableDownloadTaskSummary
    set((state) => ({ tasks: { ...state.tasks, [task.taskId]: task } }))
  },
  updateProgress: () => undefined
}))
