import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { colors, radius, semanticColor, spacing, typography } from '../../design-system/tokens'
import { useLibraryStore } from '../../stores/library-store'
import { useCatalogStore } from '../../stores/catalog-store'
import { navigationRef } from '../../app/navigationRef'
import { CatalogScanView } from './CatalogScanView'
import * as LibraryModule from '../../native/LibraryModule'

/** After picking a library, jump straight to Biblioteca with a real scan already running, rather than leaving the user to find "Catalogar biblioteca" themselves. */
function goToLibraryWithFreshScan() {
  void useCatalogStore.getState().startScan()
  if (navigationRef.isReady()) navigationRef.navigate('Tabs', { screen: 'Library' } as never)
}

/**
 * US1 — Selecionar a Biblioteca e Obter Acesso Autorizado.
 * Empty state / active-library display / explicit change-library action /
 * access-lost prompt (spec Acceptance Scenarios 1–5). Launch-time access
 * revalidation (FR-004) runs once via the bootstrap step library-store
 * registers, not per-screen-mount. Visual language matches Home/Essentials:
 * a header, a status hero card with a colored accent, icon-circle rows.
 */
export function LibrarySelectScreen() {
  const { library, status, errorMessage, selectLibrary } = useLibraryStore()

  const handleSelectLibrary = () => {
    void selectLibrary().then(() => {
      if (useLibraryStore.getState().status === 'ready') goToLibraryWithFreshScan()
    })
  }

  const handleClearAppData = () => {
    Alert.alert(
      'Limpar dados do app',
      'Isso apaga a biblioteca selecionada, credenciais salvas, catálogo em cache e a fila de transferências. O app vai reiniciar. Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Limpar dados', style: 'destructive', onPress: () => void LibraryModule.clearAppData() }
      ]
    )
  }

  if (status === 'loading') {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  const heroColor =
    library && library.accessValid ? semanticColor('success') : library ? semanticColor('warning') : colors.primary

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Configurações</Text>
      <Text style={styles.subtitle}>Gerencie a pasta da sua biblioteca OPL.</Text>

      {library && library.accessValid ? (
        <>
          <View style={[styles.heroCard, { borderColor: heroColor }]}>
            <View style={styles.heroRow}>
              <View style={[styles.heroIconWrap, { backgroundColor: `${heroColor}33` }]}>
                <MaterialIcons name="folder" size={22} color={heroColor} />
              </View>
              <View style={styles.heroTextWrap}>
                <Text style={styles.heroLabel}>Biblioteca ativa</Text>
                <Text style={styles.heroValue}>{library.displayName}</Text>
                <Text style={styles.heroCaption}>Origem: {sourceKindLabel(library.sourceKind)}</Text>
              </View>
            </View>
          </View>
          <CatalogScanView />
          <Pressable style={styles.secondaryButton} onPress={handleSelectLibrary}>
            <MaterialIcons name="sync-alt" size={18} color={colors.foreground} />
            <Text style={styles.secondaryButtonText}>Trocar biblioteca</Text>
          </Pressable>
        </>
      ) : null}

      {library && !library.accessValid ? (
        <>
          <View style={[styles.heroCard, { borderColor: heroColor }]}>
            <View style={styles.heroRow}>
              <View style={[styles.heroIconWrap, { backgroundColor: `${heroColor}33` }]}>
                <MaterialIcons name="folder-off" size={22} color={heroColor} />
              </View>
              <View style={styles.heroTextWrap}>
                <Text style={styles.heroLabel}>Acesso perdido</Text>
                <Text style={styles.heroValue}>{`"${library.displayName}" não está mais disponível.`}</Text>
              </View>
            </View>
          </View>
          <Pressable style={styles.primaryButton} onPress={handleSelectLibrary}>
            <MaterialIcons name="folder-open" size={18} color={colors.primaryForeground} />
            <Text style={styles.primaryButtonText}>Selecionar biblioteca novamente</Text>
          </Pressable>
        </>
      ) : null}

      {!library ? (
        <>
          <View style={[styles.heroCard, { borderColor: heroColor }]}>
            <View style={styles.heroRow}>
              <View style={[styles.heroIconWrap, { backgroundColor: `${heroColor}33` }]}>
                <MaterialIcons name="create-new-folder" size={22} color={heroColor} />
              </View>
              <View style={styles.heroTextWrap}>
                <Text style={styles.heroLabel}>Nenhuma biblioteca configurada</Text>
                <Text style={styles.heroCaption}>
                  Selecione a pasta que representa sua biblioteca OPL (armazenamento interno,
                  cartão SD ou um dispositivo USB conectado) para começar.
                </Text>
              </View>
            </View>
          </View>
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          <Pressable style={styles.primaryButton} onPress={handleSelectLibrary}>
            <MaterialIcons name="folder-open" size={18} color={colors.primaryForeground} />
            <Text style={styles.primaryButtonText}>Selecionar biblioteca</Text>
          </Pressable>
        </>
      ) : null}

      <Text style={styles.dangerZoneLabel}>Zona de risco</Text>
      <Pressable style={styles.dangerButton} onPress={handleClearAppData}>
        <MaterialIcons name="delete-forever" size={18} color={semanticColor('error')} />
        <Text style={styles.dangerButtonText}>Limpar dados do app</Text>
      </Pressable>
    </ScrollView>
  )
}

function sourceKindLabel(kind: string): string {
  switch (kind) {
    case 'internal':
      return 'Armazenamento interno'
    case 'sd-card':
      return 'Cartão SD'
    case 'usb-otg':
      return 'Dispositivo USB'
    default:
      return 'Desconhecida'
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  centeredContainer: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  title: {
    color: colors.foreground,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight
  },
  subtitle: { color: colors.mutedForeground, fontSize: typography.body.fontSize },
  errorText: { color: colors.red, fontSize: typography.body.fontSize },
  heroCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md
  },
  heroRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center'
  },
  heroTextWrap: { flex: 1, gap: spacing.xs },
  heroLabel: { color: colors.mutedForeground, fontSize: typography.caption.fontSize },
  heroValue: { color: colors.foreground, fontSize: typography.subtitle.fontSize, fontWeight: '600' },
  heroCaption: { color: colors.mutedForeground, fontSize: typography.body.fontSize },
  primaryButton: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryButtonText: { color: colors.primaryForeground, fontSize: typography.body.fontSize, fontWeight: '600' },
  secondaryButton: {
    flexDirection: 'row',
    gap: spacing.xs,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryButtonText: { color: colors.foreground, fontSize: typography.body.fontSize },
  dangerZoneLabel: {
    color: colors.mutedForeground,
    fontSize: typography.caption.fontSize,
    fontWeight: '700',
    marginTop: spacing.lg
  },
  dangerButton: {
    flexDirection: 'row',
    gap: spacing.xs,
    borderColor: semanticColor('error'),
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center'
  },
  dangerButtonText: { color: semanticColor('error'), fontSize: typography.body.fontSize, fontWeight: '600' }
})
