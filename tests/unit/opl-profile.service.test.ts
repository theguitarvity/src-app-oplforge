import { createHash } from 'node:crypto'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { OplProfileService } from '@electron/services/opl/opl-profile.service'
import type { OplProfile } from '@/types/opl'

describe('OplProfileService', () => {
  it('accepts only an exact official release with matching ELF hash', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'opl-profile-'))
    const elf = path.join(root, 'OPNPS2LD.ELF')
    await writeFile(elf, 'synthetic elf')
    const profile: OplProfile = {
      id: 'test',
      version: '1.2.0',
      variant: 'release',
      officialUrl: 'https://github.com/ps2homebrew/Open-PS2-Loader/releases/tag/v1.2.0',
      elfSha256: createHash('sha256').update('synthetic elf').digest('hex'),
      obtainedAt: new Date().toISOString(),
      capabilities: { iso: true, zso: true, usbExtreme: true, fileSystems: ['FAT32'] }
    }
    const service = new OplProfileService(path.join(root, 'profiles.json'))
    await expect(service.registerOfficial(profile, elf)).resolves.toEqual(profile)
    await expect(
      service.registerOfficial({ ...profile, id: 'latest', version: 'latest' }, elf)
    ).rejects.toMatchObject({ code: 'EXACT_VERSION_REQUIRED' })
  })

  it('acquires bytes only from the declared official release and verifies them', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'opl-acquire-'))
    const body = 'official synthetic elf'
    const profile: OplProfile = {
      id: 'download',
      version: '1.2.0',
      variant: 'release',
      officialUrl:
        'https://github.com/ps2homebrew/Open-PS2-Loader/releases/download/v1.2.0/OPNPS2LD.ELF',
      elfSha256: createHash('sha256').update(body).digest('hex'),
      obtainedAt: new Date().toISOString(),
      capabilities: { iso: true, zso: true, usbExtreme: true, fileSystems: ['FAT32'] }
    }
    const service = new OplProfileService(path.join(root, 'profiles.json'))
    const result = await service.acquireOfficial(
      profile,
      path.join(root, 'elfs'),
      async () => new Response(body)
    )
    expect(await readFile(result.elfPath, 'utf8')).toBe(body)
  })

  it('preserves the previous memory-card image before confirmed replacement', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'opl-update-'))
    const elf = path.join(root, 'opl.elf')
    const card = path.join(root, 'card.ps2')
    await writeFile(elf, 'elf')
    await writeFile(card, 'old-card')
    const service = new OplProfileService(path.join(root, 'profiles.json'))
    const profile: OplProfile = {
      id: 'p',
      version: 'commit-1',
      commit: 'abc',
      variant: 'daily',
      officialUrl: 'https://github.com/ps2homebrew/Open-PS2-Loader/releases/tag/v1',
      elfSha256: createHash('sha256').update('elf').digest('hex'),
      obtainedAt: new Date().toISOString(),
      capabilities: { iso: true, zso: false, usbExtreme: true, fileSystems: ['FAT32'] }
    }
    await service.registerOfficial(profile, elf)
    const plan = await service.planUpdate('p', card)
    const replacement = path.join(root, 'replacement.ps2')
    await writeFile(replacement, 'new-card')
    await expect(service.confirmUpdate(plan.id, 'wrong', replacement)).rejects.toMatchObject({
      code: 'CONFIRMATION_REQUIRED'
    })
    const result = await service.confirmUpdate(plan.id, 'ATUALIZAR OPL', replacement)
    expect(await readFile(result.backupPath, 'utf8')).toBe('old-card')
  })
})
