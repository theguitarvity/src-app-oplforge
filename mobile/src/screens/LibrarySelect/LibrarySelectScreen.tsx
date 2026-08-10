import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radius, spacing, typography } from '../../design-system/tokens'
import { useLibraryStore } from '../../stores/library-store'
import { CatalogScanView } from './CatalogScanView'

/**
 * US1 — Selecionar a Biblioteca e Obter Acesso Autorizado.
 * Empty state / active-library display / explicit change-library action /
 * access-lost prompt (spec Acceptance Scenarios 1–5). Launch-time access
 * revalidation (FR-004) runs once via the bootstrap step library-store
 * registers, not per-screen-mount.
 */
export function LibrarySelectScreen() {
  const { library, status, errorMessage, selectLibrary } = useLibraryStore()

  if (status === 'loading') {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.primary} />
      </View>
    )
  }

  if (library && library.accessValid) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.label}>Biblioteca ativa</Text>
          <Text style={styles.value}>{library.displayName}</Text>
          <Text style={styles.caption}>Origem: {sourceKindLabel(library.sourceKind)}</Text>
        </View>
        <CatalogScanView />
        <Pressable style={styles.secondaryButton} onPress={() => void selectLibrary()}>
          <Text style={styles.secondaryButtonText}>Trocar biblioteca</Text>
        </Pressable>
      </View>
    )
  }

  if (library && !library.accessValid) {
    return (
      <View style={styles.container}>
        <View style={[styles.card, styles.warningCard]}>
          <Text style={styles.label}>Acesso perdido</Text>
          <Text style={styles.value}>
            {`O acesso à biblioteca "${library.displayName}" não está mais disponível.`}
          </Text>
        </View>
        <Pressable style={styles.primaryButton} onPress={() => void selectLibrary()}>
          <Text style={styles.primaryButtonText}>Selecionar biblioteca novamente</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nenhuma biblioteca configurada</Text>
      <Text style={styles.caption}>
        Selecione a pasta que representa sua biblioteca OPL (armazenamento interno, cartão SD ou
        um dispositivo USB conectado) para começar.
      </Text>
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
      <Pressable style={styles.primaryButton} onPress={() => void selectLibrary()}>
        <Text style={styles.primaryButtonText}>Selecionar biblioteca</Text>
      </Pressable>
    </View>
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.md
  },
  title: {
    color: colors.foreground,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight
  },
  caption: { color: colors.mutedForeground, fontSize: typography.body.fontSize },
  errorText: { color: colors.red, fontSize: typography.body.fontSize },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs
  },
  warningCard: { borderColor: colors.amber },
  label: { color: colors.mutedForeground, fontSize: typography.caption.fontSize },
  value: { color: colors.foreground, fontSize: typography.subtitle.fontSize },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center'
  },
  primaryButtonText: { color: colors.primaryForeground, fontSize: typography.body.fontSize, fontWeight: '600' },
  secondaryButton: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center'
  },
  secondaryButtonText: { color: colors.foreground, fontSize: typography.body.fontSize }
})
