import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { DownloadTarget } from '../../../src/types/opl-finalization'
import { ControlledError } from '../errors/controlled-error'
import { localFolderAuthorizations } from '../paths/local-folder-authorization.service'

export interface LocalPromotionResult {
  finalPath: string
  displayName: string
  sizeBytes: number
  sha256: string
}

function safeBasename(value: string | undefined): string {
  const name = path.basename((value || 'download.bin').replaceAll('\\', '/'))
  const sanitized = [...name]
    .map((character) =>
      character.charCodeAt(0) < 32 || '<>:"|?*'.includes(character) ? '_' : character
    )
    .join('')
    .trim()
  if (!sanitized || sanitized === '.' || sanitized === '..')
    throw new ControlledError('LOCAL_NAME_INVALID', 'Nome final inválido.')
  return sanitized
}

async function hashFile(file: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer)
  return hash.digest('hex')
}

export class LocalDestinationService {
  async promote(
    sourcePath: string,
    target: Extract<DownloadTarget, { kind: 'local-folder' }>,
    originalFileName?: string,
    signal?: AbortSignal
  ): Promise<LocalPromotionResult> {
    const root = await localFolderAuthorizations.resolve(target.authorizationId, target.rootToken)
    const source = await stat(sourcePath)
    const base = safeBasename(originalFileName)
    let displayName = base
    let finalPath = path.join(root, displayName)
    if (
      await stat(finalPath)
        .then(() => true)
        .catch(() => false)
    ) {
      if (target.collisionPolicy === 'fail')
        throw new ControlledError('LOCAL_COLLISION', 'Já existe um arquivo com esse nome.')
      const extension = path.extname(base)
      const stem = path.basename(base, extension)
      for (let suffix = 2; suffix <= 9999; suffix += 1) {
        displayName = `${stem} (${suffix})${extension}`
        finalPath = path.join(root, displayName)
        if (
          !(await stat(finalPath)
            .then(() => true)
            .catch(() => false))
        )
          break
      }
    }
    const stagingRoot = path.join(root, '.oplforge-staging')
    await mkdir(stagingRoot, { recursive: true })
    const staged = path.join(
      stagingRoot,
      `${createHash('sha256').update(finalPath).digest('hex')}.part`
    )
    try {
      await pipeline(createReadStream(sourcePath), createWriteStream(staged, { flags: 'wx' }), {
        signal
      })
      const stagedStat = await stat(staged)
      if (stagedStat.size !== source.size)
        throw new ControlledError('LOCAL_VERIFY_FAILED', 'O tamanho copiado não confere.')
      const sha256 = await hashFile(staged)
      await rename(staged, finalPath)
      return { finalPath, displayName, sizeBytes: stagedStat.size, sha256 }
    } catch (error) {
      await rm(staged, { force: true }).catch(() => undefined)
      throw error
    }
  }
}
