import { CheckCircle2, FolderOpen, HardDrive, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { DeviceInfo } from '@/types/opl'
import { formatBytes } from '@/utils/format'

interface DeviceCardProps {
  device: DeviceInfo
  selected?: boolean
  onSelect?: () => void
  onPrepare?: () => void
}

export function DeviceCard({ device, selected, onSelect, onPrepare }: DeviceCardProps) {
  const { t } = useTranslation()
  const usage = device.total > 0 ? Math.round((device.used / device.total) * 100) : 0

  return (
    <Card className={selected ? 'border-violet-400/50 bg-violet-500/10' : undefined}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-4">
          <div className="rounded-2xl bg-violet-500/15 p-3 text-violet-200">
            {device.sourceKind === 'local-folder' ? (
              <FolderOpen className="size-6" />
            ) : (
              <HardDrive className="size-6" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-white">{device.name}</h3>
            {device.sourceKind === 'local-folder' ? (
              <span className="mt-1 inline-flex rounded-md border border-cyan-400/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-200">
                {t('components.deviceCard.localLibrary')}
              </span>
            ) : null}
            <p className="mt-1 text-sm text-muted-foreground">{device.path}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>{device.fileSystem}</span>
              <span>{t('components.deviceCard.free', { value: formatBytes(device.free) })}</span>
              <span>{t('components.deviceCard.total', { value: formatBytes(device.total) })}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          {device.status === 'ready' ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-xs text-white/80">
              <CheckCircle2 className="size-3 text-emerald-300" />
              {t('components.deviceCard.ready')}
            </span>
          ) : (
            <button
              onClick={onPrepare}
              className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-200 hover:bg-amber-500/20"
            >
              <TriangleAlert className="size-3 text-amber-300" />
              {t('components.deviceCard.prepare')}
            </button>
          )}
          <Button variant={selected ? 'secondary' : 'primary'} onClick={onSelect}>
            {selected ? t('components.deviceCard.selected') : t('components.deviceCard.select')}
          </Button>
        </div>
      </div>
      <div className="mt-5 h-2 rounded-full bg-white/8">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400"
          style={{ width: `${usage}%` }}
        />
      </div>
    </Card>
  )
}
