import type { GameLibrary, GameLibraryEntry } from '@/types/opl'

export interface GameIdService {
  detectGameId(filePathOrName: string): Promise<string | null>
  saveMapping(entry: GameLibraryEntry): Promise<GameLibraryEntry>
  getLibrary(): Promise<GameLibrary>
}

export function detectGameIdFromName(value: string): string | null {
  const match = value.match(/\b(SLUS|SCUS|SLES|SCES|SLPM|SLPS|SLKA|SCAJ)[-_ ]?(\d{3})[._-]?(\d{2})\b/i)
  if (!match) return null
  return `${match[1].toUpperCase()}_${match[2]}.${match[3]}`
}
