import { describe, expect, it } from 'vitest'
import { LinuxFragmentationAdapter } from '@electron/services/fragmentation/linux.adapter'
import { WindowsFragmentationAdapter } from '@electron/services/fragmentation/windows.adapter'
import { MacOsFragmentationAdapter } from '@electron/services/fragmentation/macos.adapter'

describe('fragmentation adapters', () => {
  it('distinguishes contiguous and fragmented Linux extents', async () => {
    const contiguous =
      ' ext: logical_offset: physical_offset: length: flags:\n 0: 0..3: 100..103: 4: last,eof\n/file: 1 extent found'
    const fragmented =
      ' ext: logical_offset: physical_offset: length: flags:\n 0: 0..1: 100..101: 2:\n 1: 2..3: 200..201: 2: last,eof\n/file: 2 extents found'
    expect(
      (
        await new LinuxFragmentationAdapter(async () => ({
          code: 0,
          stdout: contiguous,
          stderr: ''
        })).inspect('/file')
      ).state
    ).toBe('contiguous')
    expect(
      (
        await new LinuxFragmentationAdapter(async () => ({
          code: 0,
          stdout: fragmented,
          stderr: ''
        })).inspect('/file')
      ).state
    ).toBe('fragmented')
  })
  it('reports unknown instead of assuming success when unsupported', async () => {
    expect(
      (
        await new WindowsFragmentationAdapter(async () => ({
          code: 1,
          stdout: '',
          stderr: 'denied'
        })).inspect('X:\\file')
      ).verification
    ).toBe('not-verified')
    expect((await new MacOsFragmentationAdapter().inspect('/file')).state).toBe('unknown')
  })
})
