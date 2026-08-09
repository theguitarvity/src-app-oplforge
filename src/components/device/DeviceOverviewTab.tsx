import { Link } from 'react-router-dom'
import { Gamepad2, Sparkles, Boxes, AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react'

interface DeviceOverviewTabProps {
  ps2Count: number
  ps1Count: number
  appsCount: number
  issuesCount: number
}

export function DeviceOverviewTab({
  ps2Count,
  ps1Count,
  appsCount,
  issuesCount
}: DeviceOverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Issues Banner */}
      {issuesCount > 0 ? (
        <div className="flex items-center justify-between rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="size-5 shrink-0 text-amber-400" />
            <div>
              <p className="text-sm font-semibold text-white">
                {issuesCount} item(ns) precisam de atenção no dispositivo
              </p>
              <p className="text-xs text-amber-200/80">
                Jogos fragmentados ou nomes fora do padrão OPL foram detectados.
              </p>
            </div>
          </div>
          <Link
            to="/tools?tab=diagnostics"
            className="flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-black transition hover:bg-amber-400"
          >
            Executar Diagnóstico
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-200">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-400" />
          <div>
            <p className="text-sm font-semibold text-white">Dispositivo em excelente estado</p>
            <p className="text-xs text-emerald-200/80">
              Estrutura de diretórios OPL e jogos validados sem problemas.
            </p>
          </div>
        </div>
      )}

      {/* Content Counts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/library?type=ps2"
          className="group rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-violet-500/50 hover:bg-white/10"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground group-hover:text-white">
              Jogos PS2
            </span>
            <div className="grid size-9 place-items-center rounded-xl bg-violet-500/20 text-violet-300">
              <Gamepad2 className="size-5" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-white">{ps2Count}</p>
          <p className="mt-1 text-xs text-muted-foreground">Formatos ISO e HDLoader</p>
        </Link>

        <Link
          to="/library?type=ps1"
          className="group rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-violet-500/50 hover:bg-white/10"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground group-hover:text-white">
              Jogos PS1
            </span>
            <div className="grid size-9 place-items-center rounded-xl bg-fuchsia-500/20 text-fuchsia-300">
              <Sparkles className="size-5" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-white">{ps1Count}</p>
          <p className="mt-1 text-xs text-muted-foreground">Formatos VCD / POPStarter</p>
        </Link>

        <Link
          to="/library?type=apps"
          className="group rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-violet-500/50 hover:bg-white/10"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground group-hover:text-white">
              Aplicações & Homebrews
            </span>
            <div className="grid size-9 place-items-center rounded-xl bg-cyan-500/20 text-cyan-300">
              <Boxes className="size-5" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-extrabold text-white">{appsCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">ELF e utilitários OPL</p>
        </Link>
      </div>
    </div>
  )
}
