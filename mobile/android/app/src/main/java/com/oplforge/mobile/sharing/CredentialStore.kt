package com.oplforge.mobile.sharing

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Keystore-backed SMB credential storage (FR-017/FR-030, research.md R7 —
 * mirrors desktop's `safeStorage` precedent). Never exposes the password back
 * to callers other than the SMB auth check itself.
 */
class CredentialStore(context: Context) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs = EncryptedSharedPreferences.create(
        context,
        "sharing_credentials",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun save(username: String, password: String) {
        prefs.edit().putString(KEY_USERNAME, username).putString(KEY_PASSWORD, password).apply()
    }

    fun getUsername(): String? = prefs.getString(KEY_USERNAME, null)

    fun hasCredentials(): Boolean = prefs.contains(KEY_USERNAME) && prefs.contains(KEY_PASSWORD)

    fun verify(username: String, password: String): Boolean =
        prefs.getString(KEY_USERNAME, null) == username && prefs.getString(KEY_PASSWORD, null) == password

    /**
     * Verifies a 24-byte NTLMv1 challenge-response (real PS2 OPL clients
     * never send a plaintext password) by hashing the stored plaintext
     * password with [challenge] and comparing to [response] — the stored
     * password itself is never exposed to the caller.
     */
    fun verifyNtlmV1(username: String, challenge: ByteArray, response: ByteArray): Boolean {
        if (prefs.getString(KEY_USERNAME, null) != username) return false
        val password = prefs.getString(KEY_PASSWORD, null) ?: return false
        return com.oplforge.mobile.sharing.smb.NtlmV1.verifyResponse(password, challenge, response)
    }

    fun clear() {
        prefs.edit().clear().apply()
    }

    companion object {
        private const val KEY_USERNAME = "username"
        private const val KEY_PASSWORD = "password"
    }
}
