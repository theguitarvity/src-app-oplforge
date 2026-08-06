import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { CatalogScannerService } from '@electron/services/catalog/catalog-scanner.service'
import { CatalogService } from '@electron/services/catalog/catalog.service'
import { CatalogStoreService } from '@electron/services/catalog/catalog-store.service'
import { DeviceDiagnosticService } from '@electron/services/diagnostics/device-diagnostic.service'
import { syntheticIso } from '../fixtures/images/generate-fixtures'
import { syntheticZso } from '../fixtures/images/generate-fixtures'
import { encodeUlCfg } from '@electron/services/usbextreme/ul-cfg.service'
import { usbExtremePartStem } from '@electron/services/usbextreme/codec.service'
import { createTempDevice } from '../helpers/temp-device'

describe('device diagnostics', () => {
  it('aggregates ISO, ZSO, USBExtreme and fragmentation evidence without assuming unknown success', async () => {
    const device = await createTempDevice()
    await writeFile(path.join(device.root, 'DVD', 'game.iso'), syntheticIso())
    await writeFile(path.join(device.root, 'DVD', 'SLES_999.99.Zso Game.zso'), syntheticZso())
    await writeFile(
      path.join(device.root, 'ul.cfg'),
      encodeUlCfg([
        {
          title: 'UL Game',
          gameId: 'SCES_111.22',
          media: 'DVD',
          parts: 1,
          unknown: Buffer.alloc(15)
        }
      ])
    )
    await writeFile(
      path.join(device.root, `${usbExtremePartStem('UL Game', 'SCES_111.22')}.00`),
      'part'
    )
    const adapter = {
      platform: 'linux' as const,
      inspect: async () => ({
        state: 'unknown' as const,
        verification: 'not-verified' as const,
        method: 'fake',
        detail: 'unsupported'
      })
    }
    const catalog = new CatalogService(
      new CatalogStoreService(path.join(device.root, '..', `diag-${crypto.randomUUID()}.json`)),
      new CatalogScannerService(adapter)
    )
    const result = await new DeviceDiagnosticService(catalog).run(device.root, undefined, 'FAT32')
    expect(result.readiness).toBe('ready-with-warnings')
    expect(result.catalog.items.map((item) => item.installFormat)).toEqual(
      expect.arrayContaining(['ISO', 'ZSO', 'USBExtreme'])
    )
    expect(result.catalog.items.every((item) => item.fragmentation === 'unknown')).toBe(true)
    await device.cleanup()
  })
})
