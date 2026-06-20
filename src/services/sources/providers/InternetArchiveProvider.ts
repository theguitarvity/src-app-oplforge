import type {
  InternetArchiveSourceConfig,
  RemoteFile,
  RemoteFileKind,
  RemoteItemDetails,
  RemoteSearchParams,
  RemoteSearchProvider,
  RemoteSearchResult
} from '@/types/opl'

interface ArchiveSearchResponse {
  response?: {
    docs?: Array<Record<string, unknown>>
  }
}

interface ArchiveMetadataResponse {
  metadata?: Record<string, unknown>
  files?: Array<Record<string, unknown>>
}

const DEFAULT_TIMEOUT_MS = 15_000

function getString(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return getString(value[0])
  if (typeof value === 'number') return String(value)
  return undefined
}

function classifyFile(name: string, format?: string): RemoteFileKind {
  const lower = name.toLowerCase()
  const normalizedFormat = format?.toLowerCase() ?? ''

  if (lower.endsWith('.iso') || normalizedFormat.includes('iso')) return 'iso'
  if (lower.endsWith('.bin')) return 'bin'
  if (lower.endsWith('.cue')) return 'cue'
  if (lower.endsWith('.7z') || lower.endsWith('.zip')) return 'archive'
  if (lower.endsWith('.torrent') || normalizedFormat.includes('torrent')) return 'torrent'
  return 'other'
}

async function fetchJson<T>(url: URL, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`Internet Archive request failed: ${response.status}`)
    return (await response.json()) as T
  } finally {
    clearTimeout(timeout)
  }
}

export class InternetArchiveProvider implements RemoteSearchProvider {
  id = 'internet-archive'
  name = 'Internet Archive'
  private readonly baseUrl: string

  constructor(private readonly config: InternetArchiveSourceConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
  }

  async search(params: RemoteSearchParams): Promise<RemoteSearchResult[]> {
    const queryParts = [params.query || this.config.defaultQuery]
    const creator = params.creator || this.config.creator
    const collection = params.collection || this.config.collection

    if (creator) queryParts.push(`creator:"${creator}"`)
    if (collection) queryParts.push(`collection:"${collection}"`)
    if (this.config.mediaType) queryParts.push(`mediatype:"${this.config.mediaType}"`)

    const url = new URL('/advancedsearch.php', this.baseUrl)
    url.searchParams.set('q', queryParts.filter(Boolean).join(' AND ') || '*:*')
    url.searchParams.set('fl[]', 'identifier')
    url.searchParams.append('fl[]', 'title')
    url.searchParams.append('fl[]', 'creator')
    url.searchParams.append('fl[]', 'year')
    url.searchParams.append('fl[]', 'description')
    url.searchParams.set('page', String(params.page ?? 1))
    url.searchParams.set('rows', String(params.limit ?? 24))
    url.searchParams.set('output', 'json')

    const payload = await fetchJson<ArchiveSearchResponse>(url)
    return (payload.response?.docs ?? []).map((doc) => {
      const id = getString(doc.identifier) ?? ''
      return {
        id,
        title: getString(doc.title) ?? id,
        creator: getString(doc.creator),
        year: getString(doc.year),
        description: getString(doc.description),
        source: this.name,
        url: `${this.baseUrl}/details/${encodeURIComponent(id)}`,
        thumbnailUrl: `${this.baseUrl}/services/img/${encodeURIComponent(id)}`
      }
    })
  }

  async getItemDetails(id: string): Promise<RemoteItemDetails> {
    const url = new URL(`/metadata/${encodeURIComponent(id)}`, this.baseUrl)
    const payload = await fetchJson<ArchiveMetadataResponse>(url)
    const metadata = payload.metadata ?? {}

    return {
      id,
      title: getString(metadata.title) ?? id,
      description: getString(metadata.description),
      files: this.mapFiles(id, payload.files ?? []),
      metadata
    }
  }

  async listFiles(id: string): Promise<RemoteFile[]> {
    return (await this.getItemDetails(id)).files
  }

  private mapFiles(id: string, files: Array<Record<string, unknown>>): RemoteFile[] {
    return files.map((file) => {
      const name = getString(file.name) ?? 'unknown'
      const format = getString(file.format)
      const kind = classifyFile(name, format)
      const fileUrl = `${this.baseUrl}/download/${encodeURIComponent(id)}/${name.split('/').map(encodeURIComponent).join('/')}`
      const torrentUrl = `${this.baseUrl}/download/${encodeURIComponent(id)}/${encodeURIComponent(id)}_archive.torrent`

      return {
        name,
        size: Number(getString(file.size) ?? 0) || undefined,
        format,
        url: fileUrl,
        torrentUrl: kind === 'torrent' ? fileUrl : torrentUrl,
        kind
      }
    })
  }
}
