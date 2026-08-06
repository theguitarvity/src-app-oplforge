import { createHash } from 'node:crypto'
import { open, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import type { FileFingerprint, InstallationFormat, TransactionFile } from '../../../src/types/opl'
import type { FragmentationAdapter } from '../fragmentation/fragmentation-adapter'
import { inspectIso } from '../images/iso9660.service'
import { readZsoHeader } from '../images/zso.service'

export interface CandidateResult {
  absolutePath: string
  file: TransactionFile
}

export class FragmentationCandidateService {
  constructor(private readonly adapter: FragmentationAdapter) {}

  async create(
    sourcePath: string,
    operationId: string,
    expected: FileFingerprint,
    format: InstallationFormat
  ): Promise<CandidateResult> {
    const candidatePath = path.join(
      path.dirname(sourcePath),
      `.${path.basename(sourcePath)}.${operationId}.candidate`
    )
    const source = await open(sourcePath, 'r')
    const candidate = await open(candidatePath, 'wx', 0o600)
    const sourceHash = createHash('sha256')
    const candidateHash = createHash('sha256')
    let bytes = 0
    try {
      const buffer = Buffer.allocUnsafe(1024 * 1024)
      for (;;) {
        const result = await source.read(buffer, 0, buffer.length, null)
        if (result.bytesRead === 0) break
        const chunk = buffer.subarray(0, result.bytesRead)
        sourceHash.update(chunk)
        candidateHash.update(chunk)
        await candidate.write(chunk)
        bytes += result.bytesRead
      }
      await candidate.sync()
    } catch (error) {
      await candidate.close()
      await source.close()
      await unlink(candidatePath).catch(() => undefined)
      throw error
    }
    await candidate.close()
    await source.close()
    const sourceDigest = sourceHash.digest('hex')
    const candidateDigest = candidateHash.digest('hex')
    if (
      bytes !== expected.sizeBytes ||
      sourceDigest !== expected.sha256 ||
      candidateDigest !== expected.sha256
    ) {
      await unlink(candidatePath).catch(() => undefined)
      throw Object.assign(new Error('Candidate differs from source fingerprint'), {
        code: 'HASH_MISMATCH'
      })
    }
    try {
      if (format === 'ISO' && !(await inspectIso(candidatePath)).valid)
        throw Object.assign(new Error('Candidate ISO structure is invalid'), {
          code: 'STRUCTURE_INVALID'
        })
      if (format === 'ZSO') await readZsoHeader(candidatePath)
      const evidence = await this.adapter.inspect(candidatePath)
      if (evidence.state !== 'contiguous' || evidence.verification !== 'verified')
        throw Object.assign(new Error('Candidate is still fragmented'), {
          code: 'STILL_FRAGMENTED'
        })
    } catch (error) {
      await unlink(candidatePath).catch(() => undefined)
      throw error
    }
    const info = await stat(candidatePath)
    return {
      absolutePath: candidatePath,
      file: {
        relativePath: path.basename(candidatePath),
        sizeBytes: info.size,
        sha256: candidateDigest,
        extentState: 'contiguous'
      }
    }
  }
}
