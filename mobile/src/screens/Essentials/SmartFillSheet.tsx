import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { colors, radius, spacing, typography } from '../../design-system/tokens'
import { useEssentialsStore } from '../../stores/essentials-store'
import type { CatalogListing } from '../../types'
import { LegalConfirmationDialog } from './LegalConfirmationDialog'

function formatGb(bytes: number): string {
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

/**
 * US1 — Smart Fill: automatic byte-budget selection of S/A-tier catalog
 * items. Selecting a plan still requires the same per-item legal
 * confirmation as a direct download (FR-003) — Smart Fill only selects, it
 * never bypasses consent.
 */
export function SmartFillSheet() {
  const { smartFillPlan, status, buildSmartFillPlan, confirmAndDownload } = useEssentialsStore()
  const [budgetGb, setBudgetGb] = useState('20')
  const [confirmingAll, setConfirmingAll] = useState(false)

  const handlePlan = () => {
    const bytes = Number(budgetGb) * 1024 * 1024 * 1024
    if (!Number.isFinite(bytes) || bytes <= 0) return
    void buildSmartFillPlan(bytes)
  }

  const handleConfirmAll = () => {
    if (!smartFillPlan) return
    setConfirmingAll(false)
    void confirmAndDownload(smartFillPlan.selectedItems)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Preencher automaticamente</Text>
      <Text style={styles.subtitle}>
        Escolha um orçamento de espaço e o Smart Fill seleciona os melhores jogos (tiers S/A) que couberem.
      </Text>
      <View style={styles.budgetRow}>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={budgetGb}
          onChangeText={setBudgetGb}
        />
        <Text style={styles.unit}>GB</Text>
      </View>
      <Pressable style={styles.planButton} onPress={handlePlan}>
        <Text style={styles.planButtonText}>{status === 'loading' ? 'Calculando...' : 'Calcular plano'}</Text>
      </Pressable>

      {smartFillPlan ? (
        <View style={styles.summary}>
          <Text style={styles.summaryLine}>
            {smartFillPlan.selectedItems.length} jogo(s) selecionado(s) · {formatGb(smartFillPlan.estimatedTotalBytes)} de{' '}
            {formatGb(smartFillPlan.availableBytes)} disponíveis
          </Text>
          {smartFillPlan.warnings.map((warning: string) => (
            <Text key={warning} style={styles.warning}>
              {warning}
            </Text>
          ))}
          {smartFillPlan.selectedItems.map((item: CatalogListing) => (
            <Text key={item.id} style={styles.itemLine} numberOfLines={1}>
              • {item.title}
            </Text>
          ))}
          {smartFillPlan.selectedItems.length > 0 ? (
            <Pressable style={styles.confirmButton} onPress={() => setConfirmingAll(true)}>
              <Text style={styles.confirmButtonText}>Baixar todos os selecionados</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <LegalConfirmationDialog
        visible={confirmingAll}
        itemTitle={`${smartFillPlan?.selectedItems.length ?? 0} jogo(s) selecionados`}
        onCancel={() => setConfirmingAll(false)}
        onConfirm={handleConfirmAll}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md },
  title: { color: colors.foreground, fontSize: typography.subtitle.fontSize, fontWeight: '700' },
  subtitle: { color: colors.mutedForeground, fontSize: typography.caption.fontSize, lineHeight: 18, marginTop: -spacing.sm },
  budgetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.foreground
  },
  unit: { color: colors.mutedForeground },
  planButton: { borderRadius: radius.md, backgroundColor: colors.primary, paddingVertical: spacing.sm, alignItems: 'center' },
  planButtonText: { color: colors.primaryForeground, fontWeight: '600' },
  summary: { gap: spacing.xs, marginTop: spacing.md },
  summaryLine: { color: colors.foreground, fontSize: typography.body.fontSize },
  warning: { color: colors.amber, fontSize: typography.caption.fontSize },
  itemLine: { color: colors.mutedForeground, fontSize: typography.caption.fontSize },
  confirmButton: { marginTop: spacing.md, borderRadius: radius.md, backgroundColor: colors.primary, paddingVertical: spacing.sm, alignItems: 'center' },
  confirmButtonText: { color: colors.primaryForeground, fontWeight: '600' }
})
