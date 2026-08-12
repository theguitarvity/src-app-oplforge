import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ptBR from './locales/pt-BR.json'
import en from './locales/en.json'
import es from './locales/es.json'
import de from './locales/de.json'
import ru from './locales/ru.json'
import zh from './locales/zh.json'
import ja from './locales/ja.json'
import { DEFAULT_LANGUAGE, resolveSupportedLanguage, type SupportedLanguage } from './languages'

const resources = {
  'pt-BR': { translation: ptBR },
  en: { translation: en },
  es: { translation: es },
  de: { translation: de },
  ru: { translation: ru },
  zh: { translation: zh },
  ja: { translation: ja }
} as const

export function detectSystemLanguage(): SupportedLanguage {
  if (typeof navigator === 'undefined') return DEFAULT_LANGUAGE
  return resolveSupportedLanguage(navigator.language)
}

void i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
  returnEmptyString: false
})

export default i18n
