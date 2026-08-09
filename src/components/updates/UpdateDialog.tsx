import { useEffect, useState } from 'react'
import { oplApi } from '@/services/api'
import type { UpdatePolicy, UpdateSession } from '@/types/opl-finalization'
import { UpdateProgress } from './UpdateProgress'
export function UpdateDialog() {
  const [session, setSession] = useState<UpdateSession>()
  const [policy, setPolicy] = useState<UpdatePolicy>()
  useEffect(() => {
    void oplApi.getUpdateSession().then(setSession)
    void oplApi.getUpdatePolicy().then(setPolicy)
    return oplApi.onUpdateEvent(setSession)
  }, [])
  if (!session) return <p className="text-sm text-muted-foreground">Carregando versão…</p>
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
        confirmation: 'REINICIAR E ATUALIZAR'
      })
      .then(setSession)
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-white">OPL Forge {session.currentPublicVersion}</p>
        <p className="text-xs text-muted-foreground">Estado: {session.state}</p>
      </div>
      {session.candidatePublicVersion && (
        <p className="text-sm text-violet-200">Nova versão {session.candidatePublicVersion}</p>
      )}
      <UpdateProgress session={session} />
      {policy && (
        <label className="block text-xs text-muted-foreground">
          Política de atualização
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
              Verificar automaticamente e perguntar antes de baixar
            </option>
            <option value="ask-before-download">Perguntar antes de verificar e baixar</option>
            <option value="download-automatic">
              Baixar automaticamente e perguntar antes de instalar
            </option>
            <option value="manual-only">Somente verificação manual</option>
          </select>
        </label>
      )}
      {session.lastError && (
        <p className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-rose-500/20 bg-rose-500/10 p-2 text-sm text-rose-300">
          {session.lastError.message}
        </p>
      )}
      {session.installBlockedByOperations.length > 0 && (
        <p className="text-sm text-amber-300">Conclua as operações ativas antes de reiniciar.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20"
          onClick={check}
          disabled={['CHECKING', 'DOWNLOADING', 'INSTALLING'].includes(session.state)}
        >
          Verificar atualizações
        </button>
        {session.state === 'UPDATE_AVAILABLE' && (
          <button
            className="rounded-lg bg-violet-600 px-3 py-2 text-sm text-white"
            onClick={download}
          >
            Baixar
          </button>
        )}
        {session.state === 'READY_TO_INSTALL' && (
          <button
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white"
            onClick={install}
          >
            Reiniciar e atualizar
          </button>
        )}
      </div>
    </div>
  )
}
