import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, FolderOpen, FolderPlus, RefreshCw, Search, Upload, UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CatalogGameCard } from '@/components/catalog/CatalogGameCard'
import { DownloadPlanModal } from '@/components/catalog/DownloadPlanModal'
import { LegalConfirmationModal } from '@/components/catalog/LegalConfirmationModal'
import { SmartFillButton } from '@/components/catalog/SmartFillButton'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'
import { useDownloadStore } from '@/stores/download-store'
import { useLocalLibraryStore } from '@/stores/local-library-store'
import { useDownloadFeedbackStore } from '@/stores/download-feedback-store'
import type {
  CatalogGame,
  CatalogQuery,
  LocalFolderAuthorization,
  SmartFillPlan
} from '@/types/opl'
import { formatBytes } from '@/utils/format'

export function EssentialsCatalogPage() {
  const { t } = useTranslation()
  const activeDevice = useDeviceStore((state) => state.activeDevice)
  const upsertTask = useDownloadStore((state) => state.upsertTask)
  const queryClient = useQueryClient()
  const notifyDownload = useDownloadFeedbackStore((state) => state.notify)
  const [query, setQuery] = useState<CatalogQuery>({
    search: '',
    tier: 'all',
    mediaType: 'all',
    priority: 'all'
  })
  const [selected, setSelected] = useState<CatalogGame[]>([])
  const [plan, setPlan] = useState<SmartFillPlan | null>(null)
  const [planOpen, setPlanOpen] = useState(false)
  const [legalOpen, setLegalOpen] = useState(false)
  const [targetKind, setTargetKind] = useState<'opl-device' | 'local-folder'>(() =>
    activeDevice ? 'opl-device' : 'local-folder'
  )
  const localFolder = useLocalLibraryStore((state) => state.folder)
  const setLocalFolder = useLocalLibraryStore((state) => state.setFolder)
  const [collisionPolicy, setCollisionPolicy] = useState<'fail' | 'rename'>('rename')
  const [showSubfolder, setShowSubfolder] = useState(false)
  const [subfolderName, setSubfolderName] = useState('')
  const [destinationError, setDestinationError] = useState('')
  const [source, setSource] = useState<'official' | 'custom'>('official')
  const [showManualForm, setShowManualForm] = useState(false)
  const [manualEntry, setManualEntry] = useState({
    title: '',
    fileName: '',
    url: '',
    sizeBytes: '',
    mediaType: 'ps2-dvd' as 'ps2-dvd' | 'ps2-cd' | 'ps1'
  })
  const [manualError, setManualError] = useState('')
  const [csvErrors, setCsvErrors] = useState<string[]>([])

  const officialQuery = useQuery({
    queryKey: ['essentials-catalog', query],
    queryFn: () => oplApi.listEssentialsCatalog(query),
    enabled: source === 'official'
  })
  const customQuery = useQuery({
    queryKey: ['custom-essentials-catalog', query],
    queryFn: () => oplApi.listCustomCatalog(query),
    enabled: source === 'custom'
  })
  const catalogQuery = source === 'official' ? officialQuery : customQuery

  const addManualEntryMutation = useMutation({
    mutationFn: () =>
      oplApi.addCustomCatalogEntry({
        title: manualEntry.title,
        fileName: manualEntry.fileName,
        url: manualEntry.url,
        sizeBytes: manualEntry.sizeBytes ? Number(manualEntry.sizeBytes) : undefined,
        mediaType: manualEntry.mediaType
      }),
    onSuccess: () => {
      setManualEntry({ title: '', fileName: '', url: '', sizeBytes: '', mediaType: 'ps2-dvd' })
      setManualError('')
      setShowManualForm(false)
      void queryClient.invalidateQueries({ queryKey: ['custom-essentials-catalog'] })
    },
    onError: (err) =>
      setManualError(
        err instanceof Error ? err.message : t('pages.essentialsCatalog.addEntryError')
      )
  })
  const importCsvMutation = useMutation({
    mutationFn: async () => {
      const [filePath] = await oplApi.openPathDialog({
        mode: 'file',
        filters: [{ name: 'CSV', extensions: ['csv'] }]
      })
      if (!filePath) return null
      return oplApi.importCustomCatalogCsv(filePath)
    },
    onSuccess: (result) => {
      if (!result) return
      setCsvErrors(result.errors)
      void queryClient.invalidateQueries({ queryKey: ['custom-essentials-catalog'] })
    }
  })
  const removeCustomEntryMutation = useMutation({
    mutationFn: (id: string) => oplApi.removeCustomCatalogEntry(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['custom-essentials-catalog'] })
  })
  const smartFillMutation = useMutation({
    mutationFn: () => oplApi.createSmartFillPlan(activeDevice!.path, 500 * 1000 ** 3),
    onSuccess: (nextPlan) => {
      setPlan(nextPlan)
      setPlanOpen(true)
    }
  })
  const refreshLinksMutation = useMutation({
    mutationFn: oplApi.refreshEssentialsSourceLinks,
    onSuccess: () => void catalogQuery.refetch()
  })
  const addMutation = useMutation({
    mutationFn: async (confirmation: string) => {
      if (targetKind === 'local-folder') {
        if (!localFolder) throw new Error(t('pages.essentialsCatalog.selectLocalFolderError') ?? '')
        await Promise.all(
          selected.map((game) =>
            oplApi.enqueueDownload({
              source: {
                kind: 'http',
                url: game.url,
                expectedBytes: game.sizeBytes,
                originalFileName: game.fileName
              },
              target: {
                kind: 'local-folder',
                authorizationId: localFolder.authorizationId,
                rootToken: localFolder.rootToken,
                collisionPolicy
              },
              title: game.title,
              legalReceiptId: confirmation
            })
          )
        )
        return []
      }
      if (!activeDevice) throw new Error(t('pages.essentialsCatalog.selectOplDeviceError') ?? '')
      return oplApi.addCatalogGamesToQueue({
        devicePath: activeDevice.path,
        games: selected,
        legalConfirmationText: confirmation
      })
    },
    onSuccess: async (tasks) => {
      notifyDownload(
        t('pages.essentialsCatalog.downloadStartedNotification', { count: selected.length }),
        'started'
      )
      tasks.forEach(upsertTask)
      setSelected([])
      setLegalOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['durable-downloads'] })
    }
  })

  const totalSelected = useMemo(
    () => selected.reduce((total, game) => total + (game.sizeBytes ?? 0), 0),
    [selected]
  )

  function toggle(game: CatalogGame) {
    setSelected((current) =>
      current.some((item) => item.id === game.id)
        ? current.filter((item) => item.id !== game.id)
        : [game, ...current]
    )
  }

  function usePlan() {
    if (!plan) return
    setSelected(plan.selectedGames)
    setPlanOpen(false)
  }

  async function chooseLocalFolder(): Promise<LocalFolderAuthorization | undefined> {
    setDestinationError('')
    const [selectedPath] = await oplApi.openPathDialog({ mode: 'folder' })
    if (!selectedPath) return undefined
    const authorization = await oplApi.authorizeLocalFolder(selectedPath)
    setLocalFolder(authorization)
    return authorization
  }

  async function createDestinationSubfolder() {
    setDestinationError('')
    try {
      const parent = localFolder ?? (await chooseLocalFolder())
      if (!parent) return
      const folder = await oplApi.createLocalFolder({
        authorizationId: parent.authorizationId,
        rootToken: parent.rootToken,
        folderName: subfolderName
      })
      setLocalFolder(folder)
      setSubfolderName('')
      setShowSubfolder(false)
    } catch (error) {
      setDestinationError(
        error instanceof Error ? error.message : t('pages.essentialsCatalog.createFolderError')
      )
    }
  }

  async function beginSelectedDownload() {
    if (targetKind === 'local-folder' && !localFolder) {
      const authorization = await chooseLocalFolder()
      if (!authorization) return
    }
    setLegalOpen(true)
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">
              {t('pages.essentialsCatalog.title')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('pages.essentialsCatalog.subtitle')}
            </p>
          </div>
          <div className="flex gap-2">
            {source === 'official' ? (
              <>
                <Button
                  variant="secondary"
                  disabled={refreshLinksMutation.isPending}
                  onClick={() => refreshLinksMutation.mutate()}
                >
                  <RefreshCw className="size-4" /> {t('pages.essentialsCatalog.checkLinks')}
                </Button>
                <SmartFillButton
                  disabled={!activeDevice || smartFillMutation.isPending}
                  onClick={() => smartFillMutation.mutate()}
                />
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setShowManualForm((value) => !value)}>
                  <UserPlus className="size-4" /> {t('pages.essentialsCatalog.addManually')}
                </Button>
                <Button
                  variant="secondary"
                  disabled={importCsvMutation.isPending}
                  onClick={() => importCsvMutation.mutate()}
                >
                  <Upload className="size-4" /> {t('pages.essentialsCatalog.importCsv')}
                </Button>
              </>
            )}
            <Button
              disabled={selected.length === 0 || (targetKind === 'opl-device' && !activeDevice)}
              onClick={() => void beginSelectedDownload()}
            >
              <Download className="size-4" /> {t('pages.essentialsCatalog.addSelected')}
            </Button>
          </div>
        </div>

        <div className="mt-4 flex gap-2 border-b border-white/10">
          <button
            type="button"
            className={`px-3 py-2 text-sm font-medium ${source === 'official' ? 'border-b-2 border-violet-400 text-white' : 'text-muted-foreground'}`}
            onClick={() => {
              setSource('official')
              setSelected([])
            }}
          >
            {t('pages.essentialsCatalog.officialCatalog')}
          </button>
          <button
            type="button"
            className={`px-3 py-2 text-sm font-medium ${source === 'custom' ? 'border-b-2 border-violet-400 text-white' : 'text-muted-foreground'}`}
            onClick={() => {
              setSource('custom')
              setSelected([])
            }}
          >
            {t('pages.essentialsCatalog.myList')}
          </button>
        </div>

        {source === 'custom' && showManualForm && (
          <div className="mt-4 grid gap-3 rounded-xl border border-violet-400/20 bg-violet-500/5 p-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('pages.essentialsCatalog.titleLabel')}</Label>
              <Input
                value={manualEntry.title}
                onChange={(event) =>
                  setManualEntry((current) => ({ ...current, title: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t('pages.essentialsCatalog.fileNameLabel')}</Label>
              <Input
                value={manualEntry.fileName}
                onChange={(event) =>
                  setManualEntry((current) => ({ ...current, fileName: event.target.value }))
                }
                placeholder={t('pages.essentialsCatalog.fileNamePlaceholder') ?? ''}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>{t('pages.essentialsCatalog.urlLabel')}</Label>
              <Input
                value={manualEntry.url}
                onChange={(event) =>
                  setManualEntry((current) => ({ ...current, url: event.target.value }))
                }
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label>{t('pages.essentialsCatalog.sizeLabel')}</Label>
              <Input
                type="number"
                value={manualEntry.sizeBytes}
                onChange={(event) =>
                  setManualEntry((current) => ({ ...current, sizeBytes: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t('pages.essentialsCatalog.mediaTypeLabel')}</Label>
              <Select
                value={manualEntry.mediaType}
                onChange={(event) =>
                  setManualEntry((current) => ({
                    ...current,
                    mediaType: event.target.value as typeof manualEntry.mediaType
                  }))
                }
              >
                <option value="ps2-dvd">{t('pages.essentialsCatalog.mediaPs2Dvd')}</option>
                <option value="ps2-cd">{t('pages.essentialsCatalog.mediaPs2Cd')}</option>
                <option value="ps1">{t('pages.essentialsCatalog.mediaPs1')}</option>
              </Select>
            </div>
            {manualError ? (
              <p className="text-sm text-red-300 md:col-span-2">{manualError}</p>
            ) : null}
            <div className="md:col-span-2">
              <Button
                disabled={
                  addManualEntryMutation.isPending ||
                  !manualEntry.title.trim() ||
                  !manualEntry.fileName.trim() ||
                  !manualEntry.url.trim()
                }
                onClick={() => addManualEntryMutation.mutate()}
              >
                {t('pages.essentialsCatalog.addToMyList')}
              </Button>
            </div>
          </div>
        )}
        {source === 'custom' && csvErrors.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-amber-200">
            <p className="font-medium">{t('pages.essentialsCatalog.csvErrorsTitle')}</p>
            <ul className="mt-1 list-disc pl-5">
              {csvErrors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 grid items-end gap-3 rounded-xl border border-white/10 bg-black/20 p-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>{t('pages.essentialsCatalog.downloadToLabel')}</Label>
            <Select
              value={targetKind}
              onChange={(event) => setTargetKind(event.target.value as typeof targetKind)}
            >
              <option value="opl-device">{t('pages.essentialsCatalog.targetOplDevice')}</option>
              <option value="local-folder">{t('pages.essentialsCatalog.targetLocalFolder')}</option>
            </Select>
          </div>
          {targetKind === 'local-folder' && (
            <>
              <div className="min-w-0 space-y-2">
                <Label>{t('pages.essentialsCatalog.authorizedFolderLabel')}</Label>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="h-11 min-w-0 flex-1 justify-start px-3"
                    title={localFolder?.displayLabel}
                    onClick={() => void chooseLocalFolder()}
                  >
                    <FolderOpen className="size-4 shrink-0 text-violet-300" />
                    <span className="truncate">
                      {localFolder?.displayLabel ||
                        t('pages.essentialsCatalog.selectDestinationFolder')}
                    </span>
                  </Button>
                  <Button
                    variant="secondary"
                    className="size-11 shrink-0 px-0"
                    title={t('pages.essentialsCatalog.createSubfolderTitle') ?? ''}
                    onClick={() => setShowSubfolder((value) => !value)}
                  >
                    <FolderPlus className="size-4 text-violet-300" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('pages.essentialsCatalog.ifFileExistsLabel')}</Label>
                <Select
                  value={collisionPolicy}
                  onChange={(event) =>
                    setCollisionPolicy(event.target.value as typeof collisionPolicy)
                  }
                >
                  <option value="rename">{t('pages.essentialsCatalog.renameWithSuffix')}</option>
                  <option value="fail">{t('pages.essentialsCatalog.doNotReplace')}</option>
                </Select>
              </div>
            </>
          )}
        </div>
        {targetKind === 'local-folder' && showSubfolder ? (
          <div className="mt-3 flex items-end gap-2 rounded-xl border border-violet-400/20 bg-violet-500/5 p-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Label>
                {t('pages.essentialsCatalog.newSubfolderIn', {
                  location:
                    localFolder?.displayLabel || t('pages.essentialsCatalog.locationToChoose')
                })}
              </Label>
              <Input
                value={subfolderName}
                onChange={(event) => setSubfolderName(event.target.value)}
                placeholder={t('pages.essentialsCatalog.subfolderPlaceholder') ?? ''}
              />
            </div>
            <Button
              disabled={!subfolderName.trim()}
              onClick={() => void createDestinationSubfolder()}
            >
              {t('pages.essentialsCatalog.createAndUse')}
            </Button>
          </div>
        ) : null}
        {targetKind === 'local-folder' && localFolder ? (
          <p className="mt-2 text-xs text-emerald-300">
            {t('pages.essentialsCatalog.filesSavedIn', { location: localFolder.displayLabel })}
          </p>
        ) : null}
        {destinationError ? <p className="mt-2 text-xs text-red-300">{destinationError}</p> : null}
        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_150px_170px_180px_auto]">
          <div className="space-y-2">
            <Label>{t('pages.essentialsCatalog.searchLabel')}</Label>
            <Input
              value={query.search ?? ''}
              onChange={(event) =>
                setQuery((current) => ({ ...current, search: event.target.value }))
              }
              placeholder={t('pages.essentialsCatalog.searchPlaceholder') ?? ''}
            />
          </div>
          {source === 'official' && (
            <div className="space-y-2">
              <Label>{t('pages.essentialsCatalog.tierLabel')}</Label>
              <Select
                value={query.tier}
                onChange={(event) =>
                  setQuery((current) => ({
                    ...current,
                    tier: event.target.value as CatalogQuery['tier']
                  }))
                }
              >
                <option value="all">{t('pages.essentialsCatalog.tierAll')}</option>
                <option value="S">S</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="Unrated">Unrated</option>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>{t('pages.essentialsCatalog.mediaLabel')}</Label>
            <Select
              value={query.mediaType}
              onChange={(event) =>
                setQuery((current) => ({
                  ...current,
                  mediaType: event.target.value as CatalogQuery['mediaType']
                }))
              }
            >
              <option value="all">{t('pages.essentialsCatalog.mediaAll')}</option>
              <option value="ps2-dvd">PS2 DVD</option>
              <option value="ps2-cd">PS2 CD</option>
            </Select>
          </div>
          {source === 'official' && (
            <div className="space-y-2">
              <Label>{t('pages.essentialsCatalog.priorityLabel')}</Label>
              <Select
                value={query.priority}
                onChange={(event) =>
                  setQuery((current) => ({
                    ...current,
                    priority: event.target.value as CatalogQuery['priority']
                  }))
                }
              >
                <option value="all">{t('pages.essentialsCatalog.priorityAll')}</option>
                <option value="must-have">{t('pages.essentialsCatalog.priorityMustHave')}</option>
                <option value="recommended">
                  {t('pages.essentialsCatalog.priorityRecommended')}
                </option>
                <option value="unrated">{t('pages.essentialsCatalog.priorityUnrated')}</option>
              </Select>
            </div>
          )}
          <Button variant="secondary" onClick={() => void catalogQuery.refetch()}>
            <Search className="size-4" /> {t('pages.essentialsCatalog.refresh')}
          </Button>
        </div>
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-muted-foreground">
          {t('pages.essentialsCatalog.selectedSummary', {
            count: selected.length,
            size: formatBytes(totalSelected)
          })}
          {refreshLinksMutation.data
            ? t('pages.essentialsCatalog.accessibleLinks', {
                accessible: refreshLinksMutation.data.links.filter((link) => link.accessible)
                  .length,
                total: refreshLinksMutation.data.links.length
              })
            : ''}
        </div>
        {addMutation.isError ? (
          <p className="mt-3 text-sm text-red-300">{(addMutation.error as Error).message}</p>
        ) : null}
      </Card>

      {!activeDevice && targetKind === 'opl-device' ? (
        <EmptyState
          icon={Download}
          title={t('pages.essentialsCatalog.selectDeviceTitle')}
          description={t('pages.essentialsCatalog.selectDeviceDescription')}
        />
      ) : null}
      {catalogQuery.isLoading ? (
        <Card>
          <p className="text-sm text-muted-foreground">
            {source === 'official'
              ? t('pages.essentialsCatalog.loadingOfficialCatalog')
              : t('pages.essentialsCatalog.loadingCustomCatalog')}
          </p>
        </Card>
      ) : null}
      {catalogQuery.isError ? (
        <Card className="border-red-400/20 bg-red-500/10">
          <p className="text-sm text-red-200">{t('pages.essentialsCatalog.loadError')}</p>
        </Card>
      ) : null}
      {!catalogQuery.isLoading &&
      !catalogQuery.isError &&
      (catalogQuery.data ?? []).length === 0 ? (
        <EmptyState
          icon={Search}
          title={t('pages.essentialsCatalog.noGamesFoundTitle')}
          description={
            source === 'official'
              ? t('pages.essentialsCatalog.noGamesOfficialHint')
              : t('pages.essentialsCatalog.noGamesCustomHint')
          }
        />
      ) : null}
      <div className="grid gap-4">
        {(catalogQuery.data ?? []).map((game) => (
          <CatalogGameCard
            key={game.id}
            game={game}
            selected={selected.some((item) => item.id === game.id)}
            onToggle={() => toggle(game)}
            onRemove={
              source === 'custom' ? () => removeCustomEntryMutation.mutate(game.id) : undefined
            }
          />
        ))}
      </div>
      <DownloadPlanModal
        open={planOpen}
        plan={plan}
        onOpenChange={setPlanOpen}
        onUsePlan={usePlan}
      />
      <LegalConfirmationModal
        open={legalOpen}
        games={selected}
        onOpenChange={setLegalOpen}
        onConfirm={(text) => addMutation.mutate(text)}
      />
    </div>
  )
}
