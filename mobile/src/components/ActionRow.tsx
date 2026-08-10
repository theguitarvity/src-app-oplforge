import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { colors, radius, spacing, typography } from '../design-system/tokens'

interface ActionRowProps {
  icon: keyof typeof MaterialIcons.glyphMap
  label: string
  subtitle?: string
  onPress: () => void
  tone?: 'primary' | 'default'
  disabled?: boolean
  trailing?: ReactNode
}

/**
 * Icon-circle + label (+ optional subtitle) row, matching Home's suggestion-
 * card and quick-access tile language — the shared "action row" pattern used
 * across Configurações/Essentials wherever a plain outlined button used to
 * stand in for it.
 */
export function ActionRow({ icon, label, subtitle, onPress, tone = 'default', disabled, trailing }: ActionRowProps) {
  const iconColor = tone === 'primary' ? colors.primaryForeground : colors.primary
  return (
    <Pressable
      style={[styles.row, tone === 'primary' ? styles.primaryRow : null, disabled ? styles.disabled : null]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={[styles.iconWrap, tone === 'primary' ? styles.primaryIconWrap : null]}>
        <MaterialIcons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.label, tone === 'primary' ? styles.primaryLabel : null]}>{label}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, tone === 'primary' ? styles.primarySubtitle : null]}>{subtitle}</Text>
        ) : null}
      </View>
      {trailing ?? (
        <MaterialIcons
          name="chevron-right"
          size={22}
          color={tone === 'primary' ? colors.primaryForeground : colors.mutedForeground}
        />
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.card
  },
  primaryRow: { backgroundColor: colors.primary, borderColor: colors.primary },
  disabled: { opacity: 0.5 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.primary}33`
  },
  primaryIconWrap: { backgroundColor: 'rgba(255,255,255,0.2)' },
  textWrap: { flex: 1 },
  label: { color: colors.foreground, fontSize: typography.body.fontSize, fontWeight: '600' },
  primaryLabel: { color: colors.primaryForeground },
  subtitle: { color: colors.mutedForeground, fontSize: typography.caption.fontSize, marginTop: 2 },
  primarySubtitle: { color: 'rgba(255,255,255,0.8)' }
})
