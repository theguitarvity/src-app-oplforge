import { promises as fs } from 'node:fs'
import path from 'node:path'
import type {
  ArtAsset,
  ArtAssetType,
  ArtInstallResult,
  DvdArtSyncEntry,
  DvdArtSyncResult,
  GameArtStatus
} from '../../../src/types/opl'
import { addHistory } from '../history.service'
import { sendLog } from '../logger'
import { detectGameId, saveGameLibraryEntry } from '../games/game-id.service'

interface ArchiveMetadataResponse {
  files?: Array<Record<string, unknown>>
}

const identifier = 'OPLM_ART_2024_09'
const artTypes: ArtAssetType[] = ['ICO', 'SCR', 'SCR2', 'BG', 'LGO', 'COV', 'LAB', 'COV2']
let artCache: { timestamp: number; assets: ArtAsset[] } | null = null

function getString(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return undefined
}

async function fetchJson<T>(url: URL): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`Falha ao consultar OPLM ART: ${response.status}`)
    return (await response.json()) as T
  } finally {
    clearTimeout(timeout)
  }
}

function parseAsset(name: string): { gameId: string; type: ArtAssetType } | null {
  const match = name.match(/\b((?:SLUS|SCUS|SLES|SCES|SLPM|SLPS|SLKA|SCAJ)_\d{3}\.\d{2})_(ICO|SCR2?|BG|LGO|COV2?|LAB)\.png$/i)
  if (!match) return null
  const type = match[2].toUpperCase() as ArtAssetType
  if (!artTypes.includes(type)) return null
  return { gameId: match[1].toUpperCase(), type }
}

async function downloadFile(url: string, destination: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Falha ao baixar arte: ${response.status}`)
  await fs.mkdir(path.dirname(destination), { recursive: true })
  const buffer = Buffer.from(await response.arrayBuffer())
  await fs.writeFile(destination, buffer)
}

async function listDvdGames(devicePath: string) {
  const dvdDir = path.join(devicePath, 'DVD')
  const resolvedDevice = path.resolve(devicePath)
  const resolvedDvd = path.resolve(dvdDir)
  if (!resolvedDvd.startsWith(resolvedDevice)) throw new Error('Diretorio DVD invalido.')

  const entries = await fs.readdir(dvdDir, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.iso'))
    .map((entry) => path.join(dvdDir, entry.name))
}

async function countExistingArt(devicePath: string, gameId: string) {
  const artDir = path.join(devicePath, 'ART')
  try {
    const entries = await fs.readdir(artDir)
    const prefix = `${gameId.toUpperCase()}_`
    return entries.filter((entry) => entry.toUpperCase().startsWith(prefix) && entry.toLowerCase().endsWith('.png')).length
  } catch {
    return 0
  }
}

function statusFromCount(count: number): GameArtStatus {
  if (count >= 6) return 'complete'
  if (count > 0) return 'partial'
  return 'missing'
}

function titleFromPath(filePath: string) {
  return path
    .basename(filePath, path.extname(filePath))
    .replace(/\b(SLUS|SCUS|SLES|SCES|SLPM|SLPS|SLKA|SCAJ)[-_ ]?\d{3}[._-]?\d{2}\b/gi, '')
    .replace(/[_.,-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function indexOplmArt(): Promise<ArtAsset[]> {
  if (artCache && Date.now() - artCache.timestamp < 30 * 60_000) return artCache.assets

  const payload = await fetchJson<ArchiveMetadataResponse>(new URL(`/metadata/${identifier}`, 'https://archive.org'))
  const assets = (payload.files ?? [])
    .map((file): ArtAsset | null => {
      const name = getString(file.name)
      if (!name) return null
      const parsed = parseAsset(name)
      if (!parsed) return null
      return {
        gameId: parsed.gameId,
        type: parsed.type,
        name,
        url: `https://archive.org/download/${identifier}/${name.split('/').map(encodeURIComponent).join('/')}`,
        sizeBytes: Number(getString(file.size) ?? 0) || undefined
      }
    })
    .filter((asset): asset is ArtAsset => Boolean(asset))

  artCache = { timestamp: Date.now(), assets }
  return assets
}

