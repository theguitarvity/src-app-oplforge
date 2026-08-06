import type { DeviceCapability, VerificationCapability } from '../../../src/types/opl'
import type { FragmentationAdapter } from '../fragmentation/fragmentation-adapter'
import { CAPABILITY_MATRIX_VERSION, lookupCapability } from './capability-matrix'

export interface CapabilityProbeInput {
  deviceId: string
  mountPath: string
  realPath: string
  volumeId?: string
  fileSystem: string
  totalBytes: number
  freeBytes: number
  sampleFilePath?: string
}

export class FragmentationCapabilityService {
  constructor(
    private readonly adapter: FragmentationAdapter,
    private readonly now: () => Date = () => new Date()
  ) {}

  async probe(input: CapabilityProbeInput): Promise<DeviceCapability> {
    const method =
      this.adapter.platform === 'linux'
        ? 'filefrag'
        : this.adapter.platform === 'win32'
          ? 'fsutil'
          : 'none'
    const homologation = lookupCapability({
      platform: this.adapter.platform,
      fileSystem: input.fileSystem,
      method
    })
    const base = {
      deviceId: input.deviceId,
      mountPath: input.mountPath,
      realPath: input.realPath,
      volumeId: input.volumeId,
      fileSystem: input.fileSystem.trim().toLowerCase() || 'unknown',
      totalBytes: input.totalBytes,
      freeBytes: input.freeBytes,
      method: `${method}; capability-matrix-v${CAPABILITY_MATRIX_VERSION}`,
      observedAt: this.now().toISOString()
    }
    if (!homologation)
      return {
        ...base,
        extentVerification: 'not-homologated',
        homologated: false,
        limitations: [
          `Combinação ${this.adapter.platform}/${base.fileSystem}/${method} não homologada; correção bloqueada.`
        ]
      }
    if (!input.sampleFilePath)
      return {
        ...base,
        extentVerification: 'unavailable',
        homologated: true,
        limitations: [
          'Nenhum arquivo do volume estava disponível para o probe de extents; correção bloqueada.'
        ]
      }

    const evidence = await this.adapter.inspect(input.sampleFilePath)
    const extentVerification: VerificationCapability =
      evidence.verification === 'verified'
        ? 'supported'
        : (evidence.capability ?? 'unrecognized-output')
    return {
      ...base,
      method: `${evidence.method}; capability-matrix-v${CAPABILITY_MATRIX_VERSION}`,
      extentVerification,
      homologated: true,
      limitations:
        extentVerification === 'supported'
          ? []
          : [
              `Probe de extents falhou: ${evidence.detail}. Verifique ferramenta, permissões e suporte do volume.`
            ]
    }
  }
}
