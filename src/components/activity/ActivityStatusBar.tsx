import { useLogStore } from '@/stores/log-store'
import { ChevronUp, ChevronDown, Activity, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function ActivityStatusBar() {
  const { t } = useTranslation()
  const { progress, logs, isDrawerOpen, toggleDrawer } = useLogStore()

  const activeLogsCount = logs.length
  const errorLogsCount = logs.filter((l) => l.level === 'ERROR').length
  const isRunning = progress !== null
  const isError = !isRunning && errorLogsCount > 0

  return (
    <div className="flex h-9 shrink-0 items-center justify-between border-t border-white/10 bg-black/60 px-4 text-xs backdrop-blur-md">
      {/* Left Progress Info */}
      <div className="flex items-center gap-3 min-w-0">
        {isRunning ? (
          <div className="flex items-center gap-2 font-medium text-violet-300">
            <Activity className="size-3.5 animate-pulse text-violet-400" />
            <span className="truncate max-w-[280px]">
              {progress?.label || t('shell.activityBar.processing')}
            </span>
          </div>
        ) : isError ? (
          <div className="flex items-center gap-2 font-medium text-amber-400">
            <AlertTriangle className="size-3.5" />
            <span className="truncate">{t('shell.activityBar.needsAttention')}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="size-3.5 text-emerald-400" />
            <span>{t('shell.activityBar.ready')}</span>
          </div>
        )}

        {/* Progress Bar indicator */}
        {isRunning ? (
          <div className="flex items-center gap-2 pl-2">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-violet-500 transition-all duration-300"
                style={{ width: `${Math.round(progress?.value ?? 0)}%` }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground">
              {Math.round(progress?.value ?? 0)}%
            </span>
          </div>
        ) : null}
      </div>

      {/* Right Drawer Toggle Button */}
      <div className="flex items-center gap-3">
        {activeLogsCount > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {t('shell.activityBar.events', { count: activeLogsCount })}{' '}
            {errorLogsCount > 0 && t('shell.activityBar.errors', { count: errorLogsCount })}
          </span>
        )}
        <button
          onClick={() => toggleDrawer()}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:bg-white/10 hover:text-white"
        >
          <span>
            {isDrawerOpen ? t('shell.activityBar.hideDetails') : t('shell.activityBar.showDetails')}
          </span>
          {isDrawerOpen ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
        </button>
      </div>
    </div>
  )
}
