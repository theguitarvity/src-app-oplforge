import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { oplApi } from '@/services/api'
import { useDownloadFeedbackStore } from '@/stores/download-feedback-store'
import { useDownloadStore } from '@/stores/download-store'
export function DownloadLifecycleMonitor() {
  const initialized = useRef(false)
  const ready = useRef(new Set<string>())
  const notify = useDownloadFeedbackStore((state) => state.notify)
  const setSnapshot = useDownloadStore((state) => state.setSnapshot)
  const queue = useQuery({
    queryKey: ['durable-downloads-monitor'],
    queryFn: () => oplApi.listDownloads({ limit: 500 }),
    refetchInterval: 1200
  })
  useEffect(() => {
    if (!queue.data) return
    for (const task of queue.data.items)
      if (task.phase === 'ready' && !ready.current.has(task.taskId)) {
        if (initialized.current) notify(`${task.requestedTitle} está pronto.`, 'completed')
        ready.current.add(task.taskId)
      }
    initialized.current = true
    setSnapshot(queue.data)
  }, [notify, queue.data, setSnapshot])
  return null
}
