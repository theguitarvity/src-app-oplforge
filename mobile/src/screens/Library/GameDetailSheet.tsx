import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { colors, radius, spacing, typography } from '../../design-system/tokens'
import { GameArtThumbnail } from '../../components/GameArtThumbnail'
import type { CatalogEntry } from '../../types'

const CONTENT_TYPE_LABEL: Record<CatalogEntry['contentType'], string> = {
  dvd: 'DVD',
  cd: 'CD',
  ps1: 'PS1',
  app: 'App'
}

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  return `${(mb / 1024).toFixed(2)} GB`
}

interface GameDetailSheetProps {
  entry: CatalogEntry | undefined
  onClose: () => void
}

/**
 * T068 — Ficha de detalhes do jogo (metadados, status de validação,
 * problemas estruturais) aberta a partir de um card na LibraryScreen.
 */
export function GameDetailSheet({ entry, onClose }: GameDetailSheetProps) {
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
                <Text style={styles.label}>Tipo</Text>
                <Text style={styles.value}>{CONTENT_TYPE_LABEL[entry.contentType]}</Text>
              </View>
              {entry.gameId ? (
                <View style={styles.row}>
                  <Text style={styles.label}>ID do jogo</Text>
                  <Text style={styles.value}>{entry.gameId}</Text>
                </View>
              ) : null}
              <View style={styles.row}>
                <Text style={styles.label}>Extensão</Text>
                <Text style={styles.value}>{entry.extension}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Tamanho</Text>
                <Text style={styles.value}>{formatSize(entry.sizeBytes)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Capa</Text>
                <Text style={styles.value}>{entry.hasArt ? 'Disponível' : 'Não encontrada'}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Caminho</Text>
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
                    ? 'Nomenclatura em conformidade'
                    : 'Nomenclatura precisa de atenção'}
                </Text>
                {entry.structuralIssues.map((issue) => (
                  <Text key={issue} style={styles.statusIssue}>
                    • {issue}
                  </Text>
                ))}
              </View>

              <Pressable style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>Fechar</Text>
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
  closeButton: {
    marginTop: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    alignItems: 'center'
  },
  closeButtonText: { color: colors.foreground, fontSize: typography.body.fontSize }
})
