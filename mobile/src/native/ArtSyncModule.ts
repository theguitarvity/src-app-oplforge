import { NativeEventEmitter } from 'react-native'
import NativeArtSyncModule from './specs/NativeArtSyncModule'
import type { SerializableError } from '../types'

/**
 * Typed wrapper over the Codegen'd ArtSyncModule TurboModule — box-art
 * download for the local library, matching desktop's Art Manager.
 */

export class ArtSyncModuleError extends Error {
  code: string
  constructor(error: SerializableError) {
    super(error.message)
    this.code = error.code
  }
}

function toArtSyncModuleError(error: unknown): ArtSyncModuleError {
  if (error instanceof Error && 'code' in error) {
    return new ArtSyncModuleError({
      code: String((error as { code?: string }).code ?? 'UNKNOWN_ERROR'),
      message: error.message
    })
  }
  return new ArtSyncModuleError({ code: 'UNKNOWN_ERROR', message: String(error) })
}

export interface ArtSyncPlanSummary {
  totalGames: number
  missingArt: number
  matchedInSource: number
}

export async function planArtSync(): Promise<ArtSyncPlanSummary> {
  try {
    return (await NativeArtSyncModule.planArtSync()) as ArtSyncPlanSummary
  } catch (error) {
    throw toArtSyncModuleError(error)
  }
}

export async function startArtSync(): Promise<{ status: string }> {
  try {
    return (await NativeArtSyncModule.startArtSync()) as { status: string }
  } catch (error) {
    throw toArtSyncModuleError(error)
  }
}

export type ArtSyncState = 'idle' | 'planning' | 'planned' | 'running' | 'completed' | 'error'

export interface ArtSyncEventPayload {
  state: ArtSyncState
  totalGames: number
  matchedInSource: number
  installed: number
  failed: number
  errorMessage?: string
  timestamp: string
}

/** Subscribes to plan/progress/completion events. Returns an unsubscribe function. */
export function onArtSyncEvent(callback: (event: ArtSyncEventPayload) => void): () => void {
  const emitter = new NativeEventEmitter(NativeArtSyncModule as never)
  const subscription = emitter.addListener('onArtSyncEvent', (raw: ArtSyncEventPayload) => {
    callback(raw)
  })
  return () => subscription.remove()
}
