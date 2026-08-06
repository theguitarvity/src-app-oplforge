import { Fragment, useMemo, useState } from 'react'
import type { DiagnosticState, GameDiagnostic } from '@/types/opl'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { formatBytes } from '@/utils/format'

type StateFilter = 'all' | DiagnosticState

export function GameDiagnosticTable({
  games,
  onRepair,
  repairPending
}: {
  games: GameDiagnostic[]
  onRepair?: (game: GameDiagnostic) => void
  repairPending?: boolean
}) {
  const [filter, setFilter] = useState<StateFilter>('all')
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const visibleGames = useMemo(
    () => (filter === 'all' ? games : games.filter((game) => game.state === filter)),
    [filter, games]
  )

  function toggle(installationId: string) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(installationId)) next.delete(installationId)
      else next.add(installationId)
      return next
    })
  }

  return (
    <section
      aria-labelledby="game-diagnostics-title"
      className="rounded-xl border border-white/10 bg-black/20 p-4"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 id="game-diagnostics-title" className="font-semibold text-white">
            Evidências por jogo
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {visibleGames.length} de {games.length} instalações
          </p>
        </div>
        <label className="w-full text-sm text-muted-foreground sm:w-64">
          Filtrar por estado
          <Select
            className="mt-1"
            value={filter}
            onChange={(event) => setFilter(event.target.value as StateFilter)}
          >
            <option value="all">Todos</option>
            <option value="contiguous">contiguous</option>
            <option value="fragmented">fragmented</option>
            <option value="partially-fragmented">partially-fragmented</option>
            <option value="incomplete">incomplete</option>
            <option value="invalid">invalid</option>
            <option value="unverifiable">unverifiable</option>
          </Select>
        </label>
      </div>

      {visibleGames.length === 0 ? (
        <p className="mt-4 rounded-lg bg-white/5 p-4 text-sm text-muted-foreground">
          Nenhum jogo corresponde ao filtro.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Diagnóstico de fragmentação por jogo</caption>
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Jogo</th>
                <th>Formato</th>
                <th>Estado</th>
                <th>Tamanho</th>
                <th>Motivo</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {visibleGames.map((game) => {
                const id = game.identity.installationId
                const isExpanded = expanded.has(id)
                const usbParts = game.files.filter((file) => file.role === 'usb-part')
                const affectedUsbParts = usbParts.filter(
                  (file) => file.extentState === 'fragmented'
                )
                return (
                  <Fragment key={id}>
                    <tr className="border-t border-white/10 align-top">
                      <td className="p-3">
                        <p className="font-medium text-white">{game.identity.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {game.identity.gameId ?? 'Game ID ausente'}
                        </p>
                      </td>
                      <td>{game.identity.format}</td>
                      <td>
                        <span data-state={game.state}>{game.state}</span>
                      </td>
                      <td>{formatBytes(game.totalBytes)}</td>
                      <td>{game.findings[0]?.message ?? 'Sem achados adicionais'}</td>
                      <td className="space-y-2 p-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          aria-expanded={isExpanded}
                          aria-controls={`files-${id}`}
                          onClick={() => toggle(id)}
                        >
                          Ver arquivos de {game.identity.title}
                        </Button>
                        {onRepair &&
                        (game.state === 'fragmented' || game.state === 'partially-fragmented') ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={repairPending}
                            onClick={() => onRepair(game)}
                          >
                            Corrigir {game.identity.title}
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr className="border-t border-white/5 bg-white/[0.02]" id={`files-${id}`}>
                        <td colSpan={6} className="p-3">
                          {game.identity.format === 'USBExtreme' ? (
                            <p className="mb-2 text-sm font-medium text-white">
                              {affectedUsbParts.length} de {usbParts.length} partes afetadas · todas
                              as partes e o ul.cfg são validados como uma instalação
                            </p>
                          ) : null}
                          <ul
                            className="space-y-2"
                            aria-label={`Arquivos avaliados de ${game.identity.title}`}
                          >
                            {game.files.map((file) => (
                              <li key={file.relativePath} className="rounded-lg bg-black/20 p-3">
                                <p className="break-all text-white">{file.relativePath}</p>
                                <p className="text-xs text-muted-foreground">
                                  {file.role} · {file.structuralState} · {file.extentState}
                                  {file.extentCount !== undefined
                                    ? ` · ${file.extentCount} extents`
                                    : ''}
                                  {file.verificationMethod ? ` · ${file.verificationMethod}` : ''}
                                </p>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
