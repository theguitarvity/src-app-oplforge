import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import type { InstallationPlan, InstallationResult } from '@/types/opl'

const schema = z.object({
  name: z.string().min(1, 'Informe o nome do jogo.'),
  oplProfileId: z.string().min(1, 'Selecione uma versão exata do OPL.'),
  authorized: z.literal(true, { message: 'Confirme que o backup é autorizado.' })
})

type FormValues = z.infer<typeof schema>

export function Ps2ImportPage() {
  const [files, setFiles] = useState<string[]>([])
  const [plan, setPlan] = useState<InstallationPlan | null>(null)
  const [result, setResult] = useState<InstallationResult | null>(null)
  const [replaceConfirmed, setReplaceConfirmed] = useState(false)
  const activeDevice = useDeviceStore((state) => state.activeDevice)
  const queryClient = useQueryClient()
  const profiles = useQuery({ queryKey: ['opl-profiles'], queryFn: () => oplApi.listOplProfiles() })
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', oplProfileId: '', authorized: false as true }
  })
  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const prepared =
        plan ??
        (await oplApi.planInstallation({
          sourcePath: files[0],
          devicePath: activeDevice!.path,
          title: values.name,
          oplProfileId: values.oplProfileId,
          fileSystem: activeDevice!.fileSystem
        }))
      if (!plan) {
        setPlan(prepared)
        return prepared
      }
      if (prepared.replaces && !replaceConfirmed)
        throw new Error('Confirme explicitamente a substituição do jogo existente.')
      return oplApi.confirmInstallation({
        operationId: prepared.id,
        expectedRevision: prepared.expectedRevision,
        confirmation: prepared.replaces
          ? 'SUBSTITUIR BACKUP AUTORIZADO'
          : 'INSTALAR BACKUP AUTORIZADO'
      })
    },
    onSuccess: async (value) => {
      if (!plan) return
      if ('destinationPaths' in value) setResult(value)
      setPlan(null)
      setFiles([])
      await queryClient.invalidateQueries({ queryKey: ['history'] })
      await queryClient.invalidateQueries({ queryKey: ['summary'] })
    }
  })

  async function pickFiles() {
    const selected = await oplApi.openPathDialog({
      mode: 'file',
      filters: [{ name: 'PS2 image', extensions: ['iso', 'zso'] }]
    })
    if (selected.length) {
      setFiles(selected)
      if (!form.getValues('name'))
        form.setValue('name', basename(selected[0]).replace(/\.iso$/i, ''))
    }
  }

  async function pickFolder() {
    const [folder] = await oplApi.openPathDialog({ mode: 'folder' })
    if (!folder) return
    const sourceFiles = await oplApi.listSourceFiles({ provider: 'local-folder', rootPath: folder })
    const images = sourceFiles
      .filter((file) => file.extension === '.iso' || file.extension === '.zso')
      .map((file) => file.path)
    setFiles(images)
    if (images[0] && !form.getValues('name'))
      form.setValue('name', basename(images[0]).replace(/\.(?:iso|zso)$/i, ''))
  }

  if (!activeDevice)
    return (
      <EmptyState
        icon={Disc3}
        title="Selecione um dispositivo"
        description="Escolha o dispositivo ativo antes de importar jogos PS2."
      />
    )

  return (
    <Card>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-white">Importador PS2</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A mídia, o Game ID e o formato são inspecionados antes da instalação transacional.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={pickFolder}>
            <FolderOpen className="size-4" /> Pasta com ISOs
          </Button>
          <Button variant="secondary" onClick={pickFiles}>
            <Disc3 className="size-4" /> Selecionar ISO
          </Button>
        </div>
      </div>

      <form
        className="grid gap-4"
        onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input {...form.register('name')} placeholder="Ex: Gran Turismo 4" />
          </div>
          <div className="space-y-2">
            <Label>Perfil OPL exato</Label>
            <Select {...form.register('oplProfileId')}>
              <option value="">Selecione</option>
              {profiles.data?.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.version} · {profile.variant}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {form.formState.errors.name ? (
          <p className="text-sm text-red-300">{form.formState.errors.name.message}</p>
        ) : null}
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm font-medium text-white">Arquivos selecionados: {files.length}</p>
          <div className="mt-2 max-h-32 overflow-auto text-xs text-muted-foreground">
            {files.map((file) => (
              <p key={file}>{file}</p>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" {...form.register('authorized')} /> Confirmo que possuo autorização
          para usar este backup.
        </label>
        {plan ? (
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 text-sm">
            <p className="font-medium text-white">Plano pronto para confirmação</p>
            <p>
              {plan.gameId} · {plan.media} · {plan.format}
            </p>
            <p className="break-all text-muted-foreground">
              Destino: {plan.destinationRelativePath}
            </p>
            <p className="text-muted-foreground">SHA-256: {plan.sourceSha256}</p>
            {plan.warnings.map((warning) => (
              <p key={warning} className="text-amber-300">
                {warning}
              </p>
            ))}
          </div>
        ) : null}
        {plan?.replaces ? (
          <label className="flex items-center gap-2 text-sm text-amber-200">
            <input
              type="checkbox"
              checked={replaceConfirmed}
              onChange={(event) => setReplaceConfirmed(event.target.checked)}
            />{' '}
            Confirmo a substituição; o jogo atual será preservado até a validação.
          </label>
        ) : null}
        {result ? (
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-4 text-sm text-emerald-100">
            <p>Instalação promovida e verificada: {result.verification}</p>
            <p>Contiguidade: {result.fragmentation}</p>
            <p className="break-all">Hash destino: {result.destinationSha256}</p>
          </div>
        ) : null}
        {mutation.error ? <p className="text-sm text-red-300">{mutation.error.message}</p> : null}
        <div className="flex gap-2">
          <Button className="w-fit" disabled={files.length !== 1 || mutation.isPending}>
            {plan ? 'Confirmar instalação' : 'Validar e criar plano'}
          </Button>
          {plan ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void oplApi.cancelInstallation(plan.id)
                setPlan(null)
              }}
            >
              Cancelar plano
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  )
}
