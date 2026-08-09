import { createHash, randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import type { LocalFolderAuthorization } from '../../../src/types/opl'
import { ControlledError } from '../errors/controlled-error'

interface StoredAuthorization extends LocalFolderAuthorization {
  canonicalRoot: string
  rootFingerprint: string
}

export class LocalFolderAuthorizationService {
  private readonly authorizations = new Map<string, StoredAuthorization>()
  private loaded = false

  private async load(): Promise<void> {
    if (this.loaded) return
    this.loaded = true
    const items = await fs
      .readFile(path.join(app.getPath('userData'), 'local-folder-authorizations.json'), 'utf8')
      .then((value) => JSON.parse(value) as StoredAuthorization[])
      .catch(() => [])
    for (const item of items) this.authorizations.set(item.authorizationId, item)
  }

  private async persist(): Promise<void> {
    const file = path.join(app.getPath('userData'), 'local-folder-authorizations.json')
    await fs.mkdir(path.dirname(file), { recursive: true })
    const temporary = `${file}.tmp`
    await fs.writeFile(temporary, JSON.stringify([...this.authorizations.values()], null, 2), {
      mode: 0o600
    })
    await fs.rename(temporary, file)
  }

  async authorize(root: string): Promise<LocalFolderAuthorization> {
    await this.load()
    const canonicalRoot = await fs.realpath(root)
    const stat = await fs.stat(canonicalRoot)
    if (!stat.isDirectory())
      throw new ControlledError('LOCAL_ROOT_INVALID', 'Selecione uma pasta válida.')
    const authorizationId = randomUUID()
    const item: StoredAuthorization = {
      authorizationId,
      rootToken: createHash('sha256')
        .update(`${authorizationId}:${canonicalRoot}`)
        .digest('base64url'),
      displayLabel: path.basename(canonicalRoot) || canonicalRoot,
      state: 'valid',
      canonicalRoot,
      rootFingerprint: `${stat.dev}:${stat.ino}`,
      createdAt: new Date().toISOString(),
      lastValidatedAt: new Date().toISOString()
    }
    this.authorizations.set(authorizationId, item)
    await this.persist()
    return this.public(item)
  }

  async resolve(authorizationId: string, rootToken: string): Promise<string> {
    await this.load()
    const item = this.authorizations.get(authorizationId)
    if (!item || item.rootToken !== rootToken)
      throw new ControlledError('LOCAL_ROOT_UNAUTHORIZED', 'Pasta não autorizada.')
    const canonicalRoot = await fs.realpath(item.canonicalRoot).catch(() => '')
    if (!canonicalRoot || canonicalRoot !== item.canonicalRoot)
      throw new ControlledError(
        'LOCAL_ROOT_CHANGED',
        'A pasta selecionada não está mais disponível.',
        true
      )
    const stat = await fs.stat(canonicalRoot)
    if (`${stat.dev}:${stat.ino}` !== item.rootFingerprint)
      throw new ControlledError(
        'LOCAL_ROOT_CHANGED',
        'A identidade da pasta selecionada mudou.',
        true
      )
    item.lastValidatedAt = new Date().toISOString()
    await this.persist()
    return canonicalRoot
  }

  async createChild(authorizationId: string, rootToken: string, folderName: string) {
    if (!folderName || folderName !== path.basename(folderName) || /[\\/]/.test(folderName))
      throw new ControlledError('LOCAL_NAME_INVALID', 'Informe um nome simples para a pasta.')
    const parent = await this.resolve(authorizationId, rootToken)
    const child = path.join(parent, folderName.trim())
    await fs.mkdir(child, { recursive: false })
    return this.authorize(child)
  }

  private public(item: StoredAuthorization): LocalFolderAuthorization {
    return structuredClone({
      authorizationId: item.authorizationId,
      rootToken: item.rootToken,
      displayLabel: item.displayLabel,
      state: item.state,
      createdAt: item.createdAt,
      lastValidatedAt: item.lastValidatedAt
    })
  }
}

export const localFolderAuthorizations = new LocalFolderAuthorizationService()
