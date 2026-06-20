import { useLogStore } from '@/stores/log-store'

export function ProgressModal() {
  const progress = useLogStore((state) => state.progress)
  if (!progress) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm">
      <div className="w-[420px] rounded-3xl border border-white/10 bg-[#12111b]/95 p-6 shadow-glow">
        <p className="text-sm text-muted-foreground">Operacao em andamento</p>
        <h2 className="mt-1 text-xl font-semibold text-white">{progress.label}</h2>
        {progress.detail ? <p className="mt-2 text-sm text-muted-foreground">{progress.detail}</p> : null}
        <div className="mt-5 h-3 rounded-full bg-white/8">
          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-all" style={{ width: `${progress.value}%` }} />
        </div>
        <p className="mt-3 text-right text-sm text-white/70">{progress.value}%</p>
      </div>
    </div>
  )
}
