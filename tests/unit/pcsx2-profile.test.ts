import { chmod, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { Pcsx2ProfileService } from '@electron/services/pcsx2/pcsx2-profile.service'

describe('PCSX2 profile', () => {
  it('records exact version/hash and generates allowlisted testconfig arguments', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'pcsx2-'))
    const executable = path.join(root, 'pcsx2')
    await writeFile(executable, 'fake executable')
    await chmod(executable, 0o700)
    const service = new Pcsx2ProfileService(async (_file, args) => ({
      code: 0,
      stdout: args[0] === '-version' ? 'PCSX2 v2.4.0' : '',
      stderr: ''
    }))
    const profile = await service.detect(executable)
    expect(profile).toMatchObject({ version: '2.4.0', supported: true, adapterId: 'pcsx2-v2' })
    expect(profile.sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(service.testConfigArgs('/tmp/isolated')).toEqual([
      '-batch',
      '-nogui',
      '-datapath',
      '/tmp/isolated',
      '-testconfig'
    ])
  })
  it('rejects executables outside the adapter allowlist', async () => {
    await expect(new Pcsx2ProfileService().detect('/tmp/sh')).rejects.toMatchObject({
      code: 'UNSUPPORTED_PCSX2_EXECUTABLE'
    })
  })
})
