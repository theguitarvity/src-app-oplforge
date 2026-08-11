import { useEffect } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radius, semanticColor, spacing, typography } from '../../design-system/tokens'
import { useDiagnosticsStore } from '../../stores/diagnostics-store'
import type { ReadinessStatus } from '../../types'

const READINESS_LABEL: Record<ReadinessStatus, string> = {
  ready: 'Pronta',
  'ready-with-warnings': 'Pronta, com avisos',
  'requires-reorganization': 'Requer reorganização',
  incompatible: 'Não pronta'
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

function formatBytes(bytes?: number): string {
  if (bytes === undefined) return 'Desconhecido'
  const gb = bytes / (1024 * 1024 * 1024)
  return `${gb.toFixed(1)} GB livres`
}

/**
 * US3 — Diagnóstico do Dispositivo (spec 008 FR-010). Reuses spec 006's
 * catalog scan, checks the 7 mandatory OPL folders, and classifies overall
 * readiness with the same four-state model as desktop (research.md R8).
 */
export function DiagnosticsScreen() {
  const { report, status, errorMessage, loadLatest, runDiagnostics, prepareDevice } = useDiagnosticsStore()

  useEffect(() => {
    void loadLatest()
  }, [loadLatest])

  return (
    <View style={styles.container}>
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      {report ? (
        <View style={styles.card}>
          <View style={[styles.badge, { borderColor: readinessColor(report.readiness) }]}>
            <Text style={[styles.badgeText, { color: readinessColor(report.readiness) }]}>
              {READINESS_LABEL[report.readiness]}
            </Text>
          </View>

          <Text style={styles.label}>Espaço livre</Text>
          <Text style={styles.body}>{formatBytes(report.freeBytes)}</Text>

          <Text style={styles.label}>Pastas obrigatórias</Text>
          {report.missingFolders.length === 0 ? (
            <Text style={[styles.body, { color: semanticColor('success') }]}>Todas as pastas presentes</Text>
          ) : (
            <>
              <Text style={[styles.body, { color: semanticColor('warning') }]}>
                Faltando: {report.missingFolders.join(', ')}
              </Text>
              <Pressable style={styles.prepareButton} onPress={() => void prepareDevice()} disabled={status === 'loading'}>
                {status === 'loading' ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.prepareButtonText}>Preparar dispositivo</Text>
                )}
              </Pressable>
            </>
          )}

          <Text style={styles.timestamp}>Última verificação: {new Date(report.checkedAt).toLocaleString()}</Text>
        </View>
      ) : status !== 'loading' ? (
        <Text style={styles.body}>Nenhum diagnóstico executado ainda.</Text>
      ) : null}

      <Pressable style={styles.primaryButton} onPress={() => void runDiagnostics()} disabled={status === 'loading'}>
        {status === 'loading' ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={styles.primaryButtonText}>Executar diagnóstico</Text>
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
