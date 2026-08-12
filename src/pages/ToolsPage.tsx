import { useSearchParams } from 'react-router-dom'
import { ScanSearch, Trophy, Clock3 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DeviceDiagnosticsView } from '@/components/tools/DeviceDiagnosticsView'
import { OplComponentsList } from '@/components/tools/OplComponentsList'
import { HistoryPage } from '@/pages/HistoryPage'

export function ToolsPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'diagnostics'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">{t('pages.tools.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('pages.tools.subtitle')}</p>
      </div>

      {/* Sub-tabs */}
      <div className="flex border-b border-white/10 gap-2">
        <button
          onClick={() => setSearchParams({ tab: 'diagnostics' })}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
            activeTab === 'diagnostics'
              ? 'border-violet-500 text-white bg-white/5 font-semibold'
              : 'border-transparent text-muted-foreground hover:text-white'
          }`}
        >
          <ScanSearch className="size-4 text-violet-400" />
          {t('pages.tools.tabDiagnostics')}
        </button>
        <button
          onClick={() => setSearchParams({ tab: 'components' })}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
            activeTab === 'components'
              ? 'border-violet-500 text-white bg-white/5 font-semibold'
              : 'border-transparent text-muted-foreground hover:text-white'
          }`}
        >
          <Trophy className="size-4 text-violet-400" />
          {t('pages.tools.tabComponents')}
        </button>
        <button
          onClick={() => setSearchParams({ tab: 'history' })}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
            activeTab === 'history'
              ? 'border-violet-500 text-white bg-white/5 font-semibold'
              : 'border-transparent text-muted-foreground hover:text-white'
          }`}
        >
          <Clock3 className="size-4 text-violet-400" />
          {t('pages.tools.tabHistory')}
        </button>
      </div>

      {/* Tab Panels */}
      <div className="mt-4">
        {activeTab === 'diagnostics' && <DeviceDiagnosticsView />}
        {activeTab === 'components' && <OplComponentsList />}
        {activeTab === 'history' && <HistoryPage />}
      </div>
    </div>
  )
}
