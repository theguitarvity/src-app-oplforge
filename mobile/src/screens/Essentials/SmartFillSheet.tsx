import { useEffect, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { colors, radius, spacing, typography } from '../../design-system/tokens'
import { useEssentialsStore } from '../../stores/essentials-store'
import type { SmartFillMode } from '../../native/EssentialsModule'
import type { CatalogListing } from '../../types'
import { LegalConfirmationDialog } from './LegalConfirmationDialog'

type WizardStep = 'space' | 'mode' | 'review'

function formatGb(bytes: number): string {
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

const MODE_OPTIONS: { key: SmartFillMode; icon: keyof typeof MaterialIcons.glyphMap; titleKey: string; descriptionKey: string }[] = [
  {
    key: 'rating',
    icon: 'star',
    titleKey: 'smartFillSheet.modes.rating.title',
    descriptionKey: 'smartFillSheet.modes.rating.description'
  },
  {
    key: 'random',
    icon: 'shuffle',
    titleKey: 'smartFillSheet.modes.random.title',
    descriptionKey: 'smartFillSheet.modes.random.description'
  }
]

interface SmartFillSheetProps {
  onDownloadStarted: () => void
}

/**
 * US1 — Smart Fill wizard: reads the selected device's free space, lets the
 * user pick a max range within it, then choose a fill strategy (best-rated
 * first vs random) before reviewing and confirming — three steps instead of
 * one blind "type a GB number" field, mirroring desktop's equivalent wizard.
 * Selecting a plan still requires the same per-item legal confirmation as a
 * direct download (FR-003) — Smart Fill only selects, it never bypasses
 * consent.
 */
export function SmartFillSheet({ onDownloadStarted }: SmartFillSheetProps) {
  const { t } = useTranslation()
  const { smartFillPlan, availableBytes, status, loadAvailableSpace, buildSmartFillPlan, resetSmartFillPlan, confirmAndDownload } =
    useEssentialsStore()
  const [step, setStep] = useState<WizardStep>('space')
  const [budgetGb, setBudgetGb] = useState('')
  const [mode, setMode] = useState<SmartFillMode>('rating')
  const [confirmingAll, setConfirmingAll] = useState(false)

  useEffect(() => {
    void loadAvailableSpace().then((bytes) => {
      if (bytes !== undefined) setBudgetGb((bytes / (1024 * 1024 * 1024)).toFixed(1))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const availableGb = availableBytes !== undefined ? availableBytes / (1024 * 1024 * 1024) : undefined
  const budgetValue = Number(budgetGb)
  const budgetValid = Number.isFinite(budgetValue) && budgetValue > 0 && (availableGb === undefined || budgetValue <= availableGb + 0.05)

  const handleBuildPlan = () => {
    const bytes = budgetValue * 1024 * 1024 * 1024
    setStep('review')
    void buildSmartFillPlan(bytes, mode)
  }

  const handleConfirmAll = () => {
    if (!smartFillPlan) return
    setConfirmingAll(false)
    const selectedItems = smartFillPlan.selectedItems
    void confirmAndDownload(selectedItems).then((result) => {
      if (result?.duplicates.length) {
        const fileNames = result.duplicates.map((d) => d.fileName)
        Alert.alert(
          t('smartFillSheet.duplicatesTitle'),
          t('smartFillSheet.duplicatesMessage', { fileNames: fileNames.join(', ') }),
          [
            { text: t('smartFillSheet.cancel'), style: 'cancel' },
            {
              text: t('smartFillSheet.overwrite'),
              style: 'destructive',
              onPress: () =>
                void confirmAndDownload(selectedItems, fileNames).then(() => {
                  resetSmartFillPlan()
                  setStep('space')
                  onDownloadStarted()
                })
            }
          ]
        )
      } else {
        resetSmartFillPlan()
        setStep('space')
        onDownloadStarted()
      }
    })
  }

  const handleRestart = () => {
    resetSmartFillPlan()
    setStep('space')
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.stepper}>
        {(['space', 'mode', 'review'] as WizardStep[]).map((key, index) => (
          <View key={key} style={styles.stepDotRow}>
            <View style={[styles.stepDot, step === key ? styles.stepDotActive : null]}>
              <Text style={[styles.stepDotText, step === key ? styles.stepDotTextActive : null]}>{index + 1}</Text>
            </View>
            {index < 2 ? <View style={styles.stepLine} /> : null}
          </View>
        ))}
      </View>

      {step === 'space' ? (
        <View style={styles.card}>
          <Text style={styles.title}>{t('smartFillSheet.availableSpaceTitle')}</Text>
          <Text style={styles.subtitle}>
            {availableGb !== undefined
              ? t('smartFillSheet.availableSpaceHint', { gb: formatGb(availableBytes ?? 0) })
              : t('smartFillSheet.readingSpace')}
          </Text>
          <View style={styles.budgetRow}>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={budgetGb}
              onChangeText={setBudgetGb}
              placeholder="0"
              placeholderTextColor={colors.mutedForeground}
            />
            <Text style={styles.unit}>GB</Text>
          </View>
          {availableGb !== undefined && !budgetValid ? (
            <Text style={styles.warning}>{t('smartFillSheet.budgetWarning', { max: availableGb.toFixed(1) })}</Text>
          ) : null}
          <Pressable
            style={[styles.primaryButton, !budgetValid ? styles.disabled : null]}
            disabled={!budgetValid}
            onPress={() => setStep('mode')}
          >
            <Text style={styles.primaryButtonText}>{t('smartFillSheet.continue')}</Text>
            <MaterialIcons name="arrow-forward" size={18} color={colors.primaryForeground} />
          </Pressable>
        </View>
      ) : null}

      {step === 'mode' ? (
        <View style={styles.card}>
          <Text style={styles.title}>{t('smartFillSheet.howToFillTitle')}</Text>
          <Text style={styles.subtitle}>{t('smartFillSheet.howToFillSubtitle', { budget: budgetGb })}</Text>
          {MODE_OPTIONS.map((option) => (
            <Pressable
              key={option.key}
              style={[styles.modeCard, mode === option.key ? styles.modeCardActive : null]}
              onPress={() => setMode(option.key)}
            >
              <View style={[styles.modeIcon, mode === option.key ? styles.modeIconActive : null]}>
                <MaterialIcons name={option.icon} size={22} color={mode === option.key ? colors.primary : colors.mutedForeground} />
              </View>
              <View style={styles.modeTextWrap}>
                <Text style={styles.modeTitle}>{t(option.titleKey)}</Text>
                <Text style={styles.modeDescription}>{t(option.descriptionKey)}</Text>
              </View>
              {mode === option.key ? <MaterialIcons name="check-circle" size={20} color={colors.primary} /> : null}
            </Pressable>
          ))}
          <View style={styles.wizardActions}>
            <Pressable style={styles.secondaryButton} onPress={() => setStep('space')}>
              <MaterialIcons name="arrow-back" size={18} color={colors.foreground} />
              <Text style={styles.secondaryButtonText}>{t('smartFillSheet.back')}</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={handleBuildPlan}>
              <Text style={styles.primaryButtonText}>{t('smartFillSheet.calculatePlan')}</Text>
              <MaterialIcons name="arrow-forward" size={18} color={colors.primaryForeground} />
            </Pressable>
          </View>
        </View>
      ) : null}

      {step === 'review' ? (
        <View style={styles.card}>
          <Text style={styles.title}>{t('smartFillSheet.reviewPlanTitle')}</Text>
          {status === 'loading' && !smartFillPlan ? (
            <Text style={styles.subtitle}>{t('smartFillSheet.calculating')}</Text>
          ) : smartFillPlan ? (
            <>
              <Text style={styles.summaryLine}>
                {t('smartFillSheet.summaryLine', {
                  count: smartFillPlan.selectedItems.length,
                  selected: formatGb(smartFillPlan.estimatedTotalBytes),
                  available: formatGb(smartFillPlan.availableBytes)
                })}
              </Text>
              {smartFillPlan.warnings.map((warning: string) => (
                <Text key={warning} style={styles.warning}>
                  {warning}
                </Text>
              ))}
              <View style={styles.itemList}>
                {smartFillPlan.selectedItems.map((item: CatalogListing) => (
                  <Text key={item.id} style={styles.itemLine} numberOfLines={1}>
                    • {item.title}
                  </Text>
                ))}
              </View>
              <View style={styles.wizardActions}>
                <Pressable style={styles.secondaryButton} onPress={handleRestart}>
                  <MaterialIcons name="restart-alt" size={18} color={colors.foreground} />
                  <Text style={styles.secondaryButtonText}>{t('smartFillSheet.restart')}</Text>
                </Pressable>
                {smartFillPlan.selectedItems.length > 0 ? (
                  <Pressable style={styles.primaryButton} onPress={() => setConfirmingAll(true)}>
                    <MaterialIcons name="download" size={18} color={colors.primaryForeground} />
                    <Text style={styles.primaryButtonText}>{t('smartFillSheet.downloadSelected')}</Text>
                  </Pressable>
                ) : null}
              </View>
            </>
          ) : null}
        </View>
      ) : null}

      <LegalConfirmationDialog
        visible={confirmingAll}
        itemTitle={t('smartFillSheet.gamesSelected', { count: smartFillPlan?.selectedItems.length ?? 0 })}
        onCancel={() => setConfirmingAll(false)}
        onConfirm={handleConfirmAll}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  stepper: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', marginBottom: spacing.sm },
  stepDotRow: { flexDirection: 'row', alignItems: 'center' },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card
  },
  stepDotActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}22` },
  stepDotText: { color: colors.mutedForeground, fontSize: typography.caption.fontSize, fontWeight: '700' },
  stepDotTextActive: { color: colors.primary },
  stepLine: { width: 24, height: 1, backgroundColor: colors.border },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm
  },
  title: { color: colors.foreground, fontSize: typography.subtitle.fontSize, fontWeight: '700' },
  subtitle: { color: colors.mutedForeground, fontSize: typography.caption.fontSize, lineHeight: 18 },
  budgetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
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
  warning: { color: colors.amber, fontSize: typography.caption.fontSize },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm
  },
  modeCardActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}11` },
  modeIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modeIconActive: { backgroundColor: `${colors.primary}22` },
  modeTextWrap: { flex: 1, gap: 2 },
  modeTitle: { color: colors.foreground, fontSize: typography.body.fontSize, fontWeight: '600' },
  modeDescription: { color: colors.mutedForeground, fontSize: typography.caption.fontSize, lineHeight: 16 },
  summaryLine: { color: colors.foreground, fontSize: typography.body.fontSize },
  itemList: { gap: 2, marginTop: spacing.xs },
  itemLine: { color: colors.mutedForeground, fontSize: typography.caption.fontSize },
  wizardActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  disabled: { opacity: 0.5 },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryButtonText: {
    flexShrink: 1,
    color: colors.primaryForeground,
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    textAlign: 'center'
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryButtonText: {
    flexShrink: 1,
    color: colors.foreground,
    fontSize: typography.caption.fontSize,
    fontWeight: '600',
    textAlign: 'center'
  }
})
