import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DatabaseZap, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { oplApi } from '@/services/api'
import type { ManagedSourceConfig, SourceType } from '@/types/opl'

const schema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Informe um nome.'),
  type: z.enum(['internet-archive', 'internet-archive-directory', 'internet-archive-art-pack', 'local-folder', 'direct-url', 'torrent', 'magnet']),
  enabled: z.boolean(),
  baseUrl: z.string().optional(),
  defaultQuery: z.string().optional(),
  creator: z.string().optional(),
  collection: z.string().optional()
})

type FormValues = z.infer<typeof schema>

const defaults: FormValues = {
  name: 'Internet Archive',
  type: 'internet-archive',
  enabled: true,
  baseUrl: 'https://archive.org',
  defaultQuery: '',
  creator: '',
  collection: ''
}

export function SourceSettingsPage() {
  const queryClient = useQueryClient()
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults })
  const { data: sources = [] } = useQuery({ queryKey: ['managed-sources'], queryFn: oplApi.listManagedSources })
  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => oplApi.saveManagedSource(values as ManagedSourceConfig),
    onSuccess: async () => {
      form.reset(defaults)
      await queryClient.invalidateQueries({ queryKey: ['managed-sources'] })
    }
  })
  const removeMutation = useMutation({
    mutationFn: (id: string) => oplApi.removeManagedSource(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['managed-sources'] })
  })

  function edit(source: ManagedSourceConfig) {
    form.reset({
      id: source.id,
      name: source.name,
      type: source.type as SourceType,
      enabled: source.enabled,
      baseUrl: source.baseUrl ?? '',
      defaultQuery: source.defaultQuery ?? '',
      creator: source.creator ?? '',
      collection: source.collection ?? ''
    })
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <Card className="h-fit">
        <div className="mb-5 flex items-center gap-3"><DatabaseZap className="size-6 text-violet-200" /><div><h2 className="text-2xl font-semibold text-white">Configurações de Fonte</h2><p className="text-sm text-muted-foreground">Cadastre fontes externas para busca e downloads.</p></div></div>
        <form className="grid gap-4" onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}>
          <div className="space-y-2"><Label>Nome</Label><Input {...form.register('name')} /></div>
          <div className="space-y-2"><Label>Tipo</Label><Select {...form.register('type')}><option value="internet-archive">Internet Archive Search</option><option value="internet-archive-directory">Internet Archive Directory</option><option value="internet-archive-art-pack">Internet Archive ART Pack</option><option value="local-folder">Local Folder</option><option value="direct-url">HTTP/HTTPS direto</option><option value="torrent">Torrent</option><option value="magnet">Magnet</option></Select></div>
          <div className="space-y-2"><Label>URL base</Label><Input {...form.register('baseUrl')} placeholder="https://archive.org" /></div>
          <div className="space-y-2"><Label>Query padrão</Label><Input {...form.register('defaultQuery')} /></div>
          <div className="grid gap-3 md:grid-cols-2"><div className="space-y-2"><Label>Creator</Label><Input {...form.register('creator')} /></div><div className="space-y-2"><Label>Collection</Label><Input {...form.register('collection')} /></div></div>
          <label className="flex items-center gap-2 text-sm text-white/80"><input type="checkbox" className="size-4 accent-violet-500" {...form.register('enabled')} /> Ativa</label>
          {form.formState.errors.name ? <p className="text-sm text-red-300">{form.formState.errors.name.message}</p> : null}
          <div className="flex gap-2"><Button disabled={saveMutation.isPending}>Salvar fonte</Button><Button type="button" variant="secondary" onClick={() => form.reset(defaults)}>Nova</Button></div>
        </form>
      </Card>

      <div className="space-y-3">
        {sources.map((source) => (
          <Card key={source.id} className="flex items-center justify-between gap-4 py-4">
            <button className="text-left" onClick={() => edit(source)}>
              <p className="font-semibold text-white">{source.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{source.type} - {source.enabled ? 'ativa' : 'inativa'} - {source.baseUrl ?? source.defaultQuery ?? 'sem URL'}</p>
            </button>
            <Button variant="ghost" onClick={() => removeMutation.mutate(source.id)}><Trash2 className="size-4" /> Remover</Button>
          </Card>
        ))}
      </div>
    </div>
  )
}
