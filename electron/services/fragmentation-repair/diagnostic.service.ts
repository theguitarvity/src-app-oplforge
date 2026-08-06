import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { lstat, readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import type {
  DeviceCapability,
  EvaluatedFile,
  Finding,
  FragmentationDiagnoseInput,
  FragmentationDiagnostic,
  FragmentationDiagnosisActivity,
  FragmentationInventory,
  FragmentationInventoryItem,
  GameDiagnostic,
  RepairEvent
} from '../../../src/types/opl'
import type { FragmentationAdapter } from '../fragmentation/fragmentation-adapter'
import { normalizeGameId } from '../images/game-naming.service'
import { inspectIso } from '../images/iso9660.service'
import { readZsoHeader } from '../images/zso.service'
import { decodeUlCfg, type UlEntry } from '../usbextreme/ul-cfg.service'
import { inspectDevice } from '../device.service'
import { captureSafeRoot, resolveInside } from '../persistence/safe-path.service'
import { classifyDiagnosticFiles, summarizeDiagnostics } from './diagnostic-classifier'
import { FragmentationCapabilityService } from './capability.service'
import { createInstallationIdentity, findDuplicateGameIds } from './identity'
import type { AtomicEntityStore } from './store'
import type { FragmentationRepairAuditService } from './audit.service'

export interface DeviceCapabilityProbe {
  probe(devicePath: string): Promise<DeviceCapability>
}
export interface DiagnosticServiceOptions {
  adapter: FragmentationAdapter
  diagnostics: AtomicEntityStore<FragmentationDiagnostic>
  probe: DeviceCapabilityProbe
  createId?: () => string
  now?: () => Date
  audit?: FragmentationRepairAuditService
}

export type DiagnosticEventPublisher = (event: RepairEvent) => void

export class FragmentationDiagnosticService {
  private readonly active = new Map<string, AbortController>()
  private readonly activities = new Map<string, FragmentationDiagnosisActivity>()
  private readonly runningByDevicePath = new Map<string, Promise<FragmentationDiagnostic>>()
  private readonly sequences = new Map<string, number>()
  private readonly createId: () => string
  private readonly now: () => Date

  constructor(private readonly options: DiagnosticServiceOptions) {
    this.createId = options.createId ?? randomUUID
    this.now = options.now ?? (() => new Date())
  }

  cancel(operationId: string): void {
    this.active.get(operationId)?.abort()
  }

  async inventory(devicePath: string): Promise<FragmentationInventory> {
    const device = await this.options.probe.probe(devicePath)
    const root = await captureSafeRoot(device.mountPath)
    if (root.real !== device.realPath)
      throw Object.assign(new Error('Selected device changed after capability probe'), {
        code: 'DEVICE_CHANGED'
      })
    const images: Array<{
      absolute: string
      relative: string
      media: 'CD' | 'DVD'
      format: 'ISO' | 'ZSO'
    }> = []
    for (const media of ['DVD', 'CD'] as const) {
      try {
        await this.walkImages(
          await resolveInside(root, media),
          root.real,
          media,
          images,
          new AbortController().signal
        )
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
    }
    const items: FragmentationInventoryItem[] = await Promise.all(
      images.map(async (image) => {
        const info = await stat(image.absolute)
        return {
          selectionKey: `image:${image.relative}`,
          format: image.format,
          title: path.basename(image.absolute, path.extname(image.absolute)),
          gameId: normalizeGameId(path.basename(image.absolute)) ?? undefined,
          media: image.media,
          relativePaths: [image.relative],
          totalBytes: info.size
        }
      })
    )
    try {
      const entries = decodeUlCfg(await readFile(path.join(root.real, 'ul.cfg')))
      const names = await readdir(root.real)
      const correlations = correlateUsbExtremeParts(names, entries)
      for (const [index, entry] of entries.entries()) {
        const parts = correlations[index].parts
        const sizes = await Promise.all(
          parts.map(async (relative) => (await stat(path.join(root.real, relative))).size)
        )
        items.push({
          selectionKey: `usb:${index}:${entry.gameId}`,
          format: 'USBExtreme',
          title: entry.title,
          gameId: entry.gameId,
          media: entry.media,
          relativePaths: parts,
          totalBytes: sizes.reduce((sum, size) => sum + size, 0)
        })
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    return {
      deviceId: device.deviceId,
      devicePath,
      items: items.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR')),
      capturedAt: this.now().toISOString()
    }
  }

  diagnose(
    input: FragmentationDiagnoseInput,
    publish: DiagnosticEventPublisher = () => undefined
  ): Promise<FragmentationDiagnostic> {
    const deviceKey = normalizeDevicePath(input.devicePath)
    const running = this.runningByDevicePath.get(deviceKey)
    if (running) return running
    const diagnosis = this.runDiagnostic(input, deviceKey, publish)
    this.runningByDevicePath.set(deviceKey, diagnosis)
    void diagnosis
      .finally(() => {
        if (this.runningByDevicePath.get(deviceKey) === diagnosis)
          this.runningByDevicePath.delete(deviceKey)
      })
      .catch(() => undefined)
    return diagnosis
  }

  async getCurrent(devicePath: string): Promise<FragmentationDiagnosisActivity | undefined> {
    const deviceKey = normalizeDevicePath(devicePath)
    const current = this.activities.get(deviceKey)
    if (current) return current
    const diagnostics = (await this.options.diagnostics.list())
      .filter(({ device }) =>
        [device.mountPath, device.realPath].some(
          (candidate) => normalizeDevicePath(candidate) === deviceKey
        )
      )
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt, 'en'))
    const diagnostic = diagnostics[0]
    return diagnostic ? activityFromDiagnostic(diagnostic, devicePath) : undefined
  }

  private async runDiagnostic(
    input: FragmentationDiagnoseInput,
    deviceKey: string,
    publish: DiagnosticEventPublisher
  ): Promise<FragmentationDiagnostic> {
    const diagnosticId = this.createId()
    const controller = new AbortController()
    this.active.set(diagnosticId, controller)
    this.sequences.set(diagnosticId, 0)
    const startedAt = this.now().toISOString()
    this.activities.set(deviceKey, {
      diagnosticId,
      devicePath: input.devicePath,
      status: 'running',
      processedItems: 0,
      totalItems: 0,
      progress: 0,
      message: 'Preparando diagnóstico do dispositivo',
      startedAt
    })
    this.emit(publish, diagnosticId, 'diagnosing', 0, 'Diagnóstico iniciado', undefined, 0, 0)
    let device: DeviceCapability
    try {
      device = await this.options.probe.probe(input.devicePath)
    } catch (error) {
      this.updateActivity(deviceKey, {
        status: controller.signal.aborted ? 'cancelled' : 'failed',
        message: controller.signal.aborted
          ? 'Diagnóstico cancelado'
          : 'Não foi possível acessar o dispositivo',
        completedAt: this.now().toISOString()
      })
      this.active.delete(diagnosticId)
      this.sequences.delete(diagnosticId)
      throw error
    }
    let diagnostic: FragmentationDiagnostic = {
      diagnosticId,
      revision: 1,
      device,
      status: 'running',
      installations: [],
      summary: summarizeDiagnostics([], device.freeBytes),
      startedAt
    }
    try {
      await this.options.diagnostics.put(diagnostic)
      this.updateActivity(deviceKey, {
        deviceId: device.deviceId,
        message: 'Inventariando jogos OPL'
      })
      const installations = await this.discover(
        device,
        controller.signal,
        (done, total, installationId, currentItem) => {
          const progress = total > 0 ? done / total : 0
          const message = total > 0 ? `Analisado ${done} de ${total}` : 'Inventariando jogos OPL'
          this.updateActivity(deviceKey, {
            processedItems: done,
            totalItems: total,
            progress,
            currentItem,
            message
          })
          this.emit(
            publish,
            diagnosticId,
            'diagnosing',
            progress,
            message,
            installationId,
            done,
            total,
            currentItem
          )
        },
        input.selectionKeys
      )
      diagnostic = {
        ...diagnostic,
        revision: 2,
        status: 'complete',
        installations,
        summary: summarizeDiagnostics(installations, device.freeBytes),
        completedAt: this.now().toISOString()
      }
      await this.options.diagnostics.put(diagnostic)
      await this.options.audit?.diagnosis(diagnostic)
      this.updateActivity(deviceKey, {
        status: 'complete',
        processedItems: installations.length,
        totalItems: installations.length,
        progress: 1,
        currentItem: undefined,
        message: 'Diagnóstico concluído',
        completedAt: diagnostic.completedAt,
        diagnostic
      })
      this.emit(
        publish,
        diagnosticId,
        'diagnosis-complete',
        1,
        'Diagnóstico concluído',
        undefined,
        installations.length,
        installations.length
      )
      return diagnostic
    } catch (error) {
      const cancelled =
        controller.signal.aborted || (error as { code?: string }).code === 'CANCELLED'
      diagnostic = {
        ...diagnostic,
        revision: 2,
        status: cancelled ? 'cancelled' : 'failed',
        completedAt: this.now().toISOString()
      }
      try {
        await this.options.diagnostics.put(diagnostic)
        await this.options.audit?.diagnosis(diagnostic)
      } catch {
        // The in-memory activity still reaches a terminal state if persistence itself failed.
      }
      this.updateActivity(deviceKey, {
        status: cancelled ? 'cancelled' : 'failed',
        message: cancelled
          ? 'Diagnóstico cancelado'
          : 'O diagnóstico foi interrompido por uma falha',
        completedAt: diagnostic.completedAt,
        diagnostic
      })
      throw cancelled
        ? Object.assign(new Error('Diagnosis cancelled'), { code: 'CANCELLED' })
        : error
    } finally {
      this.active.delete(diagnosticId)
      this.sequences.delete(diagnosticId)
    }
  }

  private updateActivity(deviceKey: string, update: Partial<FragmentationDiagnosisActivity>): void {
    const current = this.activities.get(deviceKey)
    if (current) this.activities.set(deviceKey, { ...current, ...update })
  }

  private emit(
    publish: DiagnosticEventPublisher,
    operationId: string,
    phase: RepairEvent['phase'],
    progress: number,
    message: string,
    installationId?: string,
    processedItems?: number,
    totalItems?: number,
    currentItem?: string
  ) {
    const sequence = (this.sequences.get(operationId) ?? 0) + 1
    this.sequences.set(operationId, sequence)
    publish({
      operationId,
      sequence,
      phase,
      progress,
      message,
      installationId,
      processedItems,
      totalItems,
      currentItem,
      timestamp: this.now().toISOString()
    })
  }

  private async discover(
    device: DeviceCapability,
    signal: AbortSignal,
    progress: (done: number, total: number, installationId?: string, currentItem?: string) => void,
    selectionKeys?: string[]
  ): Promise<GameDiagnostic[]> {
    const root = await captureSafeRoot(device.mountPath)
    if (root.real !== device.realPath)
      throw Object.assign(new Error('Selected device changed after capability probe'), {
        code: 'DEVICE_CHANGED'
      })
    const imagePaths: Array<{
      absolute: string
      relative: string
      media: 'CD' | 'DVD'
      format: 'ISO' | 'ZSO'
    }> = []
    for (const media of ['DVD', 'CD'] as const) {
      let directory: string
      try {
        directory = await resolveInside(root, media)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
        throw error
      }
      await this.walkImages(directory, root.real, media, imagePaths, signal)
    }
    const selected = selectionKeys ? new Set(selectionKeys) : undefined
    const selectedImages = selected
      ? imagePaths.filter((image) => selected.has(`image:${image.relative}`))
      : imagePaths
    const usb = await this.usbEntries(
      root.real,
      device,
      signal,
      (done, usbTotal, installationId, currentItem) => {
        progress(done, selectedImages.length + usbTotal, installationId, currentItem)
      },
      selected
    )
    const total = selectedImages.length + usb.length
    let completed = usb.length
    progress(completed, total)
    const images = selectedImages.sort((a, b) => a.relative.localeCompare(b.relative, 'en'))
    const evaluated = await mapWithConcurrency(images, 8, async (image) => {
      this.assertActive(signal)
      progress(completed, total, undefined, image.relative)
      const game = await this.evaluateImage(device, image)
      progress(++completed, total, game.identity.installationId, image.relative)
      return game
    })
    const games: GameDiagnostic[] = [...evaluated]
    for (const game of usb) games.push(game)
    this.addDuplicateFindings(games)
    return games.sort((a, b) =>
      a.identity.installationId.localeCompare(b.identity.installationId, 'en')
    )
  }

  private async walkImages(
    directory: string,
    root: string,
    media: 'CD' | 'DVD',
    output: Array<{
      absolute: string
      relative: string
      media: 'CD' | 'DVD'
      format: 'ISO' | 'ZSO'
    }>,
    signal: AbortSignal
  ): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      this.assertActive(signal)
      const absolute = path.join(directory, entry.name)
      if ((await lstat(absolute)).isSymbolicLink()) continue
      if (entry.isDirectory()) {
        await this.walkImages(absolute, root, media, output, signal)
        continue
      }
      const extension = path.extname(entry.name).toLowerCase()
      if (entry.isFile() && (extension === '.iso' || extension === '.zso'))
        output.push({
          absolute,
          relative: path.relative(root, absolute).split(path.sep).join('/'),
          media,
          format: extension === '.iso' ? 'ISO' : 'ZSO'
        })
    }
  }

  private async evaluateImage(
    device: DeviceCapability,
    image: { absolute: string; relative: string; media: 'CD' | 'DVD'; format: 'ISO' | 'ZSO' }
  ): Promise<GameDiagnostic> {
    const fileStat = await stat(image.absolute)
    let structuralState: EvaluatedFile['structuralState'] = 'valid'
    let gameId = normalizeGameId(path.basename(image.absolute)) ?? undefined
    let media = image.media
    const findings: Finding[] = []
    try {
      if (image.format === 'ISO') {
        const inspection = await inspectIso(image.absolute)
        structuralState = inspection.valid ? 'valid' : 'invalid'
        gameId = inspection.gameId ?? gameId
        media = inspection.media ?? media
        if (!inspection.valid)
          findings.push(this.finding('IMAGE_INVALID', 'ISO9660 structure is invalid', 'error'))
      } else await readZsoHeader(image.absolute)
    } catch (error) {
      structuralState = (error as { code?: string }).code?.includes('INCOMPLETE')
        ? 'incomplete'
        : 'invalid'
      findings.push(this.finding('IMAGE_INVALID', (error as Error).message, 'error'))
    }
    const evidence =
      structuralState === 'valid' && device.extentVerification === 'supported'
        ? await this.options.adapter.inspect(image.absolute)
        : undefined
    const evaluated: EvaluatedFile = {
      relativePath: image.relative,
      role: 'game',
      sizeBytes: fileStat.size,
      modifiedAt: fileStat.mtime.toISOString(),
      sha256: await sha256File(image.absolute),
      structuralState,
      extentState:
        evidence?.state === 'contiguous' || evidence?.state === 'fragmented'
          ? evidence.state
          : 'unverifiable',
      extentCount: evidence?.extents,
      verificationMethod: evidence?.method,
      findings: [...findings]
    }
    const identity = createInstallationIdentity({
      deviceId: device.deviceId,
      format: image.format,
      relativePaths: [image.relative],
      gameId,
      title: path.basename(image.absolute, path.extname(image.absolute)),
      media
    })
    const files = [...(await this.auxiliaryFiles(device.realPath, gameId)), evaluated]
    const state = classifyDiagnosticFiles(files, false)
    return {
      identity,
      files,
      state,
      totalBytes: fileStat.size,
      temporaryBytes: state === 'fragmented' ? estimatedTemporaryBytes(fileStat.size) : 0,
      findings
    }
  }

  private async usbEntries(
    root: string,
    device: DeviceCapability,
    signal: AbortSignal,
    progress: (done: number, total: number, installationId?: string, currentItem?: string) => void,
    selected?: Set<string>
  ): Promise<GameDiagnostic[]> {
    let entries
    try {
      entries = decodeUlCfg(await readFile(path.join(root, 'ul.cfg')))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      return []
    }
    const games: GameDiagnostic[] = []
    const indexedEntries = entries
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry, index }) => !selected || selected.has(`usb:${index}:${entry.gameId}`))
    const correlations = correlateUsbExtremeParts(await readdir(root), entries)
    const ulCfgInfo = await stat(path.join(root, 'ul.cfg'))
    const ulCfgSha256 = await sha256File(path.join(root, 'ul.cfg'))
    progress(0, indexedEntries.length, undefined, indexedEntries.length > 0 ? 'ul.cfg' : undefined)
    for (const [selectedIndex, { entry, index: entryIndex }] of indexedEntries.entries()) {
      this.assertActive(signal)
      progress(selectedIndex, indexedEntries.length, undefined, entry.title)
      const validation = correlations[entryIndex]
      const files: EvaluatedFile[] = []
      for (const relativePath of validation.parts) {
        const absolute = path.join(root, relativePath)
        const info = await stat(absolute)
        const evidence =
          device.extentVerification === 'supported'
            ? await this.options.adapter.inspect(absolute)
            : undefined
        files.push({
          relativePath,
          role: 'usb-part',
          sizeBytes: info.size,
          modifiedAt: info.mtime.toISOString(),
          sha256: await sha256File(absolute),
          structuralState: 'valid',
          extentState:
            evidence?.state === 'contiguous' || evidence?.state === 'fragmented'
              ? evidence.state
              : 'unverifiable',
          extentCount: evidence?.extents,
          verificationMethod: evidence?.method,
          findings: []
        })
      }
      for (const missing of validation.missing)
        files.push({
          relativePath: `ul.${entry.gameId}.${String(missing).padStart(2, '0')}`,
          role: 'usb-part',
          structuralState: 'incomplete',
          extentState: 'unverifiable',
          findings: [
            this.finding('UL_PART_MISSING', `USBExtreme part ${missing} is missing`, 'error')
          ]
        })
      files.push({
        relativePath: 'ul.cfg',
        role: 'ul-cfg',
        sizeBytes: ulCfgInfo.size,
        modifiedAt: ulCfgInfo.mtime.toISOString(),
        sha256: ulCfgSha256,
        structuralState: validation.collision ? 'invalid' : 'valid',
        extentState: 'not-applicable',
        findings: validation.collision
          ? [
              this.finding(
                'USB_PART_COLLISION',
                'Multiple ul.cfg records or filename groups claim the same USBExtreme parts',
                'error'
              )
            ]
          : []
      })
      files.push(...(await this.auxiliaryFiles(root, entry.gameId)))
      const relativePaths = files
        .filter(({ role }) => role === 'usb-part')
        .map(({ relativePath }) => relativePath)
      const identity = createInstallationIdentity({
        deviceId: device.deviceId,
        format: 'USBExtreme',
        relativePaths,
        gameId: entry.gameId,
        title: entry.title,
        media: entry.media
      })
      const state = classifyDiagnosticFiles(files, true)
      const totalBytes = files
        .filter(({ role }) => role === 'usb-part')
        .reduce((sum, file) => sum + (file.sizeBytes ?? 0), 0)
      const candidateBytes = files
        .filter(({ extentState }) => extentState === 'fragmented')
        .reduce((sum, file) => sum + (file.sizeBytes ?? 0), 0)
      games.push({
        identity,
        files,
        state,
        totalBytes,
        temporaryBytes: candidateBytes ? estimatedTemporaryBytes(candidateBytes) : 0,
        findings: files.flatMap(({ findings }) => findings)
      })
      progress(selectedIndex + 1, indexedEntries.length, identity.installationId, entry.title)
    }
    return games
  }

  private async auxiliaryFiles(root: string, gameId?: string): Promise<EvaluatedFile[]> {
    if (!gameId) return []
    const files: EvaluatedFile[] = []
    for (const directory of ['ART', 'CFG', 'VMC']) {
      try {
        for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
          if (!entry.isFile() || !entry.name.toUpperCase().includes(gameId.toUpperCase())) continue
          const absolute = path.join(root, directory, entry.name)
          const info = await stat(absolute)
          files.push({
            relativePath: `${directory}/${entry.name}`,
            role: 'auxiliary',
            sizeBytes: info.size,
            modifiedAt: info.mtime.toISOString(),
            sha256: await sha256File(absolute),
            structuralState: 'valid',
            extentState: 'not-applicable',
            findings: []
          })
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
    }
    return files
  }

  private addDuplicateFindings(games: GameDiagnostic[]) {
    for (const [gameId, installationIds] of findDuplicateGameIds(
      games.map(({ identity }) => identity)
    )) {
      for (const game of games.filter(({ identity }) =>
        installationIds.includes(identity.installationId)
      ))
        game.findings.push(
          this.finding(
            'DUPLICATE_GAME_ID',
            `Game ID ${gameId} is shared by distinct installations`,
            'warning'
          )
        )
    }
  }

  private finding(code: string, message: string, severity: Finding['severity']): Finding {
    return { code, message, severity, state: severity === 'error' ? 'failed' : 'not-verified' }
  }
  private assertActive(signal: AbortSignal) {
    if (signal.aborted) throw Object.assign(new Error('Diagnosis cancelled'), { code: 'CANCELLED' })
  }
}

