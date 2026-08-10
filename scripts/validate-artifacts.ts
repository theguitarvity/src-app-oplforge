import { createHash } from 'node:crypto'
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { readReleaseManifest } from './release-version'

type Platform = 'windows' | 'mac' | 'linux'

const root = process.argv[2] || 'release'
const platform = (process.argv[3] || 'windows') as Platform
const manifest = await readReleaseManifest()

const PLATFORM_RULES: Record<
  Platform,
  {
    allowed: RegExp[]
    feedFile: string
    requireInstaller: (files: string[]) => boolean
    /** electron-updater's feed only lists the differential-update-capable
     * installer(s) (plus blockmaps) — e.g. Linux's .deb is a plain package
     * with no update-feed entry, so it's excluded from the "must be
     * referenced by the feed" check even though it's still an allowed file. */
    isFeedTracked: (name: string) => boolean
  }
> = {
  windows: {
    allowed: [
      new RegExp(`^OPL-Forge-${manifest.publicVersion}-x64-Setup[.]exe$`),
      /^latest[.]yml$/,
      /[.]blockmap$/
    ],
    feedFile: 'latest.yml',
    requireInstaller: (files) => files.some((name) => name.endsWith('.exe')),
    isFeedTracked: (name) => name.endsWith('.exe') || name.endsWith('.blockmap')
  },
  mac: {
    allowed: [
      new RegExp(`^OPL-Forge-${manifest.publicVersion}-mac-(x64|arm64)[.]dmg$`),
      /^latest-mac[.]yml$/,
      /[.]blockmap$/
    ],
    feedFile: 'latest-mac.yml',
    requireInstaller: (files) => files.some((name) => name.endsWith('.dmg')),
    isFeedTracked: (name) => name.endsWith('.dmg') || name.endsWith('.blockmap')
  },
  linux: {
    // electron-builder names the architecture per package format, not
    // uniformly: Debian packages use dpkg's "amd64", AppImage uses uname's
    // "x86_64" — both are the same x64 build, just labeled differently.
    allowed: [
      new RegExp(`^OPL-Forge-${manifest.publicVersion}-linux-x86_64[.]AppImage$`),
      new RegExp(`^OPL-Forge-${manifest.publicVersion}-linux-amd64[.]deb$`),
      /^latest-linux[.]yml$/,
      /[.]blockmap$/
    ],
    feedFile: 'latest-linux.yml',
    requireInstaller: (files) => files.some((name) => name.endsWith('.AppImage')),
    isFeedTracked: (name) => name.endsWith('.AppImage') || name.endsWith('.blockmap')
  }
}

const rules = PLATFORM_RULES[platform]
if (!rules) throw new Error(`Unknown platform: ${platform}`)

// electron-builder always leaves build byproducts alongside the installers
// (debug metadata, hidden icon caches, unpacked app directories per target,
// e.g. win-unpacked/mac/mac-arm64/linux-unpacked) — none of these are ever
// selected for upload/publish, so they're silently ignored rather than
// treated as "unexpected public artifacts".
const IGNORED = [/^builder-(debug|effective-config)[.]ya?ml$/, /^\./]

const dirEntries = await readdir(root, { withFileTypes: true })
const fileEntries = dirEntries.filter((entry) => entry.isFile()).map((entry) => entry.name)
const files = fileEntries.filter((name) => rules.allowed.some((rule) => rule.test(name)))
const unexpected = fileEntries.filter(
  (name) =>
    !rules.allowed.some((rule) => rule.test(name)) && !IGNORED.some((rule) => rule.test(name))
)
if (unexpected.length) throw new Error(`Unexpected public artifacts: ${unexpected.join(', ')}`)
if (!rules.requireInstaller(files) || !files.includes(rules.feedFile))
  throw new Error(`${platform} installer or ${rules.feedFile} missing`)

const feed = await readFile(path.join(root, rules.feedFile), 'utf8')
for (const name of files.filter((name) => name !== rules.feedFile && rules.isFeedTracked(name)))
  if (!feed.includes(name)) throw new Error(`${name} is not referenced by ${rules.feedFile}`)

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
