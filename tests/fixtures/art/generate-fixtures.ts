export function validPng(): Buffer {
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    Buffer.from([0, 0, 0, 13]),
    Buffer.from('IHDR'),
    Buffer.alloc(13),
    Buffer.alloc(4),
    Buffer.from([0, 0, 0, 0]),
    Buffer.from('IEND'),
    Buffer.alloc(4)
  ])
}
export const htmlError = Buffer.from('<html><title>Not Found</title></html>')
export const emptyArt = Buffer.alloc(0)
export const variableIndex = [
  { name: 'nested/SLUS_123.45_COV.png', size: validPng().length },
  { name: 'nested/SLUS_123.45_BG.png', size: validPng().length },
  { name: 'SLES_999.99_COV2.png', size: validPng().length }
]
export function storedZip(name: string, bytes: Buffer): Buffer {
  const fileName = Buffer.from(name)
  const local = Buffer.alloc(30)
  local.write('PK\x03\x04', 0, 'binary')
  local.writeUInt16LE(20, 4)
  local.writeUInt32LE(bytes.length, 18)
  local.writeUInt32LE(bytes.length, 22)
  local.writeUInt16LE(fileName.length, 26)
  const central = Buffer.alloc(46)
  central.write('PK\x01\x02', 0, 'binary')
  central.writeUInt16LE(20, 4)
  central.writeUInt16LE(20, 6)
  central.writeUInt32LE(bytes.length, 20)
  central.writeUInt32LE(bytes.length, 24)
  central.writeUInt16LE(fileName.length, 28)
  const end = Buffer.alloc(22)
  end.write('PK\x05\x06', 0, 'binary')
  end.writeUInt16LE(1, 8)
  end.writeUInt16LE(1, 10)
  end.writeUInt32LE(central.length + fileName.length, 12)
  end.writeUInt32LE(local.length + fileName.length + bytes.length, 16)
  return Buffer.concat([local, fileName, bytes, central, fileName, end])
}

export const hostileZipEntries = {
  traversal: storedZip('../../outside.png', validPng()),
  absolute: storedZip('/absolute.png', validPng()),
  oversizedClaim: (() => {
    const zip = storedZip('SLUS_123.45_COV.png', validPng())
    const central = zip.indexOf(Buffer.from('PK\x01\x02', 'binary'))
    zip.writeUInt32LE(0x7fffffff, central + 24)
    return zip
  })()
}
