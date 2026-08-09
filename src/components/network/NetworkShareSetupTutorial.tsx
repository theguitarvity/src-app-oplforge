import { useEffect, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { oplApi } from '@/services/api'
import type { NetworkShareProtocol, SetupInstructions } from '@/types/opl'

interface NetworkShareSetupTutorialProps {
  protocol: NetworkShareProtocol
  onClose: () => void
}

export function NetworkShareSetupTutorial({ protocol, onClose }: NetworkShareSetupTutorialProps) {
  const [instructions, setInstructions] = useState<SetupInstructions | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const result = await oplApi.getNetworkShareSetupInstructions(protocol)
        if (!cancelled) setInstructions(result)
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Falha ao carregar o tutorial.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [protocol])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <Card className="w-full max-w-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">
            Configurar {protocol === 'smb' ? 'SMB' : 'FTP'} no PS2
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-white">
            <X className="size-5" />
          </button>
        </div>

        {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

        {!instructions && !error && (
          <div className="mt-6 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Carregando...
          </div>
        )}

        {instructions && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              No PS2, acesse:{' '}
              <span className="text-white">{instructions.oplMenuPath.join(' → ')}</span> e informe
              os valores abaixo:
            </p>
            <div className="space-y-2">
              {instructions.steps.map((step) => (
                <div
                  key={step.label}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                >
                  <span className="text-muted-foreground">{step.label}</span>
                  <span className="font-mono text-white">{step.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </Card>
    </div>
  )
}
