import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import {
  decodeUsbExtremeRecord,
  encodeUsbExtremeRecord,
  usbExtremePartStem,
  type UsbExtremeRecord
} from './codec.service'

export type UlEntry = UsbExtremeRecord

export function decodeUlCfg(buffer: Buffer): UlEntry[] {
  if (buffer.length % 64 !== 0)
    throw Object.assign(new Error('ul.cfg has an incomplete record'), { code: 'INVALID_UL_CFG' })
  const entries: UlEntry[] = []
  for (let offset = 0; offset < buffer.length; offset += 64) {
    entries.push(decodeUsbExtremeRecord(Buffer.from(buffer.subarray(offset, offset + 64))))
  }
  return entries
}

export function encodeUlCfg(entries: UlEntry[]): Buffer {
  return Buffer.concat(entries.map(encodeUsbExtremeRecord))
}

export async function validateUlParts(
  root: string,
  entry: UlEntry
): Promise<{ complete: boolean; parts: string[]; missing: number[]; orphaned: string[] }> {
  const names = await readdir(root)
  const stem = usbExtremePartStem(entry.title, entry.gameId)
  const matching = names
    .filter((name) => name.startsWith(`${stem}.`) && /^\d{2}$/.test(name.slice(-2)))
    .sort()
  const expected = Array.from(
    { length: entry.parts },
    (_, index) => `${stem}.${String(index).padStart(2, '0')}`
  )
  const selected = expected.filter((name) => matching.includes(name))
  const missing: number[] = []
  for (let index = 0; index < entry.parts; index++)
    if (!matching.includes(expected[index])) missing.push(index)
  for (const name of selected)
    if (!(await stat(path.join(root, name))).isFile()) missing.push(Number(name.slice(-2)))
  return {
    complete: missing.length === 0,
    parts: selected,
    missing,
    orphaned: matching.filter((name) => !expected.includes(name))
  }
}
