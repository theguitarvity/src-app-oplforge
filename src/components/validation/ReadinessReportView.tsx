import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReadinessReport } from '@/types/opl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { oplApi } from '@/services/api'

export function ReadinessReportView({
  report,
  onChange
}: {
  report: ReadinessReport
  onChange(report: ReadinessReport): void
}) {
  const { t } = useTranslation()
  const [consoleModel, setConsoleModel] = useState('')
  const [adapter, setAdapter] = useState('')
  const [checks, setChecks] = useState({
    detected: false,
    artDisplayed: false,
    noFragmentationError: false,
    milestoneReached: false
  })
  const checkLabels: Record<keyof typeof checks, string> = {
    detected: t('components.readinessReportView.deviceDetected'),
    artDisplayed: t('components.readinessReportView.artDisplayed'),
    noFragmentationError: t('components.readinessReportView.noFragmentationError'),
    milestoneReached: t('components.readinessReportView.milestoneReached')
  }
  async function saveSmoke() {
    onChange(
      await oplApi.recordHardwareSmoke({
        reportId: report.id,
        expectedRevision: report.revision,
        consoleModel,
        adapter,
        oplVersion: report.opl.version,
        ...checks
      })
    )
  }
  async function exportReport() {
    const [folder] = await oplApi.openPathDialog({ mode: 'folder' })
    if (folder)
      await oplApi.exportReadinessReport(report.id, `${folder}/opl-readiness-${report.id}.json`)
  }
  return (
    <div className="mt-6 rounded-xl border border-white/10 p-4">
      <div className="flex justify-between gap-2">
        <h3 className="font-semibold text-white">{t('components.readinessReportView.title')}</h3>
        <Button variant="secondary" onClick={() => void exportReport()}>
          {t('components.readinessReportView.exportJson')}
        </Button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded bg-white/5 p-2">
          {t('components.readinessReportView.structural')}
          <br />
          {report.results.structural}
        </div>
        <div className="rounded bg-white/5 p-2">
          PCSX2
          <br />
          {report.results.pcsx2}
        </div>
        <div className="rounded bg-white/5 p-2">
          {t('components.readinessReportView.ps2Real')}
          <br />
          {report.results.hardware}
        </div>
      </div>
      <p className="mt-2 text-xs text-amber-200">
        {t('components.readinessReportView.pcsx2Disclaimer')}
      </p>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        <Input
          value={consoleModel}
          onChange={(event) => setConsoleModel(event.target.value)}
          placeholder={t('components.readinessReportView.consoleModelPlaceholder') ?? ''}
        />
        <Input
          value={adapter}
          onChange={(event) => setAdapter(event.target.value)}
          placeholder={t('components.readinessReportView.adapterPlaceholder') ?? ''}
        />
      </div>
      <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
        {Object.entries(checks).map(([key, value]) => (
          <label key={key} className="flex gap-2">
            <input
              type="checkbox"
              checked={value}
              onChange={(event) => setChecks({ ...checks, [key]: event.target.checked })}
            />
            {checkLabels[key as keyof typeof checks]}
          </label>
        ))}
      </div>
      <Button
        className="mt-3"
        onClick={() => void saveSmoke()}
        disabled={!consoleModel || !adapter}
      >
        {t('components.readinessReportView.recordSmokeTest')}
      </Button>
    </div>
  )
}
