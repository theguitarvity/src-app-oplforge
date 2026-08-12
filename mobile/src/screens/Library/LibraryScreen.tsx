import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { colors, radius, spacing, typography } from '../../design-system/tokens'
import * as CatalogModule from '../../native/CatalogModule'
import type { CatalogContentType, CatalogEntry } from '../../types'
import { GameArtThumbnail } from '../../components/GameArtThumbnail'
import { GameDetailSheet } from './GameDetailSheet'
import { LibraryChangedOverlay } from '../../components/library/LibraryChangedOverlay'

const GRID_COLUMNS = 3

const PAGE_SIZE = 30

const FILTERS: { labelKey: string; value: CatalogContentType | '' }[] = [
  { labelKey: 'library.filters.all', value: '' },
  { labelKey: 'library.filters.dvd', value: 'dvd' },
  { labelKey: 'library.filters.cd', value: 'cd' },
  { labelKey: 'library.filters.ps1', value: 'ps1' },
  { labelKey: 'library.filters.apps', value: 'app' }
]

/**
 * US6 — Navegar a Biblioteca no Celular (FR-011). Windowed/paginated list
 * backed by getCatalogEntries(), always reading the latest completed scan.
 */
export function LibraryScreen() {
  const { t } = useTranslation()
  const [filter, setFilter] = useState<CatalogContentType | ''>('')
  const [entries, setEntries] = useState<CatalogEntry[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<CatalogEntry | undefined>(undefined)

  const loadPage = useCallback(
    (targetFilter: CatalogContentType | '', targetPage: number, replace: boolean) => {
      setLoading(true)
      CatalogModule.getCatalogEntries(targetPage, PAGE_SIZE, targetFilter)
        .then((result) => {
          setEntries((prev) => (replace ? result : [...prev, ...result]))
          setHasMore(result.length === PAGE_SIZE)
          setPage(targetPage)
        })
        .finally(() => setLoading(false))
    },
    []
  )

  useEffect(() => {
    let cancelled = false
    Promise.resolve().then(() => {
      if (!cancelled) loadPage(filter, 0, true)
    })
    return () => {
      cancelled = true
    }
  }, [filter, loadPage])

  const handleEndReached = () => {
    if (loading || !hasMore) return
    loadPage(filter, page + 1, false)
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {FILTERS.map((option) => (
          <Pressable
            key={option.labelKey}
            style={[styles.chip, filter === option.value ? styles.chipActive : null]}
            onPress={() => setFilter(option.value)}
          >
            <Text style={[styles.chipText, filter === option.value ? styles.chipTextActive : null]}>
              {t(option.labelKey)}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        numColumns={GRID_COLUMNS}
        columnWrapperStyle={styles.row}
        contentContainerStyle={entries.length === 0 ? styles.emptyList : styles.list}
        onEndReachedThreshold={0.4}
        onEndReached={handleEndReached}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>{t('library.emptyState')}</Text>
            </View>
          ) : null
        }
        ListFooterComponent={loading ? <ActivityIndicator color={colors.primary} style={styles.footerSpinner} /> : null}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => setSelected(item)}>
            <GameArtThumbnail gameId={item.gameId} hasArt={item.hasArt} title={item.title} size={CARD_ART_SIZE} />
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <View style={styles.cardMetaRow}>
              <Text style={styles.cardMeta}>{item.contentType.toUpperCase()}</Text>
              {item.namingConformance === 'needs-attention' ? (
                <Text style={styles.cardWarning}>{t('library.needsAttention')}</Text>
              ) : null}
            </View>
          </Pressable>
        )}
      />

      <GameDetailSheet
        entry={selected}
        onClose={() => setSelected(undefined)}
        onDeleted={(entryId) => setEntries((prev) => prev.filter((entry) => entry.id !== entryId))}
      />

      <LibraryChangedOverlay />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    padding: spacing.md
  },
  chip: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center'
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.mutedForeground, fontSize: typography.caption.fontSize },
  chipTextActive: { color: colors.primaryForeground, fontWeight: '600' },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg, gap: spacing.sm },
  row: { gap: spacing.sm },
  emptyList: { flexGrow: 1, padding: spacing.md },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: spacing.xl },
  emptyText: { color: colors.mutedForeground, fontSize: typography.body.fontSize },
  footerSpinner: { marginVertical: spacing.md },
  card: {
    flex: 1 / GRID_COLUMNS,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.xs,
    alignItems: 'center'
  },
  cardTitle: { color: colors.foreground, fontSize: typography.caption.fontSize, fontWeight: '600', textAlign: 'center' },
  cardMetaRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
  cardMeta: { color: colors.mutedForeground, fontSize: typography.caption.fontSize },
  cardWarning: { color: colors.amber, fontSize: typography.caption.fontSize, fontWeight: '600' }
})

const CARD_ART_SIZE = 88
