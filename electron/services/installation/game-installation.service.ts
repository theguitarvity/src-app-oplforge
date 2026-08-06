import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, open, readFile, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { FragmentationAdapter } from '../fragmentation/fragmentation-adapter'
import type { InstallationPlan, InstallationResult } from '../../../src/types/opl'
import { deviceLocks } from '../persistence/device-lock.service'
import { decodeUlCfg, encodeUlCfg, type UlEntry } from '../usbextreme/ul-cfg.service'
import { createUsbExtremeLayout } from '../usbextreme/codec.service'
import { sha256File } from './installation-planner.service'

interface Journal {
  plan: InstallationPlan
  state: 'staging' | 'promoting'
  staged: string[]
  promoted: string[]
  backups: Array<{ destination: string; backup: string }>
}

async function copyRange(
  source: string,
  destination: string,
  start = 0,
  end?: number
): Promise<void> {
  await pipeline(
    createReadStream(source, end === undefined ? { start } : { start, end }),
    createWriteStream(destination, { flags: 'wx', mode: 0o600 })
  )
  const handle = await open(destination, 'r+')
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

async function sha256Parts(parts: string[]): Promise<string> {
  const hash = createHash('sha256')
  for (const part of parts)
    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(part)
      stream.on('data', (chunk) => hash.update(chunk))
      stream.on('end', resolve)
      stream.on('error', reject)
    })
  return hash.digest('hex')
}

export class GameInstallationService {
  private readonly plans = new Map<string, InstallationPlan>()
  private readonly cancelled = new Set<string>()
  constructor(private readonly fragmentation: FragmentationAdapter) {}
  remember(plan: InstallationPlan): InstallationPlan {
    this.plans.set(plan.id, structuredClone(plan))
    return plan
  }
  cancel(operationId: string): void {
    this.cancelled.add(operationId)
  }

  async confirm(
    operationId: string,
    expectedRevision: number,
    confirmation: string
  ): Promise<InstallationResult> {
    const plan = this.plans.get(operationId)
    if (!plan)
      throw Object.assign(new Error('Installation plan not found'), { code: 'PLAN_NOT_FOUND' })
    const required = plan.replaces ? 'SUBSTITUIR BACKUP AUTORIZADO' : 'INSTALAR BACKUP AUTORIZADO'
    if (confirmation !== required)
      throw Object.assign(new Error('Explicit legal/replacement confirmation required'), {
        code: 'CONFIRMATION_REQUIRED'
      })
    return deviceLocks.withLock(plan.devicePath, expectedRevision, async () => this.install(plan))
  }

  private async install(plan: InstallationPlan): Promise<InstallationResult> {
    const stagingRoot = path.join(plan.devicePath, '.oplforge-staging', plan.id)
    await mkdir(stagingRoot, { recursive: true })
    const journalPath = path.join(stagingRoot, 'journal.json')
    const journal: Journal = { plan, state: 'staging', staged: [], promoted: [], backups: [] }
    const writeJournal = async () => {
      const handle = await open(journalPath, 'w', 0o600)
      try {
        await handle.writeFile(JSON.stringify(journal))
        await handle.sync()
      } finally {
        await handle.close()
      }
    }
    await writeJournal()
    try {
      if (this.cancelled.has(plan.id))
        throw Object.assign(new Error('Installation cancelled'), { code: 'CANCELLED' })
      if (plan.format === 'USBExtreme')
        await this.stageUsbExtreme(plan, stagingRoot, journal, writeJournal)
      else {
        const staged = path.join(stagingRoot, path.basename(plan.destinationRelativePath))
        await copyRange(plan.sourcePath, staged)
        journal.staged.push(staged)
        await writeJournal()
        if ((await sha256File(staged)) !== plan.sourceSha256)
          throw Object.assign(new Error('Staging hash mismatch'), { code: 'HASH_MISMATCH' })
      }
      if (plan.format === 'USBExtreme') {
        const stagedParts = journal.staged.filter((item) => path.basename(item) !== 'ul.cfg')
        const stagedDigest = await sha256Parts(stagedParts)
        if (stagedDigest !== plan.sourceSha256)
          throw Object.assign(new Error('USBExtreme staging hash mismatch'), {
            code: 'HASH_MISMATCH',
            expected: plan.sourceSha256,
            actual: stagedDigest
          })
      }
      const candidatePaths = journal.staged.filter((item) => path.basename(item) !== 'ul.cfg')
      const candidateEvidence = await Promise.all(
        candidatePaths.map((item) => this.fragmentation.inspect(item))
      )
      if (candidateEvidence.some((item) => item.state === 'fragmented')) {
        throw Object.assign(new Error('Installation candidate is still fragmented'), {
          code: 'STILL_FRAGMENTED'
        })
      }
      if (this.cancelled.has(plan.id))
        throw Object.assign(new Error('Installation cancelled'), { code: 'CANCELLED' })
      journal.state = 'promoting'
      await writeJournal()
      const destinations = await this.promote(plan, journal, writeJournal)
      const evidence = await Promise.all(
        destinations
          .filter((item) => item !== path.join(plan.devicePath, 'ul.cfg'))
          .map((item) => this.fragmentation.inspect(item))
      )
      if (evidence.some((item) => item.state === 'fragmented')) {
        throw Object.assign(
          new Error('Promoted installation is fragmented; previous destination restored'),
          { code: 'STILL_FRAGMENTED' }
        )
      }
      const state = evidence.some((item) => item.state === 'fragmented')
        ? 'fragmented'
        : evidence.length && evidence.every((item) => item.state === 'contiguous')
          ? 'contiguous'
          : 'unknown'
      const destinationSha256 =
        plan.format === 'USBExtreme'
          ? await sha256Parts(
              destinations.filter((item) => item !== path.join(plan.devicePath, 'ul.cfg'))
            )
          : await sha256File(destinations[0])
      await rm(stagingRoot, { recursive: true, force: true })
      this.plans.delete(plan.id)
      return {
        operationId: plan.id,
        destinationPaths: destinations,
        sourceSha256: plan.sourceSha256,
        destinationSha256,
        fragmentation: state,
        verification:
          state === 'contiguous' ? 'verified' : state === 'fragmented' ? 'failed' : 'not-verified'
      }
    } catch (error) {
      await this.rollback(journal)
      await rm(stagingRoot, { recursive: true, force: true })
      throw error
    }
  }

