import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { useTranslation } from 'react-i18next'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { colors, radius, spacing, typography } from '../../design-system/tokens'
import { useEssentialsStore } from '../../stores/essentials-store'
import * as CustomCatalogModule from '../../native/CustomCatalogModule'
import type { CatalogListing } from '../../types'
import { EssentialsGameTile } from './EssentialsGameTile'
import { LegalConfirmationDialog } from './LegalConfirmationDialog'

type CatalogSource = 'official' | 'custom'
const MEDIA_TYPES: CatalogListing['mediaType'][] = ['ps2-dvd', 'ps2-cd', 'ps1']

const GRID_COLUMNS = 3

const TIER_FILTERS: { labelKey?: string; label?: string; value: string }[] = [
  { labelKey: 'essentialsCatalogTab.tierFilters.all', value: 'all' },
  { label: 'S', value: 'S' },
  { label: 'A', value: 'A' },
  { label: 'B', value: 'B' },
  { label: 'C', value: 'C' },
  { labelKey: 'essentialsCatalogTab.tierFilters.unrated', value: 'Unrated' }
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
interface EssentialsCatalogTabProps {
  onDownloadStarted: () => void
}

export function EssentialsCatalogTab({ onDownloadStarted }: EssentialsCatalogTabProps) {
  const { t } = useTranslation()
  const { items: officialItems, search, tier, status, errorMessage, loadCatalog, setSearch, setTier, confirmAndDownload } =
    useEssentialsStore()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [source, setSource] = useState<CatalogSource>('official')

  const [customItems, setCustomItems] = useState<CatalogListing[]>([])
  const [customStatus, setCustomStatus] = useState<'idle' | 'loading'>('idle')
  const [showManualForm, setShowManualForm] = useState(false)
  const [manualEntry, setManualEntry] = useState({
    title: '',
    fileName: '',
    url: '',
    sizeBytes: '',
    mediaType: 'ps2-dvd' as CatalogListing['mediaType']
  })
  const [manualError, setManualError] = useState('')
  const [csvErrors, setCsvErrors] = useState<string[]>([])

  const loadCustomCatalog = async () => {
    setCustomStatus('loading')
    try {
      const listed = await CustomCatalogModule.listCustomCatalog({ search })
      setCustomItems(listed)
    } finally {
      setCustomStatus('idle')
    }
  }

  useEffect(() => {
    void loadCatalog()
    // Accessibility/box art are enriched in the background on the native side
    // (native/EssentialsModule's first fetch returns a fast metadata-only
    // listing so this screen never sits on a blank spinner for however long
    // ~325 HEAD checks take) — poll a few times to pick up that enrichment
    // once it lands, without a manual pull-to-refresh.
    const pollTimers = [4000, 9000, 16000, 25000].map((delay) => setTimeout(() => void loadCatalog(), delay))
    return () => pollTimers.forEach(clearTimeout)
  }, [loadCatalog])

  useEffect(() => {
    if (source === 'custom') void loadCustomCatalog()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, search])

  const items = source === 'official' ? officialItems : customItems

  async function handleAddManualEntry() {
    setManualError('')
    try {
      await CustomCatalogModule.addCustomCatalogEntry({
        title: manualEntry.title,
        fileName: manualEntry.fileName,
        url: manualEntry.url,
        sizeBytes: manualEntry.sizeBytes ? Number(manualEntry.sizeBytes) : undefined,
        mediaType: manualEntry.mediaType
      })
      setManualEntry({ title: '', fileName: '', url: '', sizeBytes: '', mediaType: 'ps2-dvd' })
      setShowManualForm(false)
      await loadCustomCatalog()
    } catch (error) {
      setManualError(error instanceof Error ? error.message : t('essentialsCatalogTab.form.addError'))
    }
  }

  async function handleImportCsv() {
    const picked = await DocumentPicker.getDocumentAsync({ type: 'text/csv', copyToCacheDirectory: false })
    if (picked.canceled || picked.assets.length === 0) return
    const result = await CustomCatalogModule.importCustomCatalogCsv(picked.assets[0].uri)
    setCsvErrors(result.errors)
    if (result.added.length > 0) await loadCustomCatalog()
  }

  async function handleRemoveCustomEntry(id: string) {
    await CustomCatalogModule.removeCustomCatalogEntry(id)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    await loadCustomCatalog()
  }

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
    void confirmAndDownload(toDownload).then((result) => {
      if (result?.duplicates.length) {
        const fileNames = result.duplicates.map((d) => d.fileName)
        Alert.alert(
          t('essentialsCatalogTab.duplicatesTitle'),
          t('essentialsCatalogTab.duplicatesMessage', { fileNames: fileNames.join(', ') }),
          [
            { text: t('essentialsCatalogTab.cancel'), style: 'cancel' },
            {
              text: t('essentialsCatalogTab.overwrite'),
              style: 'destructive',
              onPress: () => void confirmAndDownload(toDownload, fileNames).then(() => onDownloadStarted())
            }
          ]
        )
      } else {
        onDownloadStarted()
      }
    })
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('essentialsCatalogTab.title')}</Text>
        <Text style={styles.headerSubtitle}>
          {source === 'official'
            ? t('essentialsCatalogTab.officialDescription')
            : t('essentialsCatalogTab.customDescription')}
        </Text>
      </View>

      <View style={styles.sourceTabs}>
        <Pressable
          style={[styles.sourceTab, source === 'official' ? styles.sourceTabActive : null]}
          onPress={() => {
            setSource('official')
            setSelectedIds(new Set())
          }}
        >
          <Text style={[styles.sourceTabText, source === 'official' ? styles.sourceTabTextActive : null]}>
            {t('essentialsCatalogTab.officialTab')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.sourceTab, source === 'custom' ? styles.sourceTabActive : null]}
          onPress={() => {
            setSource('custom')
            setSelectedIds(new Set())
          }}
        >
          <Text style={[styles.sourceTabText, source === 'custom' ? styles.sourceTabTextActive : null]}>
            {t('essentialsCatalogTab.customTab')}
          </Text>
        </Pressable>
      </View>

      {source === 'custom' ? (
        <View style={styles.customActionsRow}>
          <Pressable style={styles.customActionButton} onPress={() => setShowManualForm((value) => !value)}>
            <MaterialIcons name="person-add" size={16} color={colors.foreground} />
            <Text style={styles.customActionText}>{t('essentialsCatalogTab.addManually')}</Text>
          </Pressable>
          <Pressable style={styles.customActionButton} onPress={() => void handleImportCsv()}>
            <MaterialIcons name="upload-file" size={16} color={colors.foreground} />
            <Text style={styles.customActionText}>{t('essentialsCatalogTab.importCsv')}</Text>
          </Pressable>
        </View>
      ) : null}

      {source === 'custom' && showManualForm ? (
        <View style={styles.manualForm}>
          <TextInput
            style={styles.manualInput}
            placeholder={t('essentialsCatalogTab.form.titlePlaceholder')}
            placeholderTextColor={colors.mutedForeground}
            value={manualEntry.title}
            onChangeText={(value) => setManualEntry((current) => ({ ...current, title: value }))}
          />
          <TextInput
            style={styles.manualInput}
            placeholder={t('essentialsCatalogTab.form.fileNamePlaceholder')}
            placeholderTextColor={colors.mutedForeground}
            value={manualEntry.fileName}
            onChangeText={(value) => setManualEntry((current) => ({ ...current, fileName: value }))}
          />
          <TextInput
            style={styles.manualInput}
            placeholder={t('essentialsCatalogTab.form.urlPlaceholder')}
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            value={manualEntry.url}
            onChangeText={(value) => setManualEntry((current) => ({ ...current, url: value }))}
          />
          <TextInput
            style={styles.manualInput}
            placeholder={t('essentialsCatalogTab.form.sizePlaceholder')}
            placeholderTextColor={colors.mutedForeground}
            keyboardType="number-pad"
            value={manualEntry.sizeBytes}
            onChangeText={(value) => setManualEntry((current) => ({ ...current, sizeBytes: value }))}
          />
          <View style={styles.mediaTypeRow}>
            {MEDIA_TYPES.map((option) => (
              <Pressable
                key={option}
                style={[styles.chip, manualEntry.mediaType === option ? styles.chipActive : null]}
                onPress={() => setManualEntry((current) => ({ ...current, mediaType: option }))}
              >
                <Text style={[styles.chipText, manualEntry.mediaType === option ? styles.chipTextActive : null]}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
          {manualError ? <Text style={styles.error}>{manualError}</Text> : null}
          <Pressable
            style={[styles.selectionDownload, !manualEntry.title.trim() || !manualEntry.fileName.trim() || !manualEntry.url.trim() ? styles.disabled : null]}
            disabled={!manualEntry.title.trim() || !manualEntry.fileName.trim() || !manualEntry.url.trim()}
            onPress={() => void handleAddManualEntry()}
          >
            <Text style={styles.selectionDownloadText}>{t('essentialsCatalogTab.form.addToMyList')}</Text>
          </Pressable>
        </View>
      ) : null}

      {source === 'custom' && csvErrors.length > 0 ? (
        <View style={styles.csvErrorsBox}>
          <Text style={styles.csvErrorsTitle}>{t('essentialsCatalogTab.csvErrorsTitle')}</Text>
          {csvErrors.map((err) => (
            <Text key={err} style={styles.csvErrorsText}>
              • {err}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.searchWrap}>
        <MaterialIcons name="search" size={20} color={colors.mutedForeground} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('essentialsCatalogTab.searchPlaceholder')}
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 ? (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <MaterialIcons name="close" size={18} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>

      {source === 'official' ? (
        <View style={styles.filterRow}>
          {TIER_FILTERS.map((option) => (
            <Pressable
              key={option.value}
              style={[styles.chip, tier === option.value ? styles.chipActive : null]}
              onPress={() => setTier(option.value)}
            >
              <Text style={[styles.chipText, tier === option.value ? styles.chipTextActive : null]}>
                {option.labelKey ? t(option.labelKey) : option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {source === 'official' && errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        numColumns={GRID_COLUMNS}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.list, selectedItems.length > 0 ? styles.listWithBar : null]}
        ListEmptyComponent={
          (source === 'official' ? status : customStatus) === 'loading' ? (
            <ActivityIndicator color={colors.primary} style={styles.spinner} />
          ) : (
            <Text style={styles.emptyText}>
              {source === 'official'
                ? t('essentialsCatalogTab.emptyOfficial')
                : t('essentialsCatalogTab.emptyCustom')}
            </Text>
          )
        }
        renderItem={({ item }) => (
          <EssentialsGameTile
            item={item}
            selected={selectedIds.has(item.id)}
            onToggle={() => toggleSelection(item.id)}
            onRemove={source === 'custom' ? () => void handleRemoveCustomEntry(item.id) : undefined}
          />
        )}
      />

      {selectedItems.length > 0 ? (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionText}>
            {t('essentialsCatalogTab.selectedCount', { count: selectedItems.length, size: formatSize(selectedBytes) })}
          </Text>
          <View style={styles.selectionActions}>
            <Pressable style={styles.selectionClear} onPress={() => setSelectedIds(new Set())}>
              <MaterialIcons name="close" size={16} color={colors.foreground} />
              <Text style={styles.selectionClearText}>{t('essentialsCatalogTab.clear')}</Text>
            </Pressable>
            <Pressable style={styles.selectionDownload} onPress={() => setConfirming(true)}>
              <MaterialIcons name="download" size={16} color={colors.primaryForeground} />
              <Text style={styles.selectionDownloadText}>{t('essentialsCatalogTab.downloadSelected')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <LegalConfirmationDialog
        visible={confirming}
        itemTitle={
          selectedItems.length === 1
            ? selectedItems[0].title
            : t('essentialsCatalogTab.multipleGamesSelected', { count: selectedItems.length })
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
  sourceTabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  sourceTab: { paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  sourceTabActive: { borderBottomColor: colors.primary },
  sourceTabText: { color: colors.mutedForeground, fontSize: typography.body.fontSize, fontWeight: '600' },
  sourceTabTextActive: { color: colors.foreground },
  customActionsRow: { flexDirection: 'row', gap: spacing.sm, marginHorizontal: spacing.md, marginBottom: spacing.sm },
  customActionButton: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md
  },
  customActionText: { color: colors.foreground, fontSize: typography.caption.fontSize, fontWeight: '600' },
  manualForm: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.card
  },
  manualInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    color: colors.foreground,
    fontSize: typography.body.fontSize
  },
  mediaTypeRow: { flexDirection: 'row', gap: spacing.xs },
  disabled: { opacity: 0.5 },
  csvErrorsBox: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.amber,
    backgroundColor: `${colors.amber}18`
  },
  csvErrorsTitle: { color: colors.amber, fontSize: typography.caption.fontSize, fontWeight: '700' },
  csvErrorsText: { color: colors.amber, fontSize: typography.caption.fontSize, marginTop: 2 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    height: 44
  },
  searchInput: {
    flex: 1,
    color: colors.foreground,
    fontSize: typography.body.fontSize,
    padding: 0
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.mutedForeground, fontSize: typography.caption.fontSize, fontWeight: '600' },
  chipTextActive: { color: colors.primaryForeground, fontWeight: '700' },
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
    flexDirection: 'row',
    gap: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  selectionClearText: { color: colors.foreground, fontSize: typography.caption.fontSize },
  selectionDownload: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center'
  },
  selectionDownloadText: { color: colors.primaryForeground, fontSize: typography.caption.fontSize, fontWeight: '700' }
})
