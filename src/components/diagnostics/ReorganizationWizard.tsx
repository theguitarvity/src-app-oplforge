import { useState } from 'react'
import type { DeviceInfo, ReorganizationPlan, ReorganizationResult } from '@/types/opl'
import { oplApi } from '@/services/api'
import { Button } from '@/components/ui/button'

export function ReorganizationWizard({ device }: { device: DeviceInfo }) {
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
          confirmation: 'REORGANIZAR COM BACKUP VERIFICADO'
        })
      )
    } catch (reason) {
      setError((reason as Error).message)
    }
  }
  return (
    <div className="rounded-xl border border-red-400/30 bg-red-400/5 p-4">
      <h3 className="font-semibold text-white">Reorganização transacional</h3>
      <p className="text-sm text-muted-foreground">
        Requer backup em outro filesystem. Não formata nem desabilita a verificação do OPL.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void choose()}>
          Backup externo: {backup || 'selecionar'}
        </Button>
        <Button onClick={() => void prepare()} disabled={!backup}>
          Inventariar e planejar
        </Button>
      </div>
      {plan ? (
        <div className="mt-3 text-sm">
          <p>
            {plan.inventory.length} arquivos · {(plan.requiredBytes / 1024 / 1024).toFixed(1)} MiB
            necessários.
          </p>
          <p className="break-all text-muted-foreground">Backup: {plan.backupRoot}</p>
          <Button className="mt-2" onClick={() => void confirm()}>
            Confirmar backup, remoção e reescrita sequencial
          </Button>
          <Button
            className="mt-2"
            variant="ghost"
            onClick={() => {
              void oplApi.cancelReorganization(plan.id)
              setPlan(undefined)
            }}
          >
            Cancelar
          </Button>
        </div>
      ) : null}
      {result ? (
        <p className="mt-3 text-emerald-300">
          {result.restoredFiles} arquivos verificados; contiguidade {result.fragmentation}.
        </p>
      ) : null}
      {error ? <p className="mt-3 text-red-300">{error}</p> : null}
    </div>
  )
}
