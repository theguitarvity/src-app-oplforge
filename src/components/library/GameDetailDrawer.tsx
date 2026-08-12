import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  X,
  MonitorPlay,
  ScanSearch,
  FilePenLine,
  CheckCircle2,
  AlertTriangle,
  Gamepad2,
  Images,
  ShieldCheck,
  Trash2
} from 'lucide-react'
import type { UnifiedGameItem } from '@/types/library'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'
import { useNetworkShareStore } from '@/stores/network-share-store'
import { ConfirmDialog } from '@/components/ConfirmDialog'

interface GameDetailDrawerProps {
  item: UnifiedGameItem | null
  isOpen: boolean
  onClose: () => void
  onUpdated?: () => void
}

function formatBytes(bytes?: number) {
  if (!bytes) return '-'
  const gb = bytes / (1024 * 1024 * 1024)
  return `${gb.toFixed(2)} GB`
}

export function GameDetailDrawer({ item, isOpen, onClose, onUpdated }: GameDetailDrawerProps) {
  const { t } = useTranslation()
  const activeDevice = useDeviceStore((state) => state.activeDevice)
  const sharingActive = useNetworkShareStore((state) => state.status?.smb.state) === 'running'
  const [isProcessing, setIsProcessing] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [showPcsx2Picker, setShowPcsx2Picker] = useState(false)
  const [pcsx2Path, setPcsx2Path] = useState('')
  const [biosPath, setBiosPath] = useState('')
  const [cardPath, setCardPath] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const profiles = useQuery({
    queryKey: ['opl-profiles'],
    queryFn: oplApi.listOplProfiles,
    enabled: isOpen
  })

  if (!isOpen || !item) return null

  async function pickPath(setter: (value: string) => void, extensions: string[]) {
    const [selected] = await oplApi.openPathDialog({
      mode: 'file',
      filters: [{ name: 'Arquivo', extensions }]
    })
    if (selected) setter(selected)
  }

  const handleTestPcsx2 = async () => {
    if (!showPcsx2Picker) {
      setShowPcsx2Picker(true)
      return
    }
    if (!activeDevice || !pcsx2Path || !biosPath || !cardPath) return
    setIsProcessing(true)
    setFeedback(null)
    try {
      const profileId = profiles.data?.[0]?.id
      if (!profileId) throw new Error(t('components.gameDetailDrawer.noProfileError') ?? '')
      const snapshot = await oplApi.scanCatalog({ devicePath: activeDevice.path })
      const plan = await oplApi.planValidation({
        deviceId: activeDevice.id,
        snapshotId: snapshot.snapshotId,
        itemId: item.id,
        profileId,
        pcsx2Path,
        biosPath,
        memoryCardPath: cardPath,
        bootMode: 'memory-card'
      })
      await oplApi.startValidation(plan.id)
      setFeedback(t('components.gameDetailDrawer.pcsx2Started'))
      setShowPcsx2Picker(false)
    } catch (err) {
      setFeedback(
        t('components.gameDetailDrawer.pcsx2StartError', { message: (err as Error).message })
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRenameOpl = async () => {
    if (!activeDevice) return
    setIsProcessing(true)
    setFeedback(null)
    try {
      const profileId = profiles.data?.[0]?.id ?? 'opl-default'
      const audit = await oplApi.auditOplNaming({ deviceId: activeDevice.id, profileId })
      const auditItem = audit.items.find((entry) => entry.currentRelativePath === item.filePath)
      if (!auditItem) {
        setFeedback(t('components.gameDetailDrawer.auditNotFound'))
        return
      }
      if (auditItem.classification === 'canonical') {
        setFeedback(t('components.gameDetailDrawer.alreadyCanonical'))
        return
      }
      if (auditItem.classification !== 'correctable') {
        setFeedback(
          t('components.gameDetailDrawer.notCorrectable', {
            classification: auditItem.classification
          })
        )
        return
      }
      const plan = await oplApi.createOplNamingPlan({
        auditId: audit.auditId,
        expectedRevision: audit.revision,
        itemIds: [auditItem.itemId]
      })
      await oplApi.confirmOplNaming({
        planId: plan.planId,
        expectedRevision: plan.revision,
        // Literal confirmation phrase expected by the backend — not localized (Constitution Principle I).
        confirmation: 'ADEQUAR NOMES OPL'
      })
      setFeedback(
        t('components.gameDetailDrawer.renamedTo', {
          path: auditItem.canonicalRelativePath ?? t('components.gameDetailDrawer.title')
        })
      )
      onUpdated?.()
    } catch (err) {
      setFeedback(t('components.gameDetailDrawer.renameError', { message: (err as Error).message }))
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCheckDefrag = async () => {
    if (!activeDevice) return
    setIsProcessing(true)
    setFeedback(null)
    try {
      const inventory = await oplApi.listFragmentationGames(activeDevice.path)
      const match = inventory.items.find((entry) => entry.relativePaths.includes(item.filePath))
      if (!match) {
        setFeedback(t('components.gameDetailDrawer.fragmentationNotFound'))
        return
      }
      const diagnostic = await oplApi.diagnoseFragmentation({
        devicePath: activeDevice.path,
        selectionKeys: [match.selectionKey]
      })
      const result = diagnostic.installations.find((entry) =>
        entry.identity.relativePaths.includes(item.filePath)
      )
      if (!result) {
        setFeedback(t('components.gameDetailDrawer.fragmentationNoResult'))
        return
      }
      const labels: Record<string, string> = {
        contiguous: t('components.gameDetailDrawer.fragmentationContiguous'),
        fragmented: t('components.gameDetailDrawer.fragmentationFragmented'),
        'partially-fragmented': t('components.gameDetailDrawer.fragmentationPartial'),
        incomplete: t('components.gameDetailDrawer.fragmentationIncomplete'),
        invalid: t('components.gameDetailDrawer.fragmentationInvalid'),
        unverifiable: t('components.gameDetailDrawer.fragmentationUnverifiable')
      }
      setFeedback(
        labels[result.state] ??
          t('components.gameDetailDrawer.fragmentationState', { state: result.state })
      )
    } catch (err) {
      setFeedback(
        t('components.gameDetailDrawer.fragmentationError', { message: (err as Error).message })
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleValidateCrc = async () => {
    if (!activeDevice) return
    setIsProcessing(true)
    setFeedback(null)
    try {
      const hash = await oplApi.hashCatalogFile({
        deviceId: activeDevice.id,
        relativePath: item.filePath
      })
      setFeedback(t('components.gameDetailDrawer.hashCalculated', { hash }))
    } catch (err) {
      setFeedback(
        t('components.gameDetailDrawer.validationError', { message: (err as Error).message })
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDelete = async () => {
    if (!activeDevice) return
    setShowDeleteConfirm(false)
    setIsProcessing(true)
    setFeedback(null)
    try {
      const result = await oplApi.deleteGame(activeDevice.path, item.filePath, item.gameId)
      if (result.failed.length) {
        setFeedback(
          t('components.gameDetailDrawer.deletedWithFailures', {
            paths: result.failed.map((f) => f.path).join(', ')
          })
        )
      } else {
        setFeedback(t('components.gameDetailDrawer.deletedSuccess', { title: item.title }))
        onUpdated?.()
        onClose()
      }
    } catch (err) {
      setFeedback(t('components.gameDetailDrawer.deleteError', { message: (err as Error).message }))
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex h-full w-full max-w-md flex-col border-l border-white/10 bg-slate-950 p-6 shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Gamepad2 className="size-5 text-violet-400" />
            <span>{t('components.gameDetailDrawer.title')}</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-6 space-y-6">
          {/* Title & Cover Banner */}
          <div className="flex gap-4">
            <div className="grid size-20 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-violet-400">
              <Gamepad2 className="size-10" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white line-clamp-2">{item.title}</h3>
              <p className="mt-1 font-mono text-xs text-violet-300">
                {item.gameId || t('components.gameDetailDrawer.noGameId')}
              </p>
              <div className="mt-2 flex gap-1.5">
                <span className="rounded bg-violet-600/20 px-2 py-0.5 text-[10px] font-bold text-violet-300 border border-violet-500/30">
                  {item.type}
                </span>
                <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-mono text-white/80">
                  {item.region || 'NTSC-U'}
                </span>
              </div>
            </div>
          </div>

          {/* Feedback Message */}
          {feedback && (
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-3 text-xs text-violet-200">
              {feedback}
            </div>
          )}

          {/* Metadata Table */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t('components.gameDetailDrawer.mediaInfo')}
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">
                  {t('components.gameDetailDrawer.sizeOnDisk')}
                </span>
                <p className="font-medium text-white">{formatBytes(item.sizeBytes)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t('components.gameDetailDrawer.oplStatus')}
                </span>
                <p className="font-medium text-emerald-400 flex items-center gap-1">
                  {item.status === 'ready' ? (
                    <>
                      <CheckCircle2 className="size-3" /> {t('components.gameDetailDrawer.valid')}
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="size-3 text-amber-400" />{' '}
                      {t('components.gameDetailDrawer.needsAttention')}
                    </>
                  )}
                </p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">
                  {t('components.gameDetailDrawer.relativePath')}
                </span>
                <p className="font-mono text-[11px] text-white/80 break-all">{item.filePath}</p>
              </div>
            </div>
          </div>

          {/* Contextual Actions Panel */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t('components.gameDetailDrawer.toolsAndOperations')}
            </h4>

            <button
              onClick={handleTestPcsx2}
              disabled={isProcessing}
              className="flex w-full items-center justify-between rounded-xl border border-violet-500/30 bg-violet-500/10 p-3 text-xs font-semibold text-white transition hover:bg-violet-500/20 disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                <MonitorPlay className="size-4 text-violet-400" />
                {t('components.gameDetailDrawer.testOnPcsx2')}
              </span>
              <span className="text-[10px] text-violet-300 font-mono">
                {t('components.gameDetailDrawer.emulator')}
              </span>
            </button>

            {showPcsx2Picker ? (
              <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] text-muted-foreground">
                  {t('components.gameDetailDrawer.biosPickerHint')}
                </p>
                <button
                  onClick={() => void pickPath(setPcsx2Path, ['AppImage', 'exe'])}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-left text-[11px] text-white hover:bg-white/10"
                >
                  {t('components.gameDetailDrawer.pcsx2Label', {
                    value: pcsx2Path || t('components.gameDetailDrawer.selectExecutable')
                  })}
                </button>
                <button
                  onClick={() => void pickPath(setBiosPath, ['bin', 'rom'])}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-left text-[11px] text-white hover:bg-white/10"
                >
                  {t('components.gameDetailDrawer.biosLabel', {
                    value: biosPath || t('components.gameDetailDrawer.selectOwnFile')
                  })}
                </button>
                <button
                  onClick={() => void pickPath(setCardPath, ['ps2', 'mcd'])}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-left text-[11px] text-white hover:bg-white/10"
                >
                  {t('components.gameDetailDrawer.memoryCardLabel', {
                    value: cardPath || t('components.gameDetailDrawer.selectImage')
                  })}
                </button>
                <button
                  onClick={handleTestPcsx2}
                  disabled={isProcessing || !pcsx2Path || !biosPath || !cardPath}
                  className="w-full rounded-lg bg-violet-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  {t('components.gameDetailDrawer.confirmAndStart')}
                </button>
              </div>
            ) : null}

            <button
              onClick={handleRenameOpl}
              disabled={isProcessing}
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                <FilePenLine className="size-4 text-violet-400" />
                {t('components.gameDetailDrawer.renameToOplStandard')}
              </span>
            </button>

            <button
              onClick={handleCheckDefrag}
              disabled={isProcessing}
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                <ScanSearch className="size-4 text-violet-400" />
                {t('components.gameDetailDrawer.checkFragmentation')}
              </span>
            </button>

            <button
              onClick={handleValidateCrc}
              disabled={isProcessing}
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-violet-400" />
                {t('components.gameDetailDrawer.validateHashIso')}
              </span>
            </button>

            <Link
              to="/catalog?tab=artsync"
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-xs font-semibold text-white transition hover:bg-white/10"
            >
              <span className="flex items-center gap-2">
                <Images className="size-4 text-violet-400" />
                {t('components.gameDetailDrawer.manageArt')}
              </span>
              <span className="text-[10px] text-violet-300 font-mono">
                {t('components.gameDetailDrawer.catalog')}
              </span>
            </Link>

            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isProcessing}
              className="flex w-full items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                <Trash2 className="size-4" />
                {t('components.gameDetailDrawer.deleteTitle')}
              </span>
            </button>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="border-t border-white/10 pt-4">
          <button
            onClick={onClose}
            className="w-full rounded-xl border border-white/15 bg-white/10 py-2.5 text-xs font-semibold text-white transition hover:bg-white/15"
          >
            {t('components.gameDetailDrawer.close')}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t('components.gameDetailDrawer.deleteConfirmTitle')}
        description={
          sharingActive
            ? t('components.gameDetailDrawer.deleteConfirmDescriptionSharing', {
                title: item.title
              })
            : t('components.gameDetailDrawer.deleteConfirmDescription', { title: item.title })
        }
        confirmLabel={t('components.gameDetailDrawer.deleteConfirmLabel')}
        onConfirm={handleDelete}
      />
    </div>
  )
}
