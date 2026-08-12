import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { colors, radius, spacing, typography } from '../../design-system/tokens'
import { LEGAL_CONFIRMATION_TEXT } from '../../native/EssentialsModule'

interface LegalConfirmationDialogProps {
  visible: boolean
  itemTitle: string
  onCancel: () => void
  onConfirm: () => void
}

/** Per-item legal confirmation gate (FR-002) — the exact text a user must acknowledge before any download starts. */
export function LegalConfirmationDialog({ visible, itemTitle, onCancel, onConfirm }: LegalConfirmationDialogProps) {
  const { t } = useTranslation()
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{itemTitle}</Text>
          <Text style={styles.legalText}>{LEGAL_CONFIRMATION_TEXT}</Text>
          <View style={styles.actions}>
            <Pressable style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>{t('legalConfirmationDialog.cancel')}</Text>
            </Pressable>
            <Pressable style={styles.confirmButton} onPress={onConfirm}>
              <MaterialIcons name="check-circle" size={16} color={colors.primaryForeground} />
              <Text style={styles.confirmButtonText} numberOfLines={2}>
                {t('legalConfirmationDialog.confirm')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing.lg },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  title: { color: colors.foreground, fontSize: typography.subtitle.fontSize, fontWeight: '600' },
  legalText: { color: colors.mutedForeground, fontSize: typography.body.fontSize, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  cancelButton: { flex: 1, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  cancelButtonText: { color: colors.foreground, fontSize: typography.body.fontSize, textAlign: 'center' },
  confirmButton: {
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
  confirmButtonText: { flexShrink: 1, color: colors.primaryForeground, fontSize: typography.caption.fontSize, fontWeight: '600', textAlign: 'center' }
})
