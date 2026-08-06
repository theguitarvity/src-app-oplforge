import { describe, expect, it } from 'vitest'
import { DownloadSchedulerService } from '@electron/services/downloads/download-scheduler.service'
import {
  DEFAULT_INSTALLATION_PROFILE,
  InstallationPlannerService,
  chooseInstallationFormat
} from '@electron/services/installation/installation-planner.service'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createTempDevice } from '../helpers/temp-device'
import { structuredIso } from '../fixtures/images/generate-fixtures'

describe('Essentials unified finalization', () => {
  it('plans exact FAT32 boundaries without treating download completion as installation', () => {
    expect(
      chooseInstallationFormat({
        extension: '.iso',
        sourceBytes: 0xffffffff,
        fileSystem: 'vfat',
        zsoSupported: true
      })
    ).toBe('ISO')
    expect(
      chooseInstallationFormat({
        extension: '.iso',
        sourceBytes: 0x1_0000_0000,
        fileSystem: 'fat32',
        zsoSupported: true
      })
    ).toBe('USBExtreme')
    expect(
      chooseInstallationFormat({
        extension: '.zso',
        sourceBytes: 0xffffffff,
        fileSystem: 'fat32',
        zsoSupported: true
      })
    ).toBe('ZSO')
  })

  it('finalizes an ISO cached as payload.part using its original source name', async () => {
    const device = await createTempDevice()
    try {
      const cached = path.join(device.root, 'payload.part')
      await writeFile(
        cached,
        structuredIso('SLUS_777.01', 'BOOT2 = cdrom0:\\SLUS_777.01;1\r\n', 40)
      )
      const plan = await new InstallationPlannerService().plan({
        sourcePath: cached,
        sourceFileName: 'Original Download.iso',
        devicePath: device.root,
        title: 'Original Download',
        profile: DEFAULT_INSTALLATION_PROFILE,
        fileSystem: 'exFAT'
      })
      expect(plan).toMatchObject({
        gameId: 'SLUS_777.01',
        format: 'ISO',
        destinationRelativePath: 'CD/SLUS_777.01.Original Download.iso'
      })
    } finally {
      await device.cleanup()
    }
  })

  it('processes 20 transferred tasks with one finalization writer on the target device', async () => {
    const scheduler = new DownloadSchedulerService({ networkConcurrency: 2 })
    let networkActive = 0
    let networkPeak = 0
    let writerActive = 0
    let writerPeak = 0
    const timeline: string[] = []
    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        scheduler.scheduleNetwork(0, async () => {
          networkActive += 1
          networkPeak = Math.max(networkPeak, networkActive)
          timeline.push(`download:${index}:start`)
          await new Promise((resolve) => setTimeout(resolve, 1))
          networkActive -= 1
          await scheduler.scheduleWrite('physical-usb-1', 0, async () => {
            writerActive += 1
            writerPeak = Math.max(writerPeak, writerActive)
            timeline.push(`install:${index}:start`)
            await new Promise((resolve) => setTimeout(resolve, 1))
            timeline.push(`install:${index}:end`)
            writerActive -= 1
          })
        })
      )
    )
    expect(networkPeak).toBe(2)
    expect(writerPeak).toBe(1)
    expect(
      timeline.filter((entry) => entry.startsWith('install:') && entry.endsWith(':end'))
    ).toHaveLength(20)
  })
})
