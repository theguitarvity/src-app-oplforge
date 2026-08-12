import { useEffect, useState } from 'react'
import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useTranslation } from 'react-i18next'
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

interface QuickAction {
  key: string
  labelKey: string
  icon: keyof typeof MaterialIcons.glyphMap
  onPress: (navigation: NativeStackNavigationProp<RootStackParamList>) => void
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    key: 'library',
    labelKey: 'home.quickActions.library',
    icon: 'videogame-asset',
    onPress: (navigation) => navigation.navigate('LibrarySelect')
  },
  {
    key: 'essentials',
    labelKey: 'home.quickActions.essentials',
    icon: 'travel-explore',
    onPress: (navigation) => navigation.navigate('Essentials')
  },
  {
    key: 'sharing',
    labelKey: 'home.quickActions.sharing',
    icon: 'wifi-tethering',
    onPress: (navigation) => navigation.navigate('Sharing')
  },
  {
    key: 'transfers',
    labelKey: 'home.quickActions.transfers',
    icon: 'downloading',
    onPress: (navigation) => navigation.navigate('Transfers')
  },
  {
    key: 'diagnostics',
    labelKey: 'home.quickActions.diagnostics',
    icon: 'health-and-safety',
    onPress: (navigation) => navigation.navigate('Diagnostics')
  },
  {
    key: 'artSync',
    labelKey: 'home.quickActions.artSync',
    icon: 'image',
    onPress: (navigation) => navigation.navigate('ArtSync')
  },
  {
    key: 'sources',
    labelKey: 'home.quickActions.sources',
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
  const { t } = useTranslation()
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
        title: t('home.suggestions.diagnostics.title'),
        subtitle: t('home.suggestions.diagnostics.subtitle'),
        icon: 'health-and-safety',
        onPress: () => navigation.navigate('Diagnostics')
      })
    }
    if (snapshot?.state === 'completed' && totalGames === 0) {
      suggestions.push({
        key: 'essentials-empty',
        title: t('home.suggestions.essentialsEmpty.title'),
        subtitle: t('home.suggestions.essentialsEmpty.subtitle'),
        icon: 'travel-explore',
        onPress: () => navigation.navigate('Essentials')
      })
    } else if (snapshot?.state === 'completed' && totalGames > 0) {
      suggestions.push({
        key: 'smart-fill',
        title: t('home.suggestions.smartFill.title'),
        subtitle: t('home.suggestions.smartFill.subtitle'),
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
      <Text style={styles.title}>{t('home.title')}</Text>

      <View style={[styles.card, { borderColor: color }]}>
        <Text style={[styles.cardTitle, { color }]}>{view.title}</Text>
        <Text style={styles.cardSubtitle}>{view.subtitle}</Text>
        <View style={styles.heroActionsRow}>
          {view.primaryAction !== 'none' ? (
            <Pressable style={[styles.primaryButton, { backgroundColor: color }]} onPress={handlePrimaryAction}>
              <Text style={styles.primaryButtonText}>{primaryActionLabel(t, view.primaryAction)}</Text>
            </Pressable>
          ) : null}
          {report ? (
            <Pressable
              style={[styles.readinessPill, { borderColor: readinessCardColor(report.readiness) }]}
              onPress={() => navigation.navigate('Diagnostics')}
            >
              <Text style={[styles.readinessText, { color: readinessCardColor(report.readiness) }]}>
                {readinessLabel(t, report.readiness)}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {view.state === 'sharing-on-idle' || view.state === 'ps2-connected' ? (
        <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('Tutorial')}>
          <Text style={styles.secondaryButtonText}>{t('home.setupTutorial')}</Text>
        </Pressable>
      ) : null}

      {snapshot?.state === 'completed' ? (
        <View style={styles.countsGrid}>
          <Pressable style={styles.countTile} onPress={() => navigation.navigate('LibrarySelect')}>
            <View style={styles.countHeaderRow}>
              <Text style={styles.countLabel}>{t('home.ps2Games')}</Text>
              <View style={[styles.countIconWrap, { backgroundColor: `${colors.primary}33` }]}>
                <MaterialIcons name="sports-esports" size={18} color={colors.primary} />
              </View>
            </View>
            <Text style={styles.countValue}>{ps2Count}</Text>
          </Pressable>
          <Pressable style={styles.countTile} onPress={() => navigation.navigate('LibrarySelect')}>
            <View style={styles.countHeaderRow}>
              <Text style={styles.countLabel}>{t('home.ps1Games')}</Text>
              <View style={[styles.countIconWrap, { backgroundColor: `${colors.fuchsia}33` }]}>
                <MaterialIcons name="auto-awesome" size={18} color={colors.fuchsia} />
              </View>
            </View>
            <Text style={styles.countValue}>{ps1Count}</Text>
          </Pressable>
          <Pressable style={styles.countTile} onPress={() => navigation.navigate('LibrarySelect')}>
            <View style={styles.countHeaderRow}>
              <Text style={styles.countLabel}>{t('home.apps')}</Text>
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
          <Text style={styles.sectionTitle}>{t('home.suggestionsTitle')}</Text>
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

      <Text style={styles.sectionTitle}>{t('home.quickAccess')}</Text>
      <View style={styles.actionsGrid}>
        {QUICK_ACTIONS.map((action) => (
          <Pressable key={action.key} style={styles.actionTile} onPress={() => action.onPress(navigation)}>
            <View style={styles.actionIconWrap}>
              <MaterialIcons name={action.icon} size={26} color={colors.primary} />
            </View>
            <Text style={styles.actionLabel} numberOfLines={2}>
              {t(action.labelKey)}
            </Text>
          </Pressable>
        ))}
      </View>

      {preview.length > 0 ? (
        <>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>{t('home.recentlyCataloged')}</Text>
            <Pressable onPress={() => navigation.navigate('LibrarySelect')}>
              <Text style={styles.sectionLink}>{t('home.seeAll')}</Text>
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

function primaryActionLabel(t: (key: string) => string, action: string): string {
  switch (action) {
    case 'select-library':
      return t('home.primaryAction.selectLibrary')
    case 'catalog-library':
      return t('home.primaryAction.catalogLibrary')
    case 'go-to-sharing':
      return t('home.primaryAction.goToSharing')
    default:
      return ''
  }
}

function readinessLabel(t: (key: string) => string, readiness: string): string {
  switch (readiness) {
    case 'ready':
      return t('home.readiness.ready')
    case 'ready-with-warnings':
      return t('home.readiness.readyWithWarnings')
    case 'requires-reorganization':
      return t('home.readiness.requiresReorganization')
    case 'incompatible':
      return t('home.readiness.incompatible')
    default:
      return readiness
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
