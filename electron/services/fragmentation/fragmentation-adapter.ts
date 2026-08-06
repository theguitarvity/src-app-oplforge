import type {
  FragmentationState,
  PhysicalRange,
  VerificationCapability,
  VerificationState
} from '../../../src/types/opl'

export interface FragmentationEvidence {
  state: FragmentationState
  verification: VerificationState
  capability?: VerificationCapability
  extents?: number
  physicalRanges?: PhysicalRange[]
  method: string
  detail: string
}
export type CommandExecutor = (
  command: string,
  args: string[]
) => Promise<{ code: number; stdout: string; stderr: string }>
export interface FragmentationAdapter {
  readonly platform: NodeJS.Platform
  inspect(filePath: string): Promise<FragmentationEvidence>
}

export function unknownEvidence(
  method: string,
  detail: string,
  capability: VerificationCapability = 'unrecognized-output'
): FragmentationEvidence {
  return { state: 'unknown', verification: 'not-verified', capability, method, detail }
}
