import { useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { colors, radius, spacing, typography } from '../../design-system/tokens'
import type { CatalogListing } from '../../types'

const TIER_COLOR: Record<string, string> = {
  S: '#FBBF24',
  A: '#7C4DFF',
  B: '#34D399',
  C: '#A099B0',
  Unrated: colors.mutedForeground
}

const MEDIA_LABEL: Record<CatalogListing['mediaType'], string> = {
  'ps2-dvd': 'PS2 DVD',
  'ps2-cd': 'PS2 CD',
  ps1: 'PS1'
}

function formatSize(bytes?: number): string {
  if (!bytes) return ''
  const gb = bytes / (1024 * 1024 * 1024)
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`
}

interface EssentialsGameTileProps {
  item: CatalogListing
  selected: boolean
  onToggle: () => void
}

/**
 * Grid tile for one Essentials catalog listing. Cover art comes from
 * libretro-thumbnails (Internet Archive itself ships none — verified, only
 * ISOs/BINs plus one generic collection thumbnail) via `item.boxArtUrl`,
 * resolved server-side and cached for 24h. Falls back to a stylized
 * tier-colored placeholder when there's no confident title match or the
 * image fails to load — same "always show something, never a broken image"
 * principle as `GameArtThumbnail` uses for local library entries. Tapping
 * toggles selection for the bulk-download bar; unavailable items are inert.
 */
export function EssentialsGameTile({ item, selected, onToggle }: EssentialsGameTileProps) {
  const tierColor = TIER_COLOR[item.scoreTier] ?? colors.mutedForeground
  const [artFailed, setArtFailed] = useState(false)
  const showArt = Boolean(item.boxArtUrl) && !artFailed

  return (
    <Pressable
      style={[styles.container, !item.accessible ? styles.disabled : null]}
      disabled={!item.accessible}
      onPress={onToggle}
    >
      <View style={[styles.art, !showArt ? { backgroundColor: `${tierColor}22`, borderColor: `${tierColor}55` } : styles.artWithImage]}>
        {showArt ? (
          <Image
            source={{ uri: item.boxArtUrl }}
            style={styles.artImage}
            resizeMode="cover"
            onError={() => setArtFailed(true)}
          />
        ) : (
          <MaterialIcons name="album" size={36} color={tierColor} />
        )}
        <View style={[styles.tierBadge, { backgroundColor: tierColor }]}>
          <Text style={styles.tierBadgeText} numberOfLines={1}>
            {item.scoreTier === 'Unrated' ? '?' : item.scoreTier}
          </Text>
        </View>
        {selected ? (
          <View style={styles.checkOverlay}>
            <MaterialIcons name="check-circle" size={28} color={colors.primary} />
          </View>
        ) : null}
        {!item.accessible ? (
          <View style={styles.unavailableOverlay}>
            <Text style={styles.unavailableText}>Indisponível</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {MEDIA_LABEL[item.mediaType]} · {formatSize(item.sizeBytes)}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  container: { width: '31%', gap: spacing.xs },
  disabled: { opacity: 0.45 },
  art: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  artWithImage: { backgroundColor: colors.muted, borderColor: colors.border },
  artImage: { width: '100%', height: '100%', position: 'absolute' },
  tierBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    borderRadius: 999,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center'
  },
  tierBadgeText: { color: colors.background, fontSize: 11, fontWeight: '800' },
  checkOverlay: {
    position: 'absolute',
    bottom: spacing.xs,
    left: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: 999
  },
  unavailableOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15,13,19,0.85)',
    paddingVertical: spacing.xs,
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
    alignItems: 'center'
  },
  unavailableText: { color: colors.amber, fontSize: 10, fontWeight: '700' },
  title: { color: colors.foreground, fontSize: typography.caption.fontSize, fontWeight: '600', textAlign: 'center' },
  meta: { color: colors.mutedForeground, fontSize: 10, textAlign: 'center' }
})
