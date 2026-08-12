import { useEffect, useState } from 'react'
import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { colors, radius, semanticColor, spacing, typography } from '../../design-system/tokens'
import { deriveHomeState, homeStateColor } from './homeState'
import { useLibraryStore } from '../../stores/library-store'
import { useCatalogStore } from '../../stores/catalog-store'
import { useSharingStore } from '../../stores/sharing-store'
import { useDiagnosticsStore } from '../../stores/diagnostics-store'
import * as CatalogModule from '../../native/CatalogModule'
import type { CatalogEntry } from '../../types'
import { GameArtThumbnail } from '../../components/GameArtThumbnail'
import type { RootStackParamList } from '../../app/App'

const READINESS_LABEL: Record<string, string> = {
  ready: 'Biblioteca pronta',
  'ready-with-warnings': 'Pronta, com avisos',
  'requires-reorganization': 'Requer reorganização',
  incompatible: 'Não pronta'
}

interface QuickAction {
  key: string
  label: string
  icon: keyof typeof MaterialIcons.glyphMap
  onPress: (navigation: NativeStackNavigationProp<RootStackParamList>) => void
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    key: 'library',
    label: 'Biblioteca',
    icon: 'videogame-asset',
    onPress: (navigation) => navigation.navigate('LibrarySelect')
  },
  {
    key: 'essentials',
    label: 'Catálogo Essentials',
    icon: 'travel-explore',
    onPress: (navigation) => navigation.navigate('Essentials')
  },
  {
    key: 'sharing',
    label: 'Compartilhar',
    icon: 'wifi-tethering',
    onPress: (navigation) => navigation.navigate('Sharing')
  },
  {
    key: 'transfers',
    label: 'Transferências',
    icon: 'downloading',
    onPress: (navigation) => navigation.navigate('Transfers')
  },
  {
    key: 'diagnostics',
    label: 'Diagnóstico',
    icon: 'health-and-safety',
    onPress: (navigation) => navigation.navigate('Diagnostics')
  },
  {
    key: 'artSync',
    label: 'Sincronizar Artes',
    icon: 'image',
    onPress: (navigation) => navigation.navigate('ArtSync')
  },
  {
    key: 'sources',
    label: 'Google Drive',
    icon: 'cloud',
    onPress: (navigation) => navigation.navigate('Sources')
  }
]

/**
 * US5 — Acompanhar o Status pela Home, expanded into a proper dashboard:
 * status hero (FR-025's six at-a-glance states), one-tap shortcuts into
 * every major feature, and a preview grid of recently cataloged games with
 * their cover art so the library feels alive rather than a status page.
 */
