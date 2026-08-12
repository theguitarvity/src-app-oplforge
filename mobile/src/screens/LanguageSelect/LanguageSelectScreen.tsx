import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radius, spacing, typography } from '../../design-system/tokens'
import { useSettingsStore } from '../../stores/settings-store'
import { SUPPORTED_LANGUAGES, LANGUAGE_NAMES } from '../../i18n/languages'
import { navigationRef } from '../../app/navigationRef'

/**
 * First-launch language picker (FR-002). Pre-selects the OS-detected
 * supported language (falls back to pt-BR); confirming persists the choice
 * as an explicit user selection (FR-015) and returns to the main tabs.
 */
export function LanguageSelectScreen() {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const language = useSettingsStore((state) => state.language)
  const setLanguage = useSettingsStore((state) => state.setLanguage)

  const confirm = () => {
    setLanguage(language, 'user')
    if (navigationRef.isReady()) navigationRef.navigate('Tabs' as never)
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl }]}>
      <Text style={styles.title}>{t('languageStep.title')}</Text>
      <Text style={styles.subtitle}>{t('languageStep.subtitle')}</Text>

      <View style={styles.list}>
        {SUPPORTED_LANGUAGES.map((lang) => (
          <Pressable
            key={lang}
            style={[styles.option, lang === language ? styles.optionActive : null]}
            onPress={() => setLanguage(lang, 'user')}
          >
            <Text style={[styles.optionText, lang === language ? styles.optionTextActive : null]}>
              {LANGUAGE_NAMES[lang]}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.continueButton} onPress={confirm}>
        <Text style={styles.continueText}>{t('languageStep.continue')}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  title: { color: colors.foreground, fontSize: typography.title.fontSize, fontWeight: '700' },
  subtitle: { color: colors.mutedForeground, fontSize: typography.body.fontSize, marginTop: spacing.sm },
  list: { marginTop: spacing.lg, gap: spacing.sm },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.card
  },
  optionActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}22` },
  optionText: { color: colors.mutedForeground, fontSize: typography.body.fontSize },
  optionTextActive: { color: colors.foreground, fontWeight: '600' },
  continueButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center'
  },
  continueText: { color: colors.primaryForeground, fontSize: typography.body.fontSize, fontWeight: '600' }
})
