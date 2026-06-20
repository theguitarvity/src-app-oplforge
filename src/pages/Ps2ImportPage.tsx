import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Disc3, FolderOpen } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'
import { basename } from '@/utils/path'

const schema = z.object({
  name: z.string().min(1, 'Informe o nome do jogo.'),
  mediaType: z.enum(['DVD', 'CD']),
  region: z.string().optional(),
  code: z.string().optional()
})

type FormValues = z.infer<typeof schema>

export function Ps2ImportPage() {
  const [files, setFiles] = useState<string[]>([])
  const activeDevice = useDeviceStore((state) => state.activeDevice)
  const queryClient = useQueryClient()
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { mediaType: 'DVD', name: '' } })
  const mutation = useMutation({
    mutationFn: (values: FormValues) => oplApi.copyGame({ ...values, sourcePaths: files, devicePath: activeDevice!.path }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['history'] })
      await queryClient.invalidateQueries({ queryKey: ['summary'] })
    }
  })

  async function pickFiles() {
    const selected = await oplApi.openPathDialog({ mode: 'multiFile', filters: [{ name: 'PS2 ISO', extensions: ['iso'] }] })
    if (selected.length) {
      setFiles(selected)
      if (!form.getValues('name')) form.setValue('name', basename(selected[0]).replace(/\.iso$/i, ''))
    }
  }

  async function pickFolder() {
    const [folder] = await oplApi.openPathDialog({ mode: 'folder' })
    if (!folder) return
    const sourceFiles = await oplApi.listSourceFiles({ provider: 'local-folder', rootPath: folder })
    const isos = sourceFiles.filter((file) => file.extension === '.iso').map((file) => file.path)
    setFiles(isos)
    if (isos[0] && !form.getValues('name')) form.setValue('name', basename(isos[0]).replace(/\.iso$/i, ''))
  }

  if (!activeDevice) return <EmptyState icon={Disc3} title="Selecione um dispositivo" description="Escolha o dispositivo ativo antes de importar jogos PS2." />

  return (
    <Card>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-white">Importador PS2</h2>
          <p className="mt-1 text-sm text-muted-foreground">Importe ISO unica, multiplas ISOs ou uma pasta contendo ISOs para /DVD ou /CD.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={pickFolder}><FolderOpen className="size-4" /> Pasta com ISOs</Button>
          <Button variant="secondary" onClick={pickFiles}><Disc3 className="size-4" /> Selecionar ISO</Button>
        </div>
      </div>

      <form className="grid gap-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label>Nome</Label><Input {...form.register('name')} placeholder="Ex: Gran Turismo 4" /></div>
          <div className="space-y-2"><Label>Tipo</Label><Select {...form.register('mediaType')}><option value="DVD">DVD</option><option value="CD">CD</option></Select></div>
          <div className="space-y-2"><Label>Regiao</Label><Input {...form.register('region')} placeholder="USA, EUR, JAP, BR" /></div>
          <div className="space-y-2"><Label>Codigo opcional</Label><Input {...form.register('code')} placeholder="SLUS_000.00" /></div>
        </div>
        {form.formState.errors.name ? <p className="text-sm text-red-300">{form.formState.errors.name.message}</p> : null}
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm font-medium text-white">Arquivos selecionados: {files.length}</p>
          <div className="mt-2 max-h-32 overflow-auto text-xs text-muted-foreground">{files.map((file) => <p key={file}>{file}</p>)}</div>
        </div>
        <Button className="w-fit" disabled={files.length === 0 || mutation.isPending}>Importar jogos PS2</Button>
      </form>
    </Card>
  )
}
