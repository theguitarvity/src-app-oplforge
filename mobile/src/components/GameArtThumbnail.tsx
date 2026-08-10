import { useEffect, useState } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { colors, radius } from '../design-system/tokens'
import * as CatalogModule from '../native/CatalogModule'

interface GameArtThumbnailProps {
  gameId?: string
  hasArt?: boolean
  title: string
  size?: number
}

/**
 * Cover art for one catalog entry (OPL `ART/<GAMEID>_COV[2].png`
 * convention). Resolves lazily per-thumbnail via `CatalogModule.getArtUri`
 * rather than bulk-loading — art is optional and a library can have
 * hundreds of entries, so this only pays the SAF lookup cost for what's
 * actually rendered on screen. Falls back to a title-initial placeholder
 * when there's no art file, never a broken image icon.
 */
export function GameArtThumbnail({ gameId, hasArt, title, size = 96 }: GameArtThumbnailProps) {
  // Keying the lookup effect by gameId (via the `key` below) resets `uri`
  // back to its initial `undefined` on remount instead of needing a manual
  // reset branch that sets state synchronously in the effect body.
  const [uri, setUri] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (!gameId || hasArt === false) return
    let cancelled = false
    CatalogModule.getArtUri(gameId)
      .then((resolved) => {
        if (!cancelled) setUri(resolved)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [gameId, hasArt])

  const style = [styles.container, { width: size, height: size }]

  if (uri) {
    return <Image source={{ uri }} style={style} resizeMode="cover" />
  }

  return (
    <View style={[style, styles.placeholder]}>
      <MaterialIcons name="sports-esports" size={size * 0.4} color={colors.mutedForeground} />
      <Text style={styles.placeholderText} numberOfLines={1}>
        {title.charAt(0).toUpperCase()}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { borderRadius: radius.md, backgroundColor: colors.muted, overflow: 'hidden' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderText: { position: 'absolute', color: colors.border, fontSize: 28, fontWeight: '800' }
})
