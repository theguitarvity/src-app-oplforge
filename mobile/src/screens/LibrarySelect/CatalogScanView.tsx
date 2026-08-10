import { useEffect } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { colors, radius, semanticColor, spacing, typography } from '../../design-system/tokens'
import { useCatalogStore } from '../../stores/catalog-store'
import type { RootStackParamList } from '../../app/App'
import { ImportGameButton } from './ImportGameButton'

/**
 * US2 — Catalogar e Validar a Biblioteca Selecionada. Progress, cancel,
 * per-type counts, and non-destructive issue summary (spec Acceptance
 * Scenarios 1–4).
 */
export function CatalogScanView() {
  const { snapshot, status, errorMessage, startScan, cancelScan, loadLatest } = useCatalogStore()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  useEffect(() => {
    void loadLatest()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (status === 'scanning') {
    const total =
      (snapshot?.countsByType.dvd ?? 0) +
      (snapshot?.countsByType.cd ?? 0) +
      (snapshot?.countsByType.ps1 ?? 0) +
      (snapshot?.countsByType.app ?? 0)
    return (
      <View style={styles.card}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.body}>Catalogando... {total} itens encontrados até agora.</Text>
        <Pressable style={styles.secondaryButton} onPress={() => void cancelScan()}>
          <Text style={styles.secondaryButtonText}>Cancelar</Text>
        </Pressable>
      </View>
    )
  }

  if (status === 'error') {
    return (
      <View style={[styles.card, { borderColor: semanticColor('error') }]}>
        <Text style={styles.body}>{errorMessage ?? 'Falha ao catalogar a biblioteca.'}</Text>
        <Pressable style={styles.primaryButton} onPress={() => void startScan()}>
          <Text style={styles.primaryButtonText}>Tentar novamente</Text>
        </Pressable>
      </View>
    )
  }

  if (status === 'ready' && snapshot) {
    const { countsByType, issueCount } = snapshot
    const total = countsByType.dvd + countsByType.cd + countsByType.ps1 + countsByType.app
    return (
      <View style={styles.card}>
        {total === 0 ? (
          <Text style={styles.body}>
            Nenhum jogo reconhecido. Verifique se a pasta contém as pastas DVD, CD, PS1 ou APPS.
          </Text>
        ) : (
          <>
            <Text style={styles.label}>Biblioteca catalogada</Text>
            <Text style={styles.body}>
              DVD: {countsByType.dvd} · CD: {countsByType.cd} · PS1: {countsByType.ps1} · Apps:{' '}
              {countsByType.app}
            </Text>
            {issueCount > 0 ? (
              <Text style={[styles.body, { color: semanticColor('warning') }]}>
                {issueCount} item(ns) precisam de atenção
              </Text>
            ) : (
              <Text style={[styles.body, { color: semanticColor('success') }]}>
                Nenhum problema encontrado
              </Text>
            )}
          </>
        )}
        {total > 0 ? (
          <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('Sharing')}>
            <Text style={styles.primaryButtonText}>Compartilhar com o PS2</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('Essentials')}>
          <Text style={styles.secondaryButtonText}>Adicionar jogos (Catálogo Essentials)</Text>
        </Pressable>
        <ImportGameButton />
        <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('Diagnostics')}>
          <Text style={styles.secondaryButtonText}>Diagnóstico do dispositivo</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => void startScan()}>
          <Text style={styles.secondaryButtonText}>Catalogar novamente</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.card}>
      <Text style={styles.body}>A biblioteca ainda não foi catalogada.</Text>
      <Pressable style={styles.primaryButton} onPress={() => void startScan()}>
        <Text style={styles.primaryButtonText}>Catalogar biblioteca</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('Essentials')}>
        <Text style={styles.secondaryButtonText}>Adicionar jogos (Catálogo Essentials)</Text>
      </Pressable>
      <ImportGameButton />
      <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('Diagnostics')}>
        <Text style={styles.secondaryButtonText}>Diagnóstico do dispositivo</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
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
