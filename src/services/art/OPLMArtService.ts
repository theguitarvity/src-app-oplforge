import type { ArtAsset, ArtInstallResult } from '@/types/opl'

export interface OPLMArtService {
  indexArtPack(): Promise<ArtAsset[]>
  findByGameId(gameId: string): Promise<ArtAsset[]>
  installForGame(devicePath: string, gameId: string, title?: string): Promise<ArtInstallResult>
}

export const OPLM_ART_TYPES = ['ICO', 'SCR', 'SCR2', 'BG', 'LGO', 'COV', 'LAB', 'COV2'] as const
