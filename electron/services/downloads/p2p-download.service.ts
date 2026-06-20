import { BrowserWindow } from 'electron'
import { createWriteStream } from 'node:fs'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type {
  DownloadProgress,
  DownloadTask,
  P2PDownloadService,
  TorrentFileEntry,
  TorrentInput
} from '../../../src/types/opl'
import { addHistory } from '../history.service'
import { sendLog } from '../logger'
import { installArtForGame } from '../art/oplm-art.service'
import { detectGameId, saveGameLibraryEntry } from '../games/game-id.service'

type WebTorrentClient = {
  add: (source: string | Buffer, options: Record<string, unknown>, onTorrent: (torrent: TorrentLike) => void) => TorrentLike
}

type TorrentLike = {
  name?: string
  progress?: number
  downloaded?: number
  length?: number
  downloadSpeed?: number
  uploadSpeed?: number
  numPeers?: number
  done?: boolean
  files?: TorrentFileLike[]
  on: (event: string, callback: (...args: unknown[]) => void) => void
  destroy: (callback?: () => void) => void
  pause?: () => void
  resume?: () => void
}

type TorrentFileLike = {
  name: string
  path: string
  length: number
  select: () => void
  deselect: () => void
}

interface InternalTask extends DownloadTask {
  torrent?: TorrentLike
  progress: DownloadProgress
}

