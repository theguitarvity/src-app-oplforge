import { useMutation, useQuery } from '@tanstack/react-query'
import { FilePenLine } from 'lucide-react'
import { useState } from 'react'
import { NamingAuditTable } from '@/components/naming/NamingAuditTable'
import { NamingPlanDialog } from '@/components/naming/NamingPlanDialog'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'
import type { NamingAudit, NamingPlan } from '@/types/opl-finalization'

export function OplNamingPage() {
  const device = useDeviceStore((state) => state.activeDevice)
  const setActiveDevice = useDeviceStore((state) => state.setActiveDevice)
  const devices = useQuery({ queryKey: ['devices'], queryFn: oplApi.listDevices })
  const profiles = useQuery({ queryKey: ['opl-profiles'], queryFn: oplApi.listOplProfiles })
  const [audit, setAudit] = useState<NamingAudit>()
  const [plan, setPlan] = useState<NamingPlan>()
  const [selected, setSelected] = useState(new Set<string>())
  const [result, setResult] = useState<string>()
  const runAudit = useMutation({
    mutationFn: () =>
      oplApi.auditOplNaming({
        deviceId: device!.id,
        profileId: profiles.data?.[0]?.id ?? 'opl-default'
      }),
    onSuccess: (value) => {
      setAudit(value)
      setSelected(
        new Set(
          value.items
            .filter((item) => item.classification === 'correctable')
            .map((item) => item.itemId)
        )
      )
    }
  })
  const createPlan = useMutation({
    mutationFn: () =>
      oplApi.createOplNamingPlan({
        auditId: audit!.auditId,
        expectedRevision: audit!.revision,
        itemIds: [...selected]
      }),
    onSuccess: setPlan
  })
  const confirm = useMutation({
    mutationFn: () =>
      oplApi.confirmOplNaming({
        planId: plan!.planId,
        expectedRevision: plan!.revision,
        confirmation: 'ADEQUAR NOMES OPL'
      }),
    onSuccess: (operation) => {
      setResult(
        `${operation.items.filter((item) => item.state === 'renamed').length} jogos adequados`
      )
      setPlan(undefined)
      runAudit.mutate()
    }
  })
  if (!device)
    return (
      <div className="space-y-4">
        <EmptyState
          icon={FilePenLine}
          title="Selecione um dispositivo"
          description="Escolha abaixo o HD/USB cuja biblioteca será lida. A auditoria é somente leitura até a confirmação explícita."
        />
        {devices.isLoading ? (
          <p role="status">Procurando dispositivos…</p>
        ) : (
          <div className="grid gap-2">
            {(devices.data ?? []).map((item) => (
              <Button key={item.id} variant="secondary" onClick={() => setActiveDevice(item)}>
                Usar {item.name} — {item.path}
              </Button>
            ))}
          </div>
        )}
        {devices.error ? (
          <p className="text-red-300" role="alert">
            Falha ao listar dispositivos: {devices.error.message}
          </p>
        ) : null}
      </div>
    )
  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-2xl font-semibold text-white">Adequação de nomes OPL</h2>
        <p className="text-sm text-muted-foreground">
          Lê CD e DVD, extrai o Game ID interno de ISO/ZSO, mostra a prévia e renomeia para
          GAME_ID.Título sem copiar o conteúdo.
        </p>
        <Button className="mt-4" onClick={() => runAudit.mutate()} disabled={runAudit.isPending}>
          {runAudit.isPending ? 'Lendo dispositivo…' : 'Ler dispositivo e auditar nomes'}
        </Button>
        {result && <p role="status">{result}</p>}
        {runAudit.error ? (
          <p className="mt-3 text-red-300" role="alert">
            Falha na leitura: {runAudit.error.message}
          </p>
        ) : null}
        {createPlan.error ? (
          <p className="mt-3 text-red-300" role="alert">
            Falha ao criar plano: {createPlan.error.message}
          </p>
        ) : null}
        {confirm.error ? (
          <p className="mt-3 text-red-300" role="alert">
            Falha ao renomear: {confirm.error.message}
          </p>
        ) : null}
      </Card>
      {audit && (
        <Card>
          <p className="mb-3 text-sm text-muted-foreground">
            {audit.items.length} arquivo(s) lido(s);{' '}
            {audit.items.filter((item) => item.classification === 'correctable').length} podem ser
            adequados. Selecione os itens desejados.
          </p>
          <NamingAuditTable
            audit={audit}
            selected={selected}
            onToggle={(itemId) =>
              setSelected((current) => {
                const next = new Set(current)
                if (next.has(itemId)) next.delete(itemId)
                else next.add(itemId)
                return next
              })
            }
          />
          <Button
            className="mt-4"
            disabled={!selected.size || createPlan.isPending}
            onClick={() => createPlan.mutate()}
          >
            {createPlan.isPending
              ? 'Preparando…'
              : `Corrigir nomes selecionados (${selected.size})`}
          </Button>
          {selected.size === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Nenhum nome corrigível está selecionado.
            </p>
          ) : null}
        </Card>
      )}
      {plan && (
        <NamingPlanDialog
          plan={plan}
          open
          pending={confirm.isPending}
          error={confirm.error?.message}
          onCancel={() => setPlan(undefined)}
          onConfirm={() => confirm.mutate()}
        />
      )}
    </div>
  )
}
