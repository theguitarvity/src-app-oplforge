import { create } from 'zustand'
import type { DownloadProgress, DownloadTask } from '@/types/opl'

interface DownloadState {
  tasks: DownloadTask[]
  progressByTask: Record<string, DownloadProgress>
  setTasks: (tasks: DownloadTask[]) => void
  upsertTask: (task: DownloadTask) => void
  updateProgress: (progress: DownloadProgress) => void
}

export const useDownloadStore = create<DownloadState>((set) => ({
  tasks: [],
  progressByTask: {},
  setTasks: (tasks) => set({ tasks }),
  upsertTask: (task) =>
    set((state) => ({
      tasks: state.tasks.some((item) => item.id === task.id)
        ? state.tasks.map((item) => (item.id === task.id ? task : item))
        : [task, ...state.tasks]
    })),
  updateProgress: (progress) =>
    set((state) => ({
      progressByTask: { ...state.progressByTask, [progress.taskId]: progress },
      tasks: state.tasks.map((task) =>
        task.id === progress.taskId ? { ...task, status: progress.status } : task
      )
    }))
}))
