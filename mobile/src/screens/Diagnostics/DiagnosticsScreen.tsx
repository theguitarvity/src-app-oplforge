import { useEffect } from 'react'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { colors, radius, semanticColor, spacing, typography } from '../../design-system/tokens'
import { useDiagnosticsStore } from '../../stores/diagnostics-store'
import type { ReadinessStatus } from '../../types'

function readinessLabel(t: (key: string) => string, status: ReadinessStatus): string {
  switch (status) {
    case 'ready':
      return t('diagnostics.readiness.ready')
    case 'ready-with-warnings':
      return t('diagnostics.readiness.readyWithWarnings')
    case 'requires-reorganization':
      return t('diagnostics.readiness.requiresReorganization')
    case 'incompatible':
      return t('diagnostics.readiness.incompatible')
    default:
      return status
  }
}

function readinessColor(status: ReadinessStatus): string {
  switch (status) {
    case 'ready':
      return semanticColor('success')
    case 'ready-with-warnings':
      return semanticColor('warning')
    default:
      return semanticColor('error')
  }
}

function formatBytes(t: (key: string, options?: Record<string, unknown>) => string, bytes?: number): string {
  if (bytes === undefined) return t('diagnostics.unknownSize')
  const gb = bytes / (1024 * 1024 * 1024)
  return t('diagnostics.freeSpace', { gb: gb.toFixed(1) })
}

/**
 * US3 — Diagnóstico do Dispositivo (spec 008 FR-010). Reuses spec 006's
 * catalog scan, checks the 10 mandatory OPL folders, and classifies overall
 * readiness with the same four-state model as desktop (research.md R8).
 */
export function DiagnosticsScreen() {
  const { t } = useTranslation()
  const { report, status, errorMessage, loadLatest, runDiagnostics, prepareDevice } = useDiagnosticsStore()

  useEffect(() => {
    void loadLatest()
  }, [loadLatest])

  function handlePreparePress() {
    Alert.alert(
      t('diagnostics.prepareConfirm.title'),
      t('diagnostics.prepareConfirm.message'),
      [
        { text: t('diagnostics.prepareConfirm.cancel'), style: 'cancel' },
        { text: t('diagnostics.prepareConfirm.confirm'), onPress: () => void prepareDevice() }
      ]
    )
  }

  return (
    <View style={styles.container}>
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      {report ? (
        <View style={styles.card}>
          <View style={[styles.badge, { borderColor: readinessColor(report.readiness) }]}>
            <Text style={[styles.badgeText, { color: readinessColor(report.readiness) }]}>
              {readinessLabel(t, report.readiness)}
            </Text>
          </View>

          <Text style={styles.label}>{t('diagnostics.freeSpaceLabel')}</Text>
          <Text style={styles.body}>{formatBytes(t, report.freeBytes)}</Text>

          <Text style={styles.label}>{t('diagnostics.requiredFolders')}</Text>
          {report.missingFolders.length === 0 ? (
            <Text style={[styles.body, { color: semanticColor('success') }]}>{t('diagnostics.allFoldersPresent')}</Text>
          ) : (
            <>
              <Text style={[styles.body, { color: semanticColor('warning') }]}>
                {t('diagnostics.missingFolders', { folders: report.missingFolders.join(', ') })}
              </Text>
              <Pressable style={styles.prepareButton} onPress={handlePreparePress} disabled={status === 'loading'}>
                {status === 'loading' ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.prepareButtonText}>{t('diagnostics.prepareDeviceButton')}</Text>
                )}
              </Pressable>
            </>
          )}

          <Text style={styles.timestamp}>
            {t('diagnostics.lastCheck', { date: new Date(report.checkedAt).toLocaleString() })}
          </Text>
        </View>
      ) : status !== 'loading' ? (
        <Text style={styles.body}>{t('diagnostics.noDiagnosticsYet')}</Text>
      ) : null}

      <Pressable style={styles.primaryButton} onPress={() => void runDiagnostics()} disabled={status === 'loading'}>
        {status === 'loading' ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={styles.primaryButtonText}>{t('diagnostics.runDiagnosticsButton')}</Text>
        )}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md },
  error: { color: colors.red },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm
  },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  badgeText: { fontWeight: '700', fontSize: typography.body.fontSize },
  label: { color: colors.mutedForeground, fontSize: typography.caption.fontSize, marginTop: spacing.xs },
  body: { color: colors.foreground, fontSize: typography.body.fontSize },
  timestamp: { color: colors.mutedForeground, fontSize: typography.caption.fontSize, marginTop: spacing.sm },
  prepareButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs
  },
  prepareButtonText: { color: colors.primaryForeground, fontSize: typography.caption.fontSize, fontWeight: '600' },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center'
  },
  primaryButtonText: { color: colors.primaryForeground, fontSize: typography.body.fontSize, fontWeight: '600' }
})
