import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { DeviceInfo, ReorganizationPlan, ReorganizationResult } from '@/types/opl'
import { oplApi } from '@/services/api'
import { Button } from '@/components/ui/button'

export function ReorganizationWizard({ device }: { device: DeviceInfo }) {
  const { t } = useTranslation()
  const [backup, setBackup] = useState('')
  const [plan, setPlan] = useState<ReorganizationPlan>()
  const [result, setResult] = useState<ReorganizationResult>()
  const [error, setError] = useState('')
  async function choose() {
    const [selected] = await oplApi.openPathDialog({ mode: 'folder' })
    if (selected) setBackup(selected)
  }
  async function prepare() {
    try {
      setPlan(
        await oplApi.planReorganization({
          deviceId: device.id,
          devicePath: device.path,
          backupPath: backup
        })
      )
    } catch (reason) {
      setError((reason as Error).message)
    }
  }
  async function confirm() {
    if (!plan) return
    try {
      setResult(
        await oplApi.confirmReorganization({
          operationId: plan.id,
          expectedRevision: plan.expectedRevision,
          // Literal confirmation phrase expected by the backend — not localized (Constitution Principle I).
          confirmation: 'REORGANIZAR COM BACKUP VERIFICADO'
        })
      )
    } catch (reason) {
      setError((reason as Error).message)
    }
  }
  return (
    <div className="rounded-xl border border-red-400/30 bg-red-400/5 p-4">
      <h3 className="font-semibold text-white">{t('components.reorganizationWizard.title')}</h3>
      <p className="text-sm text-muted-foreground">
        {t('components.reorganizationWizard.description')}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void choose()}>
          {t('components.reorganizationWizard.externalBackup', {
            value: backup || t('components.reorganizationWizard.selectPrompt')
          })}
        </Button>
        <Button onClick={() => void prepare()} disabled={!backup}>
          {t('components.reorganizationWizard.inventoryAndPlan')}
        </Button>
      </div>
      {plan ? (
        <div className="mt-3 text-sm">
          <p>
            {t('components.reorganizationWizard.filesRequired', {
              files: plan.inventory.length,
              mib: (plan.requiredBytes / 1024 / 1024).toFixed(1)
            })}
          </p>
          <p className="break-all text-muted-foreground">
            {t('components.reorganizationWizard.backupLabel', { value: plan.backupRoot })}
          </p>
          <Button className="mt-2" onClick={() => void confirm()}>
            {t('components.reorganizationWizard.confirmButton')}
          </Button>
          <Button
            className="mt-2"
            variant="ghost"
            onClick={() => {
              void oplApi.cancelReorganization(plan.id)
              setPlan(undefined)
            }}
          >
            {t('components.reorganizationWizard.cancelButton')}
          </Button>
        </div>
      ) : null}
      {result ? (
        <p className="mt-3 text-emerald-300">
          {t('components.reorganizationWizard.restoredFiles', {
            count: result.restoredFiles,
            fragmentation: result.fragmentation
          })}
        </p>
      ) : null}
      {error ? <p className="mt-3 text-red-300">{error}</p> : null}
    </div>
  )
}