  private async stageUsbExtreme(
    plan: InstallationPlan,
    stagingRoot: string,
    journal: Journal,
    writeJournal: () => Promise<void>
  ) {
    const layout = createUsbExtremeLayout({
      title: plan.title,
      gameId: plan.gameId,
      media: plan.media,
      sourceBytes: plan.sourceBytes
    })
    const parts = layout.partCount
    for (let index = 0; index < parts; index++) {
      const staged = path.join(stagingRoot, layout.partNames[index])
      await copyRange(
        plan.sourcePath,
        staged,
        index * layout.partSize,
        Math.min(plan.sourceBytes, (index + 1) * layout.partSize) - 1
      )
      journal.staged.push(staged)
      await writeJournal()
    }
    const existingPath = path.join(plan.devicePath, 'ul.cfg')
    let entries: UlEntry[] = []
    try {
      entries = decodeUlCfg(await readFile(existingPath))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    entries = entries.filter((entry) => entry.gameId !== plan.gameId)
    entries.push({
      title: plan.title,
      gameId: plan.gameId,
      media: plan.media,
      parts,
      unknown: Buffer.alloc(15)
    })
    const stagedCfg = path.join(stagingRoot, 'ul.cfg')
    const handle = await open(stagedCfg, 'wx', 0o600)
    try {
      await handle.writeFile(encodeUlCfg(entries))
      await handle.sync()
    } finally {
      await handle.close()
    }
    journal.staged.push(stagedCfg)
    await writeJournal()
  }

  private async promote(
    plan: InstallationPlan,
    journal: Journal,
    writeJournal: () => Promise<void>
  ): Promise<string[]> {
    const destinations: string[] = []
    for (const staged of journal.staged.filter((item) => path.basename(item) !== 'ul.cfg')) {
      const destination =
        plan.format === 'USBExtreme'
          ? path.join(plan.devicePath, path.basename(staged))
          : path.join(plan.devicePath, plan.destinationRelativePath)
      await mkdir(path.dirname(destination), { recursive: true })
      const backup = path.join(path.dirname(staged), `${path.basename(destination)}.previous`)
      try {
        await rename(destination, backup)
        journal.backups.push({ destination, backup })
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
      await rename(staged, destination)
      destinations.push(destination)
      journal.promoted.push(destination)
      await writeJournal()
    }
    if (plan.format === 'USBExtreme') {
      const cfg = path.join(plan.devicePath, 'ul.cfg')
      const backup = path.join(path.dirname(journal.staged[0]), 'ul.cfg.previous')
      try {
        await rename(cfg, backup)
        journal.backups.push({ destination: cfg, backup })
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
      await rename(path.join(path.dirname(journal.staged[0]), 'ul.cfg'), cfg)
      destinations.push(cfg)
      journal.promoted.push(cfg)
      await writeJournal()
    }
    return destinations
  }

  private async rollback(journal: Journal): Promise<void> {
    for (const promoted of journal.promoted.reverse()) await rm(promoted, { force: true })
    for (const item of journal.backups.reverse()) {
      try {
        await rename(item.backup, item.destination)
      } catch {
        /* backup may not have been created */
      }
    }
  }

  async recover(devicePath: string): Promise<number> {
    const root = path.join(devicePath, '.oplforge-staging')
    const entries = await (await import('node:fs/promises')).readdir(root).catch(() => [])
    for (const entry of entries) {
      const operationRoot = path.join(root, entry)
      try {
        const journal = JSON.parse(
          await readFile(path.join(operationRoot, 'journal.json'), 'utf8')
        ) as Journal
        if (journal.state === 'promoting') await this.rollback(journal)
      } catch {
        /* an unpromoted or corrupt staging tree is safe to discard */
      }
      await rm(operationRoot, { recursive: true, force: true })
    }
    return entries.length
  }
}
