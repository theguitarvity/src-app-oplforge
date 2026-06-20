import type { DownloadProgress, DownloadTask, TorrentInput } from '@/types/opl'

export interface P2PDownloadService {
  addTorrent(input: TorrentInput): Promise<DownloadTask>
  pause(taskId: string): Promise<void>
  resume(taskId: string): Promise<void>
  cancel(taskId: string): Promise<void>
  getProgress(taskId: string): Promise<DownloadProgress>
}

export type { DownloadProgress, DownloadTask, TorrentInput }