const tasks = new Map<string, InternalTask>()
let clientPromise: Promise<WebTorrentClient> | null = null

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`
const stagingDirName = '_OPL_FORGE_STAGING'

async function getClient(): Promise<WebTorrentClient> {
  clientPromise ??= import('webtorrent').then((module) => {
    const WebTorrent = module.default as new () => WebTorrentClient
    return new WebTorrent()
  })
  return clientPromise
}

function sendDownloadEvent(channel: string, progress: DownloadProgress) {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(channel, progress)
  }
}

async function ensureSafeDestination(destinationPath: string) {
  const resolved = path.resolve(destinationPath)
  const stat = await fs.stat(resolved)
  if (!stat.isDirectory()) throw new Error('Destino do download deve ser uma pasta.')
  return resolved
}

async function ensureInside(parent: string, child: string) {
  const resolvedParent = path.resolve(parent)
  const resolvedChild = path.resolve(child)
  if (!resolvedChild.startsWith(`${resolvedParent}${path.sep}`) && resolvedChild !== resolvedParent) {
    throw new Error('Destino invalido fora do dispositivo selecionado.')
  }
}

async function ensureSpace(destinationPath: string, totalBytes: number) {
  const stats = await fs.statfs(destinationPath)
  const free = Number(stats.bavail) * Number(stats.bsize)
  if (totalBytes > free) throw new Error('Espaco insuficiente para o download selecionado.')
}

async function listFilesRecursive(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name)
      return entry.isDirectory() ? listFilesRecursive(fullPath) : [fullPath]
    })
  )
  return files.flat()
}

async function safeMove(source: string, destination: string) {
  await fs.mkdir(path.dirname(destination), { recursive: true })
  try {
    await fs.access(destination)
    throw new Error(`Arquivo final ja existe: ${destination}`)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Arquivo final ja existe')) throw error
  }
  await fs.rename(source, destination)
}

function sanitizeName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

function buildProgress(task: InternalTask, status = task.status): DownloadProgress {
  const torrent = task.torrent
  return {
    taskId: task.id,
    status,
    progress: Math.round(((torrent?.progress ?? task.progress.progress / 100) || 0) * 100),
    downloadedBytes: torrent?.downloaded ?? task.progress.downloadedBytes,
    totalBytes: torrent?.length ?? task.progress.totalBytes,
    downloadSpeed: torrent?.downloadSpeed ?? 0,
    uploadSpeed: torrent?.uploadSpeed ?? 0,
    peers: torrent?.numPeers ?? 0,
    etaSeconds:
      torrent?.downloadSpeed && torrent.length
        ? Math.max(Math.round((torrent.length - (torrent.downloaded ?? 0)) / torrent.downloadSpeed), 0)
        : undefined,
    error: task.progress.error
  }
}

function updateProgress(task: InternalTask, status = task.status) {
  task.status = status
  task.progress = buildProgress(task, status)
  sendDownloadEvent('download:progress', task.progress)
}

function updateDirectProgress(task: InternalTask, downloadedBytes: number, totalBytes: number) {
  task.status = 'downloading'
  task.progress = {
    ...task.progress,
    status: 'downloading',
    progress: totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0,
    downloadedBytes,
    totalBytes,
    downloadSpeed: 0,
    uploadSpeed: 0,
    peers: 0
  }
  sendDownloadEvent('download:progress', task.progress)
}

function failTask(task: InternalTask, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  task.status = 'failed'
  task.progress = { ...buildProgress(task, 'failed'), error: message }
  sendDownloadEvent('download:failed', task.progress)
  sendLog('ERROR', `Download falhou: ${message}`)
  void addHistory({
    operation: 'Download P2P',
    origin: task.input.value,
    destination: task.stagingPath,
    result: 'error',
    message
  })
}

async function prepareTorrentFiles(task: InternalTask, torrent: TorrentLike) {
  const files = torrent.files ?? []
  const selectedNames = task.selectedFiles.length ? new Set(task.selectedFiles) : null

  for (const file of files) {
    if (selectedNames && !selectedNames.has(file.name) && !selectedNames.has(file.path)) file.deselect()
    else file.select()
  }

  const selected = selectedNames
    ? files.filter((file) => selectedNames.has(file.name) || selectedNames.has(file.path))
    : files
  const totalBytes = selected.reduce((total, file) => total + file.length, 0)
  await ensureSpace(task.destinationPath, totalBytes)
}

async function markCompleted(task: InternalTask) {
  task.status = 'completed'
  task.progress = buildProgress(task, 'completed')
  task.progress.progress = 100
  if (task.input.finalizeTo && task.input.finalizeTo !== 'STAGING') {
    try {
      await finalizeOplFiles(task)
    } catch (error) {
      failTask(task, error)
      return
    }
  }
  sendDownloadEvent('download:completed', task.progress)
  sendLog('SUCCESS', `Download concluido em staging: ${path.basename(task.stagingPath)}`)
  await addHistory({
    operation: 'Download P2P concluido',
    origin: task.input.value,
    destination: task.stagingPath,
    result: 'success',
    message: 'Arquivo salvo em staging para reprocessamento.'
  })
}

async function downloadDirectUrl(task: InternalTask) {
  const response = await fetch(task.input.value)
  if (!response.ok || !response.body) {
    throw new Error(`Link direto indisponivel: HTTP ${response.status}`)
  }

  const contentLength = Number(response.headers.get('content-length') ?? task.input.expectedSizeBytes ?? 0)
  await ensureSpace(task.destinationPath, contentLength)
  const fileName = sanitizeName(task.input.fileName || path.basename(new URL(task.input.value).pathname) || task.name)
  const destination = path.join(task.stagingPath, fileName)
  await ensureInside(task.destinationPath, destination)

  let downloadedBytes = 0
  const body = Readable.fromWeb(response.body as unknown as Parameters<typeof Readable.fromWeb>[0])
  body.on('data', (chunk: Buffer) => {
    downloadedBytes += chunk.length
    updateDirectProgress(task, downloadedBytes, contentLength)
  })

  await pipeline(body, createWriteStream(destination))
  task.progress = {
    ...task.progress,
    downloadedBytes,
    totalBytes: contentLength || downloadedBytes,
    progress: 100
  }
  await markCompleted(task)
}

async function finalizeOplFiles(task: InternalTask) {
  const files = await listFilesRecursive(task.stagingPath)
  const selected = new Set(task.selectedFiles.map((file) => path.basename(file)))
  const candidates = files.filter((file) => {
    const ext = path.extname(file).toLowerCase()
    const selectedMatch = selected.size === 0 || selected.has(path.basename(file))
    return selectedMatch && ['.iso', '.bin', '.cue', '.elf'].includes(ext)
  })

  for (const file of candidates) {
    const destination = path.join(task.destinationPath, task.input.finalizeTo!, path.basename(file))
    await ensureInside(task.destinationPath, destination)
    await safeMove(file, destination)
    const gameId = await detectGameId(destination)
    if (gameId) {
      const artResult = await installArtForGame(task.destinationPath, gameId, task.input.title)
      await saveGameLibraryEntry({
        title: task.input.title ?? path.basename(destination, path.extname(destination)),
        gameId,
        media: task.input.finalizeTo === 'CD' ? 'CD' : 'DVD',
        path: destination,
        artStatus: artResult.status
      })
    }
    await addHistory({
      operation: 'Finalizar download OPL',
      origin: file,
      destination,
      result: 'success',
      message: 'Arquivo movido de staging para destino OPL final.'
    })
  }
}

export const p2pDownloadService: P2PDownloadService & {
  getQueue(): Promise<DownloadTask[]>
  listTorrentFiles(taskId: string): Promise<TorrentFileEntry[]>
  selectFiles(taskId: string, fileNames: string[]): Promise<void>
  start(taskId: string, destinationPath: string): Promise<void>
} = {
  async addTorrent(input: TorrentInput): Promise<DownloadTask> {
    const destinationPath = await ensureSafeDestination(input.destinationPath)
    const id = createId()
    const stagingPath = path.join(destinationPath, stagingDirName, id)
    await ensureInside(destinationPath, stagingPath)
    await fs.mkdir(stagingPath, { recursive: true })

    const task: InternalTask = {
      id,
      input,
      destinationPath,
      stagingPath,
      status: 'queued',
      createdAt: new Date().toISOString(),
      name: sanitizeName(input.title || input.fileName || path.basename(input.value) || 'download'),
      selectedFiles: input.selectedFiles ?? [],
      progress: {
        taskId: id,
        status: 'queued',
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        downloadSpeed: 0,
        uploadSpeed: 0,
        peers: 0
      }
    }

    tasks.set(id, task)
    sendLog('INFO', `Download adicionado a fila: ${task.name}`)

    try {
      if (input.source === 'direct-url') {
        void downloadDirectUrl(task).catch((error) => failTask(task, error))
        updateProgress(task, 'queued')
        return task
      }

      const client = await getClient()
      const source = input.source === 'torrent-file' ? await fs.readFile(input.value) : input.value
      task.torrent = client.add(source, { path: stagingPath }, (torrent) => {
        task.torrent = torrent
        task.name = sanitizeName(torrent.name ?? task.name)
        void prepareTorrentFiles(task, torrent)
          .then(() => updateProgress(task, 'downloading'))
          .catch((error) => {
            torrent.destroy()
            failTask(task, error)
          })
      })

      task.torrent.on('download', () => updateProgress(task, 'downloading'))
      task.torrent.on('done', () => void markCompleted(task))
      task.torrent.on('error', (error) => failTask(task, error))
      updateProgress(task, 'queued')
      return task
    } catch (error) {
      failTask(task, error)
      return task
    }
  },

  async pause(taskId: string) {
    const task = tasks.get(taskId)
    if (!task) throw new Error('Download nao encontrado.')
    task.torrent?.pause?.()
    updateProgress(task, 'paused')
  },

  async resume(taskId: string) {
    const task = tasks.get(taskId)
    if (!task) throw new Error('Download nao encontrado.')
    task.torrent?.resume?.()
    updateProgress(task, 'downloading')
  },

  async cancel(taskId: string) {
    const task = tasks.get(taskId)
    if (!task) throw new Error('Download nao encontrado.')
    task.torrent?.destroy()
    task.status = 'cancelled'
    task.progress = buildProgress(task, 'cancelled')
    sendDownloadEvent('download:progress', task.progress)
    sendLog('WARNING', `Download cancelado: ${task.name}`)
    await addHistory({
      operation: 'Download P2P cancelado',
      origin: task.input.value,
      destination: task.stagingPath,
      result: 'warning',
      message: 'Download cancelado pelo usuario.'
    })
  },

  async getProgress(taskId: string) {
    const task = tasks.get(taskId)
    if (!task) throw new Error('Download nao encontrado.')
    return task.progress
  },

  async getQueue() {
    return [...tasks.values()].map((task) => ({
      id: task.id,
      input: task.input,
      destinationPath: task.destinationPath,
      stagingPath: task.stagingPath,
      status: task.status,
      createdAt: task.createdAt,
      name: task.name,
      selectedFiles: task.selectedFiles
    }))
  },

  async listTorrentFiles(taskId: string) {
    const task = tasks.get(taskId)
    if (!task) throw new Error('Download nao encontrado.')
    const selected = new Set(task.selectedFiles)
    return (task.torrent?.files ?? []).map((file) => ({
      name: file.name,
      path: file.path,
      sizeBytes: file.length,
      selected: selected.size === 0 || selected.has(file.name) || selected.has(file.path)
    }))
  },

  async selectFiles(taskId: string, fileNames: string[]) {
    const task = tasks.get(taskId)
    if (!task) throw new Error('Download nao encontrado.')
    task.selectedFiles = fileNames
    if (task.torrent) await prepareTorrentFiles(task, task.torrent)
    updateProgress(task, task.status)
  },

  async start(taskId: string, destinationPath: string) {
    const task = tasks.get(taskId)
    if (!task) throw new Error('Download nao encontrado.')
    task.destinationPath = await ensureSafeDestination(destinationPath)
    task.torrent?.resume?.()
    updateProgress(task, 'downloading')
  }
}
