import { createHash } from 'node:crypto'
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { readReleaseManifest } from './release-version'
const root = process.argv[2] || 'release'
const manifest = await readReleaseManifest()
const allowed = [
  new RegExp(`^OPL-Forge-${manifest.publicVersion}-x64-Setup[.]exe$`),
  /^latest[.]yml$/,
  /[.]blockmap$/
]
const files = (await readdir(root)).filter((name) => allowed.some((rule) => rule.test(name)))
const unexpected = (await readdir(root)).filter((name) => !allowed.some((rule) => rule.test(name)))
if (unexpected.length) throw new Error(`Unexpected public artifacts: ${unexpected.join(', ')}`)
if (!files.some((name) => name.endsWith('.exe')) || !files.includes('latest.yml'))
  throw new Error('Windows installer or latest.yml missing')
const latest = await readFile(path.join(root, 'latest.yml'), 'utf8')
for (const name of files.filter((name) => name.endsWith('.exe') || name.endsWith('.blockmap')))
  if (!latest.includes(name)) throw new Error(`${name} is not referenced by latest.yml`)
const inventory = await Promise.all(
  files.map(async (name) => {
    const bytes = await readFile(path.join(root, name))
    return {
      name,
      size: (await stat(path.join(root, name))).size,
      sha256: createHash('sha256').update(bytes).digest('hex')
    }
  })
)
await writeFile(path.join(root, 'artifact-inventory.json'), JSON.stringify(inventory, null, 2))
console.log(JSON.stringify(inventory))
