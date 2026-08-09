import { useState } from 'react'
import {
  Wrench,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  X,
  RefreshCw
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { oplApi } from '@/services/api'
import type { DeviceInfo } from '@/types/opl'

interface PrepWizardProps {
  onClose: () => void
  onSuccess: () => void
  preselectedDevicePath?: string | null
}

export function PrepWizard({ onClose, onSuccess, preselectedDevicePath }: PrepWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(preselectedDevicePath ? 2 : 1)
  const [pickedDevice, setPickedDevice] = useState<DeviceInfo | null>(null)
  const [fileSystem, setFileSystem] = useState<'exFAT' | 'FAT32'>('exFAT')
  const [confirmed, setConfirmed] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: oplApi.listDevices
  })

  const selectedDevice =
    pickedDevice ?? devices.find((d) => d.path === preselectedDevicePath) ?? null
  const setSelectedDevice = setPickedDevice

  const handleExecutePreparation = async () => {
    if (!selectedDevice || !confirmed) return
    setIsExecuting(true)
    setErrorMsg(null)
    setStep(4)

    try {
      await oplApi.prepareDevice({
        devicePath: selectedDevice.path
      })
      setStep(5)
    } catch (err) {
      setErrorMsg(
        `Falha na preparação do dispositivo: ${err instanceof Error ? err.message : String(err)}`
      )
      setStep(3)
    } finally {
      setIsExecuting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl space-y-6">
      {/* Wizard Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-violet-600/20 text-violet-300 border border-violet-500/30">
            <Wrench className="size-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Preparar Dispositivo para OPL</h3>
            <p className="text-xs text-muted-foreground">
              Passo {step} de 5: {step === 1 && 'Selecionar Dispositivo'}
              {step === 2 && 'Configurar Sistema de Arquivos'}
              {step === 3 && 'Confirmação de Segurança'}
              {step === 4 && 'Executando Preparação'}
              {step === 5 && 'Concluído!'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/10 hover:text-white"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Step Progress Dots */}
      <div className="flex justify-between items-center px-4">
        {[1, 2, 3, 4, 5].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`grid size-7 place-items-center rounded-full text-xs font-bold transition ${
                s === step
                  ? 'bg-violet-600 text-white ring-4 ring-violet-600/30'
                  : s < step
                    ? 'bg-emerald-500 text-black'
                    : 'bg-white/10 text-muted-foreground'
              }`}
            >
              {s < step ? '✓' : s}
            </div>
            {s < 5 && (
              <div className={`h-0.5 w-12 ${s < step ? 'bg-emerald-500' : 'bg-white/10'}`} />
            )}
          </div>
        ))}
      </div>

      {/* STEP 1: Device Selection */}
      {step === 1 && (
        <div className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Selecione o dispositivo alvo
          </h4>
          {isLoading ? (
            <p className="text-xs text-muted-foreground">Procurando dispositivos...</p>
          ) : devices.length === 0 ? (
            <p className="text-xs text-amber-300">Nenhum dispositivo detectado no sistema.</p>
          ) : (
            <div className="space-y-2">
              {devices.map((d) => (
                <div
                  key={d.id}
                  onClick={() => setSelectedDevice(d)}
                  className={`flex items-center justify-between rounded-xl border p-4 cursor-pointer transition ${
                    selectedDevice?.id === d.id
                      ? 'border-violet-500 bg-violet-600/10 text-white font-semibold'
                      : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div>
                    <p className="text-sm text-white">{d.name}</p>
                    <p className="text-xs font-mono text-muted-foreground">
                      {d.path} • {d.fileSystem}
                    </p>
                  </div>
                  {selectedDevice?.id === d.id && (
                    <CheckCircle2 className="size-5 text-violet-400" />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-white/10">
            <button
              disabled={!selectedDevice}
              onClick={() => setStep(2)}
              className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-violet-500 disabled:opacity-50"
            >
              Próximo <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: FileSystem Config */}
      {step === 2 && (
        <div className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Escolha a configuração do OPL
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <div
              onClick={() => setFileSystem('exFAT')}
              className={`rounded-2xl border p-4 cursor-pointer transition ${
                fileSystem === 'exFAT'
                  ? 'border-violet-500 bg-violet-600/10 text-white'
                  : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10'
              }`}
            >
              <h5 className="text-sm font-bold text-white">exFAT (Recomendado)</h5>
              <p className="mt-1 text-xs text-muted-foreground">
                Suporta arquivos ISO maiores que 4GB sem necessidade de divisão em partes (OPL
                1.2+).
              </p>
            </div>

            <div
              onClick={() => setFileSystem('FAT32')}
              className={`rounded-2xl border p-4 cursor-pointer transition ${
                fileSystem === 'FAT32'
                  ? 'border-violet-500 bg-violet-600/10 text-white'
                  : 'border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10'
              }`}
            >
              <h5 className="text-sm font-bold text-white">FAT32</h5>
              <p className="mt-1 text-xs text-muted-foreground">
                Compatibilidade legada com versões antigas do OPL e consoles com mods rígidos.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-white">Pastas OPL que serão criadas:</p>
            <p className="font-mono text-violet-300">DVD / CD / PS1 / APPS / ART / CFG / VMC</p>
          </div>

          <div className="flex justify-between pt-4 border-t border-white/10">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/10"
            >
              <ArrowLeft className="size-4" /> Voltar
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-violet-500"
            >
              Próximo <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Safety Confirmation */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200">
            <ShieldAlert className="size-8 text-rose-400 shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-white">Aviso de Operação Sensível</h4>
              <p className="text-xs text-rose-200/80">
                A preparação irá gravar a estrutura OPL no dispositivo selecionado.
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/20 p-3 text-xs text-rose-200">
              {errorMsg}
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs space-y-2">
            <p>
              <span className="text-muted-foreground">Dispositivo Alvo:</span>{' '}
              <strong className="text-white font-mono">
                {selectedDevice?.name} ({selectedDevice?.path})
              </strong>
            </p>
            <p>
              <span className="text-muted-foreground">Sistema de Arquivos:</span>{' '}
              <strong className="text-violet-300 font-mono">{fileSystem}</strong>
            </p>
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="size-4 rounded accent-violet-600"
            />
            <span className="text-xs text-white">
              Estou ciente de que estou alterando o dispositivo{' '}
              <strong className="text-violet-300">{selectedDevice?.path}</strong>.
            </span>
          </label>

          <div className="flex justify-between pt-4 border-t border-white/10">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/10"
            >
              <ArrowLeft className="size-4" /> Voltar
            </button>
            <button
              disabled={!confirmed || isExecuting}
              onClick={handleExecutePreparation}
              className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-rose-500 disabled:opacity-50"
            >
              Iniciar Preparação <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Execution Progress */}
      {step === 4 && (
        <div className="py-8 text-center space-y-4">
          <RefreshCw className="size-10 animate-spin text-violet-400 mx-auto" />
          <h4 className="text-base font-bold text-white">Criando estrutura de diretórios OPL...</h4>
          <p className="text-xs text-muted-foreground">
            Por favor, mantenha o dispositivo conectado.
          </p>
        </div>
      )}

      {/* STEP 5: Success */}
      {step === 5 && (
        <div className="py-8 text-center space-y-4">
          <CheckCircle2 className="size-12 text-emerald-400 mx-auto" />
          <h4 className="text-lg font-bold text-white">Dispositivo Preparado com Sucesso!</h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            A estrutura OPL foi criada. Você já pode copiar seus jogos para as pastas DVD/CD do
            dispositivo.
          </p>

          <button
            onClick={onSuccess}
            className="rounded-xl bg-violet-600 px-6 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-violet-500"
          >
            Ir para o Dispositivo Workspace
          </button>
        </div>
      )}
    </div>
  )
}
