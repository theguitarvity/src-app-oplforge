import { CheckCircle2, HardDrive, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { DeviceInfo } from '@/types/opl'
import { formatBytes } from '@/utils/format'

interface DeviceCardProps {
  device: DeviceInfo
  selected?: boolean
  onSelect?: () => void
}

export function DeviceCard({ device, selected, onSelect }: DeviceCardProps) {
  const usage = device.total > 0 ? Math.round((device.used / device.total) * 100) : 0

  return (
    <Card className={selected ? 'border-violet-400/50 bg-violet-500/10' : undefined}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-4">
          <div className="rounded-2xl bg-violet-500/15 p-3 text-violet-200">
            <HardDrive className="size-6" />
          </div>
          <div>
            <h3 className="font-semibold text-white">{device.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{device.path}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>{device.fileSystem}</span>
              <span>{formatBytes(device.free)} livres</span>
              <span>{formatBytes(device.total)} totais</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-xs text-white/80">
            {device.status === 'ready' ? <CheckCircle2 className="size-3 text-emerald-300" /> : <TriangleAlert className="size-3 text-amber-300" />}
            {device.status === 'ready' ? 'Pronto' : 'Preparar'}
          </span>
          <Button variant={selected ? 'secondary' : 'primary'} onClick={onSelect}>
            {selected ? 'Selecionado' : 'Selecionar'}
          </Button>
        </div>
      </div>
      <div className="mt-5 h-2 rounded-full bg-white/8">
        <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400" style={{ width: `${usage}%` }} />
      </div>
    </Card>
  )
}
