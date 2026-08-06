import type { UsbExtremeLayout } from '../../../src/types/opl-finalization'
import { normalizeGameId, sanitizeOplTitle } from '../images/game-naming.service'

export const USBEXTREME_RECORD_BYTES = 64
export const USBEXTREME_PART_BYTES = 0x3ff00000

export interface UsbExtremeRecord {
  title: string
  gameId: string
  media: 'CD' | 'DVD'
  parts: number
  unknown: Buffer
  raw?: Buffer
}

export function oplManagerTitleCrc32(title: string): string {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = (index << 24) >>> 0
    for (let bit = 0; bit < 8; bit += 1)
      value = (value & 0x80000000 ? (value << 1) ^ 0x04c11db7 : value << 1) >>> 0
    table[255 - index] = value
  }
  let crc = 0
  for (const byte of Buffer.from(`${title}\0`, 'ascii'))
    crc = (table[(byte ^ (crc >>> 24)) & 0xff] ^ ((crc << 8) & 0xffffff00)) >>> 0
  return crc.toString(16).toUpperCase().padStart(8, '0')
}

export function usbExtremeGameIdSuffix(gameId: string): string {
  const normalized = normalizeGameId(gameId)
  if (!normalized)
    throw Object.assign(new Error('Invalid USBExtreme Game ID'), { code: 'INVALID_GAME_ID' })
  return normalized.slice(3)
}

export function usbExtremePartStem(title: string, gameId: string): string {
  return `ul.${oplManagerTitleCrc32(title)}.${usbExtremeGameIdSuffix(gameId)}`
}

export function createUsbExtremeLayout(input: {
  title: string
  gameId: string
  media: 'CD' | 'DVD'
  sourceBytes: number
  preservedUnknown?: Buffer
}): UsbExtremeLayout {
  const title = sanitizeOplTitle(input.title, 32)
  const crc32 = oplManagerTitleCrc32(title)
  const gameIdSuffix = usbExtremeGameIdSuffix(input.gameId)
  const partCount = Math.ceil(input.sourceBytes / USBEXTREME_PART_BYTES)
  const stem = `ul.${crc32}.${gameIdSuffix}`
  return {
    titleBytes: title,
    crc32,
    gameIdSuffix,
    partSize: USBEXTREME_PART_BYTES,
    partCount,
    partNames: Array.from(
      { length: partCount },
      (_, index) => `${stem}.${String(index).padStart(2, '0')}`
    ),
    mediaCode: input.media === 'CD' ? 0x12 : 0x14,
    preservedUnknown: [...(input.preservedUnknown ?? Buffer.alloc(15))]
  }
}

export function decodeUsbExtremeRecord(record: Buffer): UsbExtremeRecord {
  if (record.length !== USBEXTREME_RECORD_BYTES)
    throw Object.assign(new Error('USBExtreme record must contain 64 bytes'), {
      code: 'INVALID_UL_CFG'
    })
  const gameId = normalizeGameId(record.toString('ascii', 32, 47))
  if (!gameId)
    throw Object.assign(new Error('Invalid Game ID in USBExtreme record'), {
      code: 'INVALID_UL_CFG'
    })
  return {
    title: record.toString('latin1', 0, 32).replace(/\0.*$/, '').trimEnd(),
    gameId,
    parts: record[47],
    media: record[48] === 0x12 ? 'CD' : 'DVD',
    unknown: Buffer.from(record.subarray(49, 64)),
    raw: Buffer.from(record)
  }
}

export function encodeUsbExtremeRecord(entry: UsbExtremeRecord): Buffer {
  if (!Number.isInteger(entry.parts) || entry.parts < 1 || entry.parts > 255)
    throw Object.assign(new Error('Invalid USBExtreme part count'), { code: 'INVALID_UL_CFG' })
  const gameId = normalizeGameId(entry.gameId)
  if (!gameId)
    throw Object.assign(new Error('Invalid USBExtreme Game ID'), { code: 'INVALID_UL_CFG' })
  if (entry.unknown.length !== 15)
    throw Object.assign(new Error('USBExtreme unknown field must contain 15 bytes'), {
      code: 'INVALID_UL_CFG'
    })
  const record = entry.raw ? Buffer.from(entry.raw) : Buffer.alloc(USBEXTREME_RECORD_BYTES)
  record.fill(0, 0, 49)
  Buffer.from(sanitizeOplTitle(entry.title, 32), 'latin1').copy(record, 0, 0, 32)
  record.write(gameId, 32, 15, 'ascii')
  record[47] = entry.parts
  record[48] = entry.media === 'CD' ? 0x12 : 0x14
  entry.unknown.copy(record, 49, 0, 15)
  return record
}
