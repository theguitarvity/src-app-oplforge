import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FlaskConical, Moon, Settings, DatabaseZap, Wifi } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { SourceSettingsPage } from '@/pages/SourceSettingsPage'
import { NetworkShareStatus } from '@/components/network/NetworkShareStatus'
import { UpdateDialog } from '@/components/updates/UpdateDialog'
import { useSettingsStore } from '@/stores/settings-store'
import { SUPPORTED_LANGUAGES, LANGUAGE_NAMES } from '@/i18n/languages'

function GeneralSettingsView() {
  const { t } = useTranslation()
  const language = useSettingsStore((state) => state.language)
  const setLanguage = useSettingsStore((state) => state.setLanguage)

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <div className="mb-5 flex items-center gap-3">
          <Settings className="size-6 text-violet-200" />
          <div>
            <h2 className="text-2xl font-semibold text-white">{t('settings.general.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('settings.general.subtitle')}</p>
          </div>
        </div>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>{t('settings.general.language')}</Label>
            <Select
              value={language}
              onChange={(e) => setLanguage(e.target.value as typeof language)}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {LANGUAGE_NAMES[lang]}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('settings.general.theme')}</Label>
            <Select defaultValue="dark">
              <option value="dark">{t('settings.general.themeDark')}</option>
              <option value="system">{t('settings.general.themeSystem')}</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('settings.general.defaultDirectory')}</Label>
            <Input placeholder={t('settings.general.defaultDirectoryPlaceholder') ?? ''} />
          </div>
          <div className="space-y-2">
            <Label>{t('settings.general.logLevel')}</Label>
            <Select defaultValue="info">
              <option value="info">INFO</option>
              <option value="warning">WARNING</option>
              <option value="error">ERROR</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('settings.general.updates')}</Label>
            <Select defaultValue="manual">
              <option value="manual">{t('settings.general.updatesManual')}</option>
              <option value="notify">{t('settings.general.updatesNotify')}</option>
            </Select>
            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-4">
              <UpdateDialog />
            </div>
          </div>
        </div>
      </Card>
      <Card className="border-violet-400/20 bg-violet-500/10">
        <Moon className="size-7 text-violet-200" />
        <h3 className="mt-4 text-lg font-semibold text-white">
          {t('settings.general.designTitle')}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t('settings.general.designDescription')}
        </p>
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <FlaskConical className="size-4 text-fuchsia-200" />{' '}
            {t('settings.general.experimentalTitle')}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('settings.general.experimentalDescription')}
          </p>
        </div>
      </Card>
    </div>
  )
}

export function SettingsPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'general'

  const tabs = [
    { id: 'general', label: t('settings.tabs.general'), icon: Settings },
    { id: 'sources', label: t('settings.tabs.sources'), icon: DatabaseZap },
    { id: 'network', label: t('settings.tabs.network'), icon: Wifi }
  ] as const

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex border-b border-white/10 gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSearchParams({ tab: tab.id })}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
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
        {activeTab === 'general' && <GeneralSettingsView />}
        {activeTab === 'sources' && <SourceSettingsPage />}
        {activeTab === 'network' && <NetworkShareStatus />}
      </div>
    </div>
  )
}
