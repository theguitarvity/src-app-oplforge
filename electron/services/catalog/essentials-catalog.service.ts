import { promises as fs } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import type {
  ArchiveDirectoryFile,
  CatalogDownloadInput,
  CatalogGame,
  CatalogQuery,
  CatalogSourceLink,
  CatalogSourceLinkIndex,
  SmartFillPlan
} from '../../../src/types/opl'
import { InternetArchiveDirectoryProvider } from '../../../src/services/sources/providers/InternetArchiveDirectoryProvider'
import { scoreArchiveFile, sortCatalogGames } from '../../../src/services/catalog/GameScoringService'
import { DEFAULT_REMOTE_SOURCES } from '../../../src/services/sources/defaultRemoteSources'
import { addHistory } from '../history.service'
import { sendLog } from '../logger'
import { p2pDownloadService } from '../downloads/p2p-download.service'

const legalConfirmationText =
  'Confirmo que possuo este jogo fisicamente/digitalmente ou tenho autorização legal para baixar este backup.'
const defaultTargetBytes = 500 * 1000 ** 3

let catalogCache: { timestamp: number; games: CatalogGame[] } | null = null
const sourceLinksPath = () => path.join(app.getPath('userData'), 'catalog-source-links.json')

function getEssentialsSource() {
  const source = DEFAULT_REMOTE_SOURCES.find((item) => item.id === 'ia-playstation2-essentials')
  if (!source?.baseUrl) throw new Error('Fonte PlayStation 2 Essentials nao configurada.')
  return source
}

function applyQuery(games: CatalogGame[], query?: CatalogQuery) {
  return games.filter((game) => {
    if (query?.search && !`${game.title} ${game.fileName}`.toLowerCase().includes(query.search.toLowerCase())) return false
    if (query?.tier && query.tier !== 'all' && game.scoreTier !== query.tier) return false
    if (query?.mediaType && query.mediaType !== 'all' && game.mediaType !== query.mediaType) return false
    if (query?.priority && query.priority !== 'all' && game.priority !== query.priority) return false
    return true
  })
}

async function loadCatalog() {
  if (catalogCache && Date.now() - catalogCache.timestamp < 10 * 60_000) return catalogCache.games

  const source = getEssentialsSource()
  const sourceLinks = await getEssentialsSourceLinks()
  const games = sortCatalogGames(
    sourceLinks.links
      .filter((link) => link.accessible)
      .filter((file) => file.mediaType === 'ps2-dvd' || file.mediaType === 'ps2-cd')
      .map((file) => scoreArchiveFile(sourceLinkToArchiveFile(file), source.id, source.legalMode))
  )
  catalogCache = { timestamp: Date.now(), games }
  return games
}

function sourceLinkToArchiveFile(link: CatalogSourceLink): ArchiveDirectoryFile {
  return {
    id: link.id,
    name: link.fileName,
    url: link.url,
    sizeBytes: link.sizeBytes,
    extension: path.extname(link.fileName).toLowerCase(),
    mediaType: link.mediaType
  }
}

function linkTitle(name: string) {
  return name.replace(/\.(iso|bin|cue|7z|zip|torrent)$/i, '').replace(/[_.,-]+/g, ' ').trim()
}

async function checkLink(file: ArchiveDirectoryFile): Promise<CatalogSourceLink> {
  const checkedAt = new Date().toISOString()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8_000)
  try {
    const response = await fetch(file.url, { method: 'HEAD', signal: controller.signal })
    return {
      id: file.id,
      title: linkTitle(file.name),
      fileName: file.name,
      url: file.url,
      sizeBytes: Number(response.headers.get('content-length') ?? file.sizeBytes ?? 0) || file.sizeBytes,
      mediaType: file.mediaType,
      accessible: response.ok,
      checkedAt,
      statusCode: response.status
    }
  } catch {
    return {
      id: file.id,
      title: linkTitle(file.name),
      fileName: file.name,
      url: file.url,
      sizeBytes: file.sizeBytes,
      mediaType: file.mediaType,
      accessible: false,
      checkedAt
    }
  } finally {
    clearTimeout(timeout)
  }
}

function createUnverifiedLink(file: ArchiveDirectoryFile): CatalogSourceLink {
  return {
    id: file.id,
    title: linkTitle(file.name),
    fileName: file.name,
    url: file.url,
    sizeBytes: file.sizeBytes,
    mediaType: file.mediaType,
    accessible: true,
    checkedAt: new Date().toISOString()
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = []
  let index = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const currentIndex = index
      index += 1
      results[currentIndex] = await mapper(items[currentIndex])
    }
  })
  await Promise.all(workers)
  return results
}

