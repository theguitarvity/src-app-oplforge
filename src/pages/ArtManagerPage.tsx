import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Image, Images, RefreshCw, Sparkles } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ArtSyncJobProgress } from '@/components/art/ArtSyncJobProgress'
import { ArtSyncPlanDialog } from '@/components/art/ArtSyncPlanDialog'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'
import type { ArtSyncPlanSummary, OplArtType } from '@/types/opl-finalization'

const artTypes: OplArtType[] = ['ICO', 'COV', 'COV2', 'LAB', 'LGO', 'SCR', 'SCR2', 'BG']

export function ArtManagerPage() {
  const { t } = useTranslation()
  const device = useDeviceStore((state) => state.activeDevice)
  const client = useQueryClient()
  const [plan, setPlan] = useState<ArtSyncPlanSummary>()
  const [selectedTypes, setSelectedTypes] = useState<OplArtType[]>(artTypes)
  const assets = useQuery({
    queryKey: ['art-index'],
    queryFn: () => oplApi.queryArtIndex({ limit: 500 })
  })
  const jobs = useQuery({
    queryKey: ['art-jobs', device?.id],
    queryFn: () => oplApi.listArtSyncJobs({ deviceId: device!.id, limit: 100 }),
    enabled: Boolean(device),
    refetchInterval: 1500
  })
  const refresh = useMutation({
    mutationFn: () => oplApi.refreshArtIndex(true),
    onSuccess: () => assets.refetch()
  })
  const prepare = useMutation({
    mutationFn: async () => {
      await oplApi.refreshArtIndex(false)
      const snapshot = await oplApi.scanCatalog({ devicePath: device!.path })
      return oplApi.createArtSyncPlan({
        deviceId: snapshot.deviceId,
        catalogSnapshotId: snapshot.snapshotId,
        scope: 'library',
        types: selectedTypes,
        replacePolicy: 'missing-only'
      })
    },
    onSuccess: async (value) => {
      setPlan(value)
      await assets.refetch()
    }
  })
  const start = useMutation({
    mutationFn: () =>
      oplApi.startArtSync({ planId: plan!.planId, expectedRevision: plan!.revision }),
    onSuccess: async () => {
      setPlan(undefined)
      await client.invalidateQueries({ queryKey: ['art-jobs'] })
    }
  })
  if (!device)
    return (
      <EmptyState
        icon={Image}
        title={t('pages.artManager.selectDeviceTitle')}
        description={t('pages.artManager.selectDeviceDescription')}
      />
    )
  const activeJobs =
    jobs.data?.items.filter((job) => ['queued', 'running', 'paused'].includes(job.state)).length ??
    0
  return (
    <div className="space-y-5">
      <Card className="overflow-hidden bg-gradient-to-br from-violet-500/15 via-card/80 to-cyan-500/10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <span className="mb-3 inline-flex rounded-xl bg-violet-400/10 p-2 text-violet-300">
              <Images className="size-5" />
            </span>
            <h2 className="text-2xl font-semibold text-white">{t('pages.artManager.title')}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {t('pages.artManager.subtitle')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => refresh.mutate()}
              disabled={refresh.isPending}
            >
              <RefreshCw className={`size-4 ${refresh.isPending ? 'animate-spin' : ''}`} />
              {t('pages.artManager.refreshSource')}
            </Button>
            <Button
              onClick={() => prepare.mutate()}
              disabled={prepare.isPending || selectedTypes.length === 0}
            >
              <Sparkles className="size-4" />
              {prepare.isPending
                ? t('pages.artManager.readingLibrary')
                : t('pages.artManager.prepareSync')}
            </Button>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Metric
            value={assets.data?.items.length ?? 0}
            label={t('pages.artManager.artsInIndex')}
          />
          <Metric value={selectedTypes.length} label={t('pages.artManager.selectedTypes')} />
          <Metric value={activeJobs} label={t('pages.artManager.activeJobs')} />
        </div>
      </Card>
      <Card>
        <div>
          <h3 className="font-semibold text-white">{t('pages.artManager.artTypesTitle')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('pages.artManager.artTypesDescription')}
          </p>
        </div>
        <fieldset className="mt-4 flex flex-wrap gap-2">
          <legend className="sr-only">{t('pages.artManager.artTypesLegend')}</legend>
          {artTypes.map((type) => {
            const checked = selectedTypes.includes(type)
            return (
              <label
                key={type}
                className={`cursor-pointer rounded-xl border px-3 py-2 text-sm font-medium transition ${checked ? 'border-violet-400/40 bg-violet-400/10 text-violet-100' : 'border-white/10 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06]'}`}
              >
                <input
                  className="sr-only"
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setSelectedTypes((current) =>
                      current.includes(type)
                        ? current.filter((item) => item !== type)
                        : [...current, type]
                    )
                  }
                />
                {type}
              </label>
            )
          })}
        </fieldset>
        <p className="mt-4 border-t border-white/10 pt-4 text-xs text-muted-foreground">
          {t('pages.artManager.footnote')}
        </p>
        {prepare.error ? (
          <ErrorMessage>
            {t('pages.artManager.prepareError', { message: prepare.error.message })}
          </ErrorMessage>
        ) : null}
        {refresh.error ? (
          <ErrorMessage>
            {t('pages.artManager.refreshError', { message: refresh.error.message })}
          </ErrorMessage>
        ) : null}
      </Card>
      <section aria-labelledby="art-jobs-title">
        <div className="mb-3 flex items-center justify-between">
          <h3 id="art-jobs-title" className="font-semibold text-white">
            {t('pages.artManager.activityTitle')}
          </h3>
          <span className="text-xs text-muted-foreground">
            {t('pages.artManager.jobsCount', { count: jobs.data?.items.length ?? 0 })}
          </span>
        </div>
        {jobs.isLoading ? (
          <Card>
            <p className="text-sm text-muted-foreground" role="status">
              {t('pages.artManager.loadingSyncs')}
            </p>
          </Card>
        ) : null}
        {!jobs.isLoading && jobs.data?.items.length === 0 ? (
          <Card className="py-9 text-center">
            <Image className="mx-auto size-7 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-white">
              {t('pages.artManager.noSyncStarted')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('pages.artManager.noSyncDescription')}
            </p>
          </Card>
        ) : null}
        <div className="grid gap-3">
          {jobs.data?.items.map((job) => (
            <Card key={job.jobId}>
              <ArtSyncJobProgress
                job={job}
                onPause={() =>
                  void oplApi
                    .pauseArtSync({ jobId: job.jobId, expectedRevision: job.revision })
                    .then(() => jobs.refetch())
                }
                onResume={() =>
                  void oplApi
                    .resumeArtSync({ jobId: job.jobId, expectedRevision: job.revision })
                    .then(() => jobs.refetch())
                }
                onRetry={() =>
                  void oplApi
                    .retryFailedArtSync({ jobId: job.jobId, expectedRevision: job.revision })
                    .then(() => jobs.refetch())
                }
              />
            </Card>
          ))}
        </div>
      </section>
      {plan ? (
        <ArtSyncPlanDialog
          open
          plan={plan}
          pending={start.isPending}
          error={start.error?.message}
          onCancel={() => {
            setPlan(undefined)
            start.reset()
          }}
          onStart={() => start.mutate()}
        />
      ) : null}
    </div>
  )
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/15 p-3">
      <p className="text-xl font-semibold text-white">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
function ErrorMessage({ children }: { children: ReactNode }) {
  return (
    <p
      className="mt-3 rounded-xl border border-red-400/30 bg-red-400/5 p-3 text-sm text-red-200"
      role="alert"
    >
      {children}
    </p>
  )
}
