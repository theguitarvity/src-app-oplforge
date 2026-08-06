import { access, constants, stat } from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import type { Pcsx2Profile } from '../../../src/types/opl'

export type ProcessExecutor = (
  executable: string,
  args: string[]
) => Promise<{ stdout: string; stderr: string; code: number }>
const execute: ProcessExecutor = async (executable, args) => {
  try {
    const result = await promisify(execFile)(executable, args, {
      timeout: 15_000,
      encoding: 'utf8'
    })
    return { ...result, code: 0 }
  } catch (error) {
    const value = error as Error & { stdout?: string; stderr?: string; code?: number }
    return {
      stdout: value.stdout ?? '',
      stderr: value.stderr ?? value.message,
      code: Number(value.code ?? 1)
    }
  }
}
async function digest(file: string) {
  return new Promise<string>((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(file)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

export class Pcsx2ProfileService {
  constructor(private readonly run: ProcessExecutor = execute) {}
  async detect(executablePath: string): Promise<Pcsx2Profile> {
    const absolute = path.resolve(executablePath)
    const name = path.basename(absolute).toLowerCase()
    if (!['pcsx2', 'pcsx2-qt', 'pcsx2.exe', 'pcsx2-qt.exe', 'pcsx2.appimage'].includes(name))
      throw Object.assign(new Error('Executable is outside the PCSX2 adapter allowlist'), {
        code: 'UNSUPPORTED_PCSX2_EXECUTABLE'
      })
    await access(absolute, constants.R_OK | (process.platform === 'win32' ? 0 : constants.X_OK))
    if (!(await stat(absolute)).isFile()) throw new Error('PCSX2 executable must be a file')
    const versionResult = await this.run(absolute, ['-version'])
    const version = `${versionResult.stdout}\n${versionResult.stderr}`.match(
      /(?:PCSX2\s*)?v?([0-9]+\.[0-9]+(?:\.[0-9]+)?(?:-[^\s]+)?)/i
    )?.[1]
    if (!version)
      throw Object.assign(new Error('PCSX2 version could not be determined'), {
        code: 'PCSX2_VERSION_UNKNOWN'
      })
    const major = Number(version.split('.')[0])
    return {
      id: await digest(absolute),
      executablePath: absolute,
      version,
      architecture: process.arch,
      sha256: await digest(absolute),
      adapterId: major >= 2 ? 'pcsx2-v2' : 'pcsx2-qt-1.7',
      supported: major >= 2 || version.startsWith('1.7')
    }
  }
  testConfigArgs(datapath: string): string[] {
    return ['-batch', '-nogui', '-datapath', path.resolve(datapath), '-testconfig']
  }
  async testConfig(profile: Pcsx2Profile, datapath: string): Promise<void> {
    const result = await this.run(profile.executablePath, this.testConfigArgs(datapath))
    if (result.code !== 0)
      throw Object.assign(new Error(`PCSX2 configuration test failed: ${result.stderr}`), {
        code: 'PCSX2_TESTCONFIG_FAILED'
      })
  }
}
