import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useLibraryStore } from '../../stores/library-store'
import { colors, spacing, typography } from '../../design-system/tokens'

/**
 * Shown while a device/library-source change was detected (FR-011, FR-012,
 * FR-017) and the new library is loading, so the user sees an explicit
 * "loading" state instead of a momentarily-empty library screen. Hidden
 * once loading resolves (ready or error) or when no change was detected
 * (FR-013).
 */
export function LibraryChangedOverlay() {
  const { t } = useTranslation()
  const status = useLibraryStore((state) => state.status)
  const sourceChanged = useLibraryStore((state) => state.sourceChanged)

  if (!(sourceChanged && status === 'loading')) return null

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <View style={styles.card}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.title}>{t('library.changedTitle')}</Text>
        <Text style={styles.message}>{t('library.changedMessage')}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 13, 19, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: 320
  },
  title: { color: colors.foreground, fontSize: typography.title.fontSize, fontWeight: '700' },
  message: { color: colors.mutedForeground, fontSize: typography.caption.fontSize, textAlign: 'center' }
})
