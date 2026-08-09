import { mkdir, open, readFile, rename } from 'node:fs/promises'
import path from 'node:path'

export interface VersionedDocument<T> {
  schemaVersion: number
  revision: number
  updatedAt: string
  data: T
}

export type Migration<T> = (document: VersionedDocument<unknown>) => VersionedDocument<T>

export class JsonStore<T> {
  constructor(
    private readonly filePath: string,
    private readonly schemaVersion: number,
    private readonly initial: () => T,
    private readonly migrations: Record<number, Migration<T>> = {}
  ) {}

  async read(): Promise<VersionedDocument<T>> {
    try {
      const document = JSON.parse(await readFile(this.filePath, 'utf8')) as VersionedDocument<T>
      if (document.schemaVersion === this.schemaVersion) return document
      const migrate = this.migrations[document.schemaVersion]
      if (!migrate) throw new Error(`Unsupported schema version ${document.schemaVersion}`)
      return migrate(document)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      return {
        schemaVersion: this.schemaVersion,
        revision: 0,
        updatedAt: new Date(0).toISOString(),
        data: this.initial()
      }
    }
  }

  async write(data: T, expectedRevision?: number): Promise<VersionedDocument<T>> {
    const previous = await this.read()
    if (expectedRevision !== undefined && previous.revision !== expectedRevision) {
      throw Object.assign(new Error('The persisted document changed'), { code: 'STALE_REVISION' })
    }
    const document = {
      schemaVersion: this.schemaVersion,
      revision: previous.revision + 1,
      updatedAt: new Date().toISOString(),
      data
    }
    await mkdir(path.dirname(this.filePath), { recursive: true })
    const temporary = `${this.filePath}.${process.pid}.tmp`
    const handle = await open(temporary, 'w', 0o600)
    try {
      await handle.writeFile(`${JSON.stringify(document, null, 2)}\n`, 'utf8')
      await handle.sync()
    } finally {
      await handle.close()
    }
    await rename(temporary, this.filePath)
    if (process.platform !== 'win32') {
      const directory = await open(path.dirname(this.filePath), 'r')
      try {
        await directory.sync()
      } finally {
        await directory.close()
      }
    }
    return document
  }
}