export async function installArtForGame(
  devicePath: string,
  gameId: string,
  title = gameId
): Promise<ArtInstallResult> {
  const normalizedGameId = gameId.toUpperCase()
  const assets = (await indexOplmArt()).filter((asset) => asset.gameId === normalizedGameId)
  const copied: ArtAsset[] = []
  const artDir = path.join(devicePath, 'ART')
  const resolvedDevice = path.resolve(devicePath)
  const resolvedArt = path.resolve(artDir)
  if (!resolvedArt.startsWith(resolvedDevice)) throw new Error('Destino ART invalido.')

  for (const asset of assets) {
    const destination = path.join(artDir, path.basename(asset.name))
    try {
      await fs.access(destination)
    } catch {
      await downloadFile(asset.url, destination)
    }
    copied.push(asset)
  }

  const status = copied.length >= 6 ? 'complete' : copied.length > 0 ? 'partial' : 'missing'
  await addHistory({
    operation: 'Instalar artes OPLM',
    origin: 'OPLM_ART_2024_09',
    destination: artDir,
    result: status === 'missing' ? 'warning' : 'success',
    message: `${copied.length} arte(s) copiadas para ${normalizedGameId}.`
  })
  await saveGameLibraryEntry({
    title,
    gameId: normalizedGameId,
    media: 'DVD',
    path: '',
    artStatus: status
  })
  sendLog(status === 'missing' ? 'WARNING' : 'SUCCESS', `ART ${normalizedGameId}: ${status}`)
  return { gameId: normalizedGameId, copied, status }
}

export async function syncDvdArts(devicePath: string): Promise<DvdArtSyncResult> {
  const games = await listDvdGames(devicePath)
  const entries: DvdArtSyncEntry[] = []

  await indexOplmArt()

  for (const gamePath of games) {
    const title = titleFromPath(gamePath)
    const gameId = await detectGameId(gamePath)

    if (!gameId) {
      entries.push({
        title,
        path: gamePath,
        status: 'missing',
        existingArtCount: 0,
        downloadedArtCount: 0,
        message: 'Game ID nao identificado. Edite manualmente para baixar artes.'
      })
      continue
    }

    const existingArtCount = await countExistingArt(devicePath, gameId)
    const beforeStatus = statusFromCount(existingArtCount)
    const installResult = beforeStatus === 'complete' ? null : await installArtForGame(devicePath, gameId, title)
    const afterArtCount = await countExistingArt(devicePath, gameId)
    const status = statusFromCount(afterArtCount)
    const downloadedArtCount = Math.max(afterArtCount - existingArtCount, 0)

    await saveGameLibraryEntry({
      title,
      gameId,
      media: 'DVD',
      path: gamePath,
      artStatus: status
    })

    entries.push({
      title,
      path: gamePath,
      gameId,
      status,
      existingArtCount,
      downloadedArtCount,
      message:
        installResult || downloadedArtCount > 0
          ? `${downloadedArtCount} arte(s) baixadas/configuradas.`
          : 'Artes ja estavam configuradas.'
    })
  }

  const updatedGames = entries.filter((entry) => entry.downloadedArtCount > 0).length
  const missingGameIds = entries.filter((entry) => !entry.gameId).length

  await addHistory({
    operation: 'Sincronizar artes do DVD',
    origin: path.join(devicePath, 'DVD'),
    destination: path.join(devicePath, 'ART'),
    result: updatedGames > 0 ? 'success' : 'warning',
    message: `${games.length} jogo(s) lidos, ${updatedGames} atualizado(s), ${missingGameIds} sem Game ID.`
  })
  sendLog('SUCCESS', `Sincronizacao de ART do DVD concluida: ${updatedGames} atualizado(s).`)

  return {
    devicePath,
    scannedGames: games.length,
    updatedGames,
    missingGameIds,
    entries
  }
}
