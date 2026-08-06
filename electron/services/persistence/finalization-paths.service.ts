import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { captureSafeRoot, resolveInside, type SafeRoot } from './safe-path.service'

export interface FinalizationPaths {
  cacheRoot: SafeRoot
  stagingRoot: SafeRoot
}

function assertRelative(candidate: string, label: string): string {
  if (!candidate || path.isAbsolute(candidate) || candidate.includes('\0')) {
    throw Object.assign(new Error(`${label} must be a non-empty relative path`), {
      code: 'PATH_ESCAPE'
    })
  }
  const normalized = path.normalize(candidate)
  if (normalized === '..' || normalized.startsWith(`..${path.sep}`)) {
    throw Object.assign(new Error(`${label} escapes its safe root`), { code: 'PATH_ESCAPE' })
  }
  return normalized
}

async function ensureParent(root: SafeRoot, relativePath: string): Promise<void> {
  const parent = path.dirname(relativePath)
  if (parent === '.') return
  let current = ''
  for (const segment of parent.split(path.sep)) {
    current = current ? path.join(current, segment) : segment
    const directory = await resolveInside(root, current, true)
    await mkdir(directory)
  }
}

export async function createFinalizationPaths(
  userDataPath: string,
  devicePath: string
): Promise<FinalizationPaths> {
  const cachePath = path.join(path.resolve(userDataPath), 'opl-finalization', 'cache')
  const stagingPath = path.join(path.resolve(devicePath), '.oplforge-staging')
  await Promise.all([
    mkdir(cachePath, { recursive: true }),
    mkdir(stagingPath, { recursive: true })
  ])
  const [cacheRoot, stagingRoot] = await Promise.all([
    captureSafeRoot(cachePath),
    captureSafeRoot(stagingPath)
  ])
  return { cacheRoot, stagingRoot }
}

export async function resolveCachePath(
  paths: FinalizationPaths,
  relativePath: string
): Promise<string> {
  const safeRelative = assertRelative(relativePath, 'Cache path')
  await ensureParent(paths.cacheRoot, safeRelative)
  return resolveInside(paths.cacheRoot, safeRelative, true)
}

export async function resolveStagingPath(
  paths: FinalizationPaths,
  taskId: string,
  relativePath: string
): Promise<string> {
  const safeTaskId = assertRelative(taskId, 'Task ID')
  if (safeTaskId.includes(path.sep)) {
    throw Object.assign(new Error('Task ID must be a single path segment'), { code: 'PATH_ESCAPE' })
  }
  const safeRelative = assertRelative(relativePath, 'Staging path')
  const candidate = path.join(safeTaskId, safeRelative)
  await ensureParent(paths.stagingRoot, candidate)
  return resolveInside(paths.stagingRoot, candidate, true)
}
