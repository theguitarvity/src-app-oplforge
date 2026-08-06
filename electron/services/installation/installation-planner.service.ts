import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { access, constants, stat, statfs } from 'node:fs/promises'
import path from 'node:path'
import type { InstallationPlan, OplProfile } from '../../../src/types/opl'
import { canonicalGameName, normalizeGameId } from '../images/game-naming.service'
import { inspectIso } from '../images/iso9660.service'
import { readZsoHeader } from '../images/zso.service'
import { deviceLocks } from '../persistence/device-lock.service'

const FAT32_MAX_FILE_BYTES = 0xffffffff

/**
 * Compatibility assumptions used only to plan game files when no exact OPL
 * executable was registered. This is not an ELF identity or hardware approval.
 */
export const DEFAULT_INSTALLATION_PROFILE: OplProfile = {
  id: 'opl-default',
  version: 'compatibility-baseline',
  variant: 'planning-only',
  officialUrl: 'https://github.com/ps2homebrew/Open-PS2-Loader',
  elfSha256: '0'.repeat(64),
  obtainedAt: new Date(0).toISOString(),
  capabilities: { iso: true, zso: true, usbExtreme: true, fileSystems: ['FAT32', 'exFAT', 'NTFS'] }
}

export function chooseInstallationFormat(input: {
  extension: string
  sourceBytes: number
  fileSystem?: string
  zsoSupported: boolean
}): 'ISO' | 'ZSO' | 'USBExtreme' {
  const extension = input.extension.toLowerCase()
  const fat32 = /^(?:fat32|vfat|msdos)$/i.test(input.fileSystem ?? '')
  if (extension === '.zso') {
    if (!input.zsoSupported)
      throw Object.assign(new Error('Selected OPL profile does not support ZSO'), {
        code: 'UNSUPPORTED_FORMAT'
      })
    if (fat32 && input.sourceBytes > FAT32_MAX_FILE_BYTES) {
      throw Object.assign(
        new Error('ZSO exceeds the FAT32 file limit and cannot be split as USBExtreme'),
        { code: 'FAT32_FILE_TOO_LARGE' }
      )
    }
    return 'ZSO'
  }
  if (extension !== '.iso')
    throw Object.assign(new Error('Only ISO and ZSO sources are supported'), {
      code: 'UNSUPPORTED_FORMAT'
    })
  return fat32 && input.sourceBytes > FAT32_MAX_FILE_BYTES ? 'USBExtreme' : 'ISO'
}

function fileSystemName(type: number | bigint): string | undefined {
  const magic = Number(type)
  if (magic === 0x4d44) return 'vfat'
  if (magic === 0x2011bab0) return 'exfat'
  if (magic === 0x5346544e) return 'ntfs'
  return undefined
}

export async function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

export class InstallationPlannerService {
  async plan(input: {
    sourcePath: string
    sourceFileName?: string
    devicePath: string
    title: string
    profile: OplProfile
    fileSystem?: string
  }): Promise<InstallationPlan> {
    const sourcePath = path.resolve(input.sourcePath)
    const devicePath = path.resolve(input.devicePath)
    await access(sourcePath, constants.R_OK)
    const source = await stat(sourcePath)
    if (!source.isFile())
      throw Object.assign(new Error('Source must be a readable regular file'), {
        code: 'INVALID_SOURCE'
      })
    const logicalSourceName = input.sourceFileName ?? sourcePath
    const extension = path.extname(logicalSourceName).toLowerCase()
    let gameId: string | null
    let media: 'CD' | 'DVD' = 'DVD'
    const warnings: string[] = []
    if (extension === '.iso') {
      const image = await inspectIso(sourcePath)
      if (!image.valid)
        throw Object.assign(new Error('Invalid ISO9660 image'), { code: 'INVALID_IMAGE' })
      gameId = image.gameId
      media = image.media ?? 'DVD'
    } else if (extension === '.zso') {
      if (!input.profile.capabilities.zso)
        throw Object.assign(new Error('Selected OPL profile does not support ZSO'), {
          code: 'UNSUPPORTED_FORMAT'
        })
      await readZsoHeader(sourcePath)
      gameId = normalizeGameId(path.basename(logicalSourceName))
      warnings.push('ZSO Game ID derived from filename')
    } else
      throw Object.assign(new Error('Only ISO and ZSO sources are supported'), {
        code: 'UNSUPPORTED_FORMAT'
      })
    if (!gameId)
      throw Object.assign(new Error('Game ID was not found; set it explicitly before import'), {
        code: 'GAME_ID_REQUIRED'
      })
    const fs = await statfs(devicePath)
    const available = Number(fs.bavail) * Number(fs.bsize)
    if (available < source.size * 1.02)
      throw Object.assign(new Error('Insufficient destination space'), {
        code: 'INSUFFICIENT_SPACE'
      })
    const detectedFileSystem = input.fileSystem ?? fileSystemName(fs.type)
    if (!detectedFileSystem)
      warnings.push(
        'Destination filesystem could not be identified; FAT32 compatibility is not assumed'
      )
    const format = chooseInstallationFormat({
      extension,
      sourceBytes: source.size,
      fileSystem: detectedFileSystem,
      zsoSupported: input.profile.capabilities.zso
    })
    const destinationRelativePath =
      format === 'USBExtreme'
        ? 'ul.cfg'
        : path.join(media, canonicalGameName(gameId, input.title, format === 'ZSO' ? 'zso' : 'iso'))
    let replaces: string | undefined
    try {
      await access(path.join(devicePath, destinationRelativePath))
      replaces = destinationRelativePath
      warnings.push(
        'A valid existing destination will be preserved until replacement validation succeeds'
      )
    } catch {
      /* destination is free */
    }
    return {
      id: randomUUID(),
      sourcePath,
      devicePath,
      gameId,
      title: input.title,
      media,
      format,
      destinationRelativePath,
      sourceBytes: source.size,
      requiredBytes: Math.ceil(source.size * 1.02),
      sourceSha256: await sha256File(sourcePath),
      expectedRevision: deviceLocks.revision(devicePath),
      replaces,
      warnings
    }
  }
}
