import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { colors, radius, spacing, typography } from '../../design-system/tokens'
import { useEssentialsStore } from '../../stores/essentials-store'
import { EssentialsGameTile } from './EssentialsGameTile'
import { LegalConfirmationDialog } from './LegalConfirmationDialog'

const GRID_COLUMNS = 3

const TIER_FILTERS: { label: string; value: string }[] = [
  { label: 'Todos', value: 'all' },
  { label: 'S', value: 'S' },
  { label: 'A', value: 'A' },
  { label: 'B', value: 'B' },
  { label: 'C', value: 'C' },
  { label: 'Unrated', value: 'Unrated' }
]

function formatSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024)
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`
}

/**
 * US1 — Descobrir e Instalar do Catálogo Essentials (spec 008 FR-001–FR-004).
 * Grid of tiles (not a plain list) so the catalog reads like a store front,
 * with multi-select: tap a tile to add it to the selection, then confirm
 * everything in one legal-gated batch via the sticky bottom bar. Direct
 * single-item downloads still go through the same confirmation gate. Lives
 * as the "Catálogo" tab of `EssentialsScreen`.
 */
export function EssentialsCatalogTab() {
  const { items, search, tier, status, errorMessage, loadCatalog, setSearch, setTier, confirmAndDownload } =
    useEssentialsStore()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    void loadCatalog()
  }, [loadCatalog])

  const selectedItems = useMemo(() => items.filter((item) => selectedIds.has(item.id)), [items, selectedIds])
  const selectedBytes = useMemo(() => selectedItems.reduce((sum, item) => sum + (item.sizeBytes ?? 0), 0), [selectedItems])

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleConfirm = () => {
    if (selectedItems.length === 0) return
    setConfirming(false)
    const toDownload = selectedItems
    setSelectedIds(new Set())
    void confirmAndDownload(toDownload)
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Catálogo Essentials</Text>
        <Text style={styles.headerSubtitle}>
          Fonte pré-configurada: Internet Archive — PlayStation 2 Essentials, com pontuação e verificação de
          disponibilidade automáticas.
        </Text>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Buscar jogos..."
        placeholderTextColor={colors.mutedForeground}
        value={search}
        onChangeText={setSearch}
      />

      <View style={styles.filterRow}>
        {TIER_FILTERS.map((option) => (
          <Pressable
            key={option.value}
            style={[styles.chip, tier === option.value ? styles.chipActive : null]}
            onPress={() => setTier(option.value)}
          >
            <Text style={[styles.chipText, tier === option.value ? styles.chipTextActive : null]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        numColumns={GRID_COLUMNS}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.list, selectedItems.length > 0 ? styles.listWithBar : null]}
        ListEmptyComponent={
          status === 'loading' ? (
            <ActivityIndicator color={colors.primary} style={styles.spinner} />
          ) : (
            <Text style={styles.emptyText}>Nenhum item encontrado.</Text>
          )
        }
        renderItem={({ item }) => (
          <EssentialsGameTile item={item} selected={selectedIds.has(item.id)} onToggle={() => toggleSelection(item.id)} />
        )}
      />

      {selectedItems.length > 0 ? (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionText}>
            {selectedItems.length} selecionado(s) · {formatSize(selectedBytes)}
          </Text>
          <View style={styles.selectionActions}>
            <Pressable style={styles.selectionClear} onPress={() => setSelectedIds(new Set())}>
              <Text style={styles.selectionClearText}>Limpar</Text>
            </Pressable>
            <Pressable style={styles.selectionDownload} onPress={() => setConfirming(true)}>
              <Text style={styles.selectionDownloadText}>Baixar selecionados</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <LegalConfirmationDialog
        visible={confirming}
        itemTitle={
          selectedItems.length === 1 ? selectedItems[0].title : `${selectedItems.length} jogos selecionados`
        }
        onCancel={() => setConfirming(false)}
        onConfirm={handleConfirm}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.md, marginBottom: spacing.sm, gap: spacing.xs },
  headerTitle: { color: colors.foreground, fontSize: typography.subtitle.fontSize, fontWeight: '700' },
  headerSubtitle: { color: colors.mutedForeground, fontSize: typography.caption.fontSize, lineHeight: 18 },
  searchInput: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.foreground
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm
  },
  chip: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center'
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.mutedForeground, fontSize: typography.caption.fontSize },
  chipTextActive: { color: colors.primaryForeground, fontWeight: '600' },
  error: { color: colors.red, marginHorizontal: spacing.md, marginBottom: spacing.sm },
  row: { gap: spacing.sm },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg, gap: spacing.sm },
  listWithBar: { paddingBottom: 96 },
  spinner: { marginTop: spacing.xl },
  emptyText: { color: colors.mutedForeground, textAlign: 'center', marginTop: spacing.xl },
  selectionBar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8
  },
  selectionText: { color: colors.foreground, fontSize: typography.body.fontSize, fontWeight: '600' },
  selectionActions: { flexDirection: 'row', gap: spacing.sm },
  selectionClear: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center'
  },
  selectionClearText: { color: colors.foreground, fontSize: typography.caption.fontSize },
  selectionDownload: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    alignItems: 'center'
  },
  selectionDownloadText: { color: colors.primaryForeground, fontSize: typography.caption.fontSize, fontWeight: '700' }
})
