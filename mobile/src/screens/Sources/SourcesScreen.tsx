import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { colors, radius, semanticColor, spacing, typography } from '../../design-system/tokens'
import * as GoogleDriveModule from '../../native/GoogleDriveModule'
import type { GoogleDriveFile, GoogleDriveStatus } from '../../native/GoogleDriveModule'

function formatSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024)
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`
}

/**
 * Google Drive as an import source — mirrors desktop's SourcesPage.tsx
 * Google Drive card: connect once (OAuth, read-only), then list/download
 * files straight into the selected library's DVD folder. Local-folder
 * import already exists on mobile via ImportGameButton (document picker),
 * so this screen is Drive-only rather than duplicating that flow.
 */
export function SourcesScreen() {
  const [status, setStatus] = useState<GoogleDriveStatus | undefined>()
  const [clientIdInput, setClientIdInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [files, setFiles] = useState<GoogleDriveFile[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | undefined>()

  const loadStatus = async () => {
    try {
      setStatus(await GoogleDriveModule.getStatus())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => {
    void loadStatus()
  }, [])

  async function handleSaveClientId() {
    setBusy(true)
    setError('')
    try {
      await GoogleDriveModule.saveClientId(clientIdInput)
      setClientIdInput('')
      await loadStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleConnect() {
    setBusy(true)
    setError('')
    try {
      await GoogleDriveModule.connect()
      await loadStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleDisconnect() {
    await GoogleDriveModule.disconnect()
    setFiles([])
    await loadStatus()
  }

  async function handleListFiles() {
    setListLoading(true)
    setError('')
    try {
      setFiles(await GoogleDriveModule.listFiles())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setListLoading(false)
    }
  }

  function handleDownload(file: GoogleDriveFile) {
    Alert.alert('Baixar jogo', `Baixar "${file.name}" para a pasta DVD da biblioteca?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Baixar',
        onPress: () => {
          setDownloadingId(file.id)
          void GoogleDriveModule.downloadFile(file.id, file.name)
            .then(() => Alert.alert('Concluído', `"${file.name}" foi baixado para a biblioteca.`))
            .catch((err) => setError(err instanceof Error ? err.message : String(err)))
            .finally(() => setDownloadingId(undefined))
        }
      }
    ])
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Google Drive</Text>
        <Text style={styles.headerSubtitle}>
          Conecte sua própria conta para importar backups direto do seu Google Drive — acesso somente leitura.
        </Text>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!status?.configured ? (
        <View style={styles.card}>
          <Text style={styles.label}>Client ID do Google (OAuth, tipo "Android")</Text>
          <Text style={styles.helpText}>
            Crie um projeto no Google Cloud Console, ative a Drive API e gere um Client ID tipo "Android" (pacote
            com.oplforge.mobile + SHA-1 de assinatura) — nenhum client secret é necessário.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="xxxxxxxxxxxx.apps.googleusercontent.com"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            value={clientIdInput}
            onChangeText={setClientIdInput}
          />
          <Pressable
            style={[styles.primaryButton, !clientIdInput.trim() || busy ? styles.disabled : null]}
            disabled={!clientIdInput.trim() || busy}
            onPress={() => void handleSaveClientId()}
          >
            <Text style={styles.primaryButtonText}>Salvar</Text>
          </Pressable>
        </View>
      ) : !status.connected ? (
        <Pressable style={[styles.primaryButton, busy ? styles.disabled : null]} disabled={busy} onPress={() => void handleConnect()}>
          {busy ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <>
              <MaterialIcons name="link" size={18} color={colors.primaryForeground} />
              <Text style={styles.primaryButtonText}>Conectar ao Google Drive</Text>
            </>
          )}
        </Pressable>
      ) : (
        <View style={styles.card}>
          <View style={styles.connectedRow}>
            <MaterialIcons name="cloud-done" size={18} color={semanticColor('active')} />
            <Text style={styles.connectedText}>Conectado</Text>
          </View>
          <View style={styles.actionsRow}>
            <Pressable style={styles.secondaryButton} onPress={() => void handleListFiles()} disabled={listLoading}>
              <Text style={styles.secondaryButtonText}>Listar arquivos</Text>
            </Pressable>
            <Pressable style={styles.dangerButton} onPress={() => void handleDisconnect()}>
              <MaterialIcons name="link-off" size={16} color={colors.destructiveForeground} />
              <Text style={styles.dangerButtonText}>Desconectar</Text>
            </Pressable>
          </View>
        </View>
      )}

      <FlatList
        data={files}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          listLoading ? (
            <ActivityIndicator color={colors.primary} style={styles.spinner} />
          ) : status?.connected ? (
            <Text style={styles.emptyText}>Toque em "Listar arquivos" para ver seus backups no Drive.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.fileRow}>
            <View style={styles.fileInfo}>
              <Text style={styles.fileName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.fileMeta}>{formatSize(item.size)}</Text>
            </View>
            <Pressable style={styles.downloadButton} onPress={() => handleDownload(item)} disabled={downloadingId === item.id}>
              {downloadingId === item.id ? (
                <ActivityIndicator color={colors.primaryForeground} size="small" />
              ) : (
                <MaterialIcons name="download" size={18} color={colors.primaryForeground} />
              )}
            </Pressable>
          </View>
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md, gap: spacing.md },
  header: { gap: spacing.xs },
  headerTitle: { color: colors.foreground, fontSize: typography.subtitle.fontSize, fontWeight: '700' },
  headerSubtitle: { color: colors.mutedForeground, fontSize: typography.caption.fontSize, lineHeight: 18 },
  error: { color: semanticColor('error'), fontSize: typography.caption.fontSize },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm
  },
  label: { color: colors.mutedForeground, fontSize: typography.caption.fontSize },
  helpText: { color: colors.mutedForeground, fontSize: typography.caption.fontSize, lineHeight: 16 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    color: colors.foreground,
    fontSize: typography.body.fontSize
  },
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
  connectedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  connectedText: { color: semanticColor('active'), fontSize: typography.body.fontSize, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: spacing.sm },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryButtonText: { color: colors.foreground, fontSize: typography.caption.fontSize, fontWeight: '600' },
  dangerButton: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.destructive,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  dangerButtonText: { color: colors.destructiveForeground, fontSize: typography.caption.fontSize, fontWeight: '600' },
  list: { paddingBottom: spacing.lg, gap: spacing.sm },
  spinner: { marginTop: spacing.xl },
  emptyText: { color: colors.mutedForeground, textAlign: 'center', marginTop: spacing.xl },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm
  },
  fileInfo: { flex: 1 },
  fileName: { color: colors.foreground, fontSize: typography.body.fontSize, fontWeight: '600' },
  fileMeta: { color: colors.mutedForeground, fontSize: typography.caption.fontSize },
  downloadButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center'
  }
})
