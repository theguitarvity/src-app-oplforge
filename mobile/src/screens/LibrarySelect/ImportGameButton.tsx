import { Alert } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { useTransferStore } from '../../stores/transfer-store'
import { ActionRow } from '../../components/ActionRow'

/**
 * US2 — Adicionar Jogos (import local). Opens the system document picker,
 * enqueues the chosen file as a `kind: import` transfer. A duplicate result
 * (spec 008 FR-009) prompts the user to overwrite instead of silently
 * blocking or silently replacing.
 */
export function ImportGameButton() {
  const enqueueImport = useTransferStore((state) => state.enqueueImport)

  const handlePress = async () => {
    const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: false })
    if (picked.canceled || picked.assets.length === 0) return
    const sourceUri = picked.assets[0].uri

    const result = await enqueueImport(sourceUri)
    if (result.status === 'duplicate') {
      Alert.alert(
        'Título já existe',
        `"${result.fileName}" já está na biblioteca. Sobrescrever substitui o arquivo existente permanentemente.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Sobrescrever', style: 'destructive', onPress: () => void enqueueImport(sourceUri, '', true) }
        ]
      )
    }
  }

  return <ActionRow icon="upload-file" label="Adicionar jogos" subtitle="Arquivo local" onPress={() => void handlePress()} />
}
