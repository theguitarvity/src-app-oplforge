export type GameContentType = 'PS2' | 'PS1' | 'APP'
export type GameStatusBadge =
  'ready' | 'needs_attention' | 'fragmented' | 'invalid_name' | 'validation_warning'

export interface UnifiedGameItem {
  id: string
  title: string
  gameId: string
  type: GameContentType
  region?: string
  format?: string
  sizeBytes?: number
  filePath: string
  status: GameStatusBadge
  isFragmented?: boolean
  fragmentCount?: number
  hasCoverArt?: boolean
  hasBackgroundArt?: boolean
  coverUrl?: string
  crcHash?: string
}
