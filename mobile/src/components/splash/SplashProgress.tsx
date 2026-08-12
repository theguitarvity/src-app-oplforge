import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { colors, spacing, typography } from '../../design-system/tokens'

/**
 * Visual loading indicator for the splash screen (FR-014/SC-005) — replaces
 * the previous silent fixed-duration wait with real feedback for the
 * duration of `runBootstrap()`.
 */
export function SplashProgress() {
  const { t } = useTranslation()
  return (
    <View style={styles.container}>
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={styles.label}>{t('splash.loading')}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
  label: { color: colors.mutedForeground, fontSize: typography.caption.fontSize }
})
