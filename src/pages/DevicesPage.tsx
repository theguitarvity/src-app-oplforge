import { HardDrive } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { DeviceCard } from '@/components/DeviceCard'
import { EmptyState } from '@/components/EmptyState'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'
import { DiagnosticSummary } from '@/components/diagnostics/DiagnosticSummary'
import { ReorganizationWizard } from '@/components/diagnostics/ReorganizationWizard'

export function DevicesPage() {
  const activeDevice = useDeviceStore((state) => state.activeDevice)
  const setActiveDevice = useDeviceStore((state) => state.setActiveDevice)
  const queryClient = useQueryClient()
  const diagnostic = useMutation({
    mutationFn: (devicePath: string) =>
      oplApi.runDiagnostics({
        devicePath,
        fileSystem: devices.find((item) => item.path === devicePath)?.fileSystem
      }),
    onSuccess: (result) =>
      queryClient.setQueryData(['device-catalog', result.device.deviceId], result.catalog)
  })
  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: oplApi.listDevices
  })

  if (!isLoading && devices.length === 0) {
    return (
      <EmptyState
        icon={HardDrive}
        title="Nenhum dispositivo encontrado"
        description="No Linux, volumes montados em /media, /mnt ou /run/media sao listados automaticamente."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-white">Gerenciador de Dispositivos</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Selecione o dispositivo ativo para preparar estrutura, importar jogos e instalar apps.
        </p>
      </div>
      <div className="grid gap-4">
        {devices.map((device) => (
          <DeviceCard
            key={device.id}
            device={device}
            selected={activeDevice?.path === device.path}
            onSelect={() => {
              setActiveDevice(device)
              void queryClient.invalidateQueries({ queryKey: ['device-catalog'] })
              diagnostic.mutate(device.path)
            }}
          />
        ))}
      </div>
      {diagnostic.data ? <DiagnosticSummary diagnostic={diagnostic.data} /> : null}
      {diagnostic.data?.readiness === 'requires-reorganization' && activeDevice ? (
        <ReorganizationWizard device={activeDevice} />
      ) : null}
      {diagnostic.error ? (
        <p className="text-red-300">
          Não foi possível verificar o dispositivo: {diagnostic.error.message}
        </p>
      ) : null}
    </div>
  )
}
