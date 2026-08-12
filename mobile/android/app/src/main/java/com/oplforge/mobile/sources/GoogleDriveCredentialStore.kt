package com.oplforge.mobile.sources

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/** OAuth token storage for the Google Drive source (mirrors sharing/CredentialStore.kt's EncryptedSharedPreferences pattern, separate keyspace since these are tokens, not a username/password pair). */
class GoogleDriveCredentialStore(context: Context) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs = createEncryptedPrefs(context, masterKey)

    fun saveClientId(clientId: String) {
        prefs.edit().putString(KEY_CLIENT_ID, clientId).apply()
    }

    fun getClientId(): String? = prefs.getString(KEY_CLIENT_ID, null)

    fun saveTokens(accessToken: String, refreshToken: String, expiresAt: Long) {
        prefs.edit()
            .putString(KEY_ACCESS_TOKEN, accessToken)
            .putString(KEY_REFRESH_TOKEN, refreshToken)
            .putLong(KEY_EXPIRES_AT, expiresAt)
            .apply()
    }

    fun getAccessToken(): String? = prefs.getString(KEY_ACCESS_TOKEN, null)
    fun getRefreshToken(): String? = prefs.getString(KEY_REFRESH_TOKEN, null)
    fun getExpiresAt(): Long = prefs.getLong(KEY_EXPIRES_AT, 0L)
    fun isConnected(): Boolean = prefs.contains(KEY_REFRESH_TOKEN)

    fun clearTokens() {
        prefs.edit().remove(KEY_ACCESS_TOKEN).remove(KEY_REFRESH_TOKEN).remove(KEY_EXPIRES_AT).apply()
    }

    companion object {
        private const val PREFS_NAME = "google_drive_tokens"
        private const val KEY_CLIENT_ID = "client_id"
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
        private const val KEY_EXPIRES_AT = "expires_at"

        private fun buildPrefs(context: Context, masterKey: MasterKey): SharedPreferences =
            EncryptedSharedPreferences.create(
                context,
                PREFS_NAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )

        /**
         * If the Keystore-backed master key can no longer decrypt the existing
         * prefs file (e.g. reinstalled with a different signing key, or the
         * Keystore entry was invalidated), `create()` throws instead of
         * returning — crashing the whole app at native-module init, before any
         * UI can load. The old encrypted data is unrecoverable either way once
         * that happens, so wipe it and start fresh rather than crash.
         */
        private fun createEncryptedPrefs(context: Context, masterKey: MasterKey): SharedPreferences =
            try {
                buildPrefs(context, masterKey)
            } catch (e: Exception) {
                context.deleteSharedPreferences(PREFS_NAME)
                buildPrefs(context, masterKey)
            }
    }
}
