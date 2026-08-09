import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { DeviceIdentity, DeviceInfo, DeviceSummary } from '../../src/types/opl'
import { getHistory } from './history.service'

const execFileAsync = promisify(execFile)
const OPL_DIRS = ['DVD', 'CD', 'PS1', 'APPS', 'ART', 'CFG', 'VMC'] as const

interface MountCandidate {
  path: string
  name: string
  fileSystem: string
}

const safeId = (value: string) => Buffer.from(value).toString('base64url')

async function statDevice(candidate: MountCandidate): Promise<DeviceInfo | null> {
  try {
    const stats = await fs.statfs(candidate.path)
    const total = Number(stats.blocks) * Number(stats.bsize)
    const free = Number(stats.bavail) * Number(stats.bsize)
    const used = Math.max(total - free, 0)
    const missingStructure = await hasOplStructure(candidate.path)

    return {
      id: safeId(candidate.path),
      name: candidate.name,
      path: candidate.path,
      total,
      free,
      used,
      fileSystem: candidate.fileSystem,
      status: missingStructure ? 'ready' : 'missing-structure',
      sourceKind: missingStructure ? 'opl-device' : 'local-folder'
    }
  } catch {
    return null
  }
}

async function hasOplStructure(devicePath: string): Promise<boolean> {
  const checks = await Promise.all(
    OPL_DIRS.map(async (dir) => {
      try {
        const stat = await fs.stat(path.join(devicePath, dir))
        return stat.isDirectory()
      } catch {
        return false
      }
    })
  )
  return checks.every(Boolean)
}

async function linuxCandidates(): Promise<MountCandidate[]> {
  const raw = await fs.readFile('/proc/mounts', 'utf-8')
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split(' '))
    .filter((parts) => parts.length >= 3)
    .map(([device, mountPoint, fileSystem]) => ({
      path: mountPoint.replace(/\\040/g, ' '),
      name: path.basename(mountPoint.replace(/\\040/g, ' ')) || device,
      fileSystem
    }))
    .filter((candidate) =>
      ['/media/', '/mnt/', '/run/media/', `/home/${os.userInfo().username}/`].some((prefix) =>
        candidate.path.startsWith(prefix)
      )
    )
}

async function macCandidates(): Promise<MountCandidate[]> {
  const volumes = await fs.readdir('/Volumes', { withFileTypes: true })
  return volumes
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      path: path.join('/Volumes', entry.name),
      name: entry.name,
      fileSystem: 'volume'
    }))
}

async function windowsCandidates(): Promise<MountCandidate[]> {
  const { stdout } = await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-Command',
    'Get-Volume | Where-Object {$_.DriveLetter} | Select-Object DriveLetter,FileSystemLabel,FileSystem | ConvertTo-Json'
  ])
  const parsed = JSON.parse(stdout || '[]') as Array<{
    DriveLetter: string
    FileSystemLabel?: string
    FileSystem?: string
  }>
  return (Array.isArray(parsed) ? parsed : [parsed]).map((volume) => ({
    path: `${volume.DriveLetter}:\\`,
    name: volume.FileSystemLabel || `${volume.DriveLetter}:`,
    fileSystem: volume.FileSystem || 'unknown'
  }))
}

export async function listDevices(): Promise<DeviceInfo[]> {
  try {
    const candidates =
      process.platform === 'win32'
        ? await windowsCandidates()
        : process.platform === 'darwin'
          ? await macCandidates()
          : await linuxCandidates()

    const devices = await Promise.all(candidates.map(statDevice))
    return devices.filter((device): device is DeviceInfo => Boolean(device))
  } catch {
    return []
  }
}

export async function inspectDevice(
  devicePath: string,
  fileSystemHint?: string
): Promise<DeviceIdentity> {
  const realPath = await fs.realpath(devicePath)
  const stats = await fs.statfs(realPath)
  const fileSystem =
    fileSystemHint ??
    (await listDevices()).find((item) => item.path === devicePath)?.fileSystem ??
    'unknown'
  const totalBytes = Number(stats.blocks) * Number(stats.bsize)
  const freeBytes = Number(stats.bavail) * Number(stats.bsize)
  return {
    deviceId: safeId(realPath),
    mountPath: path.resolve(devicePath),
    realPath,
    fileSystem,
    totalBytes,
    freeBytes,
    clusterBytes: Number(stats.bsize) || undefined,
    supportsLargeFiles: /^(v?fat|fat32)$/i.test(fileSystem)
      ? 'failed'
      : fileSystem === 'unknown'
        ? 'not-verified'
        : 'verified',
    observedAt: new Date().toISOString()
  }
}

export async function getDeviceSummary(devicePath?: string): Promise<DeviceSummary> {
  const devices = await listDevices()
  const device = devicePath
    ? (devices.find((item) => item.path === devicePath) ??
      (await statDevice({
        path: devicePath,
        name: path.basename(devicePath),
        fileSystem: 'local'
      })))
    : (devices[0] ?? null)

  const count = async (dir: string, extensions?: string[]) => {
    if (!device) return 0
    try {
      const entries = await fs.readdir(path.join(device.path, dir), { withFileTypes: true })
      return entries.filter((entry) => {
        if (entry.isDirectory()) return !extensions
        return extensions?.some((ext) => entry.name.toLowerCase().endsWith(ext)) ?? false
      }).length
    } catch {
      return 0
    }
  }

  return {
    device,
    ps2Games:
      (await count('DVD', ['.iso', '.zso'])) +
      (await count('CD', ['.iso', '.zso'])) +
      (device?.sourceKind === 'local-folder' ? await count('.', ['.iso', '.zso']) : 0),
    ps1Games: await count('PS1', ['.bin', '.cue', '.iso']),
    apps: await count('APPS'),
    recentHistory: (await getHistory()).slice(0, 5)
  }
}

export { OPL_DIRS }