export interface UsbPartCorrelation {
  parts: string[]
  missing: number[]
  collision: boolean
}

export function correlateUsbExtremeParts(
  names: readonly string[],
  entries: readonly UlEntry[]
): UsbPartCorrelation[] {
  const seenGameIds = new Map<string, number>()
  for (const entry of entries)
    seenGameIds.set(entry.gameId, (seenGameIds.get(entry.gameId) ?? 0) + 1)
  return entries.map((entry) => {
    const escaped = entry.gameId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const matches = names
      .map((name) => ({
        name,
        match: name.match(new RegExp(`^(ul\\.[^.]+\\.${escaped})\\.(\\d{2})$`, 'i'))
      }))
      .filter((value) => value.match)
    const prefixes = new Set(matches.map(({ match }) => match![1].toLowerCase()))
    const byIndex = new Map(matches.map(({ name, match }) => [Number(match![2]), name]))
    const missing = Array.from({ length: entry.parts }, (_, index) => index).filter(
      (index) => !byIndex.has(index)
    )
    const parts = Array.from({ length: entry.parts }, (_, index) => byIndex.get(index)).filter(
      (name): name is string => Boolean(name)
    )
    return {
      parts,
      missing,
      collision:
        (seenGameIds.get(entry.gameId) ?? 0) > 1 ||
        prefixes.size > 1 ||
        matches.some(({ match }) => Number(match![2]) >= entry.parts)
    }
  })
}

