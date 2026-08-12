import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Boxes,
  ExternalLink,
  FolderOpen,
  HardDrive,
  MemoryStick,
  PackagePlus,
  Play,
  Search,
  Trash2
} from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'

const source = 'https://www.psx-place.com/resources/categories/apps.23/'
const catalog = [
  {
    name: 'wLaunchELF R3Z',
    version: '4.76',
    descriptionKey: 'wLaunchELF',
    url: 'https://www.psx-place.com/resources/wlaunchelf-r3z-fork.1492/'
  },
  {
    name: 'Apollo Save Tool',
    version: '1.0.2',
    descriptionKey: 'ApolloSaveTool',
    url: 'https://www.psx-place.com/resources/apollo-save-tool-ps2.1251/'
  },
  {
    name: 'Memory Card Annihilator',
    version: '2.2.0',
    descriptionKey: 'MemoryCardAnnihilator',
    url: 'https://www.psx-place.com/resources/memory-card-annihilator-coded-by-ffgriever-gfx-by-berion.673/'
  },
  {
    name: 'Simple Media System',
    version: '3.0',
    descriptionKey: 'SimpleMediaSystem',
    url: 'https://www.psx-place.com/resources/categories/apps.23/'
  },
  {
    name: 'PS2 Controller Tester',
    version: '1.21',
    descriptionKey: 'PS2ControllerTester',
    url: 'https://www.psx-place.com/resources/ps2-controller-tester-by-jbit.670/'
  },
  {
    name: 'DKWDRV',
    version: '1.7.6o',
    descriptionKey: 'DKWDRV',
    url: 'https://www.psx-place.com/resources/dkwdrv.1294/'
  }
] as const
const schema = z.object({
  appName: z.string().min(1),
  sourcePath: z
    .string()
    .min(1)
    .refine((value) => value.toLowerCase().endsWith('.elf'), 'appNameRequired')
})
type FormValues = z.infer<typeof schema>

