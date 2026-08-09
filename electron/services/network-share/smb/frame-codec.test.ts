import { describe, expect, it } from 'vitest'
import {
  decodeSmbMessage,
  defaultSecurityFeatures,
  encodeNbssFrame,
  encodeSmbMessage,
  NbssFrameReader,
  type SmbMessage
} from './frame-codec'

function sampleMessage(overrides: Partial<SmbMessage['header']> = {}): SmbMessage {
  return {
    header: {
      command: 0x72,
      status: 0,
      flags: 0x18,
      flags2: 0xc001,
      pidHigh: 0,
      securityFeatures: defaultSecurityFeatures(),
      tid: 0,
      pidLow: 1234,
      uid: 0,
      mid: 1,
      ...overrides
    },
    params: Buffer.alloc(0),
    data: Buffer.from('OPL Forge')
  }
}

describe('encodeSmbMessage / decodeSmbMessage', () => {
  it('round-trips a message with no params and text data', () => {
    const message = sampleMessage()
    const decoded = decodeSmbMessage(encodeSmbMessage(message))
    expect(decoded.header).toEqual(message.header)
    expect(decoded.data.toString()).toBe('OPL Forge')
    expect(decoded.params).toHaveLength(0)
  })

  it('round-trips a message with word params', () => {
    const params = Buffer.alloc(4)
    params.writeUInt16LE(0xabcd, 0)
    params.writeUInt16LE(0x1234, 2)
    const message: SmbMessage = {
      ...sampleMessage({ command: 0x2e }),
      params,
      data: Buffer.alloc(0)
    }
    const decoded = decodeSmbMessage(encodeSmbMessage(message))
    expect(decoded.params).toEqual(params)
    expect(decoded.header.command).toBe(0x2e)
  })

  it('rejects a packet with an invalid SMB signature', () => {
    const bogus = Buffer.alloc(35)
    bogus.write('NOPE', 0)
    expect(() => decodeSmbMessage(bogus)).toThrow(/signature/i)
  })

  it('rejects a packet truncated mid-params', () => {
    const params = Buffer.alloc(4)
    const message: SmbMessage = { ...sampleMessage(), params, data: Buffer.alloc(0) }
    const encoded = encodeSmbMessage(message)
    // header(32) + wordCount(1) + wordCount*2(4) + byteCount(2) = 39 bytes total;
    // cut short at 35 so the params section itself is incomplete.
    expect(() => decodeSmbMessage(encoded.subarray(0, 35))).toThrow(/truncated in params/i)
  })

  it('rejects a packet shorter than the fixed header + wordcount + bytecount', () => {
    const message = sampleMessage()
    const encoded = encodeSmbMessage(message)
    expect(() => decodeSmbMessage(encoded.subarray(0, 33))).toThrow(/shorter than minimum/i)
  })

  it('throws on an odd-length params buffer', () => {
    const message = { ...sampleMessage(), params: Buffer.alloc(3) }
    expect(() => encodeSmbMessage(message)).toThrow(/whole number of words/i)
  })
})

describe('NbssFrameReader', () => {
  it('emits nothing until a full frame has arrived', () => {
    const reader = new NbssFrameReader()
    const framed = encodeNbssFrame(encodeSmbMessage(sampleMessage()))
    expect(reader.push(framed.subarray(0, 10))).toHaveLength(0)
  })

  it('reassembles a single frame split across multiple chunks', () => {
    const reader = new NbssFrameReader()
    const packet = encodeSmbMessage(sampleMessage())
    const framed = encodeNbssFrame(packet)
    const first = framed.subarray(0, 10)
    const second = framed.subarray(10)
    expect(reader.push(first)).toHaveLength(0)
    const [result] = reader.push(second)
    expect(result).toEqual(packet)
    expect(decodeSmbMessage(result).data.toString()).toBe('OPL Forge')
  })

  it('splits multiple frames delivered in a single chunk', () => {
    const reader = new NbssFrameReader()
    const packetA = encodeSmbMessage(sampleMessage({ mid: 1 }))
    const packetB = encodeSmbMessage(sampleMessage({ mid: 2 }))
    const combined = Buffer.concat([encodeNbssFrame(packetA), encodeNbssFrame(packetB)])
    const results = reader.push(combined)
    expect(results).toHaveLength(2)
    expect(decodeSmbMessage(results[0]).header.mid).toBe(1)
    expect(decodeSmbMessage(results[1]).header.mid).toBe(2)
  })

  it('retains a trailing partial frame across pushes', () => {
    const reader = new NbssFrameReader()
    const packetA = encodeSmbMessage(sampleMessage({ mid: 1 }))
    const packetB = encodeSmbMessage(sampleMessage({ mid: 2 }))
    const framedA = encodeNbssFrame(packetA)
    const framedB = encodeNbssFrame(packetB)
    const combined = Buffer.concat([framedA, framedB.subarray(0, 5)])
    const firstBatch = reader.push(combined)
    expect(firstBatch).toHaveLength(1)
    const secondBatch = reader.push(framedB.subarray(5))
    expect(secondBatch).toHaveLength(1)
    expect(decodeSmbMessage(secondBatch[0]).header.mid).toBe(2)
  })
})
