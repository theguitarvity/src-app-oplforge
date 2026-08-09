import { randomUUID } from 'node:crypto'
import { app } from 'electron'
import { autoUpdater, type UpdateInfo } from 'electron-updater'
import type {
  OperationSummary,
  UpdatePolicy,
  UpdateSession
} from '../../../src/types/opl-finalization'
import { internalToPublic } from '../../../scripts/release-version'
export class UpdateService {
  private session: UpdateSession
  private listeners = new Set<(session: UpdateSession) => void>()
  constructor(private readonly activeOperations: () => OperationSummary[]) {
    this.session = this.makeSession('IDLE')
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false
    autoUpdater.allowPrerelease = false
    autoUpdater.on('update-available', (info) => this.available(info))
    autoUpdater.on('update-not-available', () => this.change('NO_UPDATE'))
    autoUpdater.on('download-progress', (p) => {
      this.session.downloadedBytes = p.transferred
      this.session.sizeBytes = p.total
      this.session.progress = p.percent
      this.change('DOWNLOADING')
    })
    autoUpdater.on('update-downloaded', () => this.change('READY_TO_INSTALL'))
    autoUpdater.on('error', (error) => this.fail(error))
  }
  get(): UpdateSession {
    return structuredClone(this.session)
  }
  subscribe(listener: (session: UpdateSession) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
  async check(): Promise<UpdateSession> {
    if (!app.isPackaged)
      return this.fail(
        new Error('Updates are available only in packaged builds'),
        'UPDATE_DEV_BUILD'
      )
    this.session = this.makeSession('CHECKING')
    this.emit()
    await autoUpdater.checkForUpdates()
    return this.get()
  }
  async applyStartupPolicy(policy: UpdatePolicy): Promise<void> {
    if (!app.isPackaged || policy.mode === 'manual-only' || policy.mode === 'ask-before-download')
      return
    const stop =
      policy.mode === 'download-automatic'
        ? this.subscribe((session) => {
            if (session.state === 'UPDATE_AVAILABLE') {
              stop()
              void this.download(session.sessionId, session.revision).catch(() => undefined)
            }
          })
        : () => undefined
    await this.check().catch(() => undefined)
  }
  async download(id: string, revision: number): Promise<UpdateSession> {
    this.assert(id, revision, 'UPDATE_AVAILABLE')
    this.change('DOWNLOADING')
    await autoUpdater.downloadUpdate()
    return this.get()
  }
  install(id: string, revision: number): UpdateSession {
    this.assert(id, revision, 'READY_TO_INSTALL')
    const blockers = this.activeOperations().filter(
      (item) => !['completed', 'ready', 'failed', 'cancelled'].includes(item.state)
    )
    if (blockers.length) {
      this.session.installBlockedByOperations = blockers.map((item) => item.operationId)
      this.bump()
      return this.get()
    }
    this.change('INSTALLING')
    setImmediate(() => autoUpdater.quitAndInstall(false, true))
    return this.get()
  }
  private available(info: UpdateInfo): void {
    this.session.candidateInternalVersion = info.version
    try {
      this.session.candidatePublicVersion = internalToPublic(info.version)
    } catch {
      this.session.candidatePublicVersion = info.version
    }
    this.session.releaseName = info.releaseName ?? undefined
    this.session.releaseNotes =
      typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined
    this.change('UPDATE_AVAILABLE')
  }
  private fail(error: Error, code = 'UPDATE_FAILED'): UpdateSession {
    this.session.lastError = {
      code,
      message: error.message.replace(/https?:\/\/\S+/g, '[feed]'),
      retryable: true,
      phase: this.session.state
    }
    this.change('ERROR')
    return this.get()
  }
  private change(state: UpdateSession['state']): void {
    this.session.state = state
    this.bump()
  }
  private bump(): void {
    this.session.revision += 1
    this.session.updatedAt = new Date().toISOString()
    this.emit()
  }
  private emit(): void {
    const value = this.get()
    for (const listener of this.listeners) listener(value)
  }
  private assert(id: string, revision: number, state: UpdateSession['state']): void {
    if (id !== this.session.sessionId)
      throw Object.assign(new Error('Update session not found'), {
        code: 'UPDATE_SESSION_NOT_FOUND'
      })
    if (revision !== this.session.revision)
      throw Object.assign(new Error('Update revision is stale'), { code: 'STALE_REVISION' })
    if (this.session.state !== state)
      throw Object.assign(new Error('Update command is not legal in this state'), {
        code: 'INVALID_UPDATE_STATE'
      })
  }
  private makeSession(state: UpdateSession['state']): UpdateSession {
    const current = app.getVersion()
    let publicVersion = current
    try {
      publicVersion = internalToPublic(current)
    } catch {
      /* development */
    }
    return {
      sessionId: randomUUID(),
      revision: 0,
      state,
      currentPublicVersion: publicVersion,
      currentInternalVersion: current,
      installBlockedByOperations: [],
      updatedAt: new Date().toISOString()
    }
  }
}
