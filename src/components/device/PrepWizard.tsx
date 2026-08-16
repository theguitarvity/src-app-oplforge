import { useState } from 'react'
import {
  Wrench,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  X,
  RefreshCw,
  FolderOpen
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { oplApi } from '@/services/api'
import type { DeviceInfo } from '@/types/opl'

interface PrepWizardProps {
  onClose: () => void
  onSuccess: () => void
  initialDevice?: DeviceInfo | null
}

export function PrepWizard({ onClose, onSuccess, initialDevice }: PrepWizardProps) {
  const { t } = useTranslation()
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 'ready'>(() => {
    if (!initialDevice) return 1
    return initialDevice.status === 'ready' ? 'ready' : 2
  })
  const [selectedDevice, setSelectedDevice] = useState<DeviceInfo | null>(initialDevice ?? null)
  const [fileSystem, setFileSystem] = useState<'exFAT' | 'FAT32'>('exFAT')
  const [confirmed, setConfirmed] = useState(false)
  const [confirmedOutsideHome, setConfirmedOutsideHome] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [pickError, setPickError] = useState<string | null>(null)

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: oplApi.listDevices
  })

  const stepLabel =
    step === 'ready'
      ? t('components.prepWizard.readyStepLabel')
      : step === 1
        ? t('components.prepWizard.step1Label')
        : step === 2
          ? t('components.prepWizard.step2Label')
          : step === 3
            ? t('components.prepWizard.step3Label')
            : step === 4
              ? t('components.prepWizard.step4Label')
              : t('components.prepWizard.step5Label')

  const selectTarget = (device: DeviceInfo) => {
    setSelectedDevice(device)
    setConfirmed(false)
    setConfirmedOutsideHome(false)
    if (device.status === 'ready') {
      setStep('ready')
    } else {
      setStep(1)
    }
  }

  const handlePickLocalFolder = async () => {
    setPickError(null)
    try {
      const [picked] = await oplApi.openPathDialog({ mode: 'folder', restrictSystemRoots: true })
      if (!picked) return
      const summary = await oplApi.getDeviceSummary(picked)
      if (!summary.device) {
        setPickError(t('components.prepWizard.couldNotReadFolder'))
        return
      }
      selectTarget(summary.device)
    } catch (err) {
      setPickError(
        err instanceof Error ? err.message : t('components.prepWizard.pickLocalFolderFailed')
      )
    }
  }

  const requiresExtraConfirmation = Boolean(selectedDevice?.isOutsideHome)
  const canExecutePreparation = confirmed && (!requiresExtraConfirmation || confirmedOutsideHome)

  const handleExecutePreparation = async () => {
    if (!selectedDevice || !canExecutePreparation) return
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
        t('components.prepWizard.preparationFailed', {
          message: err instanceof Error ? err.message : String(err)
        })
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
            <h3 className="text-base font-bold text-white">{t('components.prepWizard.title')}</h3>
            <p className="text-xs text-muted-foreground">
              {step === 'ready'
                ? stepLabel
                : t('components.prepWizard.stepOf', { step, label: stepLabel })}
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
      {step !== 'ready' && (
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
      )}

      {/* STEP 1: Device Selection */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t('components.prepWizard.selectTargetDevice')}
            </h4>
            <button
              onClick={handlePickLocalFolder}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
            >
              <FolderOpen className="size-3.5" /> {t('components.prepWizard.pickLocalFolder')}
            </button>
          </div>

          {pickError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/20 p-3 text-xs text-rose-200">
              {pickError}
            </div>
          )}

          {selectedDevice && !devices.some((d) => d.id === selectedDevice.id) && (
            <div className="flex items-center justify-between rounded-xl border border-violet-500 bg-violet-600/10 p-4 text-white font-semibold">
              <div>
                <p className="text-sm text-white">
                  {t('components.prepWizard.localFolderSelectedTitle')}
                </p>
                <p className="text-xs font-mono text-muted-foreground">{selectedDevice.path}</p>
              </div>
              <CheckCircle2 className="size-5 text-violet-400" />
            </div>
          )}

          {isLoading ? (
            <p className="text-xs text-muted-foreground">
              {t('components.prepWizard.searchingDevices')}
            </p>
          ) : devices.length === 0 ? (
            <p className="text-xs text-amber-300">{t('components.prepWizard.noDevicesDetected')}</p>
          ) : (
            <div className="space-y-2">
              {devices.map((d) => (
                <div
                  key={d.id}
                  onClick={() => selectTarget(d)}
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
              {t('components.prepWizard.next')} <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP "ready": already has full OPL structure */}
      {step === 'ready' && (
        <div className="py-8 text-center space-y-4">
          <CheckCircle2 className="size-12 text-emerald-400 mx-auto" />
          <h4 className="text-lg font-bold text-white">{t('components.prepWizard.readyTitle')}</h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {t('components.prepWizard.readyDescription', { path: selectedDevice?.path })}
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => {
                setSelectedDevice(null)
                setStep(1)
              }}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-semibold text-white hover:bg-white/10"
            >
              {t('components.prepWizard.selectAnother')}
            </button>
            <button
              onClick={onSuccess}
              className="rounded-xl bg-violet-600 px-6 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-violet-500"
            >
              {t('components.prepWizard.goToWorkspace')}
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: FileSystem Config */}
      {step === 2 && (
        <div className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {t('components.prepWizard.chooseOplConfig')}
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
              <h5 className="text-sm font-bold text-white">
                {t('components.prepWizard.exfatRecommended')}
              </h5>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('components.prepWizard.exfatDescription')}
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
              <h5 className="text-sm font-bold text-white">{t('components.prepWizard.fat32')}</h5>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('components.prepWizard.fat32Description')}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-white">{t('components.prepWizard.foldersToCreate')}</p>
            <p className="font-mono text-violet-300">
              DVD / CD / PS1 / APPS / ART / CFG / VMC / CHT / LNG / THM
            </p>
          </div>

          <div className="flex justify-between pt-4 border-t border-white/10">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/10"
            >
              <ArrowLeft className="size-4" /> {t('components.prepWizard.back')}
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-violet-500"
            >
              {t('components.prepWizard.next')} <ArrowRight className="size-4" />
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
              <h4 className="text-sm font-bold text-white">
                {t('components.prepWizard.sensitiveOperationTitle')}
              </h4>
              <p className="text-xs text-rose-200/80">
                {t('components.prepWizard.sensitiveOperationDescription')}
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
              <span className="text-muted-foreground">
                {t('components.prepWizard.targetDevice')}
              </span>{' '}
              <strong className="text-white font-mono">
                {selectedDevice?.name} ({selectedDevice?.path})
              </strong>
            </p>
            <p>
              <span className="text-muted-foreground">{t('components.prepWizard.fileSystem')}</span>{' '}
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
              {t('components.prepWizard.confirmationLabel', { path: selectedDevice?.path })}
            </span>
          </label>

          {requiresExtraConfirmation && (
            <label className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmedOutsideHome}
                onChange={(e) => setConfirmedOutsideHome(e.target.checked)}
                className="size-4 rounded accent-amber-500"
              />
              <span className="text-xs text-amber-100">
                {t('components.prepWizard.outsideHomeConfirmLabel')}
              </span>
            </label>
          )}

          <div className="flex justify-between pt-4 border-t border-white/10">
            <button
              onClick={() => setStep(2)}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/10"
            >
              <ArrowLeft className="size-4" /> {t('components.prepWizard.back')}
            </button>
            <button
              disabled={!canExecutePreparation || isExecuting}
              onClick={handleExecutePreparation}
              className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-rose-500 disabled:opacity-50"
            >
              {t('components.prepWizard.startPreparation')} <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Execution Progress */}
      {step === 4 && (
        <div className="py-8 text-center space-y-4">
          <RefreshCw className="size-10 animate-spin text-violet-400 mx-auto" />
          <h4 className="text-base font-bold text-white">
            {t('components.prepWizard.creatingStructure')}
          </h4>
          <p className="text-xs text-muted-foreground">
            {t('components.prepWizard.keepConnected')}
          </p>
        </div>
      )}

      {/* STEP 5: Success */}
      {step === 5 && (
        <div className="py-8 text-center space-y-4">
          <CheckCircle2 className="size-12 text-emerald-400 mx-auto" />
          <h4 className="text-lg font-bold text-white">
            {t('components.prepWizard.successTitle')}
          </h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {t('components.prepWizard.successDescription')}
          </p>

          <button
            onClick={onSuccess}
            className="rounded-xl bg-violet-600 px-6 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-violet-500"
          >
            {t('components.prepWizard.goToWorkspace')}
          </button>
        </div>
      )}
    </div>
  )
}
