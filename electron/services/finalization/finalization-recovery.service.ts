export interface RecoverableInstallationService {
  recover(devicePath: string): Promise<number>
}

export class FinalizationRecoveryService {
  constructor(
    private readonly installation: RecoverableInstallationService,
    private readonly listMountedDevicePaths: () => Promise<string[]>
  ) {}

  async reconcile(): Promise<{ devicePath: string; recovered: number }[]> {
    const results: { devicePath: string; recovered: number }[] = []
    for (const devicePath of await this.listMountedDevicePaths())
      results.push({ devicePath, recovered: await this.installation.recover(devicePath) })
    return results
  }
}
