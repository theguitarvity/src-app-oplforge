import NativeDiagnosticsModule from './specs/NativeDiagnosticsModule'
import type { DiagnosticsReport, SerializableError } from '../types'

/**
 * Typed wrapper over the Codegen'd DiagnosticsModule TurboModule
 * (specs/008-android-forge-essentials/contracts/native-modules.md).
 */

export class DiagnosticsModuleError extends Error {
  code: string
  constructor(error: SerializableError) {
    super(error.message)
    this.code = error.code
  }
}

function toDiagnosticsModuleError(error: unknown): DiagnosticsModuleError {
  if (error instanceof Error && 'code' in error) {
    return new DiagnosticsModuleError({
      code: String((error as { code?: string }).code ?? 'UNKNOWN_ERROR'),
      message: error.message
    })
  }
  return new DiagnosticsModuleError({ code: 'UNKNOWN_ERROR', message: String(error) })
}

export async function runDiagnostics(): Promise<DiagnosticsReport> {
  try {
    return (await NativeDiagnosticsModule.runDiagnostics()) as DiagnosticsReport
  } catch (error) {
    throw toDiagnosticsModuleError(error)
  }
}

export async function getLatestDiagnosticsReport(): Promise<DiagnosticsReport | undefined> {
  try {
    const result = await NativeDiagnosticsModule.getLatestDiagnosticsReport()
    return (result ?? undefined) as DiagnosticsReport | undefined
  } catch (error) {
    throw toDiagnosticsModuleError(error)
  }
}

/** Creates the 10 mandatory OPL folders that don't exist yet, then returns the re-checked report. */
export async function prepareDeviceStructure(): Promise<DiagnosticsReport> {
  try {
    return (await NativeDiagnosticsModule.prepareDeviceStructure()) as DiagnosticsReport
  } catch (error) {
    throw toDiagnosticsModuleError(error)
  }
}
