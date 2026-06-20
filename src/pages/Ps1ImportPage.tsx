import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Disc, Files } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'
import { basename } from '@/utils/path'

const schema = z.object({ name: z.string().optional() })
type FormValues = z.infer<typeof schema>

export function Ps1ImportPage() {
  const [files, setFiles] = useState<string[]>([])
  const activeDevice = useDeviceStore((state) => state.activeDevice)
  const queryClient = useQueryClient()
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: '' } })
  const mutation = useMutation({
    mutationFn: (values: FormValues) => oplApi.copyPs1Game({ ...values, sourcePaths: files, devicePath: activeDevice!.path }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['history'] })
      await queryClient.invalidateQueries({ queryKey: ['summary'] })
    }
  })

  async function pickFiles() {
    const selected = await oplApi.openPathDialog({ mode: 'multiFile', filters: [{ name: 'PS1', extensions: ['bin', 'cue', 'iso'] }] })
    setFiles(selected)
    if (selected[0] && !form.getValues('name')) form.setValue('name', basename(selected[0]).replace(/\.(bin|cue|iso)$/i, ''))
  }

  if (!activeDevice) return <EmptyState icon={Disc} title="Selecione um dispositivo" description="Escolha o dispositivo ativo antes de importar jogos PS1." />

  return (
    <Card>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-white">Importador PS1</h2>
          <p className="mt-1 text-sm text-muted-foreground">Aceita .bin, .cue e .iso. Selecione BIN/CUE juntos para preservar o relacionamento.</p>
        </div>
        <Button variant="secondary" onClick={pickFiles}><Files className="size-4" /> Selecionar arquivos</Button>
      </div>
      <form className="grid gap-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <div className="space-y-2"><Label>Nome opcional</Label><Input {...form.register('name')} placeholder="Vazio mantem o nome de cada arquivo" /></div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm font-medium text-white">Arquivos selecionados: {files.length}</p>
          <div className="mt-2 max-h-32 overflow-auto text-xs text-muted-foreground">{files.map((file) => <p key={file}>{file}</p>)}</div>
        </div>
        <Button className="w-fit" disabled={files.length === 0 || mutation.isPending}>Importar para /PS1</Button>
      </form>
    </Card>
  )
}
