import { Activity, Boxes, Clock3, Database, Gamepad2, HardDrive, ShieldCheck } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { EmptyState } from '@/components/EmptyState'
import { StatCard } from '@/components/StatCard'
import { Card } from '@/components/ui/card'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'
import { formatBytes, formatDate } from '@/utils/format'

export function DashboardPage() {
  const activeDevice = useDeviceStore((state) => state.activeDevice)
  const { data: summary } = useQuery({
    queryKey: ['summary', activeDevice?.path],
    queryFn: () => oplApi.getDeviceSummary(activeDevice?.path)
  })

  const device = summary?.device ?? activeDevice

  if (!device) {
    return <EmptyState icon={HardDrive} title="Nenhum dispositivo ativo" description="Conecte um dispositivo USB ou HD externo e selecione-o na tela Dispositivos." />
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Capacidade total" value={formatBytes(device.total)} icon={Database} hint={device.fileSystem} />
        <StatCard label="Espaco usado" value={formatBytes(device.used)} icon={Activity} />
        <StatCard label="Espaco livre" value={formatBytes(device.free)} icon={ShieldCheck} />
        <StatCard label="Status" value={device.status === 'ready' ? 'Pronto' : 'Preparar'} icon={HardDrive} />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Jogos PS2" value={summary?.ps2Games ?? 0} icon={Gamepad2} />
        <StatCard label="Jogos PS1" value={summary?.ps1Games ?? 0} icon={Gamepad2} />
        <StatCard label="Apps" value={summary?.apps ?? 0} icon={Boxes} />
      </section>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Clock3 className="size-5 text-violet-200" />
          <h3 className="text-lg font-semibold text-white">Historico recente</h3>
        </div>
        <div className="space-y-3">
          {summary?.recentHistory.length ? summary.recentHistory.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div>
                <p className="font-medium text-white">{entry.operation}</p>
                <p className="text-sm text-muted-foreground">{entry.message ?? entry.destination}</p>
              </div>
              <span className="text-sm text-muted-foreground">{formatDate(entry.timestamp)}</span>
            </div>
          )) : <p className="text-sm text-muted-foreground">Nenhuma operacao registrada ainda.</p>}
        </div>
      </Card>
    </div>
  )
}
