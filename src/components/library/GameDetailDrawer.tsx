import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
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
      if (!profileId)
        throw new Error('Nenhum perfil OPL registrado. Registre um perfil antes de validar.')
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
      setFeedback('PCSX2 iniciado em ambiente isolado.')
      setShowPcsx2Picker(false)
    } catch (err) {
      setFeedback(`Erro ao iniciar PCSX2: ${(err as Error).message}`)
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
        setFeedback('Não foi possível localizar este arquivo na auditoria de nomes.')
        return
      }
      if (auditItem.classification === 'canonical') {
        setFeedback('O nome já está no padrão OPL.')
        return
      }
      if (auditItem.classification !== 'correctable') {
        setFeedback(`Nome não pode ser corrigido automaticamente (${auditItem.classification}).`)
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
        confirmation: 'ADEQUAR NOMES OPL'
      })
      setFeedback(`Nome atualizado para ${auditItem.canonicalRelativePath ?? 'o padrão OPL'}.`)
      onUpdated?.()
    } catch (err) {
      setFeedback(`Erro ao renomear: ${(err as Error).message}`)
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
        setFeedback('Este arquivo não foi encontrado no inventário de fragmentação.')
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
        setFeedback('Diagnóstico concluído sem resultado para este arquivo.')
        return
      }
      const labels: Record<string, string> = {
        contiguous: 'Arquivo contíguo (pronto para OPL).',
        fragmented: 'Arquivo fragmentado — recomenda-se correção.',
        'partially-fragmented': 'Arquivo parcialmente fragmentado.',
        incomplete: 'Instalação incompleta detectada.',
        invalid: 'Instalação inválida detectada.',
        unverifiable: 'Não foi possível verificar a fragmentação.'
      }
      setFeedback(labels[result.state] ?? `Estado: ${result.state}`)
    } catch (err) {
      setFeedback(`Erro na verificação de fragmentação: ${(err as Error).message}`)
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
      setFeedback(`Hash calculado: ${hash}`)
    } catch (err) {
      setFeedback(`Erro na validação: ${(err as Error).message}`)
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
        setFeedback(`Excluído com falhas: ${result.failed.map((f) => f.path).join(', ')}`)
      } else {
        setFeedback(`${item.title} removido da biblioteca.`)
        onUpdated?.()
        onClose()
      }
    } catch (err) {
      setFeedback(`Erro ao excluir: ${(err as Error).message}`)
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
            <span>Detalhes do Jogo</span>
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
                {item.gameId || 'Sem Game ID'}
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
              Informações da Mídia
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Tamanho no Disco:</span>
                <p className="font-medium text-white">{formatBytes(item.sizeBytes)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Status OPL:</span>
                <p className="font-medium text-emerald-400 flex items-center gap-1">
                  {item.status === 'ready' ? (
                    <>
                      <CheckCircle2 className="size-3" /> Válido
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="size-3 text-amber-400" /> Requer atenção
                    </>
                  )}
                </p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Caminho Relativo:</span>
                <p className="font-mono text-[11px] text-white/80 break-all">{item.filePath}</p>
              </div>
            </div>
          </div>

          {/* Contextual Actions Panel */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Ferramentas & Operações
            </h4>

            <button
              onClick={handleTestPcsx2}
              disabled={isProcessing}
              className="flex w-full items-center justify-between rounded-xl border border-violet-500/30 bg-violet-500/10 p-3 text-xs font-semibold text-white transition hover:bg-violet-500/20 disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                <MonitorPlay className="size-4 text-violet-400" />
                Testar no PCSX2
              </span>
              <span className="text-[10px] text-violet-300 font-mono">Emulador</span>
            </button>

            {showPcsx2Picker ? (
              <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] text-muted-foreground">
                  Selecione sua própria BIOS legalmente extraída. Ela não será baixada nem
                  distribuída.
                </p>
                <button
                  onClick={() => void pickPath(setPcsx2Path, ['AppImage', 'exe'])}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-left text-[11px] text-white hover:bg-white/10"
                >
                  PCSX2: {pcsx2Path || 'selecionar executável'}
                </button>
                <button
                  onClick={() => void pickPath(setBiosPath, ['bin', 'rom'])}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-left text-[11px] text-white hover:bg-white/10"
                >
                  BIOS: {biosPath || 'selecionar arquivo próprio'}
                </button>
                <button
                  onClick={() => void pickPath(setCardPath, ['ps2', 'mcd'])}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-left text-[11px] text-white hover:bg-white/10"
                >
                  Memory Card: {cardPath || 'selecionar imagem'}
                </button>
                <button
                  onClick={handleTestPcsx2}
                  disabled={isProcessing || !pcsx2Path || !biosPath || !cardPath}
                  className="w-full rounded-lg bg-violet-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  Confirmar & Iniciar
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
                Renomear para Padrão OPL
              </span>
            </button>

            <button
              onClick={handleCheckDefrag}
              disabled={isProcessing}
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                <ScanSearch className="size-4 text-violet-400" />
                Verificar Fragmentação
              </span>
            </button>

            <button
              onClick={handleValidateCrc}
              disabled={isProcessing}
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-violet-400" />
                Validar Hash / ISO
              </span>
            </button>

            <Link
              to="/catalog?tab=artsync"
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-xs font-semibold text-white transition hover:bg-white/10"
            >
              <span className="flex items-center gap-2">
                <Images className="size-4 text-violet-400" />
                Gerenciar Artes
              </span>
              <span className="text-[10px] text-violet-300 font-mono">Catálogo</span>
            </Link>

            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isProcessing}
              className="flex w-full items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                <Trash2 className="size-4" />
                Excluir Título
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
            Fechar
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Excluir título"
        description={
          sharingActive
            ? `Isso remove o arquivo do jogo, capa e configuração de "${item.title}". O compartilhamento está ativo — excluir um jogo que o PS2 esteja lendo agora pode causar falha no PS2. Esta ação não pode ser desfeita.`
            : `Isso remove o arquivo do jogo, capa e configuração de "${item.title}". Esta ação não pode ser desfeita.`
        }
        confirmLabel="Excluir"
        onConfirm={handleDelete}
      />
    </div>
  )
}
