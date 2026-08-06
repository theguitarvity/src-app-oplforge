import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { copyFile, mkdir } from 'node:fs/promises'
import { writeFile } from 'node:fs/promises'
import type { ValidationPlanInput } from '../../src/types/opl'
import { getCatalogService } from '../services/catalog/catalog-runtime'
import { Pcsx2ProfileService } from '../services/pcsx2/pcsx2-profile.service'
import { ValidationAssetsService } from '../services/pcsx2/validation-assets.service'
import { UsbImageService } from '../services/pcsx2/usb-image.service'
import { ValidationService } from '../services/pcsx2/validation.service'
import { sha256File } from '../services/installation/installation-planner.service'
import { parseInput } from './schemas'
import { getOplProfileService } from './opl.ipc'
import { ReadinessReportService } from '../services/reports/readiness-report.service'
import { HardwareSmokeService } from '../services/reports/hardware-smoke.service'
import { inspectDevice } from '../services/device.service'

const profiles = new Pcsx2ProfileService()
const assets = new ValidationAssetsService()
const images = new UsbImageService()
const validation = new ValidationService()
const reports = new ReadinessReportService(
  path.join(app.getPath('userData'), 'readiness-reports.json')
)
const hardware = new HardwareSmokeService(reports)
const publish = (event: {
  runId: string
  kind: 'started' | 'checkpoint' | 'stopped'
  checkpoint?: ReturnType<ValidationService['checkpoint']>
  status?: import('../../src/types/opl').ValidationRun['status']
}) => {
  for (const window of BrowserWindow.getAllWindows())
    window.webContents.send('validation:event', event)
}
export function registerValidationIpc() {
  ipcMain.handle('pcsx2:detect', (_event, executablePath: string) =>
    profiles.detect(executablePath)
  )
  ipcMain.handle('validation:plan', async (_event, input: ValidationPlanInput) => {
    const parsed = parseInput('validationPlan', input)
    if (!(await getOplProfileService().get(parsed.profileId)))
      throw Object.assign(new Error('OPL profile not found'), { code: 'PROFILE_NOT_FOUND' })
    const snapshot = await getCatalogService().snapshot(parsed.deviceId)
    const devicePath = getCatalogService().mount(parsed.deviceId)
    const item = snapshot?.items.find((candidate) => candidate.itemId === parsed.itemId)
    if (!snapshot || snapshot.snapshotId !== parsed.snapshotId || !devicePath || !item)
      throw Object.assign(new Error('Catalog snapshot/item is stale'), { code: 'STALE_REVISION' })
    const pcsx2 = await profiles.detect(parsed.pcsx2Path)
    const bios = await assets.identifyBios(parsed.biosPath)
    const workspace = path.join(app.getPath('userData'), 'validation', crypto.randomUUID())
    await mkdir(workspace, { recursive: true })
    await profiles.testConfig(pcsx2, path.join(workspace, 'pcsx2-data'))
    const card = await assets.cloneMemoryCard(parsed.memoryCardPath, workspace)
    const usb = await images.build(devicePath, item, workspace)
    const plan = validation.plan({
      profile: pcsx2,
      bios,
      biosPath: parsed.biosPath,
      memoryCardPath: card.path,
      usbImage: usb.imagePath,
      workspace,
      bootMode: parsed.bootMode,
      elfPath: parsed.elfPath
    })
    return { id: plan.id, pcsx2, bios, bootMode: plan.bootMode }
  })
  ipcMain.handle('validation:start', async (_event, input: { operationId: string }) => {
    const run = await validation.start(parseInput('operationCancel', input).operationId)
    publish({ runId: run.id, kind: 'started', status: run.status })
    return run
  })
  ipcMain.handle(
    'validation:checkpoint',
    async (
      _event,
      input: {
        operationId: string
        stage: number
        result: 'passed' | 'failed' | 'not-verified'
        reason?: string
        screenshotPath?: string
      }
    ) => {
      const parsed = parseInput('checkpoint', input)
      let evidence: string | undefined
      if (parsed.screenshotPath) {
        evidence = await sha256File(parsed.screenshotPath)
        await copyFile(
          parsed.screenshotPath,
          path.join(
            validation.evidenceDirectory(parsed.operationId),
            `checkpoint-${parsed.stage}-${evidence.slice(0, 12)}.png`
          )
        )
      }
      const checkpoint = validation.checkpoint(
        parsed.operationId,
        parsed.stage,
        parsed.result,
        input.reason,
        evidence
      )
      publish({ runId: parsed.operationId, kind: 'checkpoint', checkpoint })
      return checkpoint
    }
  )
  ipcMain.handle('validation:stop', async (_event, input: { operationId: string }) => {
    const run = await validation.stop(parseInput('operationCancel', input).operationId)
    publish({ runId: run.id, kind: 'stopped', status: run.status })
    return run
  })
  ipcMain.handle(
    'reports:generate',
    async (
      _event,
      input: { deviceId: string; snapshotId: string; profileId: string; validationRunId?: string }
    ) => {
      const parsed = parseInput('reportGenerate', input)
      const snapshot = await getCatalogService().snapshot(parsed.deviceId)
      const mount = getCatalogService().mount(parsed.deviceId)
      const opl = await getOplProfileService().get(parsed.profileId)
      if (!snapshot || snapshot.snapshotId !== parsed.snapshotId || !mount || !opl)
        throw Object.assign(new Error('Report inputs are stale'), { code: 'STALE_REVISION' })
      return reports.generate({
        device: await inspectDevice(mount),
        snapshot,
        opl,
        validation: parsed.validationRunId ? validation.get(parsed.validationRunId) : undefined
      })
    }
  )
  ipcMain.handle('reports:get', (_event, reportId: string) => reports.get(reportId))
  ipcMain.handle(
    'reports:record-hardware-smoke',
    (
      _event,
      input: {
        reportId: string
        expectedRevision: number
        consoleModel: string
        adapter: string
        oplVersion: string
        detected: boolean
        artDisplayed: boolean
        noFragmentationError: boolean
        milestoneReached: boolean
      }
    ) => {
      const parsed = parseInput('hardwareSmoke', input)
      const { reportId, expectedRevision, ...smoke } = parsed
      return hardware.record(reportId, expectedRevision, smoke)
    }
  )
  ipcMain.handle(
    'reports:export',
    async (_event, input: { reportId: string; destinationPath: string }) => {
      const parsed = parseInput('reportExport', input)
      const report = await reports.get(parsed.reportId)
      if (!report) throw Object.assign(new Error('Report not found'), { code: 'REPORT_NOT_FOUND' })
      await writeFile(parsed.destinationPath, reports.exportJson(report), {
        mode: 0o600,
        flag: 'wx'
      })
    }
  )
}