async function readSourceLinks(): Promise<CatalogSourceLinkIndex | null> {
  try {
    return JSON.parse(await fs.readFile(sourceLinksPath(), 'utf-8')) as CatalogSourceLinkIndex
  } catch {
    return null
  }
}

async function writeSourceLinks(index: CatalogSourceLinkIndex) {
  await fs.mkdir(path.dirname(sourceLinksPath()), { recursive: true })
  await fs.writeFile(sourceLinksPath(), JSON.stringify(index, null, 2), 'utf-8')
}

async function getEssentialsSourceLinks() {
  const cached = await readSourceLinks()
  if (
    cached &&
    Date.now() - new Date(cached.generatedAt).getTime() < 24 * 60 * 60_000 &&
    cached.links.some((link) => link.accessible)
  ) {
    return cached
  }

  const source = getEssentialsSource()
  const provider = new InternetArchiveDirectoryProvider(source.baseUrl!)
  const files = (await provider.listFiles()).filter(
    (file) => file.mediaType === 'ps2-dvd' || file.mediaType === 'ps2-cd' || file.mediaType === 'ps1'
  )
  const index: CatalogSourceLinkIndex = {
    sourceId: source.id,
    generatedAt: new Date().toISOString(),
    links: files.map(createUnverifiedLink)
  }
  await writeSourceLinks(index)
  return index
}

export async function refreshEssentialsSourceLinks(): Promise<CatalogSourceLinkIndex> {
  const source = getEssentialsSource()
  const provider = new InternetArchiveDirectoryProvider(source.baseUrl!)
  const files = (await provider.listFiles()).filter(
    (file) => file.mediaType === 'ps2-dvd' || file.mediaType === 'ps2-cd' || file.mediaType === 'ps1'
  )
  const links = await mapWithConcurrency(files, 8, checkLink)
  const index: CatalogSourceLinkIndex = {
    sourceId: source.id,
    generatedAt: new Date().toISOString(),
    links
  }
  await writeSourceLinks(index)
  sendLog('SUCCESS', `Links diretos do Essentials atualizados: ${links.filter((link) => link.accessible).length}/${links.length} acessiveis.`)
  return index
}

function removeDuplicates(games: CatalogGame[]) {
  const seen = new Set<string>()
  return games.filter((game) => {
    if (seen.has(game.normalizedTitle)) return false
    seen.add(game.normalizedTitle)
    return true
  })
}

export async function listEssentialsCatalog(query?: CatalogQuery): Promise<CatalogGame[]> {
  return applyQuery(await loadCatalog(), query)
}

export async function createSmartFillPlan(
  devicePath: string,
  targetBytes = defaultTargetBytes
): Promise<SmartFillPlan> {
  const stats = await fs.statfs(devicePath)
  const availableBytes = Math.min(Number(stats.bavail) * Number(stats.bsize), targetBytes)
  const candidates = removeDuplicates(await loadCatalog()).filter(
    (game) => game.scoreTier === 'S' || game.scoreTier === 'A'
  )

  const selectedGames: CatalogGame[] = []
  let estimatedTotalBytes = 0
  for (const game of candidates) {
    const size = game.sizeBytes ?? 4.7 * 1024 ** 3
    if (estimatedTotalBytes + size <= availableBytes) {
      selectedGames.push(game)
      estimatedTotalBytes += size
    }
  }

  return {
    targetDevice: devicePath,
    availableBytes,
    selectedGames,
    estimatedTotalBytes,
    remainingBytes: Math.max(availableBytes - estimatedTotalBytes, 0),
    warnings: selectedGames.length === 0 ? ['Nenhum jogo coube no espaço disponível.'] : []
  }
}

export async function addCatalogGamesToQueue(input: CatalogDownloadInput) {
  if (input.legalConfirmationText.trim() !== legalConfirmationText) {
    throw new Error('Confirmacao legal obrigatoria ausente ou invalida.')
  }

  const tasks = []
  for (const game of input.games) {
    await addHistory({
      operation: 'Confirmacao legal de backup',
      origin: game.url,
      destination: input.devicePath,
      result: 'success',
      message: `${input.legalConfirmationText} Item: ${game.title}`
    })

    tasks.push(
      await p2pDownloadService.addTorrent({
        source: 'direct-url',
        value: game.url,
        destinationPath: input.devicePath,
        finalizeTo: game.mediaType === 'ps2-cd' ? 'CD' : 'DVD',
        title: game.title,
        fileName: game.fileName,
        expectedSizeBytes: game.sizeBytes
      })
    )
  }

  sendLog('SUCCESS', `${tasks.length} jogo(s) adicionado(s) a fila do catalogo.`)
  return tasks
}
