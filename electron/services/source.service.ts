import { promises as fs } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import type {
  ImportFromSourceInput,
  ManagedSourceConfig,
  RemoteItemDetails,
  RemoteSearchParams,
  RemoteSearchResult,
  SourceFile,
  SourceProviderConfig
} from '../../src/types/opl'
import { DEFAULT_REMOTE_SOURCES } from '../../src/services/sources/defaultRemoteSources'
import { InternetArchiveProvider } from '../../src/services/sources/providers/InternetArchiveProvider'
import { addHistory, recordFailure } from './history.service'
import { sendLog } from './logger'

export interface SourceProvider {
  name: string
  listFiles(): Promise<SourceFile[]>
  downloadFile(file: SourceFile, destination: string): Promise<void>
}

export class LocalFolderProvider implements SourceProvider {
  name = 'LocalFolderProvider'

  constructor(private readonly rootPath: string) {}

  async listFiles(): Promise<SourceFile[]> {
    const allowed = new Set(['.iso', '.bin'])
    const entries = await fs.readdir(this.rootPath, { withFileTypes: true })
    const files = await Promise.all(
      entries
        .filter(
          (entry) => entry.isFile() && allowed.has(path.extname(entry.name).toLowerCase())
        )
        .map(async (entry) => {
          const filePath = path.join(this.rootPath, entry.name)
          const stat = await fs.stat(filePath)
          return {
            id: Buffer.from(filePath).toString('base64url'),
            name: entry.name,
            path: filePath,
            size: stat.size,
            extension: path.extname(entry.name).toLowerCase(),
            provider: this.name
          }
        })
    )
    return files
  }

  async downloadFile(file: SourceFile, destination: string): Promise<void> {
    await fs.mkdir(path.dirname(destination), { recursive: true })
    await fs.copyFile(file.path, destination)
  }
}

const sourcesPath = () => path.join(app.getPath('userData'), 'sources.json')

const defaultSources: ManagedSourceConfig[] = [
  {
    id: 'internet-archive-default',
    name: 'Internet Archive',
    type: 'internet-archive',
    enabled: true,
    baseUrl: 'https://archive.org'
  },
  ...DEFAULT_REMOTE_SOURCES
]

async function ensureSourcesFile() {
  const file = sourcesPath()
  await fs.mkdir(path.dirname(file), { recursive: true })
  try {
    await fs.access(file)
  } catch {
    await fs.writeFile(file, JSON.stringify(defaultSources, null, 2), 'utf-8')
  }
}

async function readSources(): Promise<ManagedSourceConfig[]> {
  await ensureSourcesFile()
  try {
    const existing = JSON.parse(await fs.readFile(sourcesPath(), 'utf-8')) as ManagedSourceConfig[]
    const missingDefaults = defaultSources.filter(
      (defaultSource) => !existing.some((source) => source.id === defaultSource.id)
    )
    if (missingDefaults.length) {
      const merged = [...existing, ...missingDefaults]
      await writeSources(merged)
      return merged
    }
    return existing
  } catch {
    return defaultSources
  }
}

async function writeSources(sources: ManagedSourceConfig[]) {
  await ensureSourcesFile()
  await fs.writeFile(sourcesPath(), JSON.stringify(sources, null, 2), 'utf-8')
}

// TODO: Implementar UrlProvider com suporte a fontes autorizadas configuradas pelo usuario.
// TODO: Implementar GoogleDriveProvider usando OAuth/arquivos compartilhados autorizados.
// TODO: Implementar MegaProvider usando credenciais ou links autorizados pelo usuario.

function createProvider(config: SourceProviderConfig): SourceProvider {
  if (config.provider === 'local-folder') {
    if (!config.rootPath) throw new Error('Diretorio local nao informado.')
    return new LocalFolderProvider(config.rootPath)
  }
  throw new Error(`Provider ${config.provider} ainda nao implementado no MVP.`)
}

export async function listSourceFiles(config: SourceProviderConfig): Promise<SourceFile[]> {
  const provider = createProvider(config)
  return provider.listFiles()
}

export async function importFromSource(input: ImportFromSourceInput) {
  try {
    const provider = new LocalFolderProvider(path.dirname(input.file.path))
    await provider.downloadFile(input.file, input.destination)
    sendLog('SUCCESS', `Arquivo importado da fonte: ${input.file.name}`)
    return addHistory({
      operation: 'Importar de fonte',
      origin: input.file.path,
      destination: input.destination,
      result: 'success',
      message: 'Arquivo importado de fonte local.'
    })
  } catch (error) {
    return recordFailure('Importar de fonte', error, input.file.path, input.destination)
  }
}

export async function listManagedSources(): Promise<ManagedSourceConfig[]> {
  return readSources()
}

export async function saveManagedSource(config: ManagedSourceConfig): Promise<ManagedSourceConfig> {
  const sources = await readSources()
  const normalized: ManagedSourceConfig = {
    ...config,
    id: config.id || `${config.type}-${Date.now()}`,
    baseUrl: config.baseUrl?.replace(/\/$/, '')
  }
  const next = sources.some((source) => source.id === normalized.id)
    ? sources.map((source) => (source.id === normalized.id ? normalized : source))
    : [normalized, ...sources]
  await writeSources(next)
  sendLog('SUCCESS', `Fonte salva: ${normalized.name}`)
  return normalized
}

export async function removeManagedSource(id: string): Promise<void> {
  await writeSources((await readSources()).filter((source) => source.id !== id))
  sendLog('WARNING', 'Fonte removida.')
}

function createRemoteProvider(source: ManagedSourceConfig) {
  if (source.type !== 'internet-archive') {
    throw new Error(`Busca remota nao implementada para ${source.type}.`)
  }

  return new InternetArchiveProvider({
    enabled: source.enabled,
    baseUrl: source.baseUrl || 'https://archive.org',
    defaultQuery: source.defaultQuery,
    creator: source.creator,
    collection: source.collection
  })
}

async function getInternetArchiveProvider() {
  const source = (await readSources()).find(
    (item) => item.enabled && item.type === 'internet-archive'
  )
  if (!source) throw new Error('Nenhuma fonte Internet Archive ativa.')
  return createRemoteProvider(source)
}

export async function searchRemoteSource(
  params: RemoteSearchParams
): Promise<RemoteSearchResult[]> {
  const provider = await getInternetArchiveProvider()
  return provider.search(params)
}

export async function getRemoteItemDetails(id: string): Promise<RemoteItemDetails> {
  const provider = await getInternetArchiveProvider()
  return provider.getItemDetails(id)
}

export async function listRemoteFiles(id: string) {
  const provider = await getInternetArchiveProvider()
  return provider.listFiles(id)
}
