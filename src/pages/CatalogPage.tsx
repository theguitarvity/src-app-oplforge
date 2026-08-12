import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Sparkles, Images, Download, CheckCircle2, Compass, Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EssentialsCatalogPage } from '@/pages/EssentialsCatalogPage'
import { ArtManagerPage } from '@/pages/ArtManagerPage'
import { DownloadsPage } from '@/pages/DownloadsPage'
import { OnlineSourcesPage } from '@/pages/OnlineSourcesPage'
import { useDownloadFeedbackStore } from '@/stores/download-feedback-store'

interface CatalogGameEntry {
  id: string
  title: string
  gameId: string
  region: string
  coverUrl?: string
}

const mockCatalog: CatalogGameEntry[] = [
  { id: '1', title: 'Shadow of the Colossus', gameId: 'SLUS_212.59', region: 'NTSC-U' },
  { id: '2', title: 'God of War II', gameId: 'SCUS_974.81', region: 'NTSC-U' },
  { id: '3', title: 'Grand Theft Auto: San Andreas', gameId: 'SLUS_209.46', region: 'NTSC-U' },
  { id: '4', title: 'Resident Evil 4', gameId: 'SLUS_211.34', region: 'NTSC-U' },
  { id: '5', title: 'Metal Gear Solid 3: Snake Eater', gameId: 'SLUS_209.15', region: 'NTSC-U' }
]

function CatalogMetadataView() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [appliedId, setAppliedId] = useState<string | null>(null)

  const results = mockCatalog.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.gameId.toLowerCase().includes(query.toLowerCase())
  )

  const handleApplyArt = (id: string) => {
    setAppliedId(id)
    setTimeout(() => setAppliedId(null), 2500)
  }

  return (
    <div className="space-y-6">
      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-3 size-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('pages.catalog.searchPlaceholder') ?? ''}
          className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-xs text-white placeholder-muted-foreground focus:border-violet-500 focus:outline-none"
        />
      </div>

      {/* Catalog Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {results.map((game) => (
          <div
            key={game.id}
            className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md transition hover:border-violet-500/30"
          >
            <div className="flex items-center gap-3">
              <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-violet-600/20 text-violet-300 border border-violet-500/30">
                <Sparkles className="size-6" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white line-clamp-1">{game.title}</h4>
                <p className="font-mono text-xs text-violet-300">{game.gameId}</p>
                <span className="text-[10px] text-muted-foreground">{game.region}</span>
              </div>
            </div>

            <button
              onClick={() => handleApplyArt(game.id)}
              className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white transition hover:bg-white/10"
            >
              {appliedId === game.id ? (
                <>
                  <CheckCircle2 className="size-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-semibold">
                    {t('pages.catalog.applied')}
                  </span>
                </>
              ) : (
                <>
                  <Download className="size-3.5 text-violet-400" />
                  <span>{t('pages.catalog.downloadCover')}</span>
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CatalogPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'discover'
  const downloadAttention = useDownloadFeedbackStore((state) => state.attention)
  const clearDownloadAttention = useDownloadFeedbackStore((state) => state.clearAttention)

  const tabs = [
    { id: 'discover', label: t('pages.catalog.tabDiscover'), icon: Compass },
    { id: 'metadata', label: t('pages.catalog.tabMetadata'), icon: Search },
    { id: 'online', label: t('pages.catalog.tabOnline'), icon: Globe },
    { id: 'artsync', label: t('pages.catalog.tabArtsync'), icon: Images },
    { id: 'downloads', label: t('pages.catalog.tabDownloads'), icon: Download }
  ] as const

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">{t('pages.catalog.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('pages.catalog.subtitle')}</p>
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b border-white/10 gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setSearchParams({ tab: tab.id })
              if (tab.id === 'downloads') clearDownloadAttention()
            }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${tab.id === 'downloads' && downloadAttention ? 'animate-[download-led_1.1s_ease-in-out_infinite] rounded-t-xl border-violet-400 bg-violet-500/15 text-white' : ''} ${
              activeTab === tab.id
                ? 'border-violet-500 text-white bg-white/5 font-semibold'
                : 'border-transparent text-muted-foreground hover:text-white'
            }`}
          >
            <tab.icon className="size-4 text-violet-400" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="mt-4">
        {activeTab === 'discover' && <EssentialsCatalogPage />}
        {activeTab === 'metadata' && <CatalogMetadataView />}
        {activeTab === 'online' && <OnlineSourcesPage />}
        {activeTab === 'artsync' && <ArtManagerPage />}
        {activeTab === 'downloads' && <DownloadsPage />}
      </div>
    </div>
  )
}
