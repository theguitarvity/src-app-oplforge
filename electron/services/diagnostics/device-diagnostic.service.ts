import type { DeviceDiagnostic, Finding, OplProfile } from '../../../src/types/opl'
import { inspectDevice, OPL_DIRS } from '../device.service'
import { access } from 'node:fs/promises'
import path from 'node:path'
import { CatalogService } from '../catalog/catalog.service'
import { classifyReadiness } from './readiness-classifier'

export class DeviceDiagnosticService {
  constructor(private readonly catalog: CatalogService) {}
  async run(
    devicePath: string,
    profile?: OplProfile,
    fileSystemHint?: string
  ): Promise<DeviceDiagnostic> {
    const device = await inspectDevice(devicePath, fileSystemHint)
    const findings: Finding[] = []
    for (const directory of OPL_DIRS)
      try {
        await access(path.join(device.realPath, directory))
      } catch {
        findings.push({
          code: 'OPL_DIRECTORY_MISSING',
          severity: directory === 'DVD' || directory === 'CD' ? 'warning' : 'info',
          state: 'failed',
          message: `Directory /${directory} is missing`,
          remediation: 'Create the OPL directory explicitly'
        })
      }
    if (!device.clusterBytes)
      findings.push({
        code: 'CLUSTER_SIZE_UNKNOWN',
        severity: 'warning',
        state: 'not-verified',
        message: 'Cluster size could not be verified'
      })
    const catalog = await this.catalog.scan(devicePath, profile)
    findings.push(...catalog.findings)
    return {
      device,
      readiness: classifyReadiness(device, catalog, findings),
      findings,
      catalog,
      checkedAt: new Date().toISOString()
    }
  }
}
