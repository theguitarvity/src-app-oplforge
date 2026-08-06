import { describe, expect, it } from 'vitest'
import { inspectDevice } from '@electron/services/device.service'
import { createTempDevice } from '../helpers/temp-device'

describe('device capabilities', () => {
  it('captures identity, capacity, cluster and FAT32 file limit evidence', async () => {
    const device = await createTempDevice()
    const fat = await inspectDevice(device.root, 'FAT32')
    expect(fat).toMatchObject({ fileSystem: 'FAT32', supportsLargeFiles: 'failed' })
    expect(fat.totalBytes).toBeGreaterThan(0)
    expect(fat.clusterBytes).toBeGreaterThan(0)
    const exfat = await inspectDevice(device.root, 'exFAT')
    expect(exfat.supportsLargeFiles).toBe('verified')
    await device.cleanup()
  })
})
