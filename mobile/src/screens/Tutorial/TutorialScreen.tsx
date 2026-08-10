import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { colors, radius, semanticColor, spacing, typography } from '../../design-system/tokens'
import { useSharingStore } from '../../stores/sharing-store'
import * as SharingModule from '../../native/SharingModule'
import type { ConnectionTutorialStep } from '../../types'

/**
 * US4 — Configurar o PS2 com um Tutorial Guiado (FR-023). Step-by-step,
 * small-screen-friendly, ordered to match OPL's own "Servidor SMB" menu.
 */
export function TutorialScreen() {
  const { session } = useSharingStore()
  const [steps, setSteps] = useState<ConnectionTutorialStep[]>([])
  const [loading, setLoading] = useState(true)

  const isConnected = session?.state === 'running-connected'
  const isSharing = session?.state === 'running-idle' || isConnected

  useEffect(() => {
    if (!isSharing) return
    let cancelled = false
    SharingModule.getConnectionInstructions()
      .then((result) => {
        if (!cancelled) setSteps(result)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isSharing])

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Configurar o PS2</Text>

      {!isSharing ? (
        <View style={styles.card}>
          <Text style={styles.body}>
            Inicie o compartilhamento primeiro para ver os dados de conexão.
          </Text>
        </View>
      ) : loading ? (
        <Text style={styles.body}>Carregando...</Text>
      ) : (
        <>
          <Text style={styles.subtitle}>
            No PS2, acesse: Configurações → Configurações de Rede → Servidor SMB, e digite:
          </Text>
          {steps.map((step) => (
            <View key={step.order} style={styles.stepCard}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>{step.order + 1}</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepField}>{step.field}</Text>
                <Text style={styles.stepValue}>{step.value || '(vazio)'}</Text>
              </View>
            </View>
          ))}

          <View style={[styles.card, isConnected && { borderColor: semanticColor('active') }]}>
            <Text style={[styles.label, isConnected && { color: semanticColor('active') }]}>
              {isConnected ? 'PS2 conectado' : 'Aguardando conexão do PS2'}
            </Text>
            {!isConnected ? (
              <Text style={styles.body}>
                Se o PS2 não conectar, confirme que ambos os dispositivos estão na mesma rede
                Wi-Fi.
              </Text>
            ) : null}
          </View>
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  title: {
    color: colors.foreground,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight
  },
  subtitle: { color: colors.mutedForeground, fontSize: typography.body.fontSize },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs
  },
  label: { color: colors.mutedForeground, fontSize: typography.caption.fontSize },
  body: { color: colors.foreground, fontSize: typography.body.fontSize },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: spacing.sm
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepBadgeText: { color: colors.primaryForeground, fontWeight: '700' },
  stepContent: { flex: 1 },
  stepField: { color: colors.mutedForeground, fontSize: typography.caption.fontSize },
  stepValue: { color: colors.foreground, fontSize: typography.subtitle.fontSize, fontWeight: '600' }
})
