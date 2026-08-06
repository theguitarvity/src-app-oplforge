import { rename } from 'node:fs/promises'
import { JsonStore, type Migration, type VersionedDocument } from './json-store.service'

export interface AtomicEntityStoreOptions<T> {
  schemaVersion: number
  migrations?: Record<number, Migration<Record<string, T>>>
}

export class AtomicEntityStore<T extends object> {
  private readonly store: JsonStore<Record<string, T>>
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(
    private readonly filePath: string,
    private readonly idKey: keyof T,
    options: AtomicEntityStoreOptions<T>
  ) {
    this.store = new JsonStore(filePath, options.schemaVersion, () => ({}), options.migrations)
  }

  private async readDocument(): Promise<VersionedDocument<Record<string, T>>> {
    try {
      return await this.store.read()
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error
      const quarantine = `${this.filePath}.corrupt-${Date.now()}`
      await rename(this.filePath, quarantine)
      return this.store.read()
    }
  }

  async document(): Promise<VersionedDocument<Record<string, T>>> {
    return this.readDocument()
  }

  async get(id: string): Promise<T | undefined> {
    return (await this.readDocument()).data[id]
  }

  async list(): Promise<T[]> {
    return Object.values((await this.readDocument()).data)
  }

  async put(
    entity: T,
    expectedStoreRevision?: number
  ): Promise<VersionedDocument<Record<string, T>>> {
    const id = entity[this.idKey] as unknown
    if (typeof id !== 'string' || id.length === 0)
      throw new TypeError(`Missing entity key ${String(this.idKey)}`)
    return this.enqueue(async () => {
      const current = await this.readDocument()
      if (expectedStoreRevision !== undefined && current.revision !== expectedStoreRevision) {
        throw Object.assign(new Error('The persisted entity store changed'), {
          code: 'STALE_REVISION'
        })
      }
      return this.store.write({ ...current.data, [id]: entity }, current.revision)
    })
  }

  async remove(
    id: string,
    expectedStoreRevision?: number
  ): Promise<VersionedDocument<Record<string, T>>> {
    return this.enqueue(async () => {
      const current = await this.readDocument()
      if (expectedStoreRevision !== undefined && current.revision !== expectedStoreRevision) {
        throw Object.assign(new Error('The persisted entity store changed'), {
          code: 'STALE_REVISION'
        })
      }
      const next = { ...current.data }
      delete next[id]
      return this.store.write(next, current.revision)
    })
  }

  async replaceAll(
    entities: T[],
    expectedStoreRevision?: number
  ): Promise<VersionedDocument<Record<string, T>>> {
    const next: Record<string, T> = {}
    for (const entity of entities) {
      const id = entity[this.idKey] as unknown
      if (typeof id !== 'string' || id.length === 0)
        throw new TypeError(`Missing entity key ${String(this.idKey)}`)
      next[id] = entity
    }
    return this.enqueue(async () => {
      const current = await this.readDocument()
      if (expectedStoreRevision !== undefined && current.revision !== expectedStoreRevision)
        throw Object.assign(new Error('The persisted entity store changed'), {
          code: 'STALE_REVISION'
        })
      return this.store.write(next, current.revision)
    })
  }

  private async enqueue<R>(write: () => Promise<R>): Promise<R> {
    const result = this.writeQueue.then(write)
    this.writeQueue = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }
}
