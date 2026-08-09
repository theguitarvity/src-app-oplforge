import { Link } from 'react-router-dom'
import { HardDrive, Plus, Library, ScanSearch, CheckCircle2, AlertCircle } from 'lucide-react'
import type { DeviceInfo } from '@/types/opl'

interface DeviceWorkspaceHeaderProps {
  device: DeviceInfo
  ps2Count?: number
  ps1Count?: number
  appsCount?: number
  issuesCount?: number
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export function DeviceWorkspaceHeader({
  device,
  ps2Count = 0,
  ps1Count = 0,
  appsCount = 0,
  issuesCount = 0
}: DeviceWorkspaceHeaderProps) {
  const usedSpace = device.used ?? 0
  const percentUsed = device.total ? Math.round((usedSpace / device.total) * 100) : 0

  const isHealthy = issuesCount === 0 && device.status === 'ready'

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl space-y-6">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30">
            <HardDrive className="size-7 text-violet-400" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">{device.name || 'HD PS2'}</h2>
              <span className="rounded-md border border-white/15 bg-white/10 px-2 py-0.5 text-xs font-mono text-violet-300">
                {device.fileSystem || 'exFAT'}
              </span>
              <span className="rounded-md border border-white/15 bg-white/10 px-2 py-0.5 text-xs font-mono text-muted-foreground">
                {device.path}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs">
              {isHealthy ? (
                <span className="flex items-center gap-1 font-medium text-emerald-400">
                  <CheckCircle2 className="size-3.5" /> Pronto para OPL
                </span>
              ) : (
                <span className="flex items-center gap-1 font-medium text-amber-400">
                  <AlertCircle className="size-3.5" /> {issuesCount} item(ns) precisam de atenção
                </span>
              )}
              <span className="text-white/20">•</span>
              <span className="text-muted-foreground">
                {ps2Count + ps1Count + appsCount} itens salvos
              </span>
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/library?action=add"
            className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-violet-600/30 transition hover:bg-violet-500"
          >
            <Plus className="size-4" />
            Adicionar Jogos
          </Link>
          <Link
            to="/library"
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
          >
            <Library className="size-4 text-violet-400" />
            Abrir Biblioteca
          </Link>
          <Link
            to="/tools?tab=diagnostics"
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
          >
            <ScanSearch className="size-4 text-violet-400" />
            Diagnóstico
          </Link>
        </div>
      </div>

      {/* Storage Gauge Bar */}
      <div className="space-y-2 border-t border-white/10 pt-4">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            Espaço Usado: <strong className="text-white">{formatBytes(usedSpace)}</strong> (
            {percentUsed}%)
          </span>
          <span>
            Livre: <strong className="text-emerald-400">{formatBytes(device.free ?? 0)}</strong> de{' '}
            {formatBytes(device.total ?? 0)}
          </span>
        </div>

        <div className="h-3 overflow-hidden rounded-full bg-black/40 p-0.5 border border-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500"
            style={{ width: `${percentUsed}%` }}
          />
        </div>
      </div>
    </div>
  )
}
