import type {
  CommandExecutor,
  FragmentationAdapter,
  FragmentationEvidence
} from './fragmentation-adapter'
import { unknownEvidence } from './fragmentation-adapter'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execute: CommandExecutor = async (command, args) => {
  try {
    const result = await promisify(execFile)(command, args, { encoding: 'utf8' })
    return { code: 0, stdout: result.stdout, stderr: result.stderr }
  } catch (error) {
    const value = error as Error & { code?: number; stdout?: string; stderr?: string }
    return {
      code: Number(value.code ?? 1),
      stdout: value.stdout ?? '',
      stderr: value.stderr ?? value.message
    }
  }
}

function failureCapability(stderr: string) {
  if (/access is denied|requires elevation|permission/i.test(stderr))
    return 'permission-denied' as const
  if (/not recognized|not found/i.test(stderr)) return 'unavailable' as const
  return 'unsupported' as const
}

export function parseFsutilExtents(output: string): FragmentationEvidence {
  const rows = output.split(/\r?\n/).flatMap((line) => {
    const match = line.match(
      /VCN:\s*(0x[\da-f]+|\d+)\s+Clusters:\s*(0x[\da-f]+|\d+)\s+LCN:\s*(0x[\da-f]+|\d+)/i
    )
    if (!match) return []
    return [
      { logicalStart: Number(match[1]), length: Number(match[2]), physicalStart: Number(match[3]) }
    ]
  })
  if (
    rows.length === 0 ||
    rows.some(
      (row) =>
        !Number.isSafeInteger(row.logicalStart) ||
        !Number.isSafeInteger(row.physicalStart) ||
        !Number.isSafeInteger(row.length) ||
        row.length <= 0
    )
  ) {
    return unknownEvidence(
      'fsutil file queryextents',
      'Complete VCN/LCN ranges were not recognized'
    )
  }
  for (let index = 0; index < rows.length; index += 1) {
    const expected = index === 0 ? 0 : rows[index - 1].logicalStart + rows[index - 1].length
    if (rows[index].logicalStart !== expected)
      return unknownEvidence('fsutil file queryextents', 'VCN ranges contain a gap or overlap')
  }
  const physicallyAdjacent = rows.every(
    (row, index) =>
      index === 0 || row.physicalStart === rows[index - 1].physicalStart + rows[index - 1].length
  )
  return {
    state: physicallyAdjacent ? 'contiguous' : 'fragmented',
    verification: 'verified',
    capability: 'supported',
    extents: rows.length,
    physicalRanges: rows.map((row) => ({
      logicalStart: row.logicalStart,
      physicalStart: row.physicalStart,
      length: row.length
    })),
    method: 'fsutil file queryextents',
    detail: `${rows.length} range(s), complete VCN coverage, physical ${physicallyAdjacent ? 'adjacency' : 'discontinuity'}`
  }
}

export class WindowsFragmentationAdapter implements FragmentationAdapter {
  readonly platform = 'win32' as const
  constructor(private readonly run: CommandExecutor = execute) {}
  async inspect(filePath: string): Promise<FragmentationEvidence> {
    const result = await this.run('fsutil', ['file', 'queryextents', filePath])
    if (result.code !== 0)
      return unknownEvidence(
        'fsutil file queryextents',
        result.stderr || 'unsupported volume',
        failureCapability(result.stderr)
      )
    return parseFsutilExtents(result.stdout)
  }
}
