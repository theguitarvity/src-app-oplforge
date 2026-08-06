import { randomUUID } from 'node:crypto'
import type {
  CatalogSnapshot,
  DeviceIdentity,
  OplProfile,
  ReadinessReport,
  ValidationRun
} from '../../../src/types/opl'
import { JsonStore } from '../persistence/json-store.service'

export class ReadinessReportService {
  private readonly store: JsonStore<Record<string, ReadinessReport>>
  constructor(filePath: string) {
    this.store = new JsonStore(filePath, 1, () => ({}))
  }
  async generate(input: {
    device: DeviceIdentity
    snapshot: CatalogSnapshot
    opl: OplProfile
    validation?: ValidationRun
  }): Promise<ReadinessReport> {
    const { mountPath, realPath, ...sanitizedDevice } = input.device
    void mountPath
    void realPath
    const structural =
      input.snapshot.status !== 'complete'
        ? 'not-verified'
        : input.snapshot.items.some((item) => item.classification === 'invalid')
          ? 'failed'
          : input.snapshot.items.every((item) => item.classification === 'ready')
            ? 'passed'
            : 'not-verified'
    const report: ReadinessReport = {
      id: randomUUID(),
      revision: 1,
      createdAt: new Date().toISOString(),
      device: sanitizedDevice,
      opl: structuredClone(input.opl),
      pcsx2: input.validation?.pcsx2,
      bios: input.validation?.bios,
      games: input.snapshot.items
        .filter((item) => item.kind === 'game')
        .map((item) => ({
          gameId: item.gameId,
          title: item.title,
          format: item.installFormat,
          sourceHashes: item.files.flatMap((file) => (file.sha256 ? [file.sha256] : [])),
          fragmentation: item.fragmentation,
          art: item.artStatus,
          integrity: item.structuralIntegrity
        })),
      evidence:
        input.validation?.artifacts.map((artifact) => ({
          kind: artifact.kind,
          sha256: artifact.sha256
        })) ?? [],
      limitations: [
        'Aprovação no PCSX2 não garante funcionamento em hardware real.',
        ...(input.snapshot.items.some((item) => item.fragmentation === 'unknown')
          ? ['Contiguidade não verificada para um ou mais arquivos.']
          : [])
      ],
      results: {
        structural,
        pcsx2: input.validation
          ? input.validation.status === 'passed'
            ? 'passed'
            : input.validation.status === 'running'
              ? 'not-verified'
              : 'failed'
          : 'not-run',
        hardware: 'not-run'
      }
    }
    const document = await this.store.read()
    await this.store.write({ ...document.data, [report.id]: report }, document.revision)
    return structuredClone(report)
  }
  async get(id: string) {
    return structuredClone((await this.store.read()).data[id])
  }
  async replace(report: ReadinessReport, expectedRevision: number) {
    const document = await this.store.read()
    const existing = document.data[report.id]
    if (!existing) throw Object.assign(new Error('Report not found'), { code: 'REPORT_NOT_FOUND' })
    if (existing.revision !== expectedRevision)
      throw Object.assign(new Error('Report revision changed'), { code: 'STALE_REVISION' })
    const next = { ...structuredClone(report), revision: expectedRevision + 1 }
    await this.store.write({ ...document.data, [next.id]: next }, document.revision)
    return next
  }
  exportJson(report: ReadinessReport): string {
    return `${JSON.stringify(report, null, 2)}\n`
  }
}
