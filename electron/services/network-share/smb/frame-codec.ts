/**
 * SMB1 (CIFS) wire-format framing — message parsing/framing only. Deliberately
 * scoped per research.md R3 (Option C): just enough of the legacy dialect
 * OPL's IOP-side SMB client speaks, not a general-purpose SMB stack.
 *
 * Layout reference (MS-CIFS-style SMB1):
 *   NBSS-style record header (4 bytes): type(1) + big-endian 24-bit length(3)
 *   SMB header (32 bytes): 0xFF 'SMB' signature(4), command(1), status(4, LE),
 *     flags(1), flags2(2, LE), pidHigh(2, LE), securityFeatures(8),
 *     reserved(2), tid(2, LE), pidLow(2, LE), uid(2, LE), mid(2, LE)
 *   WordCount(1) + Words(WordCount*2) + ByteCount(2, LE) + Bytes(ByteCount)
 */

export const SMB_PROTOCOL_SIGNATURE = Buffer.from([0xff, 0x53, 0x4d, 0x42])
export const SMB_HEADER_SIZE = 32

export interface SmbHeader {
  command: number
  status: number
  flags: number
  flags2: number
  pidHigh: number
  securityFeatures: Buffer
  tid: number
  pidLow: number
  uid: number
  mid: number
}

export interface SmbMessage {
  header: SmbHeader
  params: Buffer
  data: Buffer
}

export function defaultSecurityFeatures(): Buffer {
  return Buffer.alloc(8)
}

/** Wraps a raw SMB packet in the 4-byte length-prefixed transport record. */
export function encodeNbssFrame(smbPacket: Buffer): Buffer {
  if (smbPacket.length > 0xffffff) throw new Error('SMB packet exceeds NBSS frame length limit')
  const frameHeader = Buffer.alloc(4)
  frameHeader.writeUInt8(0x00, 0)
  frameHeader.writeUIntBE(smbPacket.length, 1, 3)
  return Buffer.concat([frameHeader, smbPacket])
}

export function encodeSmbMessage(message: SmbMessage): Buffer {
  if (message.params.length % 2 !== 0) throw new Error('SMB params must be a whole number of words')
  const header = Buffer.alloc(SMB_HEADER_SIZE)
  SMB_PROTOCOL_SIGNATURE.copy(header, 0)
  header.writeUInt8(message.header.command, 4)
  header.writeUInt32LE(message.header.status >>> 0, 5)
  header.writeUInt8(message.header.flags, 9)
  header.writeUInt16LE(message.header.flags2, 10)
  header.writeUInt16LE(message.header.pidHigh, 12)
  message.header.securityFeatures.copy(header, 14, 0, 8)
  header.writeUInt16LE(0, 22)
  header.writeUInt16LE(message.header.tid, 24)
  header.writeUInt16LE(message.header.pidLow, 26)
  header.writeUInt16LE(message.header.uid, 28)
  header.writeUInt16LE(message.header.mid, 30)

  const wordCount = Buffer.from([message.params.length / 2])
  const byteCount = Buffer.alloc(2)
  byteCount.writeUInt16LE(message.data.length, 0)

  return Buffer.concat([header, wordCount, message.params, byteCount, message.data])
}

export function decodeSmbMessage(packet: Buffer): SmbMessage {
  if (packet.length < SMB_HEADER_SIZE + 3)
    throw new Error('SMB packet shorter than minimum header + wordcount + bytecount')
  if (!packet.subarray(0, 4).equals(SMB_PROTOCOL_SIGNATURE))
    throw new Error('Invalid SMB protocol signature')

  const header: SmbHeader = {
    command: packet.readUInt8(4),
    status: packet.readUInt32LE(5),
    flags: packet.readUInt8(9),
    flags2: packet.readUInt16LE(10),
    pidHigh: packet.readUInt16LE(12),
    securityFeatures: Buffer.from(packet.subarray(14, 22)),
    tid: packet.readUInt16LE(24),
    pidLow: packet.readUInt16LE(26),
    uid: packet.readUInt16LE(28),
    mid: packet.readUInt16LE(30)
  }

  let offset = SMB_HEADER_SIZE
  const wordCount = packet.readUInt8(offset)
  offset += 1
  const paramsEnd = offset + wordCount * 2
  if (paramsEnd + 2 > packet.length) throw new Error('SMB packet truncated in params section')
  const params = Buffer.from(packet.subarray(offset, paramsEnd))
  offset = paramsEnd

  const byteCount = packet.readUInt16LE(offset)
  offset += 2
  if (offset + byteCount > packet.length) throw new Error('SMB packet truncated in data section')
  const data = Buffer.from(packet.subarray(offset, offset + byteCount))

  return { header, params, data }
}

/**
 * Accumulates raw TCP bytes and yields complete, NBSS-unwrapped SMB packets
 * as they become available — a single `data` event may contain a partial
 * message, several messages, or both.
 */
export class NbssFrameReader {
  private buffer = Buffer.alloc(0)

  push(chunk: Buffer): Buffer[] {
    this.buffer =
      this.buffer.length === 0 ? Buffer.from(chunk) : Buffer.concat([this.buffer, chunk])
    const packets: Buffer[] = []
    for (;;) {
      if (this.buffer.length < 4) break
      const length = this.buffer.readUIntBE(1, 3)
      const total = 4 + length
      if (this.buffer.length < total) break
      packets.push(Buffer.from(this.buffer.subarray(4, total)))
      this.buffer = Buffer.from(this.buffer.subarray(total))
    }
    return packets
  }
}