export function AppsPage() {
  const { t } = useTranslation()
  const [removeTarget, setRemoveTarget] = useState('')
  const [search, setSearch] = useState('')
  const activeDevice = useDeviceStore((state) => state.activeDevice)
  const queryClient = useQueryClient()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { appName: '', sourcePath: '' }
  })
  const installed = useQuery({
    queryKey: ['installed-apps', activeDevice?.path],
    queryFn: () => oplApi.listInstalledApps(activeDevice!.path),
    enabled: Boolean(activeDevice)
  })
  const installMutation = useMutation({
    mutationFn: (values: FormValues) =>
      oplApi.installApp({ ...values, devicePath: activeDevice!.path }),
    onSuccess: async () => {
      form.reset({ appName: '', sourcePath: '' })
      await installed.refetch()
      await queryClient.invalidateQueries({ queryKey: ['history'] })
      await queryClient.invalidateQueries({ queryKey: ['summary'] })
    }
  })
  const removeMutation = useMutation({
    mutationFn: () => oplApi.removeApp(activeDevice!.path, removeTarget),
    onSuccess: async () => {
      setRemoveTarget('')
      await installed.refetch()
      await queryClient.invalidateQueries({ queryKey: ['history'] })
      await queryClient.invalidateQueries({ queryKey: ['summary'] })
    }
  })
  async function pickFile() {
    const [file] = await oplApi.openPathDialog({
      mode: 'file',
      filters: [{ name: 'Aplicativo PS2', extensions: ['elf'] }]
    })
    if (file) {
      form.setValue('sourcePath', file, { shouldValidate: true })
      if (!form.getValues('appName'))
        form.setValue(
          'appName',
          file
            .split(/[\\/]/)
            .pop()
            ?.replace(/\.elf$/i, '') ?? ''
        )
    }
  }
  if (!activeDevice)
    return (
      <EmptyState
        icon={Boxes}
        title={t('pages.apps.selectDeviceTitle')}
        description={t('pages.apps.selectDeviceDescription')}
      />
    )
  const filtered = catalog.filter((app) =>
    `${app.name} ${t(`pages.apps.catalog.${app.descriptionKey}`)}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )
  return (
    <div className="space-y-5">
      <Card className="bg-gradient-to-br from-violet-500/15 via-card/80 to-cyan-500/10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="mb-3 inline-flex rounded-xl bg-violet-400/10 p-2 text-violet-300">
              <Boxes className="size-5" />
            </span>
            <h2 className="text-2xl font-semibold text-white">{t('pages.apps.title')}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              {t('pages.apps.subtitle')}
            </p>
          </div>
          <Button variant="secondary" onClick={() => oplApi.openExternalUrl(source)}>
            <ExternalLink className="size-4" />
            {t('pages.apps.openPsxPlace')}
          </Button>
        </div>
      </Card>
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Card>
            <div className="relative">
              <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
                placeholder={t('pages.apps.searchPlaceholder') ?? ''}
              />
            </div>
          </Card>
          <div className="grid gap-3 md:grid-cols-2">
            {filtered.map((app) => (
              <Card key={app.name} className="flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-white">{app.name}</h3>
                    <span className="text-xs text-violet-300">v{app.version}</span>
                  </div>
                  <PackagePlus className="size-5 text-muted-foreground" />
                </div>
                <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">
                  {t(`pages.apps.catalog.${app.descriptionKey}`)}
                </p>
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => oplApi.openExternalUrl(app.url)}
                  >
                    <ExternalLink className="size-3.5" />
                    {t('pages.apps.viewAndDownload')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => form.setValue('appName', app.name)}
                  >
                    {t('pages.apps.prepareInstall')}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Card>
            <div className="mb-5 flex items-center gap-3">
              <PackagePlus className="size-5 text-violet-200" />
              <div>
                <h3 className="font-semibold text-white">{t('pages.apps.installElfTitle')}</h3>
                <p className="text-xs text-muted-foreground">
                  {t('pages.apps.installDestination')}
                </p>
              </div>
            </div>
            <form
              className="grid gap-4"
              onSubmit={form.handleSubmit((values) => installMutation.mutate(values))}
            >
              <div className="space-y-2">
                <Label>{t('pages.apps.appNameLabel')}</Label>
                <Input
                  {...form.register('appName')}
                  placeholder={t('pages.apps.appNamePlaceholder') ?? ''}
                />
                {form.formState.errors.appName ? (
                  <p className="text-xs text-red-300">{form.formState.errors.appName.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>{t('pages.apps.downloadedExecutable')}</Label>
                <div className="flex gap-2">
                  <Input
                    {...form.register('sourcePath')}
                    placeholder={t('pages.apps.elfFilePlaceholder') ?? ''}
                  />
                  <Button type="button" variant="secondary" onClick={pickFile}>
                    <FolderOpen className="size-4" />
                  </Button>
                </div>
                {form.formState.errors.sourcePath ? (
                  <p className="text-xs text-red-300">{t('pages.apps.appNameRequired')}</p>
                ) : null}
              </div>
              <Button disabled={installMutation.isPending}>
                {installMutation.isPending
                  ? t('pages.apps.installing')
                  : t('pages.apps.installToHdd')}
              </Button>
              {installMutation.error ? (
                <p className="text-sm text-red-300" role="alert">
                  {installMutation.error.message}
                </p>
              ) : null}
              {installMutation.data ? (
                <p
                  className={`text-sm ${installMutation.data.result === 'success' ? 'text-emerald-300' : 'text-red-300'}`}
                >
                  {installMutation.data.message}
                </p>
              ) : null}
            </form>
          </Card>
          <Card>
            <h3 className="font-semibold text-white">{t('pages.apps.howToRunTitle')}</h3>
            <div className="mt-4 space-y-3">
              <Instruction
                icon={Play}
                title={t('pages.apps.viaOplTitle')}
                text={t('pages.apps.viaOplText')}
              />
              <Instruction
                icon={HardDrive}
                title={t('pages.apps.viaWlaunchelfTitle')}
                text={t('pages.apps.viaWlaunchelfText')}
              />
              <Instruction
                icon={MemoryStick}
                title={t('pages.apps.moveToMemoryCardTitle')}
                text={t('pages.apps.moveToMemoryCardText')}
              />
            </div>
          </Card>
        </div>
      </div>
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white">{t('pages.apps.installedOnDevice')}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{t('pages.apps.elfFoundInApps')}</p>
          </div>
          <span className="text-sm text-muted-foreground">{installed.data?.length ?? 0}</span>
        </div>
        {installed.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">{t('pages.apps.readingApps')}</p>
        ) : null}
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {installed.data?.map((app) => (
            <div
              key={app.relativePath}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"
            >
              <Play className="size-4 text-emerald-300" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{app.name}</p>
                <p className="truncate text-xs text-muted-foreground">{app.launchPath}</p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                aria-label={t('pages.apps.removeAppAriaLabel', { name: app.name }) ?? ''}
                onClick={() => setRemoveTarget(app.name)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        {!installed.isLoading && installed.data?.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{t('pages.apps.noElfInstalled')}</p>
        ) : null}
      </Card>
      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveTarget('')}
        title={t('pages.apps.removeAppTitle')}
        description={t('pages.apps.removeAppDescription', { name: removeTarget })}
        confirmLabel={t('pages.apps.remove')}
        onConfirm={() => removeMutation.mutate()}
      />
    </div>
  )
}

function Instruction({
  icon: Icon,
  title,
  text
}: {
  icon: typeof Play
  title: string
  text: string
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="rounded-lg bg-white/5 p-2">
        <Icon className="size-4 text-violet-300" />
      </span>
      <div>
        <p className="text-sm font-medium text-white">{title}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p>
      </div>
    </div>
  )
}
