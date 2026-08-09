import { useEffect } from 'react'
import { CheckCircle2, Download } from 'lucide-react'
import { useDownloadFeedbackStore } from '@/stores/download-feedback-store'
export function DownloadToast() {
  const toast = useDownloadFeedbackStore((state) => state.toast)
  const dismiss = useDownloadFeedbackStore((state) => state.dismiss)
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(dismiss, 4200)
    return () => window.clearTimeout(timer)
  }, [toast, dismiss])
  if (!toast) return null
  return (
    <button
      onClick={dismiss}
      className="fixed right-6 top-20 z-[100] flex animate-[download-toast-in_.25s_ease-out] items-center gap-3 rounded-2xl border border-violet-400/30 bg-[#181424]/95 px-4 py-3 text-left shadow-[0_0_35px_rgba(139,92,246,.35)] backdrop-blur-xl"
    >
      {toast.kind === 'completed' ? (
        <CheckCircle2 className="size-5 text-emerald-300" />
      ) : (
        <Download className="size-5 animate-bounce text-violet-300" />
      )}
      <div>
        <p className="text-sm font-semibold text-white">
          {toast.kind === 'completed' ? 'Download concluído' : 'Download iniciado'}
        </p>
        <p className="text-xs text-muted-foreground">{toast.message}</p>
      </div>
    </button>
  )
}
