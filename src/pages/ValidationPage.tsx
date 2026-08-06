import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { MonitorPlay } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { CheckpointPanel } from '@/components/validation/CheckpointPanel'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'
import { basename } from '@/utils/path'
import type { CatalogSnapshot, ValidationRun } from '@/types/opl'
import type { ReadinessReport } from '@/types/opl'
import { ReadinessReportView } from '@/components/validation/ReadinessReportView'

export function ValidationPage() {
  const device = useDeviceStore((state) => state.activeDevice)
  const profiles = useQuery({ queryKey: ['opl-profiles'], queryFn: oplApi.listOplProfiles })
  const [snapshot, setSnapshot] = useState<CatalogSnapshot>()
  const [itemId, setItemId] = useState('')
  const [profileId, setProfileId] = useState('')
  const [pcsx2Path, setPcsx2Path] = useState('')
  const [biosPath, setBiosPath] = useState('')
  const [cardPath, setCardPath] = useState('')
  const [planId, setPlanId] = useState('')
  const [run, setRun] = useState<ValidationRun>()
  const [report, setReport] = useState<ReadinessReport>()
  const [patchedCardPath, setPatchedCardPath] = useState('')
  const [oplUpdatePlanId, setOplUpdatePlanId] = useState('')
  const [oplUpdateResult, setOplUpdateResult] = useState('')
  const catalog = useMutation({
    mutationFn: () => oplApi.scanCatalog({ devicePath: device!.path }),
    onSuccess: setSnapshot
  })
  const plan = useMutation({
    mutationFn: () =>
      oplApi.planValidation({
        deviceId: snapshot!.deviceId,
        snapshotId: snapshot!.snapshotId,
        itemId,
        profileId,
        pcsx2Path,
        biosPath,
        memoryCardPath: cardPath,
        bootMode: 'memory-card'
      }),
    onSuccess: (value) => setPlanId(value.id)
  })
  const start = useMutation({ mutationFn: () => oplApi.startValidation(planId), onSuccess: setRun })
  async function pick(setter: (value: string) => void, extensions: string[]) {
    const [selected] = await oplApi.openPathDialog({
      mode: 'file',
      filters: [{ name: 'Arquivo', extensions }]
    })
    if (selected) setter(selected)
  }
  async function planOplUpdate() {
    if (!profileId || !cardPath) return
    setOplUpdatePlanId((await oplApi.planOplUpdate({ profileId, memoryCardPath: cardPath })).id)
  }
  async function confirmOplUpdate() {
    if (!oplUpdatePlanId || !patchedCardPath) return
    const value = await oplApi.confirmOplUpdate({
      planId: oplUpdatePlanId,
      confirmation: 'ATUALIZAR OPL',
      patchedImagePath: patchedCardPath
    })
    setOplUpdateResult(`Imagem anterior preservada em ${basename(value.backupPath)}`)
    setOplUpdatePlanId('')
  }
  if (!device)
    return (
      <EmptyState
        icon={MonitorPlay}
        title="Selecione um dispositivo"
        description="A validação usa clone e perfil isolado; nunca altera os arquivos reais."
      />
    )
  return (
    <Card>
      <h2 className="text-2xl font-semibold text-white">Validação PCSX2 isolada</h2>
      <div className="my-4 rounded-xl border border-amber-400/20 p-3">
        <p className="text-sm text-amber-100">Atualização confirmada do OPL no memory card</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void pick(setPatchedCardPath, ['ps2', 'mcd'])}>
            Imagem preparada: {patchedCardPath ? basename(patchedCardPath) : 'selecionar'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => void planOplUpdate()}
            disabled={!profileId || !cardPath}
          >
            Revisar atualização
          </Button>
          {oplUpdatePlanId ? (
            <Button onClick={() => void confirmOplUpdate()} disabled={!patchedCardPath}>
              Confirmar ATUALIZAR OPL
            </Button>
          ) : null}
        </div>
        {oplUpdateResult ? (
          <p className="mt-2 text-xs text-emerald-300">{oplUpdateResult}</p>
        ) : null}
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Selecione sua própria BIOS legalmente extraída. Ela não será baixada, copiada para o
        relatório ou distribuída.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <Button
          variant="secondary"
          onClick={() => void pick(setPcsx2Path, ['AppImage', 'exe', '*'])}
        >
          PCSX2: {pcsx2Path ? basename(pcsx2Path) : 'selecionar'}
        </Button>
        <Button variant="secondary" onClick={() => void pick(setBiosPath, ['bin', 'rom'])}>
          BIOS: {biosPath ? basename(biosPath) : 'selecionar arquivo próprio'}
        </Button>
        <Button variant="secondary" onClick={() => void pick(setCardPath, ['ps2', 'mcd'])}>
          Memory card: {cardPath ? basename(cardPath) : 'selecionar imagem'}
        </Button>
        <Select value={profileId} onChange={(event) => setProfileId(event.target.value)}>
          <option value="">Perfil OPL exato</option>
          {profiles.data?.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.version} · {profile.elfSha256.slice(0, 12)}
            </option>
          ))}
        </Select>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => catalog.mutate()}>
          Carregar jogos
        </Button>
        {snapshot ? (
          <Select value={itemId} onChange={(event) => setItemId(event.target.value)}>
            <option value="">Jogo de teste</option>
            {snapshot.items
              .filter((item) => item.kind === 'game')
              .map((item) => (
                <option key={item.itemId} value={item.itemId}>
                  {item.gameId} · {item.title}
                </option>
              ))}
          </Select>
        ) : null}
        <Button
          onClick={() => plan.mutate()}
          disabled={!itemId || !profileId || !pcsx2Path || !biosPath || !cardPath}
        >
          Preparar ambiente
        </Button>
        {planId ? <Button onClick={() => start.mutate()}>Iniciar PCSX2</Button> : null}
        {snapshot && profileId ? (
          <Button
            variant="secondary"
            onClick={() =>
              void oplApi
                .generateReadinessReport({
                  deviceId: snapshot.deviceId,
                  snapshotId: snapshot.snapshotId,
                  profileId,
                  validationRunId: run?.id
                })
                .then(setReport)
            }
          >
            Gerar relatório
          </Button>
        ) : null}
      </div>
      {run ? (
        <div className="mt-5">
          <CheckpointPanel
            checkpoints={run.checkpoints}
            onConfirm={(stage, result) => {
              void oplApi
                .confirmValidationCheckpoint({ operationId: run.id, stage, result })
                .then((checkpoint) =>
                  setRun({
                    ...run,
                    checkpoints: [
                      ...run.checkpoints.filter((item) => item.stage !== stage),
                      checkpoint
                    ]
                  })
                )
            }}
          />
          <Button className="mt-4" onClick={() => void oplApi.stopValidation(run.id).then(setRun)}>
            Encerrar e consolidar
          </Button>
          <p className="mt-2">
            Resultado emulado: {run.status}. Isso não garante funcionamento no hardware real.
          </p>
        </div>
      ) : null}
      {report ? <ReadinessReportView report={report} onChange={setReport} /> : null}
      {plan.error || start.error ? (
        <p className="mt-3 text-red-300">{plan.error?.message ?? start.error?.message}</p>
      ) : null}
    </Card>
  )
}
