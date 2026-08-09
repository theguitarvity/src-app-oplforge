import { nativeImage } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
const source = nativeImage.createFromPath('build/icon.png')
if (source.isEmpty()) throw new Error('build/icon.png is missing or invalid')
await mkdir('build/generated', { recursive: true })
for (const size of [16, 32, 48, 64, 128, 256, 512]) {
  const image = source.resize({ width: size, height: size, quality: 'best' })
  await writeFile(`build/generated/icon-${size}.png`, image.toPNG())
}
if (nativeImage.createFromPath('build/icon.ico').isEmpty())
  throw new Error('build/icon.ico is invalid')
console.log('Platform icon sources verified and PNG sizes generated.')
