import { createWriteStream } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import type { Pcsx2Profile } from '../../../src/types/opl'

export interface RunningPcsx2 {
  process: ChildProcess
  stop(): Promise<{ code: number | null; signal: NodeJS.Signals | null; timedOut: boolean }>
}
export class Pcsx2RunnerService {
  async start(
    profile: Pcsx2Profile,
    options: { datapath: string; bootPath: string; usbImage: string; biosPath: string },
    timeoutMs = 20 * 60_000
  ): Promise<RunningPcsx2> {
    await mkdir(path.join(options.datapath, 'inis'), { recursive: true })
    await writeFile(
      path.join(options.datapath, 'inis', 'USB.ini'),
      `[USB Mass Storage]\nImagePath=${path.resolve(options.usbImage)}\n`,
      { mode: 0o600 }
    )
    const args = [
      '-batch',
      '-datapath',
      path.resolve(options.datapath),
      '-bios',
      path.resolve(options.biosPath),
      path.resolve(options.bootPath)
    ]
    const child = spawn(profile.executablePath, args, {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PCSX2_USB_IMAGE: path.resolve(options.usbImage) }
    })
    child.stdout?.pipe(createWriteStream(path.join(options.datapath, 'stdout.log')))
    child.stderr?.pipe(createWriteStream(path.join(options.datapath, 'stderr.log')))
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGTERM')
    }, timeoutMs)
    child.once('exit', () => clearTimeout(timer))
    return {
      process: child,
      stop: async () => {
        if (child.exitCode !== null || child.signalCode !== null)
          return { code: child.exitCode, signal: child.signalCode, timedOut }
        child.kill('SIGTERM')
        return new Promise((resolve) =>
          child.once('exit', (code, signal) => resolve({ code, signal, timedOut }))
        )
      }
    }
  }
}
