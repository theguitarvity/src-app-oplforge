import appConfig from '../../app.json'

export interface AndroidUpdateStatus {
  checkedAt: string | null
  currentVersion: string
  latestVersion: string | null
  updateAvailable: boolean
  releaseUrl: string | null
  checkFailed: boolean
}

const RELEASES_API_URL = 'https://api.github.com/repos/theguitarvity/src-app-oplforge/releases'
/**
 * Mobile releases share the desktop repo's GitHub Releases feed (per
 * /speckit-clarify decision, 2026-08-12) but need their own tag namespace
 * since the mobile app version (app.json) is independent from the desktop
 * app version (package.json). Until a mobile release is tagged this way,
 * the check correctly reports "no update" rather than comparing against
 * unrelated desktop tags.
 */
const MOBILE_TAG_PREFIX = 'mobile-v'

interface GithubRelease {
  tag_name: string
  html_url: string
  draft: boolean
  prerelease: boolean
}

function parseSemver(version: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version)
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function isNewer(latest: string, current: string): boolean {
  const a = parseSemver(latest)
  const b = parseSemver(current)
  if (!a || !b) return false
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i]
  }
  return false
}

/**
 * Checks the GitHub Releases feed for a newer mobile build. Never throws —
 * any failure (network, parsing, no matching release) resolves to
 * `checkFailed: true` / `updateAvailable: false` so the app always opens
 * normally (FR-010).
 */
export async function checkForAndroidUpdate(): Promise<AndroidUpdateStatus> {
  const currentVersion = appConfig.expo.version ?? '0.0.0'
  const base: AndroidUpdateStatus = {
    checkedAt: new Date().toISOString(),
    currentVersion,
    latestVersion: null,
    updateAvailable: false,
    releaseUrl: null,
    checkFailed: false
  }

  try {
    const response = await fetch(RELEASES_API_URL, {
      headers: { Accept: 'application/vnd.github+json' }
    })
    if (!response.ok) return { ...base, checkFailed: true }

    const releases = (await response.json()) as GithubRelease[]
    const mobileReleases = releases
      .filter((release) => !release.draft && !release.prerelease)
      .filter((release) => release.tag_name.startsWith(MOBILE_TAG_PREFIX))
      .map((release) => ({
        version: release.tag_name.slice(MOBILE_TAG_PREFIX.length),
        url: release.html_url
      }))
      .filter((release) => parseSemver(release.version) !== null)
      .sort((a, b) => (isNewer(a.version, b.version) ? -1 : 1))

    const latest = mobileReleases[0]
    if (!latest) return base

    return {
      ...base,
      latestVersion: latest.version,
      releaseUrl: latest.url,
      updateAvailable: isNewer(latest.version, currentVersion)
    }
  } catch {
    return { ...base, checkFailed: true }
  }
}
