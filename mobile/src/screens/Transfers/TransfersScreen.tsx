import { useEffect } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { colors, radius, semanticColor, spacing, typography } from '../../design-system/tokens'
import { useTransferStore } from '../../stores/transfer-store'
import type { TransferItem, TransferState } from '../../types'

function stateColor(state: TransferState): string {
  switch (state) {
    case 'completed':
      return semanticColor('success')
    case 'failed':
      return semanticColor('error')
    case 'running':
      return semanticColor('active')
    default:
      return semanticColor('neutral')
  }
}

function formatProgress(item: TransferItem): string {
  const done = (item.transferredBytes / (1024 * 1024)).toFixed(0)
  if (!item.expectedBytes) return `${done} MB`
  const total = (item.expectedBytes / (1024 * 1024)).toFixed(0)
  const pct = Math.min(100, Math.round((item.transferredBytes / item.expectedBytes) * 100))
  return `${done} / ${total} MB (${pct}%)`
}

/**
 * US4 — Fila de Transferências. Lists every queued/running/finished item
 * (Essentials downloads and local imports share one queue), with per-item
 * retry/cancel (spec 008 FR-011).
 */
export function TransfersScreen() {
  const { t } = useTranslation()
  const { items, loadQueue, cancel, retry } = useTransferStore()

  useEffect(() => {
    void loadQueue()
  }, [loadQueue])

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>{t('transfers.emptyQueue')}</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={styles.cardMetaRow}>
              <Text style={styles.cardMeta}>{formatProgress(item)}</Text>
              <Text style={[styles.stateBadge, { color: stateColor(item.state) }]}>
                {t(`transfers.stateLabel.${item.state}`)}
              </Text>
            </View>
            {item.errorMessage ? <Text style={styles.errorText}>{item.errorMessage}</Text> : null}
            <View style={styles.actionsRow}>
              {item.state === 'failed' ? (
                <Pressable style={styles.actionButton} onPress={() => void retry(item.id)}>
                  <Text style={styles.actionButtonText}>{t('transfers.retry')}</Text>
                </Pressable>
              ) : null}
              {item.state === 'queued' || item.state === 'running' ? (
                <Pressable style={styles.actionButton} onPress={() => void cancel(item.id)}>
                  <Text style={styles.actionButtonText}>{t('transfers.cancel')}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md, gap: spacing.sm },
  emptyText: { color: colors.mutedForeground, textAlign: 'center', marginTop: spacing.xl },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs
  },
  cardTitle: { color: colors.foreground, fontSize: typography.body.fontSize, fontWeight: '600' },
  cardMetaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cardMeta: { color: colors.mutedForeground, fontSize: typography.caption.fontSize },
  stateBadge: { fontSize: typography.caption.fontSize, fontWeight: '700' },
  errorText: { color: colors.red, fontSize: typography.caption.fontSize },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  actionButton: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  actionButtonText: { color: colors.foreground, fontSize: typography.caption.fontSize }
})
