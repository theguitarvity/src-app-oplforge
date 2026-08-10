import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { colors, radius, spacing, typography } from '../design-system/tokens'
import { useTransferStore } from '../stores/transfer-store'
import { navigationRef } from '../app/navigationRef'

/**
 * Global floating downloads indicator — the mobile equivalent of desktop's
 * sidebar download card (`Sidebar.tsx`): only visible while there's
 * something to show (active or failed transfers), badge count + average
 * progress bar, one tap jumps straight to the Transfers queue. Mounted once
 * in App.tsx above the navigator so it persists across every screen.
 */
export function DownloadsFab() {
  const items = useTransferStore((state) => state.items)
  const insets = useSafeAreaInsets()

  const activeDownloads = items.filter((item) => item.state === 'queued' || item.state === 'running')
  const failedDownloads = items.filter((item) => item.state === 'failed')
  const averageProgress = activeDownloads.length
    ? Math.round(
        activeDownloads.reduce((sum, item) => {
          const pct = item.expectedBytes ? (item.transferredBytes / item.expectedBytes) * 100 : 0
          return sum + pct
        }, 0) / activeDownloads.length
      )
    : 0

  if (activeDownloads.length === 0 && failedDownloads.length === 0) return null

  const handlePress = () => {
    if (navigationRef.isReady()) navigationRef.navigate('Transfers')
  }

  return (
    <Pressable
      style={[styles.container, { bottom: insets.bottom + 84 }]}
      onPress={handlePress}
    >
      <View style={styles.iconWrap}>
        <MaterialIcons name="downloading" size={20} color={colors.foreground} />
        {activeDownloads.length > 0 ? <View style={styles.pulseDot} /> : null}
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>Downloads</Text>
        <Text style={styles.subtitle}>
          {activeDownloads.length > 0
            ? `${activeDownloads.length} ativo(s) · ${averageProgress}%`
            : `${failedDownloads.length} requer atenção`}
        </Text>
      </View>
      {activeDownloads.length > 0 ? (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${averageProgress}%` }]} />
        </View>
      ) : null}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: spacing.md,
    left: spacing.md,
    backgroundColor: '#181424F2',
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
    elevation: 10
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: `${colors.primary}33`,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pulseDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: colors.fuchsia
  },
  textWrap: { flex: 1, minWidth: 0 },
  title: { color: colors.foreground, fontSize: typography.caption.fontSize, fontWeight: '700' },
  subtitle: { color: colors.mutedForeground, fontSize: 11 },
  progressTrack: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: 3,
    height: 3,
    borderRadius: 999,
    backgroundColor: '#00000055',
    overflow: 'hidden'
  },
  progressFill: { height: '100%', backgroundColor: colors.primary }
})
