interface PendingNetwork<T> {
  priority: number
  order: number
  work: () => Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
}

export interface DownloadSchedulerOptions {
  networkConcurrency?: number
  canonicalDeviceId?: (deviceId: string) => string
}

export class DownloadSchedulerService {
  private activeNetwork = 0
  private order = 0
  private readonly networkQueue: PendingNetwork<unknown>[] = []
  private readonly writers = new Map<string, Promise<void>>()
  private readonly networkConcurrency: number
  private readonly canonicalDeviceId: (deviceId: string) => string

  constructor(options: DownloadSchedulerOptions = {}) {
    this.networkConcurrency = options.networkConcurrency ?? 2
    if (!Number.isInteger(this.networkConcurrency) || this.networkConcurrency < 1)
      throw new Error('networkConcurrency must be positive')
    this.canonicalDeviceId = options.canonicalDeviceId ?? ((value) => value)
  }

  scheduleNetwork<T>(priority: number, work: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.networkQueue.push({
        priority,
        order: this.order++,
        work,
        resolve,
        reject
      } as PendingNetwork<unknown>)
      this.networkQueue.sort(
        (left, right) => right.priority - left.priority || left.order - right.order
      )
      this.drainNetwork()
    })
  }

  scheduleWrite<T>(deviceId: string, _priority: number, work: () => Promise<T>): Promise<T> {
    const key = this.canonicalDeviceId(deviceId)
    const previous = this.writers.get(key) ?? Promise.resolve()
    const result = previous.catch(() => undefined).then(work)
    const tail = result.then(
      () => undefined,
      () => undefined
    )
    this.writers.set(key, tail)
    void tail.finally(() => {
      if (this.writers.get(key) === tail) this.writers.delete(key)
    })
    return result
  }

  private drainNetwork(): void {
    while (this.activeNetwork < this.networkConcurrency && this.networkQueue.length) {
      const pending = this.networkQueue.shift()!
      this.activeNetwork += 1
      void pending
        .work()
        .then(pending.resolve, pending.reject)
        .finally(() => {
          this.activeNetwork -= 1
          this.drainNetwork()
        })
    }
  }
}
