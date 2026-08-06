import type { HardwareSmokeTest, ReadinessReport } from '../../../src/types/opl'
import { ReadinessReportService } from './readiness-report.service'

export class HardwareSmokeService {
  constructor(private readonly reports: ReadinessReportService) {}
  async record(
    reportId: string,
    expectedRevision: number,
    input: Omit<HardwareSmokeTest, 'recordedAt'>
  ): Promise<ReadinessReport> {
    const report = await this.reports.get(reportId)
    if (!report) throw Object.assign(new Error('Report not found'), { code: 'REPORT_NOT_FOUND' })
    const hardwareSmoke = { ...input, recordedAt: new Date().toISOString() }
    const passed =
      input.detected && input.artDisplayed && input.noFragmentationError && input.milestoneReached
    return this.reports.replace(
      {
        ...report,
        hardwareSmoke,
        results: { ...report.results, hardware: passed ? 'passed' : 'failed' }
      },
      expectedRevision
    )
  }
}
