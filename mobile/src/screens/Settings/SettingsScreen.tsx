import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { colors, radius, spacing, typography } from '../../design-system/tokens'
import { useSettingsStore } from '../../stores/settings-store'
import { SUPPORTED_LANGUAGES, LANGUAGE_NAMES } from '../../i18n/languages'

/**
 * Real Settings screen (FR-003/FR-009), replacing the placeholder that
 * previously pointed the "Settings" tab at LibrarySelectScreen
 * (RootNavigator.tsx). Hosts the language selector and the Android update
 * status/action. The update check itself runs once per launch as a
 * bootstrap step (settings-store.ts) — this screen only reads the result.
 */
export function SettingsScreen() {
  const { t } = useTranslation()
  const language = useSettingsStore((state) => state.language)
  const setLanguage = useSettingsStore((state) => state.setLanguage)
  const updateStatus = useSettingsStore((state) => state.updateStatus)
  const checking = updateStatus === null

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
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

      <Text style={[styles.sectionTitle, styles.sectionSpacing]}>{t('settings.updateSection')}</Text>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>{t('settings.currentVersion')}</Text>
        <Text style={styles.cardValue}>{updateStatus?.currentVersion ?? '—'}</Text>

        {checking ? (
          <Text style={styles.cardHint}>{t('common.continue')}…</Text>
        ) : updateStatus?.checkFailed ? (
          <Text style={styles.cardHint}>{t('settings.updateCheckFailed')}</Text>
        ) : updateStatus?.updateAvailable ? (
          <>
            <Text style={styles.cardHint}>
              {t('settings.updateAvailable')} — {updateStatus.latestVersion}
            </Text>
            <Pressable
              style={styles.updateButton}
              onPress={() => updateStatus.releaseUrl && Linking.openURL(updateStatus.releaseUrl)}
            >
              <Text style={styles.updateButtonText}>{t('settings.updateAction')}</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.cardHint}>{t('settings.updateUpToDate')}</Text>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  sectionTitle: { color: colors.foreground, fontSize: typography.subtitle.fontSize, fontWeight: '600' },
  sectionSpacing: { marginTop: spacing.xl },
  list: { marginTop: spacing.md, gap: spacing.sm },
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
  card: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.card,
    gap: spacing.xs
  },
  cardLabel: { color: colors.mutedForeground, fontSize: typography.caption.fontSize },
  cardValue: { color: colors.foreground, fontSize: typography.body.fontSize, fontWeight: '600' },
  cardHint: { color: colors.mutedForeground, fontSize: typography.caption.fontSize, marginTop: spacing.xs },
  updateButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center'
  },
  updateButtonText: { color: colors.primaryForeground, fontWeight: '600' }
})
