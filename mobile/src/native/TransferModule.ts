import { NativeEventEmitter } from 'react-native'
import NativeTransferModule from './specs/NativeTransferModule'
import type { SerializableError, TransferItem, TransferQueueEvent } from '../types'

/**
 * Typed wrapper over the Codegen'd TransferModule TurboModule
 * (specs/008-android-forge-essentials/contracts/native-modules.md).
 */

export class TransferModuleError extends Error {
  code: string
  constructor(error: SerializableError) {
    super(error.message)
    this.code = error.code
  }
}

function toTransferModuleError(error: unknown): TransferModuleError {
  if (error instanceof Error && 'code' in error) {
    return new TransferModuleError({
      code: String((error as { code?: string }).code ?? 'UNKNOWN_ERROR'),
      message: error.message
    })
  }
  return new TransferModuleError({ code: 'UNKNOWN_ERROR', message: String(error) })
}

/** Starts a local-file import (US2) — `sourceUri` is a SAF document URI from the system file picker. */
export async function enqueueImport(sourceUri: string, destinationHint = ''): Promise<TransferItem> {
  try {
    return (await NativeTransferModule.enqueueImport(sourceUri, destinationHint)) as TransferItem
  } catch (error) {
    throw toTransferModuleError(error)
  }
}

export async function getQueue(): Promise<TransferItem[]> {
  try {
    return (await NativeTransferModule.getQueue()) as TransferItem[]
  } catch (error) {
    throw toTransferModuleError(error)
  }
}

export async function cancel(transferId: string): Promise<TransferItem> {
  try {
    return (await NativeTransferModule.cancel(transferId)) as TransferItem
  } catch (error) {
    throw toTransferModuleError(error)
  }
}

export async function retry(transferId: string): Promise<TransferItem> {
  try {
    return (await NativeTransferModule.retry(transferId)) as TransferItem
  } catch (error) {
    throw toTransferModuleError(error)
  }
}

/** Subscribes to per-item queue progress/state-change events. Returns an unsubscribe function. */
export function onTransferQueueEvent(callback: (event: TransferQueueEvent) => void): () => void {
  const emitter = new NativeEventEmitter(NativeTransferModule as never)
  const subscription = emitter.addListener('onTransferQueueEvent', (raw: TransferQueueEvent) => callback(raw))
  return () => subscription.remove()
}
