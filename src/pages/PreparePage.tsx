import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldAlert, Wrench } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'

const dirs = ['DVD', 'CD', 'PS1', 'APPS', 'ART', 'CFG', 'VMC', 'README_OPL_FORGE.txt']

export function PreparePage() {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const activeDevice = useDeviceStore((state) => state.activeDevice)
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => oplApi.prepareDevice({ devicePath: activeDevice!.path }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['devices'] })
      await queryClient.invalidateQueries({ queryKey: ['history'] })
      await queryClient.invalidateQueries({ queryKey: ['summary'] })
      setConfirmOpen(false)
    }
  })

  if (!activeDevice) {
    return <EmptyState icon={Wrench} title="Selecione um dispositivo" description="Escolha um dispositivo ativo antes de criar a estrutura OPL." />
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-violet-500/15 p-3 text-violet-200"><Wrench className="size-6" /></div>
          <div>
            <h2 className="text-2xl font-semibold text-white">Preparar para OPL</h2>
            <p className="text-sm text-muted-foreground">Cria a estrutura padrao sem formatar ou apagar arquivos existentes.</p>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {dirs.map((dir) => <div key={dir} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-white/80">/{dir}</div>)}
        </div>
        <Button className="mt-6" size="lg" onClick={() => setConfirmOpen(true)} disabled={mutation.isPending}>
          Preparar para OPL
        </Button>
      </Card>

      <Card className="h-fit border-amber-400/20 bg-amber-500/10">
        <ShieldAlert className="size-6 text-amber-200" />
        <h3 className="mt-3 font-semibold text-white">Operacao segura</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Formatacao real permanece bloqueada por padrao via ENABLE_REAL_FORMAT=false. Este fluxo apenas cria pastas e README.
        </p>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Criar estrutura OPL?"
        description={`O dispositivo ${activeDevice.name} recebera as pastas OPL. Arquivos existentes nao serao removidos.`}
        confirmLabel="Preparar"
        onConfirm={() => mutation.mutate()}
      />
    </div>
  )
}
