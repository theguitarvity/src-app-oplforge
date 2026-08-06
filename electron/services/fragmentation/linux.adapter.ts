import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type {
  CommandExecutor,
  FragmentationAdapter,
  FragmentationEvidence
} from './fragmentation-adapter'
import { unknownEvidence } from './fragmentation-adapter'

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
  if (/permission denied|operation not permitted/i.test(stderr)) return 'permission-denied' as const
  if (/not found|enoent|not recognized/i.test(stderr)) return 'unavailable' as const
  return 'unsupported' as const
}

export function parseFilefragOutput(output: string): FragmentationEvidence {
  const summary = output.match(/:\s*(\d+) extent(?:s)? found\s*$/im)
  const rows = output.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*\d+:\s*(\d+)\.\.\s*(\d+):\s*(\d+)\.\.\s*(\d+):\s*(\d+):/)
    if (!match) return []
    return [
      {
        logicalStart: Number(match[1]),
        logicalEnd: Number(match[2]),
        physicalStart: Number(match[3]),
        physicalEnd: Number(match[4]),
        length: Number(match[5]),
        eof: /\beof\b/i.test(line)
      }
    ]
  })
  if (!summary || rows.length === 0 || Number(summary[1]) !== rows.length)
    return unknownEvidence('filefrag -v -s', 'Complete extent table or summary was not recognized')
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const expectedLogicalStart = index === 0 ? 0 : rows[index - 1].logicalEnd + 1
    if (
      row.logicalStart !== expectedLogicalStart ||
      row.logicalEnd < row.logicalStart ||
      row.physicalEnd < row.physicalStart ||
      row.length !== row.logicalEnd - row.logicalStart + 1 ||
      row.length !== row.physicalEnd - row.physicalStart + 1
    ) {
      return unknownEvidence(
        'filefrag -v -s',
        'Extent table has a logical gap, overlap or invalid range'
      )
    }
  }
  if (!rows.at(-1)?.eof)
    return unknownEvidence('filefrag -v -s', 'Extent table does not prove complete EOF coverage')
  const physicallyAdjacent = rows.every(
    (row, index) => index === 0 || row.physicalStart === rows[index - 1].physicalEnd + 1
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
    method: 'filefrag -v -s',
    detail: `${rows.length} range(s), complete logical coverage, physical ${physicallyAdjacent ? 'adjacency' : 'discontinuity'}`
  }
}

export class LinuxFragmentationAdapter implements FragmentationAdapter {
  readonly platform = 'linux' as const
  constructor(private readonly run: CommandExecutor = execute) {}
  async inspect(filePath: string): Promise<FragmentationEvidence> {
    const result = await this.run('filefrag', ['-v', '-s', '--', filePath])
    if (result.code !== 0)
      return unknownEvidence(
        'filefrag -v -s',
        result.stderr || 'filefrag unavailable',
        failureCapability(result.stderr)
      )
    return parseFilefragOutput(result.stdout)
  }
}
