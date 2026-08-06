import type { CatalogItem } from '@/types/opl'
export function generateCatalogItems(count = 500): CatalogItem[] {
  return Array.from({ length: count }, (_, index) => ({
    itemId: `item-${index}`,
    kind: 'game',
    title: `Synthetic Game ${String(index).padStart(3, '0')}`,
    gameId: `SLUS_${String(index).padStart(3, '0')}.00`,
    gameIdSource: 'filename',
    mediaType: 'DVD',
    installFormat: 'ISO',
    relativePath: `DVD/game-${index}.iso`,
    files: [],
    totalBytes: 1024,
    structuralIntegrity: 'verified',
    hashState: 'not-calculated',
    fragmentation: 'contiguous',
    artStatus: 'cover-ready',
    compatibility: 'verified',
    classification: 'ready',
    findings: []
  }))
}
