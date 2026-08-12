import { Terminal, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useLogStore } from '@/stores/log-store'
import { cn } from '@/utils/cn'

const levelClass = {
  INFO: 'text-sky-300',
  WARNING: 'text-amber-300',
  ERROR: 'text-red-300',
  SUCCESS: 'text-emerald-300'
}

export function LogPanel() {
  const { t } = useTranslation()
  const logs = useLogStore((state) => state.logs)
  const clearLogs = useLogStore((state) => state.clearLogs)

  return (
    <div className="border-t border-white/10 bg-black/30 px-6 py-3 backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-white/80">
          <Terminal className="size-4 text-violet-200" /> {t('components.logPanel.title')}
        </div>
        <Button variant="ghost" size="sm" onClick={clearLogs}>
          <Trash2 className="size-4" /> {t('components.logPanel.clear')}
        </Button>
      </div>
      <div className="h-28 overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 font-mono text-xs">
        {logs.length === 0 ? (
          <p className="text-muted-foreground">{t('components.logPanel.waitingForOperations')}</p>
        ) : null}
        {logs.map((log) => (
          <div key={log.id} className="mb-1 flex gap-2">
            <span className="text-white/35">{new Date(log.timestamp).toLocaleTimeString()}</span>
            <span className={cn('font-semibold', levelClass[log.level])}>{log.level}</span>
            <span className="text-white/75">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
