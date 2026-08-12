import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { oplApi } from '@/services/api'
import type { UpdatePolicy, UpdateSession } from '@/types/opl-finalization'
import { UpdateProgress } from './UpdateProgress'
export function UpdateDialog() {
  const { t } = useTranslation()
  const [session, setSession] = useState<UpdateSession>()
  const [policy, setPolicy] = useState<UpdatePolicy>()
  useEffect(() => {
    void oplApi.getUpdateSession().then(setSession)
    void oplApi.getUpdatePolicy().then(setPolicy)
    return oplApi.onUpdateEvent(setSession)
  }, [])
  if (!session)
    return (
      <p className="text-sm text-muted-foreground">{t('components.updateDialog.loadingVersion')}</p>
    )
  const check = () => void oplApi.checkForUpdates().then(setSession)
  const download = () =>
    void oplApi
      .downloadUpdate({ sessionId: session.sessionId, expectedRevision: session.revision })
      .then(setSession)
  const install = () =>
    void oplApi
      .installUpdate({
        sessionId: session.sessionId,
        expectedRevision: session.revision,
        // Literal confirmation phrase expected by the backend — not localized (Constitution Principle I).
        confirmation: 'REINICIAR E ATUALIZAR'
      })
      .then(setSession)
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-white">OPL Forge {session.currentPublicVersion}</p>
        <p className="text-xs text-muted-foreground">
          {t('components.updateDialog.state', { state: session.state })}
        </p>
      </div>
      {session.candidatePublicVersion && (
        <p className="text-sm text-violet-200">
          {t('components.updateDialog.newVersion', { version: session.candidatePublicVersion })}
        </p>
      )}
      <UpdateProgress session={session} />
      {policy && (
        <label className="block text-xs text-muted-foreground">
          {t('components.updateDialog.updatePolicy')}
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 p-2 text-white"
            value={policy.mode}
            onChange={(event) =>
              void oplApi
                .setUpdatePolicy(event.target.value as UpdatePolicy['mode'], policy.revision)
                .then(setPolicy)
            }
          >
            <option value="check-automatic">
              {t('components.updateDialog.policyCheckAutomatic')}
            </option>
            <option value="ask-before-download">
              {t('components.updateDialog.policyAskBeforeDownload')}
            </option>
            <option value="download-automatic">
              {t('components.updateDialog.policyDownloadAutomatic')}
            </option>
            <option value="manual-only">{t('components.updateDialog.policyManualOnly')}</option>
          </select>
        </label>
      )}
      {session.lastError && (
        <p className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-rose-500/20 bg-rose-500/10 p-2 text-sm text-rose-300">
          {session.lastError.message}
        </p>
      )}
      {session.installBlockedByOperations.length > 0 && (
        <p className="text-sm text-amber-300">
          {t('components.updateDialog.finishActiveOperations')}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20"
          onClick={check}
          disabled={['CHECKING', 'DOWNLOADING', 'INSTALLING'].includes(session.state)}
        >
          {t('components.updateDialog.checkForUpdates')}
        </button>
        {session.state === 'UPDATE_AVAILABLE' && (
          <button
            className="rounded-lg bg-violet-600 px-3 py-2 text-sm text-white"
            onClick={download}
          >
            {t('components.updateDialog.download')}
          </button>
        )}
        {session.state === 'READY_TO_INSTALL' && (
          <button
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white"
            onClick={install}
          >
            {t('components.updateDialog.restartAndUpdate')}
          </button>
        )}
      </div>
    </div>
  )
}
