import { useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { semanticColor, spacing, typography } from '../../design-system/tokens'
import { useTransferStore } from '../../stores/transfer-store'
import { TransferModuleError } from '../../native/TransferModule'
import { ActionRow } from '../../components/ActionRow'

/**
 * US2 — Adicionar Jogos (import local). Opens the system document picker,
 * enqueues the chosen file as a `kind: import` transfer. A `DUPLICATE_ITEM`
 * rejection surfaces as an inline warning rather than a silent block
 * (spec 008 FR-009) — the button doesn't retry on its own; the user decides.
 */
export function ImportGameButton() {
  const enqueueImport = useTransferStore((state) => state.enqueueImport)
  const [duplicateWarning, setDuplicateWarning] = useState<string | undefined>(undefined)

  const handlePress = async () => {
    setDuplicateWarning(undefined)
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: false })
    if (result.canceled || result.assets.length === 0) return

    try {
      await enqueueImport(result.assets[0].uri)
    } catch (error) {
      if (error instanceof TransferModuleError && error.code === 'DUPLICATE_ITEM') {
        setDuplicateWarning(error.message)
      } else {
        throw error
      }
    }
  }

  return (
    <>
      <ActionRow icon="upload-file" label="Adicionar jogos" subtitle="Arquivo local" onPress={() => void handlePress()} />
      {duplicateWarning ? <Text style={styles.warning}>{duplicateWarning}</Text> : null}
    </>
  )
}

const styles = StyleSheet.create({
  warning: { color: semanticColor('warning'), fontSize: typography.caption.fontSize, marginTop: spacing.xs }
})
