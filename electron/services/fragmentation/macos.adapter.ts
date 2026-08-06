import type { FragmentationAdapter, FragmentationEvidence } from './fragmentation-adapter'
import { unknownEvidence } from './fragmentation-adapter'

export class MacOsFragmentationAdapter implements FragmentationAdapter {
  readonly platform = 'darwin' as const
  async inspect(filePath?: string): Promise<FragmentationEvidence> {
    void filePath
    return unknownEvidence(
      'macOS',
      'No stable public extent API is available; repair is blocked',
      'unsupported'
    )
  }
}
