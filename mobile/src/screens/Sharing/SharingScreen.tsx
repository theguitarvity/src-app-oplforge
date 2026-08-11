import { useEffect, useState } from 'react'
import { Animated, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { colors, radius, semanticColor, spacing, typography } from '../../design-system/tokens'
import { useSharingStore } from '../../stores/sharing-store'
import type { RootStackParamList } from '../../app/App'

const DEFAULT_SHARE_NAME = 'oplforge'

const LOG_KIND_ICON: Record<string, keyof typeof MaterialIcons.glyphMap> = {
  'state-changed': 'sync',
  'client-connected': 'link',
  'client-disconnected': 'link-off',
  'write-conflict': 'warning'
}

/** Centered network icon — a steady purple glow while sharing/idle, a pulsing green neon glow once the PS2 actually connects, muted gray when off. */
function NetworkHero({ isRunning, isConnected }: { isRunning: boolean; isConnected: boolean }) {
  const [pulse] = useState(() => new Animated.Value(0))

  useEffect(() => {
    if (!isConnected) {
      pulse.setValue(0)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true })
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [isConnected, pulse])

  const color = isConnected ? semanticColor('active') : isRunning ? colors.primary : colors.mutedForeground
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.8] })
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] })

  return (
    <View style={styles.heroWrap}>
      {isConnected ? (
        <Animated.View
          style={[styles.heroGlow, { backgroundColor: color, opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
        />
      ) : null}
      <View style={[styles.heroCircle, { borderColor: color, backgroundColor: `${color}22` }]}>
        <MaterialIcons name="wifi-tethering" size={40} color={color} />
      </View>
    </View>
  )
}

/**
 * US3 — Compartilhar a Biblioteca com o PS2 pela Rede Local. Single-tap
 * activation (credentials + write-access consent + start, all in one action)
 * instead of a two-step "definir credenciais" then "iniciar" flow, with a
 * centered network hero that lights up green once the PS2 actually connects.
 */
export function SharingScreen() {
  const { session, status, errorMessage, logs, clearLogs, recentConnections, loadRecentConnections, loadSession, stopSharing, activate } =
    useSharingStore()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [shareName, setShareName] = useState('')
  const [writeAccessRequested, setWriteAccessRequested] = useState(false)
  const [showValidation, setShowValidation] = useState(false)
  const [shake] = useState(() => new Animated.Value(0))

  useEffect(() => {
    void loadSession()
    void loadRecentConnections()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function applyRecentConnection(entry: { username: string; shareName: string }) {
    setUsername(entry.username)
    setShareName(entry.shareName)
    setShowValidation(false)
  }

  const isRunning = session?.state === 'running-idle' || session?.state === 'running-connected'
  const isConnected = session?.state === 'running-connected'
  const isBusy = status === 'busy'

  const usernameInvalid = showValidation && !username
  const passwordInvalid = showValidation && !password
  const writeAccessInvalid = showValidation && !writeAccessRequested

  function runShake() {
    shake.setValue(0)
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true })
    ]).start()
  }

  function handleActivatePress() {
    if (isBusy) return
    if (!username || !password || !writeAccessRequested) {
      setShowValidation(true)
      runShake()
      return
    }
    void activate(username, password, shareName, writeAccessRequested)
  }

  const shakeTranslate = shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] })

  if (isRunning) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <NetworkHero isRunning={isRunning} isConnected={isConnected} />
        <View style={[styles.card, { borderColor: isConnected ? semanticColor('active') : colors.border }]}>
          <Text style={[styles.label, isConnected ? { color: semanticColor('active') } : null]}>
            {isConnected ? 'PS2 conectado' : 'Compartilhando, aguardando conexão'}
          </Text>
          <View style={styles.infoRow}>
            <MaterialIcons name="lan" size={16} color={colors.mutedForeground} />
            <Text style={styles.body}>{session?.boundAddress}:{session?.port}</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="folder-shared" size={16} color={colors.mutedForeground} />
            <Text style={styles.body}>{session?.shareName}</Text>
          </View>
        </View>
        <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('Tutorial')}>
          <MaterialIcons name="help-outline" size={18} color={colors.foreground} />
          <Text style={styles.secondaryButtonText}>Ver tutorial de configuração do PS2</Text>
        </Pressable>
        <Pressable style={styles.dangerButton} onPress={() => void stopSharing()} disabled={isBusy}>
          <MaterialIcons name="stop-circle" size={18} color={colors.destructiveForeground} />
          <Text style={styles.dangerButtonText}>Parar compartilhamento</Text>
        </Pressable>

        <View style={styles.logsHeader}>
          <Text style={styles.logsTitle}>Log de conexão</Text>
          {logs.length > 0 ? (
            <Pressable onPress={clearLogs} hitSlop={8}>
              <Text style={styles.logsClear}>Limpar</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.logsCard}>
          {logs.length === 0 ? (
            <Text style={styles.logsEmpty}>Nenhum evento ainda.</Text>
          ) : (
            logs.map((entry) => (
              <View key={entry.id} style={styles.logRow}>
                <MaterialIcons name={LOG_KIND_ICON[entry.kind] ?? 'info-outline'} size={14} color={colors.mutedForeground} />
                <View style={styles.logTextWrap}>
                  <Text style={styles.logMessage}>{entry.message}</Text>
                  <Text style={styles.logTimestamp}>{new Date(entry.timestamp).toLocaleTimeString()}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <NetworkHero isRunning={false} isConnected={false} />
      <Text style={styles.title}>Compartilhar biblioteca</Text>
      <Text style={styles.subtitle}>Defina as credenciais, confirme o acesso de escrita e comece — em um único passo.</Text>

      {recentConnections.length > 0 ? (
        <View style={styles.recentCard}>
          <Text style={styles.label}>Últimas conexões</Text>
          {recentConnections.map((entry) => (
            <Pressable
              key={`${entry.username}:${entry.shareName}`}
              style={styles.recentRow}
              onPress={() => applyRecentConnection(entry)}
            >
              <MaterialIcons name="history" size={18} color={colors.mutedForeground} />
              <View style={styles.recentTextWrap}>
                <Text style={styles.recentUsername}>{entry.username}</Text>
                <Text style={styles.recentShareName}>{entry.shareName}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </View>
      ) : null}

      <Animated.View style={{ transform: [{ translateX: shakeTranslate }] }}>
        <View style={styles.card}>
          <Text style={styles.label}>Credenciais do compartilhamento</Text>
          <View style={[styles.inputWrap, usernameInvalid ? styles.inputWrapInvalid : null]}>
            <MaterialIcons name="person" size={18} color={usernameInvalid ? semanticColor('error') : colors.mutedForeground} />
            <TextInput
              style={styles.input}
              placeholder="Usuário"
              placeholderTextColor={colors.mutedForeground}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>
          <View style={[styles.inputWrap, passwordInvalid ? styles.inputWrapInvalid : null]}>
            <MaterialIcons name="lock" size={18} color={passwordInvalid ? semanticColor('error') : colors.mutedForeground} />
            <TextInput
              style={styles.input}
              placeholder="Senha"
              placeholderTextColor={colors.mutedForeground}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>
          <View style={styles.inputWrap}>
            <MaterialIcons name="folder-shared" size={18} color={colors.mutedForeground} />
            <TextInput
              style={styles.input}
              placeholder={`Nome do compartilhamento (padrão: ${DEFAULT_SHARE_NAME})`}
              placeholderTextColor={colors.mutedForeground}
              value={shareName}
              onChangeText={setShareName}
              autoCapitalize="none"
            />
          </View>
          {usernameInvalid || passwordInvalid ? (
            <Text style={styles.fieldErrorText}>Usuário e senha são obrigatórios.</Text>
          ) : null}
        </View>

        {/* Write-access consent is a distinct step from credentials (FR-018) */}
        <View style={[styles.card, styles.warningCard, writeAccessInvalid ? styles.cardInvalid : null]}>
          <Text style={styles.label}>Acesso de escrita do PS2</Text>
          <Text style={styles.body}>
            O PS2 poderá criar, modificar e sobrescrever arquivos na sua biblioteca local pela rede.
          </Text>
          <Pressable style={styles.checkboxRow} onPress={() => setWriteAccessRequested(!writeAccessRequested)}>
            <View
              style={[
                styles.checkbox,
                writeAccessRequested ? styles.checkboxChecked : null,
                writeAccessInvalid ? styles.checkboxInvalid : null
              ]}
            >
              {writeAccessRequested ? <MaterialIcons name="check" size={14} color={colors.primaryForeground} /> : null}
            </View>
            <Text style={styles.body}>Estou ciente e autorizo</Text>
          </Pressable>
          {writeAccessInvalid ? (
            <Text style={styles.fieldErrorText}>Confirme o acesso de escrita antes de compartilhar.</Text>
          ) : null}
        </View>
      </Animated.View>

      {errorMessage ? (
        <View style={[styles.card, { borderColor: semanticColor('error') }]}>
          <Text style={styles.body}>{errorMessage}</Text>
        </View>
      ) : null}

      <Pressable style={[styles.primaryButton, isBusy ? styles.disabled : null]} onPress={handleActivatePress} disabled={isBusy}>
        {isBusy ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <>
            <MaterialIcons name="wifi-tethering" size={20} color={colors.primaryForeground} />
            <Text style={styles.primaryButtonText}>Iniciar compartilhamento</Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, alignItems: 'stretch', paddingBottom: spacing.xl },
  title: { color: colors.foreground, fontSize: typography.title.fontSize, fontWeight: typography.title.fontWeight },
  subtitle: { color: colors.mutedForeground, fontSize: typography.body.fontSize },
  heroWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, height: 96 },
  heroGlow: { position: 'absolute', width: 96, height: 96, borderRadius: 999 },
  heroCircle: {
    width: 80,
    height: 80,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center'
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
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    height: 44
  },
  input: { flex: 1, color: colors.foreground, fontSize: typography.body.fontSize, padding: 0 },
  inputWrapInvalid: { borderColor: semanticColor('error') },
  cardInvalid: { borderColor: semanticColor('error') },
  fieldErrorText: { color: semanticColor('error'), fontSize: typography.caption.fontSize },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxInvalid: { borderColor: semanticColor('error') },
  disabled: { opacity: 0.5 },
  primaryButton: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryButtonText: { color: colors.primaryForeground, fontSize: typography.body.fontSize, fontWeight: '700' },
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
  dangerButton: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.destructive,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center'
  },
  dangerButtonText: { color: colors.destructiveForeground, fontSize: typography.body.fontSize, fontWeight: '600' },
  logsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm
  },
  logsTitle: { color: colors.foreground, fontSize: typography.body.fontSize, fontWeight: '700' },
  logsClear: { color: colors.primary, fontSize: typography.caption.fontSize, fontWeight: '600' },
  logsCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm
  },
  logsEmpty: { color: colors.mutedForeground, fontSize: typography.caption.fontSize },
  logRow: { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' },
  logTextWrap: { flex: 1 },
  logMessage: { color: colors.foreground, fontSize: typography.caption.fontSize },
  logTimestamp: { color: colors.mutedForeground, fontSize: 10, marginTop: 1 },
  recentCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs
  },
  recentTextWrap: { flex: 1 },
  recentUsername: { color: colors.foreground, fontSize: typography.body.fontSize, fontWeight: '600' },
  recentShareName: { color: colors.mutedForeground, fontSize: typography.caption.fontSize }
})
