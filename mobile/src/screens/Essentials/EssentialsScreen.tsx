import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { colors } from '../../design-system/tokens'
import { SegmentedTabs, type SegmentedTabOption } from '../../components/SegmentedTabs'
import { EssentialsCatalogTab } from './EssentialsCatalogTab'
import { SmartFillSheet } from './SmartFillSheet'
import { TransfersScreen } from '../Transfers/TransfersScreen'

type EssentialsTab = 'catalog' | 'smartfill' | 'downloads'

const TABS: SegmentedTabOption<EssentialsTab>[] = [
  { key: 'catalog', label: 'Catálogo' },
  { key: 'smartfill', label: 'Smart Fill' },
  { key: 'downloads', label: 'Downloads' }
]

/**
 * US1 — Descobrir e Instalar do Catálogo Essentials. Tabbed shell (Catálogo /
 * Smart Fill / Downloads) so the whole discover-plan-track flow stays on one
 * screen rather than pushing/popping between three — closer to how the
 * desktop app keeps catalog, plan, and queue in view together.
 */
export function EssentialsScreen() {
  const [tab, setTab] = useState<EssentialsTab>('catalog')

  return (
    <View style={styles.container}>
      <SegmentedTabs options={TABS} value={tab} onChange={setTab} />
      <View style={styles.content}>
        {tab === 'catalog' ? <EssentialsCatalogTab /> : null}
        {tab === 'smartfill' ? <SmartFillSheet /> : null}
        {tab === 'downloads' ? <TransfersScreen /> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1 }
})
