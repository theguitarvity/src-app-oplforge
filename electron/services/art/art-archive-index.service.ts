import { listZipEntryNames } from './oplm-art.service'

export class ArtArchiveIndexService {
  async index(
    url: string,
    request: typeof fetch = fetch,
    fallback?: () => Promise<Buffer>
  ): Promise<string[]> {
    const tail = await request(url, { headers: { Range: 'bytes=-65557' } })
    if (tail.status === 206) {
      const bytes = Buffer.from(await tail.arrayBuffer())
      const eocd = bytes.lastIndexOf(Buffer.from('PK\x05\x06', 'binary'))
      if (eocd >= 0) {
        const centralBytes = bytes.readUInt32LE(eocd + 12)
        const centralOffset = bytes.readUInt32LE(eocd + 16)
        const central = await request(url, {
          headers: { Range: `bytes=${centralOffset}-${centralOffset + centralBytes - 1}` }
        })
        if (central.status === 206)
          return listZipEntryNames(Buffer.from(await central.arrayBuffer()))
      }
    }
    if (fallback) return listZipEntryNames(await fallback())
    if (tail.ok && tail.status === 200)
      return listZipEntryNames(Buffer.from(await tail.arrayBuffer()))
    throw Object.assign(new Error('Artwork archive index is unavailable'), {
      code: 'ART_ARCHIVE_INDEX_FAILED'
    })
  }
}
