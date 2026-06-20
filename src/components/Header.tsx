import { RefreshCw } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'

export function Header() {
  const queryClient = useQueryClient()
  const activeDevice = useDeviceStore((state) => state.activeDevice)
  const { data: devices = [] } = useQuery({ queryKey: ['devices'], queryFn: oplApi.listDevices })

  return (
    <header className="relative z-10 flex h-20 items-center justify-between border-b border-white/10 bg-black/20 px-6 backdrop-blur-xl">
      <div>
        <p className="text-sm text-muted-foreground">Prepare, organize e gerencie seu HD do PS2 com facilidade.</p>
        <h2 className="mt-1 text-xl font-semibold text-white">
          {activeDevice ? activeDevice.name : devices.length ? 'Selecione um dispositivo' : 'Nenhum dispositivo detectado'}
        </h2>
      </div>
      <Button variant="secondary" onClick={() => void queryClient.invalidateQueries({ queryKey: ['devices'] })}>
        <RefreshCw className="size-4" /> Atualizar
      </Button>
    </header>
  )
}
