import type { ValidationCheckpoint, ValidationCheckpointResult } from '@/types/opl'
import { Button } from '@/components/ui/button'

const labels = [
  'BIOS inicializada',
  'OPL abriu sem crash',
  'USB emulado detectado',
  'Lista de jogos carregada',
  'Game ID e título exibidos',
  'Capa COV/COV2 exibida',
  'Jogo selecionável',
  'Sem erro de fragmentação',
  'Marco do jogo alcançado'
]
export function CheckpointPanel({
  checkpoints,
  onConfirm
}: {
  checkpoints: ValidationCheckpoint[]
  onConfirm(stage: number, result: ValidationCheckpointResult): void
}) {
  return (
    <div className="space-y-2">
      {labels.map((label, index) => {
        const stage = index + 1
        const current = checkpoints.find((item) => item.stage === stage)
        return (
          <div
            key={label}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 p-3"
          >
            <span>
              {stage}. {label} — {current?.result ?? 'aguardando'}
            </span>
            <div className="flex gap-1">
              <Button type="button" variant="secondary" onClick={() => onConfirm(stage, 'passed')}>
                Passou
              </Button>
              <Button type="button" variant="ghost" onClick={() => onConfirm(stage, 'failed')}>
                Falhou
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onConfirm(stage, 'not-verified')}
              >
                Não verificado
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
