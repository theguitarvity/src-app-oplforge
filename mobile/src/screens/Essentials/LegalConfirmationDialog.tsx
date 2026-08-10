import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
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
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{itemTitle}</Text>
          <Text style={styles.legalText}>{LEGAL_CONFIRMATION_TEXT}</Text>
          <View style={styles.actions}>
            <Pressable style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </Pressable>
            <Pressable style={styles.confirmButton} onPress={onConfirm}>
              <Text style={styles.confirmButtonText}>Confirmo e quero baixar</Text>
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
  cancelButton: { flex: 1, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: spacing.sm, alignItems: 'center' },
  cancelButtonText: { color: colors.foreground, fontSize: typography.body.fontSize },
  confirmButton: { flex: 1, borderRadius: radius.md, backgroundColor: colors.primary, paddingVertical: spacing.sm, alignItems: 'center' },
  confirmButtonText: { color: colors.primaryForeground, fontSize: typography.body.fontSize, fontWeight: '600' }
})
