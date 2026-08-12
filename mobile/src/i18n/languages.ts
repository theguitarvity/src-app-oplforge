export const SUPPORTED_LANGUAGES = ['pt-BR', 'en', 'es', 'de', 'ru', 'zh', 'ja'] as const

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const DEFAULT_LANGUAGE: SupportedLanguage = 'pt-BR'

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  'pt-BR': 'Português (Brasil)',
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
  ru: 'Русский',
  zh: '中文',
  ja: '日本語'
}

export function isSupportedLanguage(value: string): value is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
}

export function resolveSupportedLanguage(locale: string | null | undefined): SupportedLanguage {
  if (!locale) return DEFAULT_LANGUAGE
  const normalized = locale.trim()
  if (isSupportedLanguage(normalized)) return normalized
  const base = normalized.split(/[-_]/)[0]?.toLowerCase()
  const match = SUPPORTED_LANGUAGES.find((lang) => lang.toLowerCase().startsWith(base ?? ''))
  return match ?? DEFAULT_LANGUAGE
}
