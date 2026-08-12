import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '@/stores/settings-store'
import { SUPPORTED_LANGUAGES, LANGUAGE_NAMES } from '@/i18n/languages'
import { Card } from '@/components/ui/card'

export function LanguageStep() {
  const { t } = useTranslation()
  const languageSource = useSettingsStore((state) => state.languageSource)
  const language = useSettingsStore((state) => state.language)
  const setLanguage = useSettingsStore((state) => state.setLanguage)

  if (languageSource === 'user') return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <Card className="w-full max-w-md">
        <h2 className="text-xl font-semibold text-white">{t('languageStep.title')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('languageStep.subtitle')}</p>
        <div className="mt-5 grid gap-2">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang, 'user')}
              className={`rounded-lg border px-4 py-2.5 text-left text-sm transition ${
                lang === language
                  ? 'border-violet-500 bg-white/10 text-white font-medium'
                  : 'border-white/10 text-muted-foreground hover:text-white hover:bg-white/5'
              }`}
            >
              {LANGUAGE_NAMES[lang]}
            </button>
          ))}
        </div>
        <button
          onClick={() => setLanguage(language, 'user')}
          className="mt-5 w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-500"
        >
          {t('languageStep.continue')}
        </button>
      </Card>
    </div>
  )
}
