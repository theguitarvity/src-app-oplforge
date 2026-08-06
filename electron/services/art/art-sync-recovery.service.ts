import type { ArtSyncJob } from '../../../src/types/opl-finalization'
import type { ArtSyncJobService } from './art-sync-job.service'

export class ArtSyncRecoveryService {
  constructor(private readonly jobs: ArtSyncJobService) {}
  async reconcile(): Promise<ArtSyncJob[]> {
    const page = await this.jobs.list(0, 500)
    const recovered: ArtSyncJob[] = []
    for (const job of page.items) {
      if (!['running', 'recovery-pending'].includes(job.state)) continue
      const normalized = await this.jobs.pause(job.jobId, job.revision)
      recovered.push(normalized)
    }
    return recovered
  }
}
