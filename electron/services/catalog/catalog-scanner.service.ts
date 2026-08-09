import { createHash, randomUUID } from 'node:crypto'
import { lstat, readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import type { CatalogItem, Finding, OplProfile } from '../../../src/types/opl'
import type { FragmentationAdapter } from '../fragmentation/fragmentation-adapter'
import { normalizeGameId } from '../images/game-naming.service'
import { inspectIso } from '../images/iso9660.service'
import { readZsoHeader } from '../images/zso.service'
import { captureSafeRoot, resolveInside } from '../persistence/safe-path.service'
import { decodeUlCfg, validateUlParts } from '../usbextreme/ul-cfg.service'
import { localArtIndex, type LocalArtIndexSnapshot } from './local-art-index.service'

export class CatalogScannerService {
  constructor(private readonly fragmentation: FragmentationAdapter) {}
  async scan(
    devicePath: string,
    deviceId: string,
    profile?: OplProfile,
    signal?: AbortSignal
  ): Promise<{ items: CatalogItem[]; findings: Finding[] }> {
    const root = await captureSafeRoot(devicePath)
    const items: CatalogItem[] = []
    const findings: Finding[] = []
    const artIndex = await localArtIndex.scan(devicePath, deviceId).catch((error) => {
      const previous = localArtIndex.get(deviceId)
      if (previous) return previous
      throw error
    })
    let foundOplMediaDirectory = false
    for (const media of ['DVD', 'CD'] as const) {
      try {
        const mediaDirectory = await resolveInside(root, media)
        foundOplMediaDirectory = true
        await this.walk(
          mediaDirectory,
          root.real,
          media,
          deviceId,
          profile,
          items,
          findings,
          signal,
          new Set(),
          artIndex
        )
      } catch (error) {
        findings.push({
          code: 'DIRECTORY_INACCESSIBLE',
          severity: 'warning',
          state: 'not-verified',
          message: `${media}: ${(error as Error).message}`
        })
      }
    }
    if (!foundOplMediaDirectory) {
      await this.walk(
        root.real,
        root.real,
        'DVD',
        deviceId,
        profile,
        items,
        findings,
        signal,
        new Set(),
        artIndex
      )
    }
    try {
      const cfgPath = await resolveInside(root, 'ul.cfg')
      const entries = decodeUlCfg(await readFile(cfgPath))
      for (const entry of entries) {
        if (signal?.aborted) throw Object.assign(new Error('Scan cancelled'), { code: 'CANCELLED' })
        const validation = await validateUlParts(root.real, entry)
        const files = await Promise.all(
          validation.parts.map(async (name) =>
            this.identity(deviceId, root.real, path.join(root.real, name))
          )
        )
        const fragmentation = validation.complete
          ? await Promise.all(
              files.map((file) =>
                this.fragmentation.inspect(path.join(root.real, file.relativePath))
              )
            )
          : []
        const state = !validation.complete
          ? 'failed'
          : fragmentation.every((e) => e.state === 'contiguous')
            ? 'verified'
            : 'not-verified'
        items.push({
          itemId: randomUUID(),
          kind: 'game',
          title: entry.title,
          gameId: entry.gameId,
          gameIdSource: 'ul-cfg',
          mediaType: entry.media,
          installFormat: 'USBExtreme',
          relativePath: 'ul.cfg',
          files,
          totalBytes: files.reduce((sum, file) => sum + file.sizeBytes, 0),
          structuralIntegrity: state,
          hashState: 'not-calculated',
          fragmentation: fragmentation.some((e) => e.state === 'fragmented')
            ? 'fragmented'
            : fragmentation.every((e) => e.state === 'contiguous')
              ? 'contiguous'
              : 'unknown',
          artStatus: this.artStatus(artIndex, entry.gameId),
          artView: localArtIndex.view(artIndex, entry.gameId),
          compatibility:
            profile?.capabilities.usbExtreme === false
              ? 'failed'
              : profile
                ? 'verified'
                : 'not-verified',
          classification: !validation.complete
            ? 'invalid'
            : state === 'verified'
              ? 'ready'
              : 'warning',
          findings: validation.missing.map((part) => ({
            code: 'UL_PART_MISSING',
            severity: 'error',
            state: 'failed',
            message: `USBExtreme part ${part} is missing`
          }))
        })
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
        findings.push({
          code: 'UL_CFG_INCONSISTENT',
          severity: 'error',
          state: 'failed',
          message: (error as Error).message
        })
    }
    return { items, findings }
  }

  private async walk(
    directory: string,
    root: string,
    media: 'DVD' | 'CD',
    deviceId: string,
    profile: OplProfile | undefined,
    items: CatalogItem[],
    findings: Finding[],
    signal: AbortSignal | undefined,
    visited: Set<string>,
    artIndex: LocalArtIndexSnapshot
  ): Promise<void> {
    const current = await stat(directory, { bigint: true })
    const identity = `${current.dev}:${current.ino}`
    if (visited.has(identity)) return
    visited.add(identity)
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (signal?.aborted) throw Object.assign(new Error('Scan cancelled'), { code: 'CANCELLED' })
      const absolute = path.join(directory, entry.name)
      const linkStat = await lstat(absolute)
      if (linkStat.isSymbolicLink()) {
        findings.push({
          code: 'SYMLINK_SKIPPED',
          severity: 'warning',
          state: 'not-verified',
          message: `Skipped symbolic link ${entry.name}`
        })
        continue
      }
      if (entry.isDirectory()) {
        await this.walk(
          absolute,
          root,
          media,
          deviceId,
          profile,
          items,
          findings,
          signal,
          visited,
          artIndex
        )
        continue
      }
      if (!entry.isFile()) continue
      const extension = path.extname(entry.name).toLowerCase()
      const file = await this.identity(deviceId, root, absolute)
      if (!['.iso', '.zso'].includes(extension)) {
        items.push(this.unknown(file, media))
        continue
      }
      try {
        let gameId: string | null
        let detectedMedia: 'DVD' | 'CD' = media
        let integrity: 'verified' | 'failed' = 'verified'
        let source: 'iso' | 'zso' | 'filename'
        if (extension === '.iso') {
          const inspection = await inspectIso(absolute)
          integrity = inspection.valid ? 'verified' : 'failed'
          gameId = inspection.gameId
          detectedMedia = inspection.media ?? media
          source = inspection.gameId ? 'iso' : 'filename'
        } else {
          await readZsoHeader(absolute)
          gameId = normalizeGameId(entry.name)
          source = 'zso'
        }
        gameId ??= normalizeGameId(entry.name)
        const evidence = await this.fragmentation.inspect(absolute)
        const compatible =
          extension === '.zso' && profile?.capabilities.zso === false
            ? 'failed'
            : profile
              ? 'verified'
              : 'not-verified'
        const invalid = integrity === 'failed' || compatible === 'failed'
        const warning = !gameId || evidence.state !== 'contiguous' || !profile
        items.push({
          itemId: randomUUID(),
          kind: 'game',
          title: entry.name
            .replace(/\.(iso|zso)$/i, '')
            .replace(/^[A-Z]{4}_[0-9]{3}\.[0-9]{2}\./i, ''),
          gameId: gameId ?? undefined,
          gameIdSource: gameId ? source : 'none',
          mediaType: detectedMedia,
          installFormat: extension === '.zso' ? 'ZSO' : 'ISO',
          relativePath: file.relativePath,
          files: [file],
          totalBytes: file.sizeBytes,
          structuralIntegrity: integrity,
          hashState: 'not-calculated',
          fragmentation: evidence.state,
          artStatus: gameId ? this.artStatus(artIndex, gameId) : 'missing',
          artView: gameId ? localArtIndex.view(artIndex, gameId) : undefined,
          compatibility: compatible,
          classification: invalid ? 'invalid' : warning ? 'warning' : 'ready',
          findings: !gameId
            ? [
                {
                  code: 'GAME_ID_MISSING',
                  severity: 'warning',
                  state: 'not-verified',
                  message: 'Game ID was not detected'
                }
              ]
            : []
        })
      } catch (error) {
        const unknown = this.unknown(file, media)
        unknown.findings.push({
          code: 'IMAGE_INVALID',
          severity: 'error',
          state: 'failed',
          message: (error as Error).message
        })
        items.push(unknown)
      }
    }
  }

  private async identity(deviceId: string, root: string, absolute: string) {
    const value = await stat(absolute)
    return {
      deviceId,
      relativePath: path.relative(root, absolute),
      sizeBytes: value.size,
      modifiedAt: value.mtime.toISOString(),
      structuralSignature: createHash('sha256')
        .update(`${value.size}:${value.mtimeMs}`)
        .digest('hex')
    }
  }
  private unknown(
    file: Awaited<ReturnType<CatalogScannerService['identity']>>,
    media: 'DVD' | 'CD'
  ): CatalogItem {
    return {
      itemId: randomUUID(),
      kind: 'unknown',
      gameIdSource: 'none',
      mediaType: media,
      installFormat: 'unknown',
      relativePath: file.relativePath,
      files: [file],
      totalBytes: file.sizeBytes,
      structuralIntegrity: 'not-verified',
      hashState: 'not-calculated',
      fragmentation: 'unknown',
      artStatus: 'missing',
      compatibility: 'not-verified',
      classification: 'invalid',
      findings: [
        {
          code: 'UNKNOWN_FILE',
          severity: 'warning',
          state: 'not-verified',
          message: 'File is not a recognized OPL game image'
        }
      ]
    }
  }
  private artStatus(index: LocalArtIndexSnapshot, gameId: string) {
    const view = localArtIndex.view(index, gameId)
    return view.primaryCoverAssetId
      ? view.availableTypes.length > 1
        ? ('partial' as const)
        : ('cover-ready' as const)
      : ('missing' as const)
  }
}
