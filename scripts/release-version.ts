import { readFile } from 'node:fs/promises'

export interface ReleaseManifest {
  schemaVersion: number
  publicVersion: string
  internalVersion: string
  channel: 'stable' | 'prerelease'
  tag: string
  artifactVersion: string
}

const PUBLIC_VERSION = /^1\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/

export function publicToInternal(publicVersion: string): string {
  const match = PUBLIC_VERSION.exec(publicVersion)
  if (!match) throw new Error('Public version must match 1.A.B.C with components from 0 to 999')
  const [, a, b, c] = match
  const values = [a, b, c].map(Number)
  if (values.some((value) => value > 999)) throw new Error('Version component exceeds 999')
  return `1.${values[0]}.${values[1] * 1000 + values[2]}`
}

export function internalToPublic(internalVersion: string): string {
  const match = /^1\.(\d{1,3})\.(\d{1,6})$/.exec(internalVersion)
  if (!match) throw new Error('Internal version must be a mapped stable SemVer')
  const a = Number(match[1])
  const packed = Number(match[2])
  const b = Math.floor(packed / 1000)
  const c = packed % 1000
  if (a > 999 || b > 999) throw new Error('Internal version is outside the reversible range')
  return `1.${a}.${b}.${c}`
}

export function validateReleaseManifest(value: unknown): ReleaseManifest {
  if (!value || typeof value !== 'object') throw new Error('Release manifest must be an object')
  const manifest = value as ReleaseManifest
  const expectedInternal = publicToInternal(manifest.publicVersion)
  if (manifest.schemaVersion !== 1) throw new Error('Unsupported release manifest schema')
  if (manifest.internalVersion !== expectedInternal)
    throw new Error('Internal version mapping mismatch')
  if (manifest.tag !== `v${manifest.publicVersion}`) throw new Error('Release tag mismatch')
  if (manifest.artifactVersion !== manifest.publicVersion)
    throw new Error('Artifact version mismatch')
  if (!['stable', 'prerelease'].includes(manifest.channel))
    throw new Error('Invalid release channel')
  return manifest
}

export async function readReleaseManifest(
  file = 'release-manifest.json'
): Promise<ReleaseManifest> {
  return validateReleaseManifest(JSON.parse(await readFile(file, 'utf8')))
}
