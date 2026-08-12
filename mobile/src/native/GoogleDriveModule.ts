import { Linking } from 'react-native'
import NativeGoogleDriveModule from './specs/NativeGoogleDriveModule'
import type { SerializableError } from '../types'
import i18n from '../i18n'

/** Typed wrapper over the Codegen'd GoogleDriveModule TurboModule. */

export class GoogleDriveModuleError extends Error {
  code: string
  constructor(error: SerializableError) {
    super(error.message)
    this.code = error.code
  }
}

/**
 * Custom URL schemes (oplforge://...) aren't "special" per the WHATWG URL
 * spec, so the global `URL` class doesn't reliably parse their authority —
 * hand-rolled parsing avoids depending on that polyfill behavior entirely.
 */
function parseQueryString(query: string): Record<string, string> {
  const params: Record<string, string> = {}
  for (const pair of query.split('&')) {
    if (!pair) continue
    const [key, value = ''] = pair.split('=')
    params[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '))
  }
  return params
}

function toGoogleDriveModuleError(error: unknown): GoogleDriveModuleError {
  if (error instanceof Error && 'code' in error) {
    return new GoogleDriveModuleError({
      code: String((error as { code?: string }).code ?? 'UNKNOWN_ERROR'),
      message: error.message
    })
  }
  return new GoogleDriveModuleError({ code: 'UNKNOWN_ERROR', message: String(error) })
}

export interface GoogleDriveStatus {
  configured: boolean
  connected: boolean
  clientId?: string
}

export async function getStatus(): Promise<GoogleDriveStatus> {
  try {
    return (await NativeGoogleDriveModule.getStatus()) as GoogleDriveStatus
  } catch (error) {
    throw toGoogleDriveModuleError(error)
  }
}

export async function saveClientId(clientId: string): Promise<void> {
  try {
    await NativeGoogleDriveModule.saveClientId(clientId)
  } catch (error) {
    throw toGoogleDriveModuleError(error)
  }
}

export async function disconnect(): Promise<void> {
  try {
    await NativeGoogleDriveModule.disconnect()
  } catch (error) {
    throw toGoogleDriveModuleError(error)
  }
}

/**
 * Opens the Google consent screen in the system browser and resolves once
 * the oplforge://oauth-callback redirect lands and the token exchange
 * completes — the whole round trip in one call, so callers don't need to
 * manage the Linking subscription themselves.
 */
export async function connect(): Promise<void> {
  try {
    const { url, state } = (await NativeGoogleDriveModule.getAuthorizationUrl()) as { url: string; state: string }

    const redirectPromise = new Promise<{ code: string; state: string }>((resolve, reject) => {
      const subscription = Linking.addEventListener('url', ({ url: redirectUrl }) => {
        if (!redirectUrl.startsWith('oplforge://oauth-callback')) return
        subscription.remove()
        const params = parseQueryString(redirectUrl.split('?')[1] ?? '')
        const code = params.code
        const returnedState = params.state
        const error = params.error
        if (error || !code || !returnedState) {
          reject(new GoogleDriveModuleError({ code: 'AUTH_FAILED', message: error || i18n.t('sources.authCanceledOrInvalid') }))
          return
        }
        resolve({ code, state: returnedState })
      })
      // Bound wait — if the user abandons the browser tab, don't hang forever.
      setTimeout(() => {
        subscription.remove()
        reject(new GoogleDriveModuleError({ code: 'AUTH_TIMEOUT', message: i18n.t('sources.authTimeout') }))
      }, 5 * 60_000)
    })

    await Linking.openURL(url)
    const { code, state: returnedState } = await redirectPromise
    if (returnedState !== state) {
      throw new GoogleDriveModuleError({ code: 'AUTH_FAILED', message: i18n.t('sources.authInvalidResponse') })
    }
    await NativeGoogleDriveModule.completeAuthorization(code, returnedState)
  } catch (error) {
    throw error instanceof GoogleDriveModuleError ? error : toGoogleDriveModuleError(error)
  }
}

export interface GoogleDriveFile {
  id: string
  name: string
  path: string
  size: number
  extension: string
  provider: string
}

export async function listFiles(): Promise<GoogleDriveFile[]> {
  try {
    return (await NativeGoogleDriveModule.listFiles()) as GoogleDriveFile[]
  } catch (error) {
    throw toGoogleDriveModuleError(error)
  }
}

/** Downloads straight into the selected library's DVD folder. */
export async function downloadFile(fileId: string, fileName: string): Promise<void> {
  try {
    await NativeGoogleDriveModule.downloadFile(fileId, fileName)
  } catch (error) {
    throw toGoogleDriveModuleError(error)
  }
}
