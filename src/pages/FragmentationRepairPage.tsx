import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckSquare2, HardDrive, LoaderCircle, ScanSearch } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import {
  DiagnosticSummary,
  GameDiagnosticTable,
  RecoveryBanner,
  RepairPlanDialog,
  RepairProgress
} from '@/components/fragmentation-repair'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'
import type {
  FragmentationDiagnosisActivity,
  FragmentationInventoryItem,
  GameDiagnostic,
  RepairOperation,
  RepairPlan,
  RepairReport,
  ResolveRecoveryInput
} from '@/types/opl'

export function FragmentationRepairPage() {
  const { t } = useTranslation()
  const activeDevice = useDeviceStore((state) => state.activeDevice)
  const setActiveDevice = useDeviceStore((state) => state.setActiveDevice)
  const [selectedDeviceId, setSelectedDeviceId] = useState(activeDevice?.id ?? '')
  const [plan, setPlan] = useState<RepairPlan>()
  const [operation, setOperation] = useState<RepairOperation>()
  const [report, setReport] = useState<RepairReport>()
  const [selectedGames, setSelectedGames] = useState<string[]>([])
  const queryClient = useQueryClient()
  const devices = useQuery({ queryKey: ['devices'], queryFn: oplApi.listDevices })
  const selectedDevice = devices.data?.find((device) => device.id === selectedDeviceId)
  const inventory = useQuery({
    queryKey: ['fragmentation-inventory', selectedDevice?.path],
    queryFn: () => oplApi.listFragmentationGames(selectedDevice!.path),
    enabled: Boolean(selectedDevice)
  })
  const diagnosis = useMutation({
    mutationFn: () => {
      if (!selectedDevice)
        throw new Error(t('pages.fragmentationRepair.selectDeviceBeforeStart') ?? '')
      if (selectedGames.length === 0 && !inventory.isError)
        throw new Error(t('pages.fragmentationRepair.selectAtLeastOneGame') ?? '')
      return oplApi.diagnoseFragmentation({
        devicePath: selectedDevice.path,
        selectionKeys: selectedGames.length ? selectedGames : undefined
      })
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: ['fragmentation-diagnosis-activity', selectedDevice?.path]
      })
  })
  const diagnosisActivity = useQuery({
    queryKey: ['fragmentation-diagnosis-activity', selectedDevice?.path],
    queryFn: () => oplApi.getCurrentFragmentationDiagnosis(selectedDevice!.path),
    enabled: Boolean(selectedDevice),
    refetchInterval: (query) =>
      diagnosis.isPending || query.state.data?.status === 'running' ? 500 : false
  })
  const recovery = useQuery({
    queryKey: ['fragmentation-recovery', selectedDeviceId],
    queryFn: () => oplApi.listFragmentationRecovery(selectedDeviceId),
    enabled: Boolean(selectedDeviceId)
  })
  const resolveRecovery = useMutation({
    mutationFn: (input: ResolveRecoveryInput) => oplApi.resolveFragmentationRecovery(input),
    onSuccess: () => recovery.refetch()
  })
  const cancelDiagnosis = useMutation({
    mutationFn: (diagnosticId: string) => oplApi.cancelFragmentationDiagnosis(diagnosticId),
    onSettled: () => diagnosisActivity.refetch()
  })
  useEffect(
    () =>
      oplApi.onFragmentationRepairEvent((event) => {
        if (event.phase !== 'diagnosing' && event.phase !== 'diagnosis-complete') return
        void queryClient.invalidateQueries({
          queryKey: ['fragmentation-diagnosis-activity', selectedDevice?.path]
        })
      }),
    [queryClient, selectedDevice?.path]
  )
  const currentDiagnostic = diagnosis.isPending
    ? undefined
    : (diagnosis.data ?? diagnosisActivity.data?.diagnostic)
  const isDiagnosing = diagnosis.isPending || diagnosisActivity.data?.status === 'running'
  const planning = useMutation({
    mutationFn: ({ games, mode }: { games: GameDiagnostic[]; mode: 'single' | 'batch' }) => {
      if (!currentDiagnostic) throw new Error(t('pages.fragmentationRepair.noPlanError') ?? '')
      return oplApi.planFragmentationRepair({
        diagnosticId: currentDiagnostic.diagnosticId,
        expectedRevision: currentDiagnostic.revision,
        mode,
        installationIds: games.map((game) => game.identity.installationId)
      })
    },
    onSuccess: setPlan
  })
  const confirmation = useMutation({
    mutationFn: () => {
      if (!plan) throw new Error(t('pages.fragmentationRepair.noPlanAvailableError') ?? '')
      return oplApi.confirmFragmentationRepair({
        planId: plan.planId,
        expectedRevision: plan.revision,
        // Literal confirmation phrase expected by the backend — not localized (Constitution Principle I).
        confirmation: 'CORRIGIR FRAGMENTAÇÃO'
      })
    },
    onSuccess: (next) => {
      setOperation(next)
      setPlan(undefined)
    }
  })
  const loadReport = useCallback(async (operationId: string) => {
    const next = await oplApi.getFragmentationRepairReportByOperation(operationId)
    if (next) setReport(next)
  }, [])
  const planningError = planning.error as (Error & { code?: string }) | null
  const eligibleGames =
    currentDiagnostic?.installations.filter(
      (game) => game.state === 'fragmented' || game.state === 'partially-fragmented'
    ) ?? []
  function clearRepair() {
    setPlan(undefined)
    setOperation(undefined)
    setReport(undefined)
    planning.reset()
    confirmation.reset()
  }
  function diagnoseAgain() {
    clearRepair()
    diagnosis.mutate()
  }

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-2xl font-semibold text-white">
          {t('pages.fragmentationRepair.title')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('pages.fragmentationRepair.subtitle')}
        </p>
      </header>
      <section
        aria-labelledby="diagnosis-device-title"
        className="rounded-xl border border-white/10 bg-black/20 p-4"
      >
        <div className="flex items-center gap-3">
          <HardDrive className="size-5 text-violet-200" aria-hidden="true" />
          <h3 id="diagnosis-device-title" className="font-semibold text-white">
            {t('pages.fragmentationRepair.selectDeviceTitle')}
          </h3>
        </div>
        {devices.isLoading ? (
          <p className="mt-3 text-sm text-muted-foreground" role="status">
            {t('pages.fragmentationRepair.searchingDevices')}
          </p>
        ) : null}
        {devices.error ? (
          <p className="mt-3 text-sm text-red-300" role="alert">
            {t('pages.fragmentationRepair.listDevicesError', { message: devices.error.message })}
          </p>
        ) : null}
        {!devices.isLoading && !devices.error && devices.data?.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {t('pages.fragmentationRepair.noCompatibleDevice')}
          </p>
        ) : null}
        {devices.data && devices.data.length > 0 ? (
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm text-muted-foreground">
              {t('pages.fragmentationRepair.deviceLabel')}
              <Select
                value={selectedDeviceId}
                disabled={isDiagnosing}
                onChange={(event) => {
                  const nextId = event.target.value
                  setSelectedDeviceId(nextId)
                  setActiveDevice(devices.data?.find((device) => device.id === nextId) ?? null)
                  diagnosis.reset()
                  setSelectedGames([])
                  clearRepair()
                }}
                className="mt-1"
              >
                <option value="">{t('pages.fragmentationRepair.selectExplicitly')}</option>
                {devices.data.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name} — {device.fileSystem} — {device.path}
                  </option>
                ))}
              </Select>
            </label>
            <Button
              type="button"
              variant="secondary"
              onClick={() => inventory.refetch()}
              disabled={!selectedDevice || inventory.isFetching || isDiagnosing}
            >
              <ScanSearch className="size-4" aria-hidden="true" />
              {inventory.isFetching
                ? t('pages.fragmentationRepair.readingGames')
                : t('pages.fragmentationRepair.refreshList')}
            </Button>
            <Button
              type="button"
              onClick={diagnoseAgain}
              disabled={
                !selectedDevice ||
                isDiagnosing ||
                (!inventory.isError && selectedGames.length === 0)
              }
            >
              <ScanSearch className="size-4" aria-hidden="true" />
              {t('pages.fragmentationRepair.startDiagnosis')}
            </Button>
          </div>
        ) : null}
      </section>
      {selectedDevice ? (
        <GameSelection
          items={inventory.data?.items ?? []}
          selected={selectedGames}
          loading={inventory.isLoading || inventory.isFetching}
          error={inventory.error?.message}
          disabled={isDiagnosing}
          onChange={setSelectedGames}
          onDiagnose={diagnoseAgain}
        />
      ) : null}
      {recovery.data ? (
        <RecoveryBanner
          items={recovery.data}
          pending={resolveRecovery.isPending}
          error={resolveRecovery.error?.message}
          onResolve={(input) => resolveRecovery.mutate(input)}
        />
      ) : null}
      {recovery.error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-400/30 bg-red-400/5 p-4 text-red-200"
        >
          {t('pages.fragmentationRepair.recoveryError', { message: recovery.error.message })}
        </p>
      ) : null}
      {isDiagnosing ? (
        <DiagnosisProgress
          activity={diagnosisActivity.data}
          cancelling={cancelDiagnosis.isPending}
          onCancel={(diagnosticId) => cancelDiagnosis.mutate(diagnosticId)}
        />
      ) : null}
      {diagnosisActivity.data?.status === 'cancelled' && !isDiagnosing ? (
        <p
          className="rounded-xl border border-white/10 bg-black/20 p-4 text-muted-foreground"
          role="status"
        >
          {t('pages.fragmentationRepair.diagnosisCancelled')}
        </p>
      ) : null}
      {!isDiagnosing &&
      ((diagnosis.error && (diagnosis.error as Error & { code?: string }).code !== 'CANCELLED') ||
        diagnosisActivity.data?.status === 'failed') ? (
        <div
          className="rounded-xl border border-red-400/30 bg-red-400/5 p-4 text-red-200"
          role="alert"
        >
          <p className="font-medium">{t('pages.fragmentationRepair.diagnosisFailedTitle')}</p>
          {diagnosis.error ? <p className="mt-1 text-sm">{diagnosis.error.message}</p> : null}
          <p className="mt-1 text-sm">{t('pages.fragmentationRepair.diagnosisFailedHint')}</p>
        </div>
      ) : null}
      {currentDiagnostic?.status === 'complete' ? (
        <>
          <DiagnosticSummary diagnostic={currentDiagnostic} />
          {eligibleGames.length > 0 ? (
            <div className="flex justify-end">
              <Button
                type="button"
                disabled={planning.isPending || Boolean(operation)}
                onClick={() => planning.mutate({ games: eligibleGames, mode: 'batch' })}
              >
                {t('pages.fragmentationRepair.fixAllEligible', { count: eligibleGames.length })}
              </Button>
            </div>
          ) : null}
          {currentDiagnostic.installations.length > 0 ? (
            <GameDiagnosticTable
              games={currentDiagnostic.installations}
              onRepair={(game) => planning.mutate({ games: [game], mode: 'single' })}
              repairPending={planning.isPending || Boolean(operation)}
            />
          ) : (
            <p className="rounded-xl border border-white/10 bg-black/20 p-4 text-muted-foreground">
              {t('pages.fragmentationRepair.noOplInstallations')}
            </p>
          )}
        </>
      ) : null}
      {planningError ? (
        <div
          role="alert"
          className="rounded-xl border border-red-400/30 bg-red-400/5 p-4 text-red-200"
        >
          <p>{planningError.message}</p>
          {planningError.code === 'STALE_PLAN' ? (
            <Button className="mt-3" type="button" variant="secondary" onClick={diagnoseAgain}>
              {t('pages.fragmentationRepair.diagnoseAgain')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {plan ? (
        <RepairPlanDialog
          plan={plan}
          pending={confirmation.isPending}
          error={confirmation.error?.message}
          onCancel={() => {
            setPlan(undefined)
            confirmation.reset()
          }}
          onConfirm={() => confirmation.mutate()}
        />
      ) : null}
      {operation ? <RepairProgress operation={operation} onTerminal={loadReport} /> : null}
      {report ? (
        <section
          aria-labelledby="repair-report-title"
          className="rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-4"
        >
          <h3 id="repair-report-title" className="font-semibold text-white">
            {t('pages.fragmentationRepair.reportTitle')}
          </h3>
          <p className="mt-1 text-sm">
            {t('pages.fragmentationRepair.reportResult', { result: report.result })}
          </p>
          <ul className="mt-3 space-y-2">
            {report.games.map((game) => (
              <li key={game.installation.installationId} className="rounded-lg bg-black/20 p-3">
                <span className="font-medium text-white">{game.installation.title}</span> —{' '}
                {game.outcome}
                {game.finalState ? ` · ${game.previousState} → ${game.finalState}` : ''}
                {game.failures.map((failure) => (
                  <p key={failure.code} className="mt-1 text-sm text-red-200">
                    {failure.message}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function GameSelection({
  items,
  selected,
  loading,
  error,
  disabled,
  onChange,
  onDiagnose
}: {
  items: FragmentationInventoryItem[]
  selected: string[]
  loading: boolean
  error?: string
  disabled: boolean
  onChange: (keys: string[]) => void
  onDiagnose: () => void
}) {
  const { t, i18n } = useTranslation()
  const allSelected = items.length > 0 && selected.length === items.length
  const size = (bytes: number) =>
    new Intl.NumberFormat(i18n.language, {
      style: 'unit',
      unit: 'megabyte',
      maximumFractionDigits: 0
    }).format(bytes / 1024 / 1024)
  const gameWord =
    selected.length === 1
      ? t('pages.fragmentationRepair.gameSingular')
      : t('pages.fragmentationRepair.gamePlural')
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 p-5">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-white">
            <CheckSquare2 className="size-4 text-violet-300" />
            {t('pages.fragmentationRepair.chooseGamesTitle')}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('pages.fragmentationRepair.chooseGamesDescription')}
          </p>
        </div>
        <Button disabled={disabled || loading || selected.length === 0} onClick={onDiagnose}>
          <ScanSearch className="size-4" />
          {t('pages.fragmentationRepair.analyzeButton', {
            count: selected.length || '',
            gameWord
          })}
        </Button>
      </div>
      {loading ? (
        <p className="p-5 text-sm text-muted-foreground" role="status">
          {t('pages.fragmentationRepair.readingCdDvd')}
        </p>
      ) : null}
      {error ? (
        <p className="m-5 rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 text-sm text-amber-100">
          {t('pages.fragmentationRepair.listGamesError', { message: error })}
        </p>
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">
          {t('pages.fragmentationRepair.noGamesFound')}
        </p>
      ) : null}
      {items.length > 0 ? (
        <>
          <label className="flex cursor-pointer items-center gap-3 border-b border-white/10 bg-white/[0.025] px-5 py-3 text-sm text-muted-foreground">
            <input
              type="checkbox"
              className="size-4 accent-violet-500"
              checked={allSelected}
              disabled={disabled}
              onChange={() => onChange(allSelected ? [] : items.map((item) => item.selectionKey))}
            />
            {t('pages.fragmentationRepair.selectAll')}{' '}
            <span className="ml-auto text-xs">
              {t('pages.fragmentationRepair.selectedOfTotal', {
                selected: selected.length,
                total: items.length
              })}
            </span>
          </label>
          <div className="max-h-[420px] divide-y divide-white/5 overflow-y-auto">
            {items.map((item) => (
              <label
                key={item.selectionKey}
                className="flex cursor-pointer items-center gap-3 px-5 py-3 transition hover:bg-white/[0.035]"
              >
                <input
                  type="checkbox"
                  className="size-4 shrink-0 accent-violet-500"
                  checked={selected.includes(item.selectionKey)}
                  disabled={disabled}
                  onChange={() =>
                    onChange(
                      selected.includes(item.selectionKey)
                        ? selected.filter((key) => key !== item.selectionKey)
                        : [...selected, item.selectionKey]
                    )
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-white">
                    {item.title}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.gameId ?? t('pages.fragmentationRepair.unidentifiedId')} · {item.format} ·{' '}
                    {item.media}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">{size(item.totalBytes)}</span>
              </label>
            ))}
          </div>
        </>
      ) : null}
    </Card>
  )
}

function DiagnosisProgress({
  activity,
  cancelling,
  onCancel
}: {
  activity?: FragmentationDiagnosisActivity
  cancelling: boolean
  onCancel: (diagnosticId: string) => void
}) {
  const { t } = useTranslation()
  const progress = Math.max(0, Math.min(1, activity?.progress ?? 0))
  const percent = Math.round(progress * 100)
  const hasInventory = Boolean(activity?.totalItems)
  return (
    <section
      aria-labelledby="diagnosis-progress-title"
      className="rounded-xl border border-violet-400/30 bg-violet-500/10 p-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3
            id="diagnosis-progress-title"
            className="flex items-center gap-2 font-semibold text-white"
          >
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            {t('pages.fragmentationRepair.diagnosisInProgress')}
          </h3>
          <p className="mt-1 text-sm text-violet-100">
            {activity?.message ?? t('pages.fragmentationRepair.diagnosingMessage')}
          </p>
        </div>
        {activity ? (
          <Button
            type="button"
            variant="secondary"
            disabled={cancelling}
            onClick={() => onCancel(activity.diagnosticId)}
          >
            {cancelling
              ? t('pages.fragmentationRepair.cancelling')
              : t('pages.fragmentationRepair.cancelDiagnosis')}
          </Button>
        ) : null}
      </div>
      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-black/30"
        role="progressbar"
        aria-label={t('pages.fragmentationRepair.diagnosisProgressAriaLabel') ?? ''}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div
          className="h-full rounded-full bg-violet-400 transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {hasInventory
            ? t('pages.fragmentationRepair.gamesAnalyzed', {
                processed: activity?.processedItems,
                total: activity?.totalItems
              })
            : t('pages.fragmentationRepair.inventoryingGames')}
        </span>
        <span>{percent}%</span>
      </div>
      {activity?.currentItem ? (
        <p className="mt-2 break-all text-xs text-violet-100">
          {t('pages.fragmentationRepair.currentFile', { file: activity.currentItem })}
        </p>
      ) : null}
      <p className="mt-3 text-xs text-muted-foreground">
        {t('pages.fragmentationRepair.backgroundHint')}
      </p>
    </section>
  )
}
