export class DeviceLockService {
  private readonly locks = new Map<string, Promise<void>>()
  private readonly revisions = new Map<string, number>()
  constructor(
    private readonly canonicalize: (deviceId: string) => string = (deviceId) => deviceId
  ) {}

  revision(deviceId: string): number {
    return this.revisions.get(this.canonicalize(deviceId)) ?? 0
  }

  async withLock<T>(
    deviceId: string,
    expectedRevision: number | undefined,
    work: () => Promise<T>
  ): Promise<T> {
    const key = this.canonicalize(deviceId)
    if (expectedRevision !== undefined && expectedRevision !== this.revision(key)) {
      throw Object.assign(new Error('Device state changed'), { code: 'STALE_REVISION' })
    }
    const prior = this.locks.get(key) ?? Promise.resolve()
    let release!: () => void
    const current = new Promise<void>((resolve) => {
      release = resolve
    })
    const queued = prior.then(() => current)
    this.locks.set(key, queued)
    await prior
    try {
      const result = await work()
      this.revisions.set(key, this.revision(key) + 1)
      return result
    } finally {
      release()
      if (this.locks.get(key) === queued) this.locks.delete(key)
    }
  }
}

export const deviceLocks = new DeviceLockService()
