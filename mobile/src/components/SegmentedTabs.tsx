import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radius, spacing, typography } from '../design-system/tokens'

export interface SegmentedTabOption<T extends string> {
  key: T
  label: string
}

interface SegmentedTabsProps<T extends string> {
  options: SegmentedTabOption<T>[]
  value: T
  onChange: (value: T) => void
}

/**
 * Lightweight in-screen tab switcher — no extra native dependency (no
 * `react-native-tab-view`/`pager-view`), just a segmented pill row plus
 * conditional rendering by the caller. Used for the Essentials screen's
 * Catálogo / Smart Fill / Downloads tabs.
 */
export function SegmentedTabs<T extends string>({ options, value, onChange }: SegmentedTabsProps<T>) {
  return (
    <View style={styles.row}>
      {options.map((option) => {
        const active = option.key === value
        return (
          <Pressable
            key={option.key}
            style={[styles.tab, active ? styles.tabActive : null]}
            onPress={() => onChange(option.key)}
          >
            <Text style={[styles.tabText, active ? styles.tabTextActive : null]}>{option.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm
  },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: colors.primary },
  tabText: { color: colors.mutedForeground, fontSize: typography.caption.fontSize, fontWeight: '600' },
  tabTextActive: { color: colors.primaryForeground }
})