export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  // Subscribing to each store (no selector) re-renders Home on any relevant
  // change — catalog scan progress, sharing/client transitions — without
  // polling (FR-025 "at a glance").
  useLibraryStore()
  const { snapshot } = useCatalogStore()
  useSharingStore()
  const { report, loadLatest } = useDiagnosticsStore()
  const [preview, setPreview] = useState<CatalogEntry[]>([])

  useEffect(() => {
    void loadLatest()
  }, [loadLatest])

  useEffect(() => {
    CatalogModule.getCatalogEntries(0, 9, '')
      .then(setPreview)
      .catch(() => undefined)
  }, [])

  const view = deriveHomeState()
  const color = homeStateColor(view)

  const counts = snapshot?.countsByType
  const ps2Count = (counts?.dvd ?? 0) + (counts?.cd ?? 0)
  const ps1Count = counts?.ps1 ?? 0
  const appsCount = counts?.app ?? 0
  const totalGames = ps2Count + ps1Count + appsCount

  const suggestions: {
    key: string
    title: string
    subtitle: string
    icon: keyof typeof MaterialIcons.glyphMap
    onPress: () => void
  }[] = []
  if (view.state !== 'no-library') {
    if (!report) {
      suggestions.push({
        key: 'diagnostics',
        title: 'Rode um diagnóstico',
        subtitle: 'Verifique se sua biblioteca está pronta para o PS2.',
        icon: 'health-and-safety',
        onPress: () => navigation.navigate('Diagnostics')
      })
    }
    if (snapshot?.state === 'completed' && totalGames === 0) {
      suggestions.push({
        key: 'essentials-empty',
        title: 'Adicione seus primeiros jogos',
        subtitle: 'Explore o Catálogo Essentials para começar sua biblioteca.',
        icon: 'travel-explore',
        onPress: () => navigation.navigate('Essentials')
      })
    } else if (snapshot?.state === 'completed' && totalGames > 0) {
      suggestions.push({
        key: 'smart-fill',
        title: 'Preencha o espaço livre',
        subtitle: 'Use o Smart Fill para adicionar jogos automaticamente.',
        icon: 'auto-awesome',
        onPress: () => navigation.navigate('Essentials')
      })
    }
  }

  const handlePrimaryAction = () => {
    switch (view.primaryAction) {
      case 'select-library':
      case 'catalog-library':
        navigation.navigate('LibrarySelect')
        break
      case 'go-to-sharing':
        navigation.navigate('Sharing')
        break
      default:
        break
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>OPL Forge Mobile</Text>

      <View style={[styles.card, { borderColor: color }]}>
        <Text style={[styles.cardTitle, { color }]}>{view.title}</Text>
        <Text style={styles.cardSubtitle}>{view.subtitle}</Text>
        <View style={styles.heroActionsRow}>
          {view.primaryAction !== 'none' ? (
            <Pressable style={[styles.primaryButton, { backgroundColor: color }]} onPress={handlePrimaryAction}>
              <Text style={styles.primaryButtonText}>{primaryActionLabel(view.primaryAction)}</Text>
            </Pressable>
          ) : null}
          {report ? (
            <Pressable
              style={[styles.readinessPill, { borderColor: readinessCardColor(report.readiness) }]}
              onPress={() => navigation.navigate('Diagnostics')}
            >
              <Text style={[styles.readinessText, { color: readinessCardColor(report.readiness) }]}>
                {READINESS_LABEL[report.readiness] ?? report.readiness}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {view.state === 'sharing-on-idle' || view.state === 'ps2-connected' ? (
        <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('Tutorial')}>
          <Text style={styles.secondaryButtonText}>Tutorial de configuração do PS2</Text>
        </Pressable>
      ) : null}

      {snapshot?.state === 'completed' ? (
        <View style={styles.countsGrid}>
          <Pressable style={styles.countTile} onPress={() => navigation.navigate('LibrarySelect')}>
            <View style={styles.countHeaderRow}>
              <Text style={styles.countLabel}>Jogos PS2</Text>
              <View style={[styles.countIconWrap, { backgroundColor: `${colors.primary}33` }]}>
                <MaterialIcons name="sports-esports" size={18} color={colors.primary} />
              </View>
            </View>
            <Text style={styles.countValue}>{ps2Count}</Text>
          </Pressable>
          <Pressable style={styles.countTile} onPress={() => navigation.navigate('LibrarySelect')}>
            <View style={styles.countHeaderRow}>
              <Text style={styles.countLabel}>Jogos PS1</Text>
              <View style={[styles.countIconWrap, { backgroundColor: `${colors.fuchsia}33` }]}>
                <MaterialIcons name="auto-awesome" size={18} color={colors.fuchsia} />
              </View>
            </View>
            <Text style={styles.countValue}>{ps1Count}</Text>
          </Pressable>
          <Pressable style={styles.countTile} onPress={() => navigation.navigate('LibrarySelect')}>
            <View style={styles.countHeaderRow}>
              <Text style={styles.countLabel}>Apps</Text>
              <View style={[styles.countIconWrap, { backgroundColor: `${colors.cyan}33` }]}>
                <MaterialIcons name="widgets" size={18} color={colors.cyan} />
              </View>
            </View>
            <Text style={styles.countValue}>{appsCount}</Text>
          </Pressable>
        </View>
      ) : null}

      {suggestions.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Sugestões para você</Text>
          {suggestions.map((suggestion) => (
            <Pressable key={suggestion.key} style={styles.suggestionCard} onPress={suggestion.onPress}>
              <View style={styles.suggestionIconWrap}>
                <MaterialIcons name={suggestion.icon} size={22} color={colors.primary} />
              </View>
              <View style={styles.suggestionTextWrap}>
                <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
                <Text style={styles.suggestionSubtitle}>{suggestion.subtitle}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </>
      ) : null}

      <Text style={styles.sectionTitle}>Acesso rápido</Text>
      <View style={styles.actionsGrid}>
        {QUICK_ACTIONS.map((action) => (
          <Pressable key={action.key} style={styles.actionTile} onPress={() => action.onPress(navigation)}>
            <View style={styles.actionIconWrap}>
              <MaterialIcons name={action.icon} size={26} color={colors.primary} />
            </View>
            <Text style={styles.actionLabel} numberOfLines={2}>
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {preview.length > 0 ? (
        <>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Catalogados recentemente</Text>
            <Pressable onPress={() => navigation.navigate('LibrarySelect')}>
              <Text style={styles.sectionLink}>Ver tudo</Text>
            </Pressable>
          </View>
          <View style={styles.gamesGrid}>
            {preview.map((entry) => (
              <View key={entry.id} style={styles.gameCell}>
                <GameArtThumbnail gameId={entry.gameId} hasArt={entry.hasArt} title={entry.title} size={96} />
                <Text style={styles.gameTitle} numberOfLines={2}>
                  {entry.title}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  )
}

function readinessCardColor(readiness: string): string {
  switch (readiness) {
    case 'ready':
      return semanticColor('success')
    case 'ready-with-warnings':
      return semanticColor('warning')
    default:
      return semanticColor('error')
  }
}

function primaryActionLabel(action: string): string {
  switch (action) {
    case 'select-library':
      return 'Selecionar biblioteca'
    case 'catalog-library':
      return 'Ir para biblioteca'
    case 'go-to-sharing':
      return 'Ir para compartilhamento'
    default:
      return ''
  }
}

const GAME_CELL_WIDTH = 96

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  title: {
    color: colors.foreground,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs
  },
  cardTitle: { fontSize: typography.subtitle.fontSize, fontWeight: '600' },
  cardSubtitle: { color: colors.mutedForeground, fontSize: typography.body.fontSize },
  heroActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  primaryButton: { borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, alignItems: 'center' },
  primaryButtonText: { color: colors.primaryForeground, fontSize: typography.body.fontSize, fontWeight: '600' },
  secondaryButton: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center'
  },
  secondaryButtonText: { color: colors.foreground, fontSize: typography.body.fontSize },
  readinessPill: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  readinessText: { fontSize: typography.caption.fontSize, fontWeight: '600' },
  sectionTitle: { color: colors.foreground, fontSize: typography.subtitle.fontSize, fontWeight: '700', marginTop: spacing.sm },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  sectionLink: { color: colors.primary, fontSize: typography.caption.fontSize, fontWeight: '600' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionTile: {
    width: '30%',
    minWidth: 96,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    gap: spacing.xs
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: `${colors.primary}22`,
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionLabel: { color: colors.foreground, fontSize: typography.caption.fontSize, textAlign: 'center', fontWeight: '600' },
  countsGrid: { flexDirection: 'row', gap: spacing.sm },
  countTile: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.sm,
    gap: spacing.xs
  },
  countHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  countLabel: { color: colors.mutedForeground, fontSize: 10, fontWeight: '600', flexShrink: 1 },
  countIconWrap: { width: 28, height: 28, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  countValue: { color: colors.foreground, fontSize: 22, fontWeight: '800' },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md
  },
  suggestionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: `${colors.primary}22`,
    alignItems: 'center',
    justifyContent: 'center'
  },
  suggestionTextWrap: { flex: 1, minWidth: 0 },
  suggestionTitle: { color: colors.foreground, fontSize: typography.body.fontSize, fontWeight: '600' },
  suggestionSubtitle: { color: colors.mutedForeground, fontSize: typography.caption.fontSize, marginTop: 2 },
  gamesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gameCell: { width: '30%', minWidth: GAME_CELL_WIDTH, gap: spacing.xs, alignItems: 'center' },
  gameTitle: { color: colors.mutedForeground, fontSize: typography.caption.fontSize }
})
