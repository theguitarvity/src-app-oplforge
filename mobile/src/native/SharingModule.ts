import { NativeEventEmitter } from 'react-native'
import NativeSharingModule from './specs/NativeSharingModule'
import type { ConnectionTutorialStep, SerializableError, SharingSession } from '../types'

/**
 * Typed wrapper over the Codegen'd SharingModule TurboModule
 * (contracts/native-modules.md). The rest of the app imports from here.
 */

interface RawSession {
  state: string
  boundAddress?: string
  port?: number
  shareName: string
  hasCredentials: boolean
  writeAccessAcknowledgedAt?: string
  startedAt?: string
  error?: SerializableError
}

function toSession(raw: RawSession): SharingSession {
  return {
    state: raw.state as SharingSession['state'],
    boundAddress: raw.boundAddress,
    port: raw.port,
    shareName: raw.shareName,
    hasCredentials: raw.hasCredentials,
    writeAccessAcknowledgedAt: raw.writeAccessAcknowledgedAt,
    startedAt: raw.startedAt,
    error: raw.error
  }
}

export class SharingModuleError extends Error {
  code: string
  constructor(error: SerializableError) {
    super(error.message)
    this.code = error.code
  }
}

function toSharingModuleError(error: unknown): SharingModuleError {
  if (error instanceof Error && 'code' in error) {
    return new SharingModuleError({
      code: String((error as { code?: string }).code ?? 'UNKNOWN_ERROR'),
      message: error.message
    })
  }
  return new SharingModuleError({ code: 'UNKNOWN_ERROR', message: String(error) })
}

export async function getSession(): Promise<SharingSession> {
  try {
    const raw = (await NativeSharingModule.getSession()) as RawSession
    return toSession(raw)
  } catch (error) {
    throw toSharingModuleError(error)
  }
}

/** Sets the SMB username/password (FR-017) — write-only, never echoed back. */
export async function saveCredentials(username: string, password: string): Promise<SharingSession> {
  try {
    const raw = (await NativeSharingModule.saveCredentials({ username, password })) as RawSession
    return toSession(raw)
  } catch (error) {
    throw toSharingModuleError(error)
  }
}

/** Records the one-time explicit write-access consent (FR-018), distinct from credentials. */
export async function acknowledgeWriteAccess(): Promise<SharingSession> {
  try {
    const raw = (await NativeSharingModule.acknowledgeWriteAccess()) as RawSession
    return toSession(raw)
  } catch (error) {
    throw toSharingModuleError(error)
  }
}

export async function startSharing(shareName: string): Promise<SharingSession> {
  try {
    const raw = (await NativeSharingModule.startSharing(shareName)) as RawSession
    return toSession(raw)
  } catch (error) {
    throw toSharingModuleError(error)
  }
}

export async function stopSharing(): Promise<SharingSession> {
  try {
    const raw = (await NativeSharingModule.stopSharing()) as RawSession
    return toSession(raw)
  } catch (error) {
    throw toSharingModuleError(error)
  }
}

/** Guided tutorial steps for the currently active session (FR-023); empty when sharing is off. */
export async function getConnectionInstructions(): Promise<ConnectionTutorialStep[]> {
  try {
    const raw = (await NativeSharingModule.getConnectionInstructions()) as ConnectionTutorialStep[]
    return raw
  } catch (error) {
    throw toSharingModuleError(error)
  }
}

export interface RecentConnection {
  username: string
  shareName: string
  lastUsedAt: string
}

/** Up to 5 most-recently-used connections (username + share name only, never the password). */
export async function getRecentConnections(): Promise<RecentConnection[]> {
  try {
    return (await NativeSharingModule.getRecentConnections()) as RecentConnection[]
  } catch (error) {
    throw toSharingModuleError(error)
  }
}

export interface SharingSessionEventPayload {
  kind: string
  session: SharingSession
  client?: { id: string; remoteAddress: string; connectedAt: string }
  message: string
  timestamp: string
}

/** Subscribes to state/client/write-conflict events. Returns an unsubscribe function. */
export function onSharingSessionEvent(callback: (event: SharingSessionEventPayload) => void): () => void {
  const emitter = new NativeEventEmitter(NativeSharingModule as never)
  const subscription = emitter.addListener(
    'onSharingSessionEvent',
    (raw: { kind: string; session: RawSession; client?: SharingSessionEventPayload['client']; message: string; timestamp: string }) => {
      callback({
        kind: raw.kind,
        session: toSession(raw.session),
        client: raw.client,
        message: raw.message,
        timestamp: raw.timestamp
      })
    }
  )
  return () => subscription.remove()
}
