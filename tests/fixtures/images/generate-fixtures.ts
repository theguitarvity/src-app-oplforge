import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'

const ISO_SECTOR_BYTES = 2048

function directoryRecord(name: Buffer, extent: number, bytes: number, flags = 0): Buffer {
  const length = 33 + name.length + (name.length % 2 === 0 ? 1 : 0)
  const record = Buffer.alloc(length)
  record[0] = length
  record.writeUInt32LE(extent, 2)
  record.writeUInt32BE(extent, 6)
  record.writeUInt32LE(bytes, 10)
  record.writeUInt32BE(bytes, 14)
  record[25] = flags
  record.writeUInt16LE(1, 28)
  record.writeUInt16BE(1, 30)
  record[32] = name.length
  name.copy(record, 33)
  return record
}

export function structuredIso(
  gameId = 'SLES_999.99',
  boot = `BOOT2 = cdrom0:\\${gameId};1\r\n`,
  cnfSector = 3000
): Buffer {
  const sectors = cnfSector + 2
  const image = Buffer.alloc(sectors * ISO_SECTOR_BYTES)
  const pvd = 16 * ISO_SECTOR_BYTES
  image[pvd] = 1
  image.write('CD001', pvd + 1, 'ascii')
  image[pvd + 6] = 1
  image.writeUInt32LE(sectors, pvd + 80)
  const rootSector = 20
  directoryRecord(Buffer.from([0]), rootSector, ISO_SECTOR_BYTES, 2).copy(image, pvd + 156)
  const records = [
    directoryRecord(Buffer.from([0]), rootSector, ISO_SECTOR_BYTES, 2),
    directoryRecord(Buffer.from([1]), rootSector, ISO_SECTOR_BYTES, 2),
    directoryRecord(Buffer.from('SYSTEM.CNF;1'), cnfSector, Buffer.byteLength(boot))
  ]
  let offset = rootSector * ISO_SECTOR_BYTES
  for (const record of records) {
    record.copy(image, offset)
    offset += record.length
  }
  image.write(boot, cnfSector * ISO_SECTOR_BYTES, 'ascii')
  return image
}

export function syntheticIso(gameId = 'SLUS_123.45', sectors = 200_000): Buffer {
  const image = Buffer.alloc(17 * 2048)
  image[16 * 2048] = 1
  image.write('CD001', 16 * 2048 + 1, 'ascii')
  image[16 * 2048 + 6] = 1
  image.writeUInt32LE(sectors, 16 * 2048 + 80)
  image.write(`BOOT2 = cdrom0:\\${gameId};1\r\nVER = 1.00\r\n`, 2048, 'ascii')
  return image
}

export function syntheticIsoWithLateSystemCnf(
  gameId = 'SLES_999.99',
  offset = 5 * 1024 * 1024
): Buffer {
  const image = Buffer.alloc(offset + 2048)
  image[16 * 2048] = 1
  image.write('CD001', 16 * 2048 + 1, 'ascii')
  image[16 * 2048 + 6] = 1
  image.writeUInt32LE(Math.ceil(image.length / 2048), 16 * 2048 + 80)
  image.write(`BOOT2 = cdrom0:\\${gameId};1\r\nVER = 1.00\r\n`, offset, 'ascii')
  return image
}

export function syntheticZso(logicalBytes = 17 * 2048): Buffer {
  const header = Buffer.alloc(24)
  header.write('ZISO', 0, 'ascii')
  header.writeUInt32LE(24, 4)
  header.writeBigUInt64LE(BigInt(logicalBytes), 8)
  header.writeUInt32LE(2048, 16)
  header[20] = 1
  return Buffer.concat([header, Buffer.alloc((Math.ceil(logicalBytes / 2048) + 1) * 4)])
}

export function syntheticUncompressedZso(block = Buffer.alloc(2048, 0x2a)): Buffer {
  const header = Buffer.alloc(24)
  header.write('ZISO')
  header.writeUInt32LE(24, 4)
  header.writeBigUInt64LE(BigInt(block.length), 8)
  header.writeUInt32LE(block.length, 16)
  const index = Buffer.alloc(8)
  index.writeUInt32LE((32 | 0x80000000) >>> 0, 0)
  index.writeUInt32LE(32 + block.length, 4)
  return Buffer.concat([header, index, block])
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const destination = path.dirname(new URL(import.meta.url).pathname)
  await mkdir(destination, { recursive: true })
  await writeFile(path.join(destination, 'valid.iso'), syntheticIso())
  await writeFile(path.join(destination, 'invalid.iso'), Buffer.alloc(4096))
  await writeFile(path.join(destination, 'valid.zso'), syntheticZso())
  await writeFile(path.join(destination, 'late-system-cnf.iso'), syntheticIsoWithLateSystemCnf())
}
