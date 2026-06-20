import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Boxes, PackagePlus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'

const suggestedApps = ['OPL', 'uLaunchELF', 'GSM', 'POPStarter', 'Memory Card Annihilator', 'HDL Dump']
const schema = z.object({ appName: z.string().min(1), sourcePath: z.string().min(1) })
type FormValues = z.infer<typeof schema>

export function AppsPage() {
  const [removeTarget, setRemoveTarget] = useState('')
  const activeDevice = useDeviceStore((state) => state.activeDevice)
  const queryClient = useQueryClient()
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { appName: 'OPL', sourcePath: '' } })
  const installMutation = useMutation({
    mutationFn: (values: FormValues) => oplApi.installApp({ ...values, devicePath: activeDevice!.path }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['history'] })
      await queryClient.invalidateQueries({ queryKey: ['summary'] })
    }
  })
  const removeMutation = useMutation({
    mutationFn: () => oplApi.removeApp(activeDevice!.path, removeTarget),
    onSuccess: async () => {
      setRemoveTarget('')
      await queryClient.invalidateQueries({ queryKey: ['history'] })
      await queryClient.invalidateQueries({ queryKey: ['summary'] })
    }
  })

  async function pickFile() {
    const [file] = await oplApi.openPathDialog({ mode: 'file' })
    if (file) form.setValue('sourcePath', file)
  }

  if (!activeDevice) return <EmptyState icon={Boxes} title="Selecione um dispositivo" description="Escolha o dispositivo ativo antes de instalar ou remover homebrews." />

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card>
        <div className="mb-6 flex items-center gap-3"><PackagePlus className="size-6 text-violet-200" /><div><h2 className="text-2xl font-semibold text-white">Apps & Homebrews</h2><p className="text-sm text-muted-foreground">Instale, atualize ou remova apps em /APPS/NOME_APP.</p></div></div>
        <form className="grid gap-4" onSubmit={form.handleSubmit((values) => installMutation.mutate(values))}>
          <div className="space-y-2"><Label>Nome do app</Label><Input {...form.register('appName')} placeholder="Ex: OPL" /></div>
          <div className="space-y-2"><Label>Arquivo local</Label><div className="flex gap-2"><Input {...form.register('sourcePath')} placeholder="Selecione um ELF, ZIP ou arquivo do app" /><Button type="button" variant="secondary" onClick={pickFile}>Buscar</Button></div></div>
          <Button className="w-fit" disabled={installMutation.isPending}>Instalar / Atualizar</Button>
        </form>
      </Card>

      <Card>
        <h3 className="font-semibold text-white">Catalogo inicial</h3>
        <div className="mt-4 space-y-2">
          {suggestedApps.map((app) => (
            <div key={app} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <button className="text-left text-sm text-white/80" onClick={() => form.setValue('appName', app)}>{app}</button>
              <Button size="sm" variant="ghost" onClick={() => setRemoveTarget(app)}><Trash2 className="size-4" /></Button>
            </div>
          ))}
        </div>
      </Card>

      <ConfirmDialog open={Boolean(removeTarget)} onOpenChange={(open) => !open && setRemoveTarget('')} title="Remover app?" description={`Remover ${removeTarget} de /APPS. Esta operacao exige confirmacao.`} confirmLabel="Remover" onConfirm={() => removeMutation.mutate()} />
    </div>
  )
}
