import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { app } from 'electron'
import type { NetworkShareConfig, SaveNetworkShareConfigInput } from '../../../src/types/opl'
import { decryptSecret, encryptSecret } from './credential-store'

interface StoredNetworkShareConfig {
  libraryRootPath: string
  enabledProtocols: NetworkShareConfig['enabledProtocols']
  shareName: string
  username: string
  encryptedPassword?: string
  smbPort: number
  ftpPort: number
  autoStartOnLaunch: boolean
  writeAccessAcknowledgedAt?: string
}

const defaultConfig = (): StoredNetworkShareConfig => ({
  // Empty until the user picks a device on the sharing screen — the main
  // process must never guess "the" device on its own; the device the user
  // already has active in the renderer (useDeviceStore) is the source of
  // truth, same as every other device-scoped operation in this app.
  libraryRootPath: '',
  enabledProtocols: [],
  shareName: os.hostname() || 'OPL Forge',
  username: '',
  smbPort: 445,
  ftpPort: 21,
  // Off by default, no auto-start without explicit opt-in (FR-007/SC-005).
  autoStartOnLaunch: false,
  // Unset until FR-014's one-time acknowledgment is recorded.
  writeAccessAcknowledgedAt: undefined
})

const configPath = () => path.join(app.getPath('userData'), 'network-share-config.json')

async function readStored(): Promise<StoredNetworkShareConfig> {
  try {
    const raw = await fs.readFile(configPath(), 'utf-8')
    return { ...defaultConfig(), ...(JSON.parse(raw) as Partial<StoredNetworkShareConfig>) }
  } catch {
    return defaultConfig()
  }
}

async function writeStored(config: StoredNetworkShareConfig): Promise<void> {
  const target = configPath()
  await fs.mkdir(path.dirname(target), { recursive: true })
  const temporary = `${target}.${process.pid}.tmp`
  const handle = await fs.open(temporary, 'w', 0o600)
  try {
    await handle.writeFile(`${JSON.stringify(config, null, 2)}\n`, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  await fs.rename(temporary, target)
}

const toPublicConfig = (stored: StoredNetworkShareConfig): NetworkShareConfig => ({
  libraryRootPath: stored.libraryRootPath,
  enabledProtocols: stored.enabledProtocols,
  shareName: stored.shareName,
  username: stored.username,
  smbPort: stored.smbPort,
  ftpPort: stored.ftpPort,
  autoStartOnLaunch: stored.autoStartOnLaunch,
  writeAccessAcknowledgedAt: stored.writeAccessAcknowledgedAt
})

export async function getConfig(): Promise<NetworkShareConfig> {
  return toPublicConfig(await readStored())
}

export async function saveConfig(input: SaveNetworkShareConfigInput): Promise<NetworkShareConfig> {
  const current = await readStored()
  const deviceChanged = current.libraryRootPath !== input.libraryRootPath
  const next: StoredNetworkShareConfig = {
    ...current,
    libraryRootPath: input.libraryRootPath,
    enabledProtocols: input.enabledProtocols,
    shareName: input.shareName,
    username: input.username,
    smbPort: input.smbPort ?? current.smbPort,
    ftpPort: input.ftpPort ?? current.ftpPort,
    autoStartOnLaunch: input.autoStartOnLaunch,
    encryptedPassword:
      input.password !== undefined ? encryptSecret(input.password) : current.encryptedPassword,
    // Switching to a different device revokes the previous device's
    // write-access acknowledgment (FR-014) — it must not silently carry
    // over to a folder the user never explicitly approved.
    writeAccessAcknowledgedAt: deviceChanged ? undefined : current.writeAccessAcknowledgedAt
  }
  await writeStored(next)
  return toPublicConfig(next)
}

export async function acknowledgeWriteAccess(): Promise<NetworkShareConfig> {
  const current = await readStored()
  const next: StoredNetworkShareConfig = {
    ...current,
    writeAccessAcknowledgedAt: new Date().toISOString()
  }
  await writeStored(next)
  return toPublicConfig(next)
}

/** Decrypted password for internal SMB/FTP auth use only — never exposed via IPC. */
export async function getPassword(): Promise<string | undefined> {
  const stored = await readStored()
  return stored.encryptedPassword ? decryptSecret(stored.encryptedPassword) : undefined
}
