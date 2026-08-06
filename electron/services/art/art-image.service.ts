import { readFile, writeFile } from 'node:fs/promises'
import { validatePng } from './art-validation.service'

export class ArtImageService {
  async normalize(sourcePath: string, destinationPath: string): Promise<void> {
    const bytes = await readFile(sourcePath)
    if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      validatePng(bytes, 'asset.png')
      await writeFile(destinationPath, bytes, { mode: 0o600 })
      return
    }
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9) {
      const { nativeImage } = await import('electron')
      const png = await new Promise<Buffer>((resolve, reject) =>
        setImmediate(() => {
          try {
            const converted = nativeImage.createFromBuffer(bytes).toPNG()
            if (!converted.length) throw new Error('JPEG conversion failed')
            resolve(converted)
          } catch (error) {
            reject(error)
          }
        })
      )
      validatePng(png, 'asset.png')
      await writeFile(destinationPath, png, { mode: 0o600 })
      return
    }
    throw Object.assign(new Error('Artwork is neither PNG nor JPEG'), { code: 'INVALID_ART_IMAGE' })
  }
}
