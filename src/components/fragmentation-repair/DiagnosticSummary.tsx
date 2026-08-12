import { useTranslation } from 'react-i18next'
import type { DiagnosticState, FragmentationDiagnostic } from '@/types/opl'
import { formatBytes } from '@/utils/format'

const states: DiagnosticState[] = [
  'contiguous',
  'fragmented',
  'partially-fragmented',
  'incomplete',
  'invalid',
  'unverifiable'
]

export function DiagnosticSummary({ diagnostic }: { diagnostic: FragmentationDiagnostic }) {
  const { t } = useTranslation()
  const { summary, device } = diagnostic

  return (
    <section
      aria-labelledby="fragmentation-summary-title"
      className="rounded-xl border border-white/10 bg-black/20 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="fragmentation-summary-title" className="font-semibold text-white">
            {t('components.fragmentationDiagnosticSummary.title')}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('components.fragmentationDiagnosticSummary.verification', {
              fileSystem: device.fileSystem,
              method: device.extentVerification
            })}
          </p>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-white">
          {t('components.fragmentationDiagnosticSummary.totalGames', { count: summary.total })}
        </span>
      </div>

      <dl className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {states.map((state) => (
          <div key={state} className="rounded-lg bg-white/5 p-3">
            <dt className="text-xs text-muted-foreground">{state}</dt>
            <dd className="mt-1 text-xl font-semibold text-white">{summary.byState[state] ?? 0}</dd>
          </div>
        ))}
      </dl>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">
            {t('components.fragmentationDiagnosticSummary.eligible')}
          </dt>
          <dd>{summary.eligibleGames}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">
            {t('components.fragmentationDiagnosticSummary.affectedFiles')}
          </dt>
          <dd>{summary.affectedFiles}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">
            {t('components.fragmentationDiagnosticSummary.freeSpace')}
          </dt>
          <dd>{formatBytes(summary.freeBytes)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">
            {t('components.fragmentationDiagnosticSummary.peakTemporary')}
          </dt>
          <dd>{formatBytes(summary.peakTemporaryBytes)}</dd>
        </div>
      </dl>

      {device.limitations.length > 0 ? (
        <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3" role="note">
          <p className="font-medium text-amber-200">
            {t('components.fragmentationDiagnosticSummary.limitationsTitle')}
          </p>
          <ul className="mt-1 list-disc pl-5 text-sm text-amber-100">
            {device.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
