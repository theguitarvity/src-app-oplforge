import { createWriteStream } from 'node:fs'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { SourceFile } from '../../../src/types/opl'
import type { SourceProvider } from '../source.service'

const DRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files'
const ALLOWED_EXTENSIONS = new Set(['.iso', '.bin', '.cue', '.zso'])

interface DriveFile {
  id: string
  name: string
  size?: string
  mimeType: string
}

/**
 * Lists/downloads from the connected user's own Google Drive — read-only
 * (drive.readonly scope, enforced at the OAuth consent level, see
 * google-drive-auth.service.ts). `SourceFile.path` is repurposed here as the
 * opaque Drive file ID rather than a filesystem path (matches how
 * LocalFolderProvider uses it as a real fs path — each provider defines what
 * that field means for its own downloadFile()).
 */
export class GoogleDriveProvider implements SourceProvider {
  name = 'GoogleDriveProvider'

  constructor(private readonly accessToken: string) {}

  private authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.accessToken}` }
  }

  async listFiles(): Promise<SourceFile[]> {
    const files: SourceFile[] = []
    let pageToken: string | undefined
    do {
      const url = new URL(DRIVE_FILES_ENDPOINT)
      url.searchParams.set('fields', 'nextPageToken, files(id, name, size, mimeType)')
      url.searchParams.set('pageSize', '200')
      // trashed=false keeps deleted-but-not-purged files out; name-based
      // filtering happens client-side below since Drive's `q` syntax doesn't
      // support "ends with any of these extensions" directly.
      url.searchParams.set('q', 'trashed = false')
      if (pageToken) url.searchParams.set('pageToken', pageToken)

      const response = await fetch(url, { headers: this.authHeaders() })
      if (!response.ok) {
        throw new Error(`Falha ao listar arquivos do Google Drive (${response.status}).`)
      }
      const payload = (await response.json()) as { files?: DriveFile[]; nextPageToken?: string }
      for (const file of payload.files ?? []) {
        const extension = path.extname(file.name).toLowerCase()
        if (!ALLOWED_EXTENSIONS.has(extension)) continue
        files.push({
          id: file.id,
          name: file.name,
          path: file.id,
          size: file.size ? Number(file.size) : 0,
          extension,
          provider: this.name
        })
      }
      pageToken = payload.nextPageToken
    } while (pageToken)
    return files
  }

  async downloadFile(file: SourceFile, destination: string): Promise<void> {
    const url = new URL(`${DRIVE_FILES_ENDPOINT}/${encodeURIComponent(file.path)}`)
    url.searchParams.set('alt', 'media')
    const response = await fetch(url, { headers: this.authHeaders() })
    if (!response.ok || !response.body) {
      throw new Error(`Falha ao baixar arquivo do Google Drive (${response.status}).`)
    }
    await fs.mkdir(path.dirname(destination), { recursive: true })
    await pipeline(Readable.fromWeb(response.body as never), createWriteStream(destination))
  }
}
