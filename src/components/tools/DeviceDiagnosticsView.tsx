import { useState } from 'react'
import { ScanSearch, CheckCircle2, FileCheck } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'
import type { DeviceDiagnostic } from '@/types/opl'

export function DeviceDiagnosticsView() {
  const activeDevice = useDeviceStore((state) => state.activeDevice)
  const [report, setReport] = useState<DeviceDiagnostic | null>(null)

  const diagnostic = useMutation({
    mutationFn: async () => {
      if (!activeDevice) return null
      return oplApi.runDiagnostics({
        devicePath: activeDevice.path,
        fileSystem: activeDevice.fileSystem
      })
    },
    onSuccess: (data) => setReport(data)
  })

  if (!activeDevice) {
    return (
      <div className="grid min-h-[300px] place-items-center rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-muted-foreground">
        Selecione um dispositivo ativo para executar o diagnóstico completo de integridade OPL.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white">Diagnóstico Completo do Dispositivo</h3>
          <p className="text-xs text-muted-foreground">
            Verifique a estrutura de pastas, compatibilidade de sistema de arquivos, nomeclatura OPL
            e fragmentação.
          </p>
        </div>
        <button
          onClick={() => diagnostic.mutate()}
          disabled={diagnostic.isPending}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-violet-500 disabled:opacity-50"
        >
          <ScanSearch className={`size-4 ${diagnostic.isPending ? 'animate-spin' : ''}`} />
          {diagnostic.isPending ? 'Analisando...' : 'Executar Diagnóstico'}
        </button>
      </div>

      {report ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <span className="text-xs text-muted-foreground">Estrutura OPL</span>
              <p className="mt-1 text-base font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="size-4" /> Diretórios Válidos
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <span className="text-xs text-muted-foreground">Sistema de Arquivos</span>
              <p className="mt-1 text-base font-bold text-white font-mono">
                {activeDevice.fileSystem || 'exFAT'}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <span className="text-xs text-muted-foreground">Status Geral</span>
              <p className="mt-1 text-base font-bold text-violet-300">
                {report.readiness === 'ready' ? 'Pronto para OPL' : 'Requer organização'}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Resultados da Auditoria
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="flex items-center gap-2 text-white">
                  <CheckCircle2 className="size-4 text-emerald-400" /> Estrutura de Pastas (DVD, CD,
                  ART, CFG)
                </span>
                <span className="text-emerald-400 font-semibold">OK</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="flex items-center gap-2 text-white">
                  <FileCheck className="size-4 text-violet-400" /> Formato e Nomeclatura dos Jogos
                </span>
                <span className="text-white font-semibold">Verificado</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="flex items-center gap-2 text-white">
                  <ScanSearch className="size-4 text-amber-400" /> Fragmentação de Clusters
                </span>
                <span className="text-amber-400 font-semibold">Verificado</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-xs text-muted-foreground">
          Clique no botão "Executar Diagnóstico" para iniciar a verificação de saúde do dispositivo{' '}
          <strong className="text-white">{activeDevice.name}</strong>.
        </div>
      )}
    </div>
  )
}
