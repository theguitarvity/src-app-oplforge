import { useEffect } from 'react'
import { oplApi } from '@/services/api'
import { useDownloadStore } from '@/stores/download-store'
import { useLogStore } from '@/stores/log-store'

export function useElectronEvents() {
  const pushLog = useLogStore((state) => state.pushLog)
  const setProgress = useLogStore((state) => state.setProgress)
  const updateDownloadProgress = useDownloadStore((state) => state.updateProgress)

  useEffect(() => {
    const offLog = oplApi.onLog(pushLog)
    const offProgress = oplApi.onProgress((progress) => {
      setProgress(progress)
      if (progress.value >= 100) {
        window.setTimeout(() => setProgress(null), 1200)
      }
    })
    const offDownloadProgress = oplApi.onDownloadProgress(updateDownloadProgress)
    const offDownloadCompleted = oplApi.onDownloadCompleted((progress) => {
      updateDownloadProgress(progress)
      pushLog({
        id: `${progress.taskId}-completed`,
        timestamp: new Date().toISOString(),
        level: 'SUCCESS',
        message: 'Download concluido em staging.'
      })
    })
    const offDownloadFailed = oplApi.onDownloadFailed((progress) => {
      updateDownloadProgress(progress)
      pushLog({
        id: `${progress.taskId}-failed`,
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        message: progress.error ?? 'Download falhou.'
      })
    })

    return () => {
      offLog()
      offProgress()
      offDownloadProgress()
      offDownloadCompleted()
      offDownloadFailed()
    }
  }, [pushLog, setProgress, updateDownloadProgress])
}
