import { copyFile, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import path from 'node:path'
import type { OplProfile } from '../../../src/types/opl'
import { JsonStore } from '../persistence/json-store.service'

interface UpdatePlan {
  id: string
  profileId: string
  memoryCardPath: string
  createdAt: string
}

export class OplProfileService {
  private readonly store: JsonStore<OplProfile[]>
  private readonly plans = new Map<string, UpdatePlan>()

  constructor(storePath: string) {
    this.store = new JsonStore(storePath, 1, () => [])
  }
  async list(): Promise<OplProfile[]> {
    return (await this.store.read()).data
  }
  async get(id: string): Promise<OplProfile | undefined> {
    return (await this.list()).find((profile) => profile.id === id)
  }

  async registerOfficial(profile: OplProfile, elfPath: string): Promise<OplProfile> {
    if (profile.version.toLowerCase() === 'latest')
      throw Object.assign(new Error('An exact OPL version or commit is required'), {
        code: 'EXACT_VERSION_REQUIRED'
      })
    const origin = new URL(profile.officialUrl)
    if (
      origin.protocol !== 'https:' ||
      origin.hostname !== 'github.com' ||
      !origin.pathname.startsWith('/ps2homebrew/Open-PS2-Loader/')
    ) {
      throw Object.assign(new Error('OPL must originate from the official project'), {
        code: 'UNTRUSTED_OPL_ORIGIN'
      })
    }
    const digest = createHash('sha256')
      .update(await readFile(elfPath))
      .digest('hex')
    if (digest !== profile.elfSha256.toLowerCase())
      throw Object.assign(new Error('OPL ELF hash mismatch'), { code: 'HASH_MISMATCH' })
    const document = await this.store.read()
    if (document.data.some((item) => item.id === profile.id))
      throw Object.assign(new Error('OPL profile is immutable'), { code: 'PROFILE_EXISTS' })
    await this.store.write([...document.data, structuredClone(profile)], document.revision)
    return profile
  }

  async acquireOfficial(
    profile: OplProfile,
    destinationDirectory: string,
    request: typeof fetch = fetch
  ): Promise<{ profile: OplProfile; elfPath: string }> {
    const origin = new URL(profile.officialUrl)
    if (
      origin.protocol !== 'https:' ||
      origin.hostname !== 'github.com' ||
      !origin.pathname.startsWith('/ps2homebrew/Open-PS2-Loader/')
    ) {
      throw Object.assign(new Error('OPL must originate from the official project'), {
        code: 'UNTRUSTED_OPL_ORIGIN'
      })
    }
    const response = await request(origin)
    if (!response.ok)
      throw Object.assign(new Error(`Official OPL download failed (${response.status})`), {
        code: 'DOWNLOAD_FAILED'
      })
    const bytes = new Uint8Array(await response.arrayBuffer())
    const digest = createHash('sha256').update(bytes).digest('hex')
    if (digest !== profile.elfSha256.toLowerCase())
      throw Object.assign(new Error('OPL ELF hash mismatch'), { code: 'HASH_MISMATCH' })
    await mkdir(destinationDirectory, { recursive: true })
    const elfPath = path.join(destinationDirectory, `${profile.id}.elf`)
    await writeFile(elfPath, bytes, { mode: 0o600, flag: 'wx' })
    await this.registerOfficial(profile, elfPath)
    return { profile, elfPath }
  }

  async planUpdate(profileId: string, memoryCardPath: string): Promise<UpdatePlan> {
    if (!(await this.get(profileId)))
      throw Object.assign(new Error('OPL profile not found'), { code: 'PROFILE_NOT_FOUND' })
    const target = await stat(memoryCardPath)
    if (!target.isFile()) throw new Error('Memory card must be an image file')
    const plan = {
      id: randomUUID(),
      profileId,
      memoryCardPath: path.resolve(memoryCardPath),
      createdAt: new Date().toISOString()
    }
    this.plans.set(plan.id, plan)
    return plan
  }

  async confirmUpdate(
    planId: string,
    confirmation: string,
    patchedImagePath: string
  ): Promise<{ backupPath: string }> {
    if (confirmation !== 'ATUALIZAR OPL')
      throw Object.assign(new Error('Explicit confirmation required'), {
        code: 'CONFIRMATION_REQUIRED'
      })
    const plan = this.plans.get(planId)
    if (!plan) throw Object.assign(new Error('Update plan not found'), { code: 'PLAN_NOT_FOUND' })
    const backupPath = `${plan.memoryCardPath}.before-opl-${Date.now()}.bak`
    const temporary = `${plan.memoryCardPath}.${plan.id}.tmp`
    await mkdir(path.dirname(plan.memoryCardPath), { recursive: true })
    await copyFile(plan.memoryCardPath, backupPath)
    const replacement = await readFile(patchedImagePath)
    if (!replacement.length)
      throw Object.assign(new Error('Replacement memory-card image is empty'), {
        code: 'INVALID_MEMORY_CARD'
      })
    await writeFile(temporary, replacement, { mode: 0o600 })
    await rename(temporary, plan.memoryCardPath)
    this.plans.delete(planId)
    return { backupPath }
  }
}
