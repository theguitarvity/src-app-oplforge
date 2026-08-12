import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import type { ArchiveMediaType, CatalogGame, CatalogQuery } from '../../../src/types/opl'
import { normalizeGameTitle } from '../../../src/services/catalog/GameScoringService'

/**
 * User-supplied Essentials entries (CSV import or manual form), stored
 * separately from the fixed Internet Archive listing
 * (essentials-catalog.service.ts). Shaped as CatalogGame so it feeds the
 * same addCatalogGamesToQueue()/download pipeline without any new download
 * logic — the only thing custom about these entries is where they came from.
 */

export interface CustomCatalogEntryInput {
  title: string
  fileName: string
  url: string
  sizeBytes?: number
  mediaType?: ArchiveMediaType
}

const storePath = () => path.join(app.getPath('userData'), 'custom-essentials.json')

async function readStore(): Promise<CatalogGame[]> {
  try {
    const raw = await fs.readFile(storePath(), 'utf-8')
    const parsed = JSON.parse(raw) as { entries?: CatalogGame[] }
    return parsed.entries ?? []
  } catch {
    return []
  }
}

async function writeStore(entries: CatalogGame[]): Promise<void> {
  await fs.mkdir(path.dirname(storePath()), { recursive: true })
  await fs.writeFile(storePath(), JSON.stringify({ entries }, null, 2), 'utf-8')
}

function toCatalogGame(input: CustomCatalogEntryInput): CatalogGame {
  const title = input.title.trim()
  if (!title) throw new Error('Título é obrigatório.')
  if (!input.fileName.trim()) throw new Error('Nome do arquivo é obrigatório.')
  if (!input.url.trim()) throw new Error('URL é obrigatória.')
  return {
    id: `custom:${randomUUID()}`,
    title,
    normalizedTitle: normalizeGameTitle(title),
    fileName: input.fileName.trim(),
    url: input.url.trim(),
    sizeBytes: input.sizeBytes,
    mediaType: input.mediaType ?? 'ps2-dvd',
    scoreTier: 'Unrated',
    genres: [],
    priority: 'unrated',
    sourceId: 'custom-user-list',
    // Unlike the Internet Archive listing (metadata-assets), this content
    // was never verified by this app — the legal responsibility for what a
    // custom URL actually serves is entirely the user's own, same framing
    // desktop already uses for manually-managed sources (ManagedSourceConfig).
    legalMode: 'user-configured'
  }
}

function applyQuery(games: CatalogGame[], query?: CatalogQuery) {
  return games.filter((game) => {
    if (
      query?.search &&
      !`${game.title} ${game.fileName}`.toLowerCase().includes(query.search.toLowerCase())
    )
      return false
    if (query?.mediaType && query.mediaType !== 'all' && game.mediaType !== query.mediaType)
      return false
    return true
  })
}

export async function listCustomCatalog(query?: CatalogQuery): Promise<CatalogGame[]> {
  return applyQuery(await readStore(), query)
}

export async function addCustomCatalogEntry(input: CustomCatalogEntryInput): Promise<CatalogGame> {
  const entry = toCatalogGame(input)
  const entries = await readStore()
  entries.push(entry)
  await writeStore(entries)
  return entry
}

export async function removeCustomCatalogEntry(id: string): Promise<void> {
  const entries = (await readStore()).filter((entry) => entry.id !== id)
  await writeStore(entries)
}

const CSV_MEDIA_TYPES: ArchiveMediaType[] = ['ps2-dvd', 'ps2-cd', 'ps1']

/** Minimal CSV parser: one row per line, comma-separated, double-quote escaping for fields containing commas — sufficient for this fixed 5-column schema (no embedded newlines expected). */
function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        current += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      fields.push(current)
      current = ''
    } else {
      current += char
    }
  }
  fields.push(current)
  return fields.map((field) => field.trim())
}

export interface ImportCustomCatalogCsvResult {
  added: CatalogGame[]
  errors: string[]
}

/**
 * Expected header: title,fileName,url,sizeBytes,mediaType — sizeBytes and
 * mediaType are optional per row (mediaType defaults to ps2-dvd). Rows that
 * fail validation are skipped and reported in `errors`, not aborting the
 * whole import — a typo in row 12 shouldn't lose rows 1-11.
 */
export async function importCustomCatalogCsv(
  filePath: string
): Promise<ImportCustomCatalogCsvResult> {
  const raw = await fs.readFile(filePath, 'utf-8')
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length === 0) return { added: [], errors: ['Arquivo CSV vazio.'] }

  const header = parseCsvLine(lines[0]).map((column) => column.toLowerCase())
  const titleIdx = header.indexOf('title')
  const fileNameIdx = header.indexOf('filename')
  const urlIdx = header.indexOf('url')
  const sizeIdx = header.indexOf('sizebytes')
  const mediaTypeIdx = header.indexOf('mediatype')
  if (titleIdx === -1 || fileNameIdx === -1 || urlIdx === -1) {
    return {
      added: [],
      errors: ['Cabeçalho inválido — esperado: title,fileName,url,sizeBytes,mediaType']
    }
  }

  const added: CatalogGame[] = []
  const errors: string[] = []
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i])
    try {
      const sizeBytesRaw = sizeIdx >= 0 ? row[sizeIdx] : undefined
      const mediaTypeRaw = mediaTypeIdx >= 0 ? row[mediaTypeIdx]?.toLowerCase() : undefined
      const mediaType = CSV_MEDIA_TYPES.includes(mediaTypeRaw as ArchiveMediaType)
        ? (mediaTypeRaw as ArchiveMediaType)
        : undefined
      added.push(
        toCatalogGame({
          title: row[titleIdx] ?? '',
          fileName: row[fileNameIdx] ?? '',
          url: row[urlIdx] ?? '',
          sizeBytes: sizeBytesRaw ? Number(sizeBytesRaw) : undefined,
          mediaType
        })
      )
    } catch (error) {
      errors.push(`Linha ${i + 1}: ${error instanceof Error ? error.message : 'inválida'}`)
    }
  }

  if (added.length > 0) {
    const entries = await readStore()
    entries.push(...added)
    await writeStore(entries)
  }
  return { added, errors }
}
