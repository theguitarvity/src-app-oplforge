import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { LayoutGrid, List, Search, Gamepad2, Plus, X } from 'lucide-react'
import { GameCard } from '@/components/library/GameCard'
import { GameRow } from '@/components/library/GameRow'
import { GameDetailDrawer } from '@/components/library/GameDetailDrawer'
import { SourcesPage } from '@/pages/SourcesPage'
import { oplApi } from '@/services/api'
import { useDeviceStore } from '@/stores/device-store'
import type { UnifiedGameItem, GameContentType, GameStatusBadge } from '@/types/library'
import type { CatalogItem } from '@/types/opl'

function toUnifiedGameItem(item: CatalogItem): UnifiedGameItem {
  const status: GameStatusBadge =
    item.classification === 'invalid'
      ? 'invalid_name'
      : item.fragmentation === 'fragmented'
        ? 'fragmented'
        : item.classification === 'warning' || item.artStatus === 'missing'
          ? 'needs_attention'
          : item.compatibility === 'failed'
            ? 'validation_warning'
            : 'ready'

  return {
    id: item.itemId,
    title: item.title || item.relativePath,
    gameId: item.gameId || '',
    type: 'PS2',
    format: item.installFormat !== 'unknown' ? item.installFormat : undefined,
    filePath: item.relativePath,
    sizeBytes: item.totalBytes,
    status,
    isFragmented: item.fragmentation === 'fragmented',
    hasCoverArt: item.artStatus !== 'missing',
    hasBackgroundArt: item.artStatus === 'complete'
  }
}

export function GameLibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeDevice = useDeviceStore((state) => state.activeDevice)

  const activeType = (searchParams.get('type') as GameContentType) || 'ALL'
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGame, setSelectedGame] = useState<UnifiedGameItem | null>(null)
  const [showAddPanel, setShowAddPanel] = useState(() => searchParams.get('action') === 'add')

  const { data: libraryItems = [], refetch } = useQuery({
    queryKey: ['library-items', activeDevice?.path],
    queryFn: async () => {
      if (!activeDevice) return []
      const snapshot = await oplApi.scanCatalog({ devicePath: activeDevice.path })
      return snapshot.items.filter((item) => item.kind === 'game').map(toUnifiedGameItem)
    },
    enabled: Boolean(activeDevice)
  })

  const filteredItems = libraryItems.filter((item) => {
    if (activeType === 'PS2' && item.type !== 'PS2') return false
    if (activeType === 'PS1' && item.type !== 'PS1') return false
    if (activeType === 'APP' && item.type !== 'APP') return false

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return item.title.toLowerCase().includes(q) || item.gameId.toLowerCase().includes(q)
    }

    return true
  })

  return (
    <div className="space-y-6">
      {/* Header & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Biblioteca de Jogos</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie e organize seus jogos PS2, PS1 e aplicações no dispositivo ativo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Add Games Toggle */}
          <button
            onClick={() => setShowAddPanel((current) => !current)}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              showAddPanel
                ? 'bg-violet-600 text-white'
                : 'border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white'
            }`}
          >
            {showAddPanel ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
            {showAddPanel ? 'Fechar' : 'Adicionar Jogos'}
          </button>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === 'grid'
                  ? 'bg-violet-600 text-white'
                  : 'text-muted-foreground hover:text-white'
              }`}
            >
              <LayoutGrid className="size-3.5" />
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === 'list'
                  ? 'bg-violet-600 text-white'
                  : 'text-muted-foreground hover:text-white'
              }`}
            >
              <List className="size-3.5" />
              Lista
            </button>
          </div>
        </div>
      </div>

      {/* Add Games Panel (Local Import) */}
      {showAddPanel ? (
        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
          <SourcesPage />
        </div>
      ) : null}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        {/* Type Tabs */}
        <div className="flex gap-2">
          {(['ALL', 'PS2', 'PS1', 'APP'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setSearchParams({ type: t === 'ALL' ? '' : t })}
              className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
                (t === 'ALL' && !searchParams.get('type')) || searchParams.get('type') === t
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                  : 'border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white'
              }`}
            >
              {t === 'ALL' ? 'Todos' : t}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome ou Game ID..."
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-4 text-xs text-white placeholder-muted-foreground focus:border-violet-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Content Rendering */}
      {!activeDevice ? (
        <div className="grid min-h-[300px] place-items-center rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-center text-muted-foreground">
          Conecte e selecione um dispositivo na tela Dispositivos para visualizar a biblioteca.
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="grid min-h-[300px] place-items-center rounded-3xl border border-dashed border-white/10 bg-white/5 p-8 text-center">
          <Gamepad2 className="size-10 text-muted-foreground mb-2" />
          <p className="text-sm font-semibold text-white">Nenhum jogo encontrado</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Adicione jogos ISO na pasta DVD/CD do seu dispositivo para começar.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredItems.map((item) => (
            <GameCard
              key={item.id}
              item={item}
              onSelect={(selected) => setSelectedGame(selected)}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-black/20">
                <th className="py-3 px-4">Jogo</th>
                <th className="py-3 px-4">Game ID</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Região</th>
                <th className="py-3 px-4">Tamanho</th>
                <th className="py-3 px-4 text-right">Status OPL</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <GameRow
                  key={item.id}
                  item={item}
                  onSelect={(selected) => setSelectedGame(selected)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Slide-over Game Detail Drawer */}
      <GameDetailDrawer
        item={selectedGame}
        isOpen={Boolean(selectedGame)}
        onClose={() => setSelectedGame(null)}
        onUpdated={() => void refetch()}
      />
    </div>
  )
}
