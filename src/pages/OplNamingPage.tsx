import { useMutation, useQuery } from '@tanstack/react-query'
import { FilePenLine } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NamingAuditTable } from '@/components/naming/NamingAuditTable'
import { NamingPlanDialog } from '@/components/naming/NamingPlanDialog'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'
import type { NamingAudit, NamingPlan } from '@/types/opl-finalization'

export function OplNamingPage() {
  const { t } = useTranslation()
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
        // Literal confirmation phrase expected by the backend — not localized (Constitution Principle I).
        confirmation: 'ADEQUAR NOMES OPL'
      }),
    onSuccess: (operation) => {
      setResult(
        t('pages.oplNaming.renamedResult', {
          count: operation.items.filter((item) => item.state === 'renamed').length
        })
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
          title={t('pages.oplNaming.selectDeviceTitle')}
          description={t('pages.oplNaming.selectDeviceDescription')}
        />
        {devices.isLoading ? (
          <p role="status">{t('pages.oplNaming.searchingDevices')}</p>
        ) : (
          <div className="grid gap-2">
            {(devices.data ?? []).map((item) => (
              <Button key={item.id} variant="secondary" onClick={() => setActiveDevice(item)}>
                {t('pages.oplNaming.useDevice', { name: item.name, path: item.path })}
              </Button>
            ))}
          </div>
        )}
        {devices.error ? (
          <p className="text-red-300" role="alert">
            {t('pages.oplNaming.listDevicesError', { message: devices.error.message })}
          </p>
        ) : null}
      </div>
    )
  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-2xl font-semibold text-white">{t('pages.oplNaming.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('pages.oplNaming.subtitle')}</p>
        <Button className="mt-4" onClick={() => runAudit.mutate()} disabled={runAudit.isPending}>
          {runAudit.isPending ? t('pages.oplNaming.reading') : t('pages.oplNaming.readAndAudit')}
        </Button>
        {result && <p role="status">{result}</p>}
        {runAudit.error ? (
          <p className="mt-3 text-red-300" role="alert">
            {t('pages.oplNaming.readError', { message: runAudit.error.message })}
          </p>
        ) : null}
        {createPlan.error ? (
          <p className="mt-3 text-red-300" role="alert">
            {t('pages.oplNaming.planError', { message: createPlan.error.message })}
          </p>
        ) : null}
        {confirm.error ? (
          <p className="mt-3 text-red-300" role="alert">
            {t('pages.oplNaming.renameError', { message: confirm.error.message })}
          </p>
        ) : null}
      </Card>
      {audit && (
        <Card>
          <p className="mb-3 text-sm text-muted-foreground">
            {t('pages.oplNaming.filesRead', {
              count: audit.items.length,
              correctable: audit.items.filter((item) => item.classification === 'correctable')
                .length
            })}
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
              ? t('pages.oplNaming.preparing')
              : t('pages.oplNaming.fixSelected', { count: selected.size })}
          </Button>
          {selected.size === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {t('pages.oplNaming.noneSelected')}
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
