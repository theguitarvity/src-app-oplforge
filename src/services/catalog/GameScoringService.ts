import ratings from '@/data/game-ratings.seed.json'
import type { ArchiveDirectoryFile, CatalogGame, GamePriority, GameRatingSeed, GameScoreTier, SourceLegalMode } from '@/types/opl'

const ratingSeed = ratings as GameRatingSeed[]

export function normalizeGameTitle(value: string) {
  return value
    .replace(/\.(iso|bin|cue|7z|zip|torrent)$/i, '')
    .replace(/\b(SLUS|SCUS|SLES|SCES|SLPM|SLPS|SLKA|SCAJ)[-_ ]?\d{3}[._-]?\d{2}\b/gi, '')
    .replace(/\((usa|europe|japan|brazil|pal|ntsc|disc \d+|cd|dvd).*?\)/gi, '')
    .replace(/\[(.*?)\]/g, ' ')
    .replace(/[_.,-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function similarity(a: string, b: string) {
  const aWords = new Set(a.split(' ').filter(Boolean))
  const bWords = new Set(b.split(' ').filter(Boolean))
  const intersection = [...aWords].filter((word) => bWords.has(word)).length
  const union = new Set([...aWords, ...bWords]).size
  return union === 0 ? 0 : intersection / union
}

function findRating(normalizedTitle: string) {
  let best: { seed: GameRatingSeed; similarity: number } | null = null
  for (const seed of ratingSeed) {
    const match = similarity(normalizedTitle, seed.normalizedTitle)
    if (!best || match > best.similarity) best = { seed, similarity: match }
  }
  return best && best.similarity >= 0.6 ? best.seed : null
}

function priorityWeight(priority: GamePriority) {
  if (priority === 'must-have') return 6
  if (priority === 'recommended') return 3
  if (priority === 'optional') return 1
  return 0
}

function sizePenalty(sizeBytes?: number) {
  if (!sizeBytes) return 0
  const gb = sizeBytes / 1024 ** 3
  return Math.min(Math.max(gb - 4, 0), 8)
}

function tierFromScore(score?: number): GameScoreTier {
  if (score === undefined) return 'Unrated'
  if (score >= 95) return 'S'
  if (score >= 88) return 'A'
  if (score >= 78) return 'B'
  return 'C'
}

export function scoreArchiveFile(
  file: ArchiveDirectoryFile,
  sourceId = 'ia-playstation2-essentials',
  legalMode: SourceLegalMode = 'user-owned-backup-required',
  torrentUrl?: string
): CatalogGame {
  const normalizedTitle = normalizeGameTitle(file.name)
  const seed = findRating(normalizedTitle)
  const baseScore = seed?.score
  const finalScore =
    baseScore === undefined
      ? undefined
      : Math.round(baseScore + priorityWeight(seed?.priority ?? 'unrated') - sizePenalty(file.sizeBytes))

  return {
    id: file.id,
    title: normalizedTitle.replace(/\b\w/g, (letter) => letter.toUpperCase()),
    normalizedTitle,
    fileName: file.name,
    url: file.url,
    torrentUrl,
    sizeBytes: file.sizeBytes,
    mediaType: file.mediaType,
    score: finalScore,
    scoreTier: tierFromScore(finalScore),
    genres: seed?.genres ?? [],
    priority: seed?.priority ?? 'unrated',
    matchedSeed: seed?.normalizedTitle,
    sourceId,
    legalMode
  }
}

export function sortCatalogGames(games: CatalogGame[]) {
  return [...games].sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || (a.sizeBytes ?? 0) - (b.sizeBytes ?? 0))
}
