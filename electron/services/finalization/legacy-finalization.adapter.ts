export interface LegacyFinalizationRequest {
  stagingPath: string
  devicePath: string
  media: 'CD' | 'DVD'
  title: string
  selectedFiles: string[]
}

export type LegacyFinalizationHandler = (request: LegacyFinalizationRequest) => Promise<void>

export class LegacyFinalizationAdapter {
  private handler?: LegacyFinalizationHandler

  configure(handler: LegacyFinalizationHandler): void {
    this.handler = handler
  }

  async submit(request: LegacyFinalizationRequest): Promise<void> {
    if (!this.handler) {
      throw Object.assign(
        new Error(
          'Downloaded files remain in staging until the unified finalization runtime is available'
        ),
        {
          code: 'FINALIZATION_PIPELINE_REQUIRED',
          stagingPreserved: true
        }
      )
    }
    await this.handler(request)
  }
}

export const legacyFinalizationAdapter = new LegacyFinalizationAdapter()
