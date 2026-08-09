import { useLogStore } from '@/stores/log-store'
import { X, Trash2, Copy, Filter } from 'lucide-react'

export function ActivityDrawer() {
  const { logs, isDrawerOpen, logFilter, toggleDrawer, clearLogs, setLogFilter } = useLogStore()

  if (!isDrawerOpen) return null

  const filteredLogs = logs.filter((log) => {
    if (logFilter === 'info') return log.level === 'INFO' || log.level === 'SUCCESS'
    if (logFilter === 'warn') return log.level === 'WARNING'
    if (logFilter === 'error') return log.level === 'ERROR'
    return true
  })

  const copyLogs = () => {
    const text = logs
      .map((l) => `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.level}] ${l.message}`)
      .join('\n')
    void navigator.clipboard.writeText(text)
  }

  return (
    <div className="absolute inset-x-0 bottom-9 z-30 flex h-72 flex-col border-t border-white/10 bg-black/90 p-4 backdrop-blur-xl shadow-2xl animate-in slide-in-from-bottom duration-200">
      {/* Drawer Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-white">Console de Atividades & Logs</h3>
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1 text-xs">
            <Filter className="ml-1 size-3 text-muted-foreground" />
            <button
              onClick={() => setLogFilter('all')}
              className={`rounded px-2 py-0.5 transition ${
                logFilter === 'all'
                  ? 'bg-violet-600 text-white'
                  : 'text-muted-foreground hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setLogFilter('info')}
              className={`rounded px-2 py-0.5 transition ${
                logFilter === 'info'
                  ? 'bg-violet-600 text-white'
                  : 'text-muted-foreground hover:text-white'
              }`}
            >
              Info
            </button>
            <button
              onClick={() => setLogFilter('warn')}
              className={`rounded px-2 py-0.5 transition ${
                logFilter === 'warn'
                  ? 'bg-amber-600 text-white'
                  : 'text-muted-foreground hover:text-white'
              }`}
            >
              Avisos
            </button>
            <button
              onClick={() => setLogFilter('error')}
              className={`rounded px-2 py-0.5 transition ${
                logFilter === 'error'
                  ? 'bg-rose-600 text-white'
                  : 'text-muted-foreground hover:text-white'
              }`}
            >
              Erros
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyLogs}
            className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-white/10 hover:text-white"
          >
            <Copy className="size-3" />
            Copiar
          </button>
          <button
            onClick={clearLogs}
            className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-white/10 hover:text-white"
          >
            <Trash2 className="size-3" />
            Limpar
          </button>
          <button
            onClick={() => toggleDrawer(false)}
            className="rounded-md p-1 text-muted-foreground hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Log Terminal List */}
      <div className="flex-1 overflow-y-auto py-2 font-mono text-xs space-y-1">
        {filteredLogs.length === 0 ? (
          <div className="grid h-full place-items-center text-muted-foreground">
            Nenhum evento registrado no console.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 py-0.5">
              <span className="shrink-0 text-muted-foreground/60">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span
                className={`shrink-0 rounded px-1.5 py-0.2 text-[10px] uppercase font-bold ${
                  log.level === 'ERROR'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : log.level === 'WARNING'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : log.level === 'SUCCESS'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                }`}
              >
                {log.level}
              </span>
              <span className="text-white/90 break-all">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
