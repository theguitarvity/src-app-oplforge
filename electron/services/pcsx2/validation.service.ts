import { mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  BiosIdentity,
  Pcsx2Profile,
  ValidationCheckpoint,
  ValidationRun
} from '../../../src/types/opl'
import { Pcsx2RunnerService, type RunningPcsx2 } from './pcsx2-runner.service'
import { sha256File } from '../installation/installation-planner.service'

export const VALIDATION_STAGES = [
  'BIOS inicializada',
  'OPL abriu sem crash',
  'USB emulado detectado',
  'Lista de jogos carregada',
  'Game ID e título exibidos',
  'Capa COV/COV2 exibida',
  'Jogo selecionável',
  'Sem erro de fragmentação',
  'Marco do jogo alcançado'
]
interface Plan {
  id: string
  profile: Pcsx2Profile
  bios: BiosIdentity
  biosPath: string
  memoryCardPath: string
  usbImage: string
  workspace: string
  bootMode: 'memory-card' | 'elf-fallback'
  elfPath?: string
}
export class ValidationService {
  private plans = new Map<string, Plan>()
  private runs = new Map<string, { value: ValidationRun; process: RunningPcsx2 }>()
  constructor(private readonly runner = new Pcsx2RunnerService()) {}
  plan(input: Omit<Plan, 'id'>) {
    const plan = { id: randomUUID(), ...input }
    this.plans.set(plan.id, plan)
    return plan
  }
  async start(planId: string): Promise<ValidationRun> {
    const plan = this.plans.get(planId)
    if (!plan)
      throw Object.assign(new Error('Validation plan not found'), { code: 'PLAN_NOT_FOUND' })
    await mkdir(plan.workspace, { recursive: true })
    const process = await this.runner.start(plan.profile, {
      datapath: path.join(plan.workspace, 'pcsx2-data'),
      bootPath: plan.bootMode === 'memory-card' ? plan.memoryCardPath : plan.elfPath!,
      usbImage: plan.usbImage,
      biosPath: plan.biosPath
    })
    const value: ValidationRun = {
      id: randomUUID(),
      status: 'running',
      bootMode: plan.bootMode,
      pcsx2: plan.profile,
      bios: plan.bios,
      datapath: path.join(plan.workspace, 'pcsx2-data'),
      startedAt: new Date().toISOString(),
      checkpoints: [],
      artifacts: []
    }
    this.runs.set(value.id, { value, process })
    return value
  }
  checkpoint(
    runId: string,
    stage: number,
    result: 'passed' | 'failed' | 'not-verified',
    reason?: string,
    evidenceSha256?: string
  ): ValidationCheckpoint {
    const run = this.runs.get(runId)
    if (!run || stage < 1 || stage > 9)
      throw Object.assign(new Error('Validation run/checkpoint not found'), {
        code: 'RUN_NOT_FOUND'
      })
    const checkpoint = {
      stage,
      label: VALIDATION_STAGES[stage - 1],
      result,
      actor: 'manual' as const,
      timestamp: new Date().toISOString(),
      reason,
      evidenceSha256
    }
    run.value.checkpoints = [
      ...run.value.checkpoints.filter((item) => item.stage !== stage),
      checkpoint
    ].sort((a, b) => a.stage - b.stage)
    return checkpoint
  }
  evidenceDirectory(runId: string): string {
    const run = this.runs.get(runId)
    if (!run) throw Object.assign(new Error('Validation run not found'), { code: 'RUN_NOT_FOUND' })
    return run.value.datapath
  }
  get(runId: string): ValidationRun | undefined {
    return this.runs.get(runId)?.value
  }
  async stop(runId: string): Promise<ValidationRun> {
    const run = this.runs.get(runId)
    if (!run) throw Object.assign(new Error('Validation run not found'), { code: 'RUN_NOT_FOUND' })
    const processResult = await run.process.stop()
    run.value.completedAt = new Date().toISOString()
    const checkpointsPassed =
      run.value.checkpoints.length === 9 &&
      run.value.checkpoints.every((item) => item.result === 'passed')
    const crashed = processResult.code !== null && processResult.code !== 0
    run.value.status = processResult.timedOut
      ? 'timeout'
      : checkpointsPassed && !crashed
        ? 'passed'
        : 'failed'
    for (const name of await readdir(run.value.datapath).catch(() => []))
      if (/\.(log|png)$/i.test(name)) {
        const artifactPath = path.join(run.value.datapath, name)
        run.value.artifacts.push({
          kind: name.endsWith('.png') ? 'screenshot' : 'log',
          path: artifactPath,
          sha256: await sha256File(artifactPath)
        })
      }
    return run.value
  }
}
