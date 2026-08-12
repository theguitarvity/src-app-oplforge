package com.oplforge.mobile.sources

import com.oplforge.mobile.specs.NativeGoogleDriveModuleSpec
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.oplforge.mobile.library.LibraryPreferences
import com.oplforge.mobile.library.SafDocumentTree
import com.oplforge.mobile.shared.AppError
import com.oplforge.mobile.shared.ErrorMapping
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import okhttp3.FormBody
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.concurrent.TimeUnit

private const val AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
private const val TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
private const val DRIVE_FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files"
private const val SCOPE = "https://www.googleapis.com/auth/drive.readonly"
private const val REDIRECT_URI = "oplforge://oauth-callback"
private val ALLOWED_EXTENSIONS = setOf("iso", "bin", "cue", "zso")

/**
 * Authorization Code + PKCE OAuth flow against a Google Cloud OAuth Client
 * (type "Android", package com.oplforge.mobile + release SHA-1 registered) —
 * no client secret needed, matching Google's recommendation for installed
 * apps. The consent screen opens in the system browser (JS side, via
 * Linking.openURL — Google blocks OAuth from embedded WebViews) and redirects
 * back to this app via the oplforge://oauth-callback intent filter
 * (AndroidManifest.xml); JS forwards the resulting code+state here to
 * complete the exchange. Read-only scope (drive.readonly) — this app only
 * ever lists/downloads the user's own files, never writes to their Drive.
 *
 * No Client ID ships with this app (registering a Google Cloud OAuth client
 * is a manual, external, per-deployer step) — every method rejects
 * NOT_CONFIGURED until saveClientId() has been called.
 */
