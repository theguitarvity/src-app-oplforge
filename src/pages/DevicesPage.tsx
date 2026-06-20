import { HardDrive } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { DeviceCard } from '@/components/DeviceCard'
import { EmptyState } from '@/components/EmptyState'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'

export function DevicesPage() {
  const activeDevice = useDeviceStore((state) => state.activeDevice)
  const setActiveDevice = useDeviceStore((state) => state.setActiveDevice)
  const { data: devices = [], isLoading } = useQuery({ queryKey: ['devices'], queryFn: oplApi.listDevices })

  if (!isLoading && devices.length === 0) {
    return <EmptyState icon={HardDrive} title="Nenhum dispositivo encontrado" description="No Linux, volumes montados em /media, /mnt ou /run/media sao listados automaticamente." />
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-white">Gerenciador de Dispositivos</h2>
        <p className="mt-1 text-sm text-muted-foreground">Selecione o dispositivo ativo para preparar estrutura, importar jogos e instalar apps.</p>
      </div>
      <div className="grid gap-4">
        {devices.map((device) => (
          <DeviceCard key={device.id} device={device} selected={activeDevice?.path === device.path} onSelect={() => setActiveDevice(device)} />
        ))}
      </div>
    </div>
  )
}
