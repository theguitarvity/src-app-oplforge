/**
 * OPL Forge design tokens — "Forge Dark", the design system shared with the
 * desktop app and defined in the project's Stitch workspace ("OPL Forge UX
 * Redesign"). Dark-only: there is no light-theme variant, on either platform.
 */

export const colors = {
  background: '#0F0D13',
  foreground: '#FFFFFF',
  card: '#14121A',
  cardForeground: '#FFFFFF',
  muted: '#1A1625',
  mutedForeground: '#A099B0',
  border: '#2D2938',
  primary: '#8B5CF6',
  primaryForeground: '#FFFFFF',
  destructive: '#DC2626',
  destructiveForeground: '#FFFFFF',
  emerald: '#34D399',
  amber: '#FBBF24',
  red: '#F87171',
  fuchsia: '#E879F9',
  cyan: '#22D3EE'
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32
} as const

export const radius = {
  sm: 8,
  md: 12,
  lg: 16
} as const

export const typography = {
  fontFamily: 'Inter',
  title: { fontSize: 22, fontWeight: '600' as const },
  subtitle: { fontSize: 16, fontWeight: '500' as const },
  body: { fontSize: 14, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '400' as const }
} as const

/**
 * Semantic status colors driving Home/Sharing state indicators (spec FR-025).
 * Mirrors desktop's emerald=success/active, amber=warning, red=error convention.
 */
export type SemanticStatus = 'neutral' | 'success' | 'warning' | 'error' | 'active'

export function semanticColor(status: SemanticStatus): string {
  switch (status) {
    case 'success':
    case 'active':
      return colors.emerald
    case 'warning':
      return colors.amber
    case 'error':
      return colors.red
    case 'neutral':
    default:
      return colors.mutedForeground
  }
}
