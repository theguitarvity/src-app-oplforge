import { app } from 'electron'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { GameLibrary, GameLibraryEntry } from '../../../src/types/opl'
import { detectGameIdFromName } from '../../../src/services/games/GameIdService'

const libraryPath = () => path.join(app.getPath('userData'), 'game-library.json')

async function ensureLibrary(): Promise<void> {
  const file = libraryPath()
  await fs.mkdir(path.dirname(file), { recursive: true })
  try {
    await fs.access(file)
  } catch {
    await fs.writeFile(file, JSON.stringify({ games: [] }, null, 2), 'utf-8')
  }
}

export async function getGameLibrary(): Promise<GameLibrary> {
  await ensureLibrary()
  try {
    return JSON.parse(await fs.readFile(libraryPath(), 'utf-8')) as GameLibrary
  } catch {
    return { games: [] }
  }
}

export async function saveGameLibraryEntry(entry: GameLibraryEntry): Promise<GameLibraryEntry> {
  const library = await getGameLibrary()
  const games = library.games.some((game) => game.path === entry.path || game.gameId === entry.gameId)
    ? library.games.map((game) => (game.path === entry.path || game.gameId === entry.gameId ? entry : game))
    : [entry, ...library.games]
  await fs.writeFile(libraryPath(), JSON.stringify({ games }, null, 2), 'utf-8')
  return entry
}

export async function detectGameId(filePathOrName: string): Promise<string | null> {
  const fromName = detectGameIdFromName(filePathOrName)
  if (fromName) return fromName

  try {
    const handle = await fs.open(filePathOrName, 'r')
    try {
      const buffer = Buffer.alloc(1024 * 1024)
      await handle.read(buffer, 0, buffer.length, 0)
      return detectGameIdFromName(buffer.toString('latin1'))
    } finally {
      await handle.close()
    }
  } catch {
    return null
  }
}
