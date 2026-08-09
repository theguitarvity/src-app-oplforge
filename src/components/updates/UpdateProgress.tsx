import type { UpdateSession } from '@/types/opl-finalization'
export function UpdateProgress({ session }: { session: UpdateSession }) {
  if (!['DOWNLOADING', 'READY_TO_INSTALL'].includes(session.state)) return null
  return (
    <div className="space-y-2">
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full bg-violet-500 transition-all"
          style={{
            width: `${session.progress ?? (session.state === 'READY_TO_INSTALL' ? 100 : 0)}%`
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{Math.round(session.progress ?? 0)}% baixado</p>
    </div>
  )
}
