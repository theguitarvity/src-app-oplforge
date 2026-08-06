import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  LinuxFragmentationAdapter,
  parseFilefragOutput
} from '@electron/services/fragmentation/linux.adapter'
import {
  WindowsFragmentationAdapter,
  parseFsutilExtents
} from '@electron/services/fragmentation/windows.adapter'
import { MacOsFragmentationAdapter } from '@electron/services/fragmentation/macos.adapter'
import {
  CAPABILITY_MATRIX_VERSION,
  lookupCapability
} from '@electron/services/fragmentation-repair/capability-matrix'
import { FragmentationCapabilityService } from '@electron/services/fragmentation-repair/capability.service'

const fixture = (name: string) =>
  readFile(path.resolve('tests/fixtures/fragmentation/extents', name), 'utf8')

describe('extent capability and parsers', () => {
  it('parses complete Linux logical coverage and physical adjacency', async () => {
    const parsed = parseFilefragOutput(await fixture('linux-filefrag.txt'))
    expect(parsed).toMatchObject({ state: 'fragmented', verification: 'verified', extents: 3 })
    expect(parsed.physicalRanges).toHaveLength(3)
    const contiguous = (await fixture('linux-filefrag.txt'))
      .replace('2000..      2003', '1004..      1007')
      .replace('3000..      3003', '1008..      1011')
    expect(parseFilefragOutput(contiguous).state).toBe('contiguous')
  })

  it('rejects Linux gaps, overlaps, malformed/localized summaries and incomplete EOF', async () => {
    const golden = await fixture('linux-filefrag.txt')
    for (const malformed of [
      golden.replace('4..       7', '5..       7'),
      golden.replace('4..       7', '3..       7'),
      golden.replace('3 extents found', '3 extensoes encontradas'),
      golden.replace('last,eof', 'last')
    ])
      expect(parseFilefragOutput(malformed).verification).toBe('not-verified')
  })

  it('parses complete Windows VCN coverage and physical adjacency', async () => {
    const golden = await fixture('windows-fsutil.txt')
    expect(parseFsutilExtents(golden)).toMatchObject({
      state: 'fragmented',
      verification: 'verified',
      extents: 3
    })
    expect(
      parseFsutilExtents(golden.replace('0x7d0', '0x3ec').replace('0xbb8', '0x3f0')).state
    ).toBe('contiguous')
    expect(parseFsutilExtents(golden.replace('VCN: 0x4', 'VCN: 0x5')).verification).toBe(
      'not-verified'
    )
    expect(parseFsutilExtents(golden.replace('VCN: 0x4', 'VCN: 0x3')).verification).toBe(
      'not-verified'
    )
  })

  it('classifies unavailable tools, permission denial and unsupported macOS', async () => {
    expect(
      (
        await new LinuxFragmentationAdapter(async () => ({
          code: 127,
          stdout: '',
          stderr: 'command not found'
        })).inspect('/file')
      ).capability
    ).toBe('unavailable')
    expect(
      (
        await new WindowsFragmentationAdapter(async () => ({
          code: 1,
          stdout: '',
          stderr: 'Access is denied.'
        })).inspect('X:\\file')
      ).capability
    ).toBe('permission-denied')
    expect((await new MacOsFragmentationAdapter().inspect('/file')).capability).toBe('unsupported')
  })

  it('uses a versioned deny-by-default matrix and requires a successful per-volume probe', async () => {
    expect(CAPABILITY_MATRIX_VERSION).toBeGreaterThan(0)
    expect(
      lookupCapability({ platform: 'linux', fileSystem: 'ext4', method: 'filefrag' })
    ).toBeUndefined()
    const adapter = new LinuxFragmentationAdapter(async () => ({
      code: 0,
      stdout: await fixture('linux-filefrag.txt'),
      stderr: ''
    }))
    const service = new FragmentationCapabilityService(adapter)
    const supported = await service.probe({
      deviceId: 'vol',
      mountPath: '/media/usb',
      realPath: '/media/usb',
      fileSystem: 'vfat',
      totalBytes: 100,
      freeBytes: 50,
      sampleFilePath: '/media/usb/game.iso'
    })
    expect(supported).toMatchObject({ homologated: true, extentVerification: 'supported' })
    const blocked = await service.probe({
      deviceId: 'vol',
      mountPath: '/media/usb',
      realPath: '/media/usb',
      fileSystem: 'ext4',
      totalBytes: 100,
      freeBytes: 50,
      sampleFilePath: '/media/usb/game.iso'
    })
    expect(blocked).toMatchObject({ homologated: false, extentVerification: 'not-homologated' })
    expect(blocked.limitations[0]).toMatch(/homologada/i)
  })
})
