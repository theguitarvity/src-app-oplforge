import { Alert } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { useTranslation } from 'react-i18next'
import { useTransferStore } from '../../stores/transfer-store'
import { ActionRow } from '../../components/ActionRow'

/**
 * US2 — Adicionar Jogos (import local). Opens the system document picker,
 * enqueues the chosen file as a `kind: import` transfer. A duplicate result
 * (spec 008 FR-009) prompts the user to overwrite instead of silently
 * blocking or silently replacing.
 */
export function ImportGameButton() {
  const { t } = useTranslation()
  const enqueueImport = useTransferStore((state) => state.enqueueImport)

  const handlePress = async () => {
    const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: false })
    if (picked.canceled || picked.assets.length === 0) return
    const sourceUri = picked.assets[0].uri

    const result = await enqueueImport(sourceUri)
    if (result.status === 'duplicate') {
      Alert.alert(
        t('importGameButton.duplicateTitle'),
        t('importGameButton.duplicateMessage', { fileName: result.fileName }),
        [
          { text: t('importGameButton.cancel'), style: 'cancel' },
          { text: t('importGameButton.overwrite'), style: 'destructive', onPress: () => void enqueueImport(sourceUri, '', true) }
        ]
      )
    }
  }

  return (
    <ActionRow
      icon="upload-file"
      label={t('importGameButton.addGames')}
      subtitle={t('importGameButton.localFile')}
      onPress={() => void handlePress()}
    />
  )
}
