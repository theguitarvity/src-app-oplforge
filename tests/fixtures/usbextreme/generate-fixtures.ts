import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { encodeUlCfg } from '@electron/services/usbextreme/ul-cfg.service'

const destination = path.dirname(new URL(import.meta.url).pathname)
await mkdir(destination, { recursive: true })
await writeFile(
  path.join(destination, 'ul.cfg'),
  encodeUlCfg([
    {
      title: 'Synthetic Game',
      gameId: 'SLUS_123.45',
      media: 'DVD',
      parts: 2,
      unknown: Buffer.alloc(15, 0x7f)
    }
  ])
)
await writeFile(path.join(destination, 'ul.CRC32FIX.S_123.45.00'), '')
await writeFile(path.join(destination, 'ul.CRC32FIX.S_123.45.01'), '')
await writeFile(path.join(destination, 'ul.CRC32FIX.S_123.45.02.orphan'), '')
await writeFile(
  path.join(destination, 'missing-parts.ul.cfg'),
  encodeUlCfg([
    {
      title: 'Missing Parts',
      gameId: 'SLES_999.99',
      media: 'CD',
      parts: 2,
      unknown: Buffer.alloc(15)
    }
  ])
)
