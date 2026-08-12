import { useState } from 'react'
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { colors, radius, spacing, typography } from '../../design-system/tokens'
import { GameArtThumbnail } from '../../components/GameArtThumbnail'
import * as CatalogModule from '../../native/CatalogModule'
import { useSharingStore } from '../../stores/sharing-store'
import type { CatalogEntry } from '../../types'

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
}

interface GameDetailSheetProps {
  entry: CatalogEntry | undefined
  onClose: () => void
  onDeleted?: (entryId: string) => void
}

/**
 * T068 — Ficha de detalhes do jogo (metadados, status de validação,
 * problemas estruturais) aberta a partir de um card na LibraryScreen.
 */
export function GameDetailSheet({ entry, onClose, onDeleted }: GameDetailSheetProps) {
  const { t } = useTranslation()
  const sharingState = useSharingStore((state) => state.session?.state)
  const sharingActive = sharingState === 'running-connected' || sharingState === 'running-idle'
  const [deleting, setDeleting] = useState(false)

  const handleDelete = () => {
    if (!entry) return
    Alert.alert(
      t('gameDetailSheet.deleteConfirm.title'),
      sharingActive
        ? t('gameDetailSheet.deleteConfirm.messageSharing', { title: entry.title })
        : t('gameDetailSheet.deleteConfirm.message', { title: entry.title }),
      [
        { text: t('gameDetailSheet.deleteConfirm.cancel'), style: 'cancel' },
        {
          text: t('gameDetailSheet.deleteConfirm.confirm'),
          style: 'destructive',
          onPress: () => {
            setDeleting(true)
            CatalogModule.deleteEntry(entry.id)
              .then((result) => {
                if (result.failed.length === 0) {
                  onDeleted?.(entry.id)
                  onClose()
                } else {
                  Alert.alert(t('gameDetailSheet.deleteFailedTitle'), result.failed.map((f) => f.path).join(', '))
                }
              })
              .catch((error) =>
                Alert.alert(t('gameDetailSheet.deleteErrorTitle'), error instanceof Error ? error.message : String(error))
              )
              .finally(() => setDeleting(false))
          }
        }
      ]
    )
  }

  return (
    <Modal visible={entry !== undefined} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {entry ? (
            <ScrollView contentContainerStyle={styles.content}>
              <View style={styles.artRow}>
                <GameArtThumbnail gameId={entry.gameId} hasArt={entry.hasArt} title={entry.title} size={80} />
                <Text style={styles.title}>{entry.title}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>{t('gameDetailSheet.type')}</Text>
                <Text style={styles.value}>{t(`gameDetailSheet.contentType.${entry.contentType}`)}</Text>
              </View>
              {entry.gameId ? (
                <View style={styles.row}>
                  <Text style={styles.label}>{t('gameDetailSheet.gameId')}</Text>
                  <Text style={styles.value}>{entry.gameId}</Text>
                </View>
              ) : null}
              <View style={styles.row}>
                <Text style={styles.label}>{t('gameDetailSheet.extension')}</Text>
                <Text style={styles.value}>{entry.extension}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>{t('gameDetailSheet.size')}</Text>
                <Text style={styles.value}>{formatSize(entry.sizeBytes)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>{t('gameDetailSheet.art')}</Text>
                <Text style={styles.value}>
                  {entry.hasArt ? t('gameDetailSheet.artAvailable') : t('gameDetailSheet.artNotFound')}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>{t('gameDetailSheet.path')}</Text>
                <Text style={styles.value}>{entry.logicalPath}</Text>
              </View>

              <View
                style={[
                  styles.statusCard,
                  entry.namingConformance === 'conforms' ? styles.statusOk : styles.statusWarning
                ]}
              >
                <Text style={styles.statusTitle}>
                  {entry.namingConformance === 'conforms'
                    ? t('gameDetailSheet.namingConforms')
                    : t('gameDetailSheet.namingNeedsAttention')}
                </Text>
                {entry.structuralIssues.map((issue) => (
                  <Text key={issue} style={styles.statusIssue}>
                    • {issue}
                  </Text>
                ))}
              </View>

              <Pressable style={styles.deleteButton} onPress={handleDelete} disabled={deleting}>
                <Text style={styles.deleteButtonText}>
                  {deleting ? t('gameDetailSheet.deleting') : t('gameDetailSheet.deleteTitle')}
                </Text>
              </Pressable>

              <Pressable style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>{t('gameDetailSheet.close')}</Text>
              </Pressable>
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '80%'
  },
  content: { padding: spacing.lg, gap: spacing.sm },
  artRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  title: { color: colors.foreground, fontSize: typography.title.fontSize, fontWeight: '600', flexShrink: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  label: { color: colors.mutedForeground, fontSize: typography.body.fontSize },
  value: { color: colors.foreground, fontSize: typography.body.fontSize, flexShrink: 1, textAlign: 'right' },
  statusCard: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginTop: spacing.md, gap: spacing.xs },
  statusOk: { borderColor: colors.emerald },
  statusWarning: { borderColor: colors.amber },
  statusTitle: { color: colors.foreground, fontSize: typography.body.fontSize, fontWeight: '600' },
  statusIssue: { color: colors.mutedForeground, fontSize: typography.caption.fontSize },
  deleteButton: {
    marginTop: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.destructive,
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    paddingVertical: spacing.sm,
    alignItems: 'center'
  },
  deleteButtonText: { color: colors.destructive, fontSize: typography.body.fontSize, fontWeight: '600' },
  closeButton: {
    marginTop: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    alignItems: 'center'
  },
  closeButtonText: { color: colors.foreground, fontSize: typography.body.fontSize }
})
