import { useEffect, useRef } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radius, semanticColor, spacing, typography } from '../../design-system/tokens'
import { useArtSyncStore } from '../../stores/art-sync-store'
import { useCatalogStore } from '../../stores/catalog-store'
import { navigationRef } from '../../app/navigationRef'

/**
 * Art Sync — downloads box art for games already in the local library that
 * don't have it yet, matched by exact game ID against archive.org's
 * `OPLM_ART_2024_09.zip` (mirrors desktop's Art Manager). Never touches game
 * files, only cover art, so there's no per-item legal confirmation gate.
 */
export function ArtSyncScreen() {
  const { state, totalGames, matchedInSource, installed, failed, errorMessage, plan, start } = useArtSyncStore()
  const navigatedOnCompletion = useRef(false)

  // Newly-synced covers only show once the catalog re-reads the ART folder —
  // jump to Biblioteca with a fresh scan already running so the user sees
  // the result immediately instead of a stale grid.
  useEffect(() => {
    if (state === 'completed' && !navigatedOnCompletion.current) {
      navigatedOnCompletion.current = true
      void useCatalogStore.getState().startScan()
      if (navigationRef.isReady()) navigationRef.navigate('Tabs', { screen: 'Library' } as never)
    }
    if (state !== 'completed') navigatedOnCompletion.current = false
  }, [state])

  const isPlanning = state === 'planning'
  const isRunning = state === 'running'
  const isDone = state === 'completed'
  const processed = installed + failed
  const progress = matchedInSource > 0 ? processed / matchedInSource : 0

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sincronizar Artes</Text>
      <Text style={styles.description}>
        Baixa a capa dos jogos já catalogados na sua biblioteca que ainda não têm arte, a partir do
        acervo público OPLM Art (archive.org), casando pelo Game ID exato — sem alterar arquivos de jogo.
      </Text>

      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

      {state === 'idle' || state === 'error' ? (
        <Pressable style={styles.primaryButton} onPress={() => void plan()}>
          <Text style={styles.primaryButtonText}>Preparar sincronização</Text>
        </Pressable>
      ) : null}

      {isPlanning ? (
        <View style={styles.card}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.body}>Verificando artes faltando e disponíveis...</Text>
        </View>
      ) : null}

      {state === 'planned' ? (
        <View style={styles.card}>
          <Text style={styles.label}>Jogos sem arte</Text>
          <Text style={styles.body}>{totalGames}</Text>
          <Text style={styles.label}>Encontrados no acervo</Text>
          <Text style={styles.body}>{matchedInSource}</Text>
          <Pressable
            style={[styles.primaryButton, matchedInSource === 0 ? styles.disabled : null]}
            disabled={matchedInSource === 0}
            onPress={() => void start()}
          >
            <Text style={styles.primaryButtonText}>Iniciar sincronização</Text>
          </Pressable>
        </View>
      ) : null}

      {isRunning || isDone ? (
        <View style={styles.card}>
          <Text style={styles.label}>{isDone ? 'Sincronização concluída' : 'Sincronizando...'}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={styles.body}>
            {processed} de {matchedInSource} artes processadas
          </Text>
          <Text style={styles.label}>
            {installed} instalada{installed === 1 ? '' : 's'}
            {failed > 0 ? ` · ${failed} falharam` : ''}
          </Text>
          {isDone ? (
            <Pressable style={styles.primaryButton} onPress={() => void plan()}>
              <Text style={styles.primaryButtonText}>Verificar novamente</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md },
  title: { color: colors.foreground, fontSize: typography.title.fontSize, fontWeight: '700' },
  description: { color: colors.mutedForeground, fontSize: typography.body.fontSize },
  error: { color: colors.red },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm
  },
  label: { color: colors.mutedForeground, fontSize: typography.caption.fontSize },
  body: { color: colors.foreground, fontSize: typography.body.fontSize },
  progressTrack: {
    height: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    backgroundColor: semanticColor('success')
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center'
  },
  disabled: { opacity: 0.5 },
  primaryButtonText: { color: colors.primaryForeground, fontSize: typography.body.fontSize, fontWeight: '600' }
})
