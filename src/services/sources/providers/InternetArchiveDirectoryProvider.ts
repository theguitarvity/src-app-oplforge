import type { ArchiveDirectoryFile, ArchiveMediaType } from '@/types/opl'

interface ArchiveMetadataResponse {
  files?: Array<Record<string, unknown>>
}

const supportedExtensions = ['.iso', '.bin', '.cue', '.torrent', '.zip', '.7z']
const timeoutMs = 15_000

function getString(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return undefined
}

function getArchiveIdentifier(baseUrl: string) {
  const url = new URL(baseUrl)
  const parts = url.pathname.split('/').filter(Boolean)
  const downloadIndex = parts.indexOf('download')
  if (downloadIndex >= 0) return parts[downloadIndex + 1]
  if (parts[0] === 'details') return parts[1]
  return parts.at(-1) ?? ''
}

function classifyMedia(name: string): ArchiveMediaType {
  const lower = name.toLowerCase()
  if (lower.endsWith('.torrent')) return 'torrent'
  if (lower.endsWith('.zip') || lower.endsWith('.7z')) return 'archive'
  if (lower.endsWith('.bin') || lower.endsWith('.cue')) return 'ps1'
  if (lower.endsWith('.iso')) return lower.includes('(cd)') || lower.includes('[cd]') ? 'ps2-cd' : 'ps2-dvd'
  return 'unknown'
}

async function fetchJson<T>(url: URL): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`Archive directory request failed: ${response.status}`)
    return (await response.json()) as T
  } finally {
    clearTimeout(timeout)
  }
}

export class InternetArchiveDirectoryProvider {
  constructor(private readonly baseUrl: string) {}

  async listFiles(): Promise<ArchiveDirectoryFile[]> {
    const identifier = getArchiveIdentifier(this.baseUrl)
    const metadataUrl = new URL(`/metadata/${encodeURIComponent(identifier)}`, 'https://archive.org')
    const payload = await fetchJson<ArchiveMetadataResponse>(metadataUrl)

    return (payload.files ?? [])
      .map((file) => this.mapFile(identifier, file))
      .filter((file): file is ArchiveDirectoryFile => Boolean(file))
  }

  private mapFile(identifier: string, file: Record<string, unknown>): ArchiveDirectoryFile | null {
    const name = getString(file.name)
    if (!name) return null
    const extension = supportedExtensions.find((ext) => name.toLowerCase().endsWith(ext))
    if (!extension) return null

    return {
      id: Buffer.from(`${identifier}/${name}`).toString('base64url'),
      name,
      url: `https://archive.org/download/${encodeURIComponent(identifier)}/${name.split('/').map(encodeURIComponent).join('/')}`,
      sizeBytes: Number(getString(file.size) ?? 0) || undefined,
      modifiedAt: getString(file.mtime),
      extension,
      mediaType: classifyMedia(name)
    }
  }
}
