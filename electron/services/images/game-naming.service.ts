import path from 'node:path'

export const GAME_ID_PATTERN = /([A-Za-z]{4})[-_ ]?([0-9]{3})[. ]?([0-9]{2})/

export function normalizeGameId(value: string): string | null {
  const match = value.match(GAME_ID_PATTERN)
  return match ? `${match[1].toUpperCase()}_${match[2]}.${match[3]}` : null
}

export function sanitizeOplTitle(value: string, maxBytes = 64): string {
  const cleaned =
    [...value.normalize('NFKD')]
      .map((character) =>
        character.charCodeAt(0) < 32 ||
        character.charCodeAt(0) > 126 ||
        '<>:"/\\|?*'.includes(character)
          ? ' '
          : character
      )
      .join('')
      .replace(/\s+/g, ' ')
      .trim() || 'Untitled'
  let output = cleaned
  while (Buffer.byteLength(output, 'utf8') > maxBytes) output = output.slice(0, -1)
  return output.replace(/[. ]+$/, '') || 'Untitled'
}

export function canonicalGameName(gameId: string, title: string, extension: 'iso' | 'zso'): string {
  const normalized = normalizeGameId(gameId)
  if (!normalized) throw Object.assign(new Error('Invalid Game ID'), { code: 'INVALID_GAME_ID' })
  return `${normalized}.${sanitizeOplTitle(title, 32)}.${extension.toLowerCase()}`
}

export function planCanonicalGameName(
  gameId: string,
  title: string,
  extension: string,
  existingNames: string[] = []
): { fileName: string; collision?: string } {
  const normalizedExtension = extension.toLowerCase()
  if (normalizedExtension !== 'iso' && normalizedExtension !== 'zso')
    throw Object.assign(new Error('Invalid OPL image extension'), { code: 'UNSUPPORTED_FORMAT' })
  const fileName = canonicalGameName(gameId, title, normalizedExtension)
  const collision = existingNames.find(
    (existing) => existing.toLocaleLowerCase('en-US') === fileName.toLocaleLowerCase('en-US')
  )
  return collision ? { fileName, collision } : { fileName }
}

export function mediaDirectory(media: 'CD' | 'DVD'): string {
  return path.posix.join('/', media)
}
