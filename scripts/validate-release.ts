import { readFile, writeFile } from 'node:fs/promises'
import { readReleaseManifest } from './release-version'

const manifest = await readReleaseManifest()
const pkg = JSON.parse(await readFile('package.json', 'utf8')) as { version: string }
if (pkg.version !== manifest.internalVersion)
  throw new Error(`package.json ${pkg.version} differs from ${manifest.internalVersion}`)
const requestedTag = process.env.GITHUB_REF_NAME || process.argv[2]
if (requestedTag && requestedTag !== manifest.tag)
  throw new Error(`Tag ${requestedTag} differs from ${manifest.tag}`)
const values = {
  OPL_PUBLIC_VERSION: manifest.publicVersion,
  OPL_INTERNAL_VERSION: manifest.internalVersion,
  OPL_RELEASE_TAG: manifest.tag
}
if (process.env.GITHUB_OUTPUT)
  await writeFile(
    process.env.GITHUB_OUTPUT,
    Object.entries(values)
      .map(([key, value]) => `${key.toLowerCase()}=${value}`)
      .join('\n') + '\n',
    { flag: 'a' }
  )
console.log(JSON.stringify(values))
