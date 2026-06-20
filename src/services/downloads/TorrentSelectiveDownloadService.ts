import type { DownloadTask, TorrentFileEntry } from '@/types/opl'

export interface TorrentSelectiveDownloadService {
  addTorrent(torrentUrl: string): Promise<DownloadTask>
  listTorrentFiles(taskId: string): Promise<TorrentFileEntry[]>
  selectFiles(taskId: string, fileNames: string[]): Promise<void>
  start(taskId: string, destination: string): Promise<void>
  pause(taskId: string): Promise<void>
  resume(taskId: string): Promise<void>
  cancel(taskId: string): Promise<void>
}
