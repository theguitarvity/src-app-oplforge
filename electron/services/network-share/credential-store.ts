import { safeStorage } from 'electron'

/**
 * Encrypts secrets at rest via Electron's OS-native `safeStorage` (DPAPI on
 * Windows, Keychain on macOS, libsecret on Linux) — first use of this API in
 * the codebase, introduced specifically so the sharing password never lands
 * in plaintext JSON (Constitution Principle IV).
 */
export function encryptSecret(plainText: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    // No OS-level keystore available (e.g. some minimal Linux setups without
    // a secret service). Falling back to plaintext would violate Principle
    // IV, so the caller must treat this as a hard failure instead.
    throw Object.assign(new Error('Secure credential storage is unavailable on this system'), {
      code: 'SECRET_STORAGE_UNAVAILABLE'
    })
  }
  return safeStorage.encryptString(plainText).toString('base64')
}

export function decryptSecret(encoded: string): string {
  return safeStorage.decryptString(Buffer.from(encoded, 'base64'))
}

export function isSecretStorageAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}
