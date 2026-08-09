import { timingSafeEqual } from 'node:crypto'
import des from 'des.js'

function leftRotate(value: number, bits: number): number {
  return ((value << bits) | (value >>> (32 - bits))) >>> 0
}

/** MD4 as required by NTLMv1. OpenSSL 3 no longer exposes MD4 through node:crypto. */
function md4(input: Buffer): Buffer {
  const bitLength = BigInt(input.length) * 8n
  const paddingLength = (56 - ((input.length + 1) % 64) + 64) % 64
  const padded = Buffer.alloc(input.length + 1 + paddingLength + 8)
  input.copy(padded)
  padded[input.length] = 0x80
  padded.writeBigUInt64LE(bitLength, padded.length - 8)

  let a = 0x67452301
  let b = 0xefcdab89
  let c = 0x98badcfe
  let d = 0x10325476
  const rotations1 = [3, 7, 11, 19]
  const rotations2 = [3, 5, 9, 13]
  const rotations3 = [3, 9, 11, 15]

  for (let offset = 0; offset < padded.length; offset += 64) {
    const words = Array.from({ length: 16 }, (_, index) => padded.readUInt32LE(offset + index * 4))
    const initial = [a, b, c, d]
    for (let index = 0; index < 16; index++) {
      const next = (a + ((b & c) | (~b & d)) + words[index]) >>> 0
      ;[a, b, c, d] = [d, leftRotate(next, rotations1[index % 4]), b, c]
    }
    for (let index = 0; index < 16; index++) {
      const wordIndex = (index % 4) * 4 + Math.floor(index / 4)
      const next = (a + ((b & c) | (b & d) | (c & d)) + words[wordIndex] + 0x5a827999) >>> 0
      ;[a, b, c, d] = [d, leftRotate(next, rotations2[index % 4]), b, c]
    }
    const order = [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15]
    for (let index = 0; index < 16; index++) {
      const next = (a + (b ^ c ^ d) + words[order[index]] + 0x6ed9eba1) >>> 0
      ;[a, b, c, d] = [d, leftRotate(next, rotations3[index % 4]), b, c]
    }
    a = (a + initial[0]) >>> 0
    b = (b + initial[1]) >>> 0
    c = (c + initial[2]) >>> 0
    d = (d + initial[3]) >>> 0
  }
  const result = Buffer.alloc(16)
  ;[a, b, c, d].forEach((value, index) => result.writeUInt32LE(value, index * 4))
  return result
}

function expandDesKey(key: Buffer): Buffer {
  const result = Buffer.alloc(8)
  result[0] = key[0] & 0xfe
  result[1] = ((key[0] << 7) | (key[1] >>> 1)) & 0xfe
  result[2] = ((key[1] << 6) | (key[2] >>> 2)) & 0xfe
  result[3] = ((key[2] << 5) | (key[3] >>> 3)) & 0xfe
  result[4] = ((key[3] << 4) | (key[4] >>> 4)) & 0xfe
  result[5] = ((key[4] << 3) | (key[5] >>> 5)) & 0xfe
  result[6] = ((key[5] << 2) | (key[6] >>> 6)) & 0xfe
  result[7] = (key[6] << 1) & 0xfe
  return result
}

export function createNtlmV1Response(password: string, challenge: Buffer): Buffer {
  const passwordHash = md4(Buffer.from(password, 'utf16le'))
  const paddedHash = Buffer.concat([passwordHash, Buffer.alloc(5)])
  const blocks: Buffer[] = []
  for (let offset = 0; offset < 21; offset += 7) {
    const desKey = expandDesKey(paddedHash.subarray(offset, offset + 7))
    // Electron uses BoringSSL and does not expose legacy DES ciphers. Keep
    // this protocol-only primitive in pure JS so availability is identical
    // in development, packaged Electron, Linux, macOS, and Windows.
    const cipher = des.DES.create({ type: 'encrypt', key: desKey, padding: false })
    blocks.push(Buffer.from(cipher.update(challenge).concat(cipher.final())))
  }
  return Buffer.concat(blocks)
}

export function verifyNtlmV1Response(
  password: string,
  challenge: Buffer,
  response: Buffer
): boolean {
  if (response.length !== 24) return false
  return timingSafeEqual(createNtlmV1Response(password, challenge), response)
}
