import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { colors, radius, semanticColor, spacing, typography } from '../../design-system/tokens'
import { useSharingStore } from '../../stores/sharing-store'
import type { RootStackParamList } from '../../app/App'

/**
 * US3 — Compartilhar a Biblioteca com o PS2 pela Rede Local. Credentials
 * form, a write-access consent step kept visually distinct from credentials
 * (FR-017/FR-018), start/stop control, and connection-details display
 * (spec Acceptance Scenarios 1–5).
 */
export function SharingScreen() {
  const { session, status, errorMessage, loadSession, saveCredentials, acknowledgeWriteAccess, startSharing, stopSharing } =
    useSharingStore()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [writeAccessRequested, setWriteAccessRequested] = useState(false)

  useEffect(() => {
    void loadSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isRunning = session?.state === 'running-idle' || session?.state === 'running-connected'
  const isConnected = session?.state === 'running-connected'

  if (isRunning) {
    return (
      <View style={styles.container}>
        <View style={[styles.card, { borderColor: isConnected ? semanticColor('active') : colors.border }]}>
          <Text style={[styles.label, isConnected && { color: semanticColor('active') }]}>
            {isConnected ? 'PS2 conectado' : 'Compartilhando, aguardando conexão'}
          </Text>
          <Text style={styles.body}>Endereço: {session?.boundAddress}</Text>
          <Text style={styles.body}>Porta: {session?.port}</Text>
          <Text style={styles.body}>Compartilhamento: {session?.shareName}</Text>
        </View>
        <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('Tutorial')}>
          <Text style={styles.secondaryButtonText}>Ver tutorial de configuração do PS2</Text>
        </Pressable>
        <Pressable style={styles.dangerButton} onPress={() => void stopSharing()} disabled={status === 'busy'}>
          <Text style={styles.dangerButtonText}>Parar compartilhamento</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Compartilhar biblioteca</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Usuário e senha do compartilhamento</Text>
        <TextInput
          style={styles.input}
          placeholder="Usuário"
          placeholderTextColor={colors.mutedForeground}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Senha"
          placeholderTextColor={colors.mutedForeground}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />
        <Pressable
          style={styles.secondaryButton}
          onPress={() => void saveCredentials(username, password)}
          disabled={!username || !password}
        >
          <Text style={styles.secondaryButtonText}>
            {session?.hasCredentials ? 'Atualizar credenciais' : 'Definir credenciais'}
          </Text>
        </Pressable>
      </View>

      {/* Write-access consent is a distinct step from credentials (FR-018) */}
      <View style={[styles.card, styles.warningCard]}>
        <Text style={styles.label}>Acesso de escrita do PS2</Text>
        <Text style={styles.body}>
          O PS2 poderá criar, modificar e sobrescrever arquivos na sua biblioteca local pela rede.
        </Text>
        <Pressable
          style={styles.checkboxRow}
          onPress={() => setWriteAccessRequested(!writeAccessRequested)}
        >
          <View style={[styles.checkbox, writeAccessRequested && styles.checkboxChecked]} />
          <Text style={styles.body}>Estou ciente e autorizo</Text>
        </Pressable>
        {writeAccessRequested && !session?.writeAccessAcknowledgedAt ? (
          <Pressable style={styles.secondaryButton} onPress={() => void acknowledgeWriteAccess()}>
            <Text style={styles.secondaryButtonText}>Confirmar</Text>
          </Pressable>
        ) : null}
        {session?.writeAccessAcknowledgedAt ? (
          <Text style={[styles.body, { color: semanticColor('success') }]}>Confirmado</Text>
        ) : null}
      </View>

      {errorMessage ? (
        <View style={[styles.card, { borderColor: semanticColor('error') }]}>
          <Text style={styles.body}>{errorMessage}</Text>
        </View>
      ) : null}

      <Pressable
        style={styles.primaryButton}
        onPress={() => void startSharing()}
        disabled={status === 'busy' || !session?.hasCredentials}
      >
        {status === 'busy' ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={styles.primaryButtonText}>Iniciar compartilhamento</Text>
        )}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg, gap: spacing.md },
  title: {
    color: colors.foreground,
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm
  },
  warningCard: { borderColor: colors.amber },
  label: { color: colors.mutedForeground, fontSize: typography.caption.fontSize },
  body: { color: colors.foreground, fontSize: typography.body.fontSize },
  input: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    color: colors.foreground
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  checkbox: { width: 20, height: 20, borderRadius: radius.sm / 2, borderWidth: 1, borderColor: colors.border },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
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
  secondaryButtonText: { color: colors.foreground, fontSize: typography.body.fontSize },
  dangerButton: {
    backgroundColor: colors.destructive,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center'
  },
  dangerButtonText: { color: colors.destructiveForeground, fontSize: typography.body.fontSize, fontWeight: '600' }
})
