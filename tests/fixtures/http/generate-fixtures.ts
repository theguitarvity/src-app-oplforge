import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const resumablePayload = Buffer.alloc(256 * 1024, 0x5a)

if (import.meta.url === `file://${process.argv[1]}`) {
  const destination = path.dirname(new URL(import.meta.url).pathname)
  await mkdir(destination, { recursive: true })
  await writeFile(path.join(destination, 'payload.bin'), resumablePayload)
  await writeFile(
    path.join(destination, 'payload-v2.bin'),
    Buffer.alloc(resumablePayload.length, 0x6b)
  )
}