class GoogleDriveModule(reactContext: ReactApplicationContext) :
    NativeGoogleDriveModuleSpec(reactContext) {

    private val credentialStore = GoogleDriveCredentialStore(reactContext)
    private val libraryPreferences = LibraryPreferences(reactContext)
    private val scope = CoroutineScope(Dispatchers.IO)
    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    // Single in-flight authorization attempt at a time — state -> PKCE
    // verifier, cleared once completeAuthorization() consumes it (or the
    // module is recreated, e.g. app restart, which safely just invalidates
    // any abandoned flow).
    private val pendingVerifiers = mutableMapOf<String, String>()

    override fun getStatus(promise: Promise) {
        promise.resolve(Arguments.createMap().apply {
            val clientId = credentialStore.getClientId()
            putBoolean("configured", !clientId.isNullOrBlank())
            putBoolean("connected", credentialStore.isConnected())
            clientId?.let { putString("clientId", it) }
        })
    }

    override fun saveClientId(clientId: String, promise: Promise) {
        if (clientId.isBlank()) {
            ErrorMapping.reject(promise, AppError("INVALID_INPUT", "Client ID não pode ser vazio."))
            return
        }
        credentialStore.saveClientId(clientId.trim())
        promise.resolve(null)
    }

    override fun disconnect(promise: Promise) {
        credentialStore.clearTokens()
        promise.resolve(null)
    }

    override fun getAuthorizationUrl(promise: Promise) {
        val clientId = credentialStore.getClientId()
        if (clientId.isNullOrBlank()) {
            ErrorMapping.reject(promise, AppError("NOT_CONFIGURED", "Configure o Client ID do Google Drive antes de conectar."))
            return
        }
        val verifier = randomUrlSafeString(64)
        val challenge = base64UrlEncode(MessageDigest.getInstance("SHA-256").digest(verifier.toByteArray(Charsets.UTF_8)))
        val state = randomUrlSafeString(24)
        pendingVerifiers[state] = verifier

        val url = android.net.Uri.parse(AUTH_ENDPOINT).buildUpon()
            .appendQueryParameter("client_id", clientId)
            .appendQueryParameter("redirect_uri", REDIRECT_URI)
            .appendQueryParameter("response_type", "code")
            .appendQueryParameter("scope", SCOPE)
            .appendQueryParameter("access_type", "offline")
            .appendQueryParameter("prompt", "consent")
            .appendQueryParameter("code_challenge", challenge)
            .appendQueryParameter("code_challenge_method", "S256")
            .appendQueryParameter("state", state)
            .build()
            .toString()

        promise.resolve(Arguments.createMap().apply {
            putString("url", url)
            putString("state", state)
        })
    }

    override fun completeAuthorization(code: String, state: String, promise: Promise) {
        val clientId = credentialStore.getClientId()
        val verifier = pendingVerifiers.remove(state)
        if (clientId.isNullOrBlank() || verifier == null) {
            ErrorMapping.reject(promise, AppError("AUTH_FAILED", "Sessão de autorização inválida ou expirada — tente conectar novamente."))
            return
        }
        scope.launch {
            try {
                val body = FormBody.Builder()
                    .add("client_id", clientId)
                    .add("code", code)
                    .add("code_verifier", verifier)
                    .add("grant_type", "authorization_code")
                    .add("redirect_uri", REDIRECT_URI)
                    .build()
                val response = httpClient.newCall(Request.Builder().url(TOKEN_ENDPOINT).post(body).build()).execute()
                response.use {
                    if (!it.isSuccessful) {
                        ErrorMapping.reject(promise, AppError("AUTH_FAILED", "Falha ao trocar código por token (${it.code})."))
                        return@launch
                    }
                    val json = JSONObject(it.body?.string() ?: "{}")
                    val accessToken = json.getString("access_token")
                    val refreshToken = json.optString("refresh_token", "")
                    val expiresIn = json.optLong("expires_in", 3600L)
                    if (refreshToken.isBlank()) {
                        ErrorMapping.reject(
                            promise,
                            AppError(
                                "NO_REFRESH_TOKEN",
                                "O Google não retornou um refresh token. Revogue o acesso em myaccount.google.com/permissions e tente novamente."
                            )
                        )
                        return@launch
                    }
                    credentialStore.saveTokens(accessToken, refreshToken, System.currentTimeMillis() + expiresIn * 1000)
                    promise.resolve(null)
                }
            } catch (e: Exception) {
                ErrorMapping.rejectUnexpected(promise, e)
            }
        }
    }

    private fun getValidAccessTokenOrThrow(): String {
        if (!credentialStore.isConnected()) throw IllegalStateException("NOT_CONNECTED")
        val expiresAt = credentialStore.getExpiresAt()
        val current = credentialStore.getAccessToken()
        if (current != null && System.currentTimeMillis() < expiresAt - 60_000) return current
        return refreshAccessTokenSync()
    }

    private fun refreshAccessTokenSync(): String {
        val clientId = credentialStore.getClientId() ?: throw IllegalStateException("NOT_CONFIGURED")
        val refreshToken = credentialStore.getRefreshToken() ?: throw IllegalStateException("NOT_CONNECTED")
        val body = FormBody.Builder()
            .add("client_id", clientId)
            .add("refresh_token", refreshToken)
            .add("grant_type", "refresh_token")
            .build()
        httpClient.newCall(Request.Builder().url(TOKEN_ENDPOINT).post(body).build()).execute().use { response ->
            if (!response.isSuccessful) throw IllegalStateException("REFRESH_FAILED")
            val json = JSONObject(response.body?.string() ?: "{}")
            val accessToken = json.getString("access_token")
            val expiresIn = json.optLong("expires_in", 3600L)
            credentialStore.saveTokens(accessToken, refreshToken, System.currentTimeMillis() + expiresIn * 1000)
            return accessToken
        }
    }

    override fun listFiles(promise: Promise) {
        scope.launch {
            try {
                val accessToken = getValidAccessTokenOrThrow()
                val files = Arguments.createArray()
                var pageToken: String? = null
                do {
                    val urlBuilder = android.net.Uri.parse(DRIVE_FILES_ENDPOINT).buildUpon()
                        .appendQueryParameter("fields", "nextPageToken, files(id, name, size, mimeType)")
                        .appendQueryParameter("pageSize", "200")
                        .appendQueryParameter("q", "trashed = false")
                    pageToken?.let { urlBuilder.appendQueryParameter("pageToken", it) }
                    val request = Request.Builder().url(urlBuilder.build().toString()).header("Authorization", "Bearer $accessToken").build()
                    httpClient.newCall(request).execute().use { response ->
                        if (!response.isSuccessful) throw IllegalStateException("Falha ao listar arquivos do Google Drive (${response.code}).")
                        val json = JSONObject(response.body?.string() ?: "{}")
                        val array = json.optJSONArray("files")
                        if (array != null) {
                            for (i in 0 until array.length()) {
                                val file = array.getJSONObject(i)
                                val name = file.getString("name")
                                val extension = name.substringAfterLast('.', "").lowercase()
                                if (extension !in ALLOWED_EXTENSIONS) continue
                                files.pushMap(Arguments.createMap().apply {
                                    putString("id", file.getString("id"))
                                    putString("name", name)
                                    putString("path", file.getString("id"))
                                    putDouble("size", file.optString("size", "0").toDoubleOrNull() ?: 0.0)
                                    putString("extension", ".$extension")
                                    putString("provider", "GoogleDriveModule")
                                })
                            }
                        }
                        pageToken = json.optString("nextPageToken", "").ifBlank { null }
                    }
                } while (pageToken != null)
                promise.resolve(files)
            } catch (e: Exception) {
                ErrorMapping.rejectUnexpected(promise, e)
            }
        }
    }

    /** Downloads straight into the selected library's DVD folder — the same default destination the local-import flow (ImportGameButton) writes to. */
    override fun downloadFile(fileId: String, fileName: String, promise: Promise) {
        val stored = libraryPreferences.load()
        if (stored == null) {
            ErrorMapping.reject(promise, AppError("NO_LIBRARY_SELECTED", "Nenhuma biblioteca foi selecionada."))
            return
        }
        scope.launch {
            try {
                val accessToken = getValidAccessTokenOrThrow()
                val url = android.net.Uri.parse("$DRIVE_FILES_ENDPOINT/$fileId").buildUpon()
                    .appendQueryParameter("alt", "media")
                    .build()
                    .toString()
                val request = Request.Builder().url(url).header("Authorization", "Bearer $accessToken").build()
                httpClient.newCall(request).execute().use { response ->
                    if (!response.isSuccessful || response.body == null) {
                        ErrorMapping.reject(promise, AppError("DOWNLOAD_FAILED", "Falha ao baixar arquivo do Google Drive (${response.code})."))
                        return@launch
                    }
                    val tree = SafDocumentTree(reactApplicationContext, android.net.Uri.parse(stored.treeUri))
                    val destination = tree.createFile("DVD", fileName)
                        ?: throw IllegalStateException("Não foi possível criar o arquivo de destino.")
                    reactApplicationContext.contentResolver.openOutputStream(destination.uri)?.use { output ->
                        response.body!!.byteStream().use { input -> input.copyTo(output) }
                    } ?: throw IllegalStateException("Não foi possível abrir o destino para escrita.")
                    promise.resolve(null)
                }
            } catch (e: Exception) {
                ErrorMapping.rejectUnexpected(promise, e)
            }
        }
    }

    private fun randomUrlSafeString(byteLength: Int): String {
        val bytes = ByteArray(byteLength)
        SecureRandom().nextBytes(bytes)
        return base64UrlEncode(bytes)
    }

    private fun base64UrlEncode(bytes: ByteArray): String =
        android.util.Base64.encodeToString(bytes, android.util.Base64.URL_SAFE or android.util.Base64.NO_WRAP or android.util.Base64.NO_PADDING)

    companion object {
        const val NAME = "GoogleDriveModule"
    }
}