export async function probeBasicDeviceCapability(
  devicePath: string,
  adapter: FragmentationAdapter
): Promise<DeviceCapability> {
  const device = await inspectDevice(devicePath)
  const rootIdentity = await lstat(device.realPath, { bigint: true })
  return new FragmentationCapabilityService(adapter).probe({
    deviceId: createHash('sha256').update(`${rootIdentity.dev}:${rootIdentity.ino}`).digest('hex'),
    mountPath: device.mountPath,
    realPath: device.realPath,
    volumeId: device.volumeId,
    fileSystem: device.fileSystem,
    totalBytes: device.totalBytes,
    freeBytes: device.freeBytes,
    sampleFilePath: await findExtentSample(device.realPath)
  })
}

async function findExtentSample(root: string): Promise<string | undefined> {
  for (const directory of ['DVD', 'CD', '.']) {
    try {
      for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
        if (!entry.isFile()) continue
        const extension = path.extname(entry.name).toLowerCase()
        if (extension === '.iso' || extension === '.zso' || entry.name.startsWith('ul.'))
          return path.join(root, directory, entry.name)
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
  return undefined
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(filePath)) hash.update(chunk as Buffer)
  return hash.digest('hex')
}

function estimatedTemporaryBytes(candidateBytes: number): number {
  return candidateBytes + Math.max(64 * 1024 * 1024, Math.ceil(candidateBytes * 0.02))
}

function normalizeDevicePath(devicePath: string): string {
  return path.resolve(devicePath)
}

function activityFromDiagnostic(
  diagnostic: FragmentationDiagnostic,
  devicePath: string
): FragmentationDiagnosisActivity {
  const totalItems = diagnostic.summary.total
  const interrupted = diagnostic.status === 'running'
  const status = interrupted ? 'failed' : diagnostic.status
  const messages: Record<FragmentationDiagnostic['status'], string> = {
    running: 'Diagnóstico em andamento',
    complete: 'Diagnóstico concluído',
    cancelled: 'Diagnóstico cancelado',
    failed: 'O diagnóstico foi interrompido por uma falha'
  }
  return {
    diagnosticId: diagnostic.diagnosticId,
    devicePath,
    deviceId: diagnostic.device.deviceId,
    status,
    processedItems: interrupted ? diagnostic.installations.length : totalItems,
    totalItems,
    progress: interrupted ? 0 : 1,
    message: interrupted
      ? 'O aplicativo foi encerrado antes de concluir o diagnóstico'
      : messages[diagnostic.status],
    startedAt: diagnostic.startedAt,
    completedAt: diagnostic.completedAt,
    diagnostic: interrupted ? undefined : diagnostic
  }
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  work: (value: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length)
  let next = 0
  async function worker() {
    for (;;) {
      const index = next++
      if (index >= values.length) return
      results[index] = await work(values[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker))
  return results
}
