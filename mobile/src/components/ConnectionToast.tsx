import { useEffect } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { colors, radius, semanticColor, spacing, typography } from '../design-system/tokens'
import { useConnectionFeedbackStore } from '../stores/connection-feedback-store'

/** PS2 connect/disconnect toast — mirrors desktop's `DownloadToast.tsx` (top-of-screen, auto-dismiss). */
export function ConnectionToast() {
  const toast = useConnectionFeedbackStore((state) => state.toast)
  const dismiss = useConnectionFeedbackStore((state) => state.dismiss)
  const insets = useSafeAreaInsets()

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(dismiss, 4200)
    return () => clearTimeout(timer)
  }, [toast, dismiss])

  if (!toast) return null

  return (
    <Pressable
      style={[styles.container, { top: insets.top + spacing.sm }]}
      onPress={dismiss}
    >
      <MaterialIcons
        name={toast.kind === 'connected' ? 'sports-esports' : 'link-off'}
        size={20}
        color={toast.kind === 'connected' ? semanticColor('success') : colors.mutedForeground}
      />
      <Text style={styles.text}>{toast.message}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: spacing.md,
    left: spacing.md,
    backgroundColor: '#181424F5',
    borderWidth: 1,
    borderColor: `${colors.primary}55`,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
    zIndex: 50
  },
  text: { color: colors.foreground, fontSize: typography.caption.fontSize, fontWeight: '600', flex: 1 }
})
