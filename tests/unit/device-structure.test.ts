import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { mkdtempSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'

const userDataDir = mkdtempSync(path.join(tmpdir(), 'oplforge-userdata-'))
vi.mock('electron', () => ({
  app: { getPath: () => userDataDir },
  BrowserWindow: { getAllWindows: () => [] }
}))

const { getDeviceSummary, OPL_DIRS } = await import('@electron/services/device.service')
const { prepareDevice } = await import('@electron/services/file.service')

async function makeTempFolder() {
  return mkdtemp(path.join(tmpdir(), 'oplforge-structure-'))
}

describe('OPL_DIRS', () => {
  it('includes the full set of directories the OPL expects, including CHT/LNG/THM', () => {
    expect(OPL_DIRS).toEqual(
      expect.arrayContaining(['DVD', 'CD', 'PS1', 'APPS', 'ART', 'CFG', 'VMC', 'CHT', 'LNG', 'THM'])
    )
    expect(OPL_DIRS).toHaveLength(10)
  })
})

describe('getDeviceSummary structure validation', () => {
  it('classifies a folder with the full OPL structure as ready', async () => {
    const root = await makeTempFolder()
    await Promise.all(OPL_DIRS.map((dir) => mkdir(path.join(root, dir))))

    const summary = await getDeviceSummary(root)
    expect(summary.device?.status).toBe('ready')

    await rm(root, { recursive: true, force: true })
  })

  it('classifies a folder missing only CHT/LNG/THM as missing-structure', async () => {
    const root = await makeTempFolder()
    await Promise.all(
      OPL_DIRS.filter((dir) => !['CHT', 'LNG', 'THM'].includes(dir)).map((dir) =>
        mkdir(path.join(root, dir))
      )
    )

    const summary = await getDeviceSummary(root)
    expect(summary.device?.status).toBe('missing-structure')

    await rm(root, { recursive: true, force: true })
  })

  it('validates an arbitrary local folder path the same way as an auto-detected device', async () => {
    const root = await makeTempFolder()
    // completely empty folder, not in listDevices()
    const summary = await getDeviceSummary(root)
    expect(summary.device?.status).toBe('missing-structure')
    expect(summary.device?.path).toBe(root)

    await rm(root, { recursive: true, force: true })
  })

  it('flags a folder outside the user home as isOutsideHome', async () => {
    const root = await makeTempFolder()
    const summary = await getDeviceSummary(root)
    const insideHome = root.startsWith(homedir())
    expect(summary.device?.isOutsideHome).toBe(!insideHome)

    await rm(root, { recursive: true, force: true })
  })
})

describe('prepareDevice', () => {
  it('creates all 10 OPL directories additively without touching existing content', async () => {
    const root = await makeTempFolder()
    await mkdir(path.join(root, 'DVD'))
    await writeFile(path.join(root, 'DVD', 'existing-game.iso'), 'not-a-real-iso')

    await prepareDevice(root)

    const summary = await getDeviceSummary(root)
    expect(summary.device?.status).toBe('ready')

    const preserved = await readFile(path.join(root, 'DVD', 'existing-game.iso'), 'utf-8')
    expect(preserved).toBe('not-a-real-iso')

    await rm(root, { recursive: true, force: true })
  })
})
