package com.oplforge.mobile.sharing

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import org.json.JSONArray
import org.json.JSONObject

/** One previously used connection — username/share name only, never the password (FR — remembered connections). */
data class RecentConnection(val username: String, val shareName: String, val lastUsedAt: String)

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

    /**
     * Share-level password check (TREE_CONNECT_ANDX) — a real PS2 OPL client
     * uses share-level security: it sends a dummy/empty SESSION_SETUP_ANDX
     * and puts the actual share password on TREE_CONNECT_ANDX instead (no
     * username involved at that layer, mirrors desktop's `connectTree`).
     */
    fun verifySharePassword(password: String): Boolean =
        prefs.getString(KEY_PASSWORD, null) == password

    /**
     * Verifies a 24-byte NTLMv1 challenge-response (real PS2 OPL clients
     * never send a plaintext password) by hashing the stored plaintext
     * password with [challenge] and comparing to [response] — the stored
     * password itself is never exposed to the caller.
     */
    fun verifyShareNtlmV1(challenge: ByteArray, response: ByteArray): Boolean {
        val password = prefs.getString(KEY_PASSWORD, null) ?: return false
        return com.oplforge.mobile.sharing.smb.NtlmV1.verifyResponse(password, challenge, response)
    }

    fun clear() {
        prefs.edit().clear().apply()
    }

    /**
     * Records [username]/[shareName] as the most-recently-used connection —
     * never the password (a plaintext password list would multiply the
     * attack surface for no real benefit; re-entering it is a small cost for
     * a "recent connections" shortcut). Deduplicates by username+shareName,
     * most recent first, capped at 5.
     */
    fun recordRecentConnection(username: String, shareName: String) {
        val existing = getRecentConnections().filterNot { it.username == username && it.shareName == shareName }
        val updated = (listOf(RecentConnection(username, shareName, java.time.Instant.now().toString())) + existing).take(5)
        val array = JSONArray()
        updated.forEach { entry ->
            array.put(
                JSONObject().apply {
                    put("username", entry.username)
                    put("shareName", entry.shareName)
                    put("lastUsedAt", entry.lastUsedAt)
                }
            )
        }
        prefs.edit().putString(KEY_RECENT_CONNECTIONS, array.toString()).apply()
    }

    fun getRecentConnections(): List<RecentConnection> {
        val raw = prefs.getString(KEY_RECENT_CONNECTIONS, null) ?: return emptyList()
        return try {
            val array = JSONArray(raw)
            (0 until array.length()).map { index ->
                val obj = array.getJSONObject(index)
                RecentConnection(obj.getString("username"), obj.getString("shareName"), obj.getString("lastUsedAt"))
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    companion object {
        private const val KEY_USERNAME = "username"
        private const val KEY_PASSWORD = "password"
        private const val KEY_RECENT_CONNECTIONS = "recent_connections"
    }
}
