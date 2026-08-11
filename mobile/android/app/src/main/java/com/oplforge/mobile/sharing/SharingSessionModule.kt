package com.oplforge.mobile.sharing

import com.oplforge.mobile.specs.NativeSharingModuleSpec
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.oplforge.mobile.catalog.CatalogIndexStore
import com.oplforge.mobile.library.LibraryPreferences
import com.oplforge.mobile.sharing.smb.SmbServerListener
import com.oplforge.mobile.shared.AppDatabase
import com.oplforge.mobile.shared.AppError
import com.oplforge.mobile.shared.ErrorMapping
import com.oplforge.mobile.shared.HistoryStore
import com.oplforge.mobile.shared.TypedEventEmitter
import com.facebook.react.bridge.ReactApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.Instant
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * TurboModule for SMB sharing sessions (FR-013–FR-024, FR-033, FR-034). See
 * contracts/native-modules.md SharingModule for the contract this implements.
 */
class SharingSessionModule(reactContext: ReactApplicationContext) :
    NativeSharingModuleSpec(reactContext), SmbServerListener {

    private val db = AppDatabase.getInstance(reactContext)
    private val historyStore = HistoryStore(db)
    private val libraryPreferences = LibraryPreferences(reactContext)
    private val catalogStore = CatalogIndexStore(db)
    private val credentialStore = CredentialStore(reactContext)
    private val events = TypedEventEmitter(reactContext)
    private val scope = CoroutineScope(Dispatchers.IO)

    private var state = STATE_OFF
    private var lastError: Pair<String, String>? = null
    private var startedAt: String? = null
    private var shareName = SharingForegroundService.SHARE_NAME_DEFAULT
    private val connectedClients = ConcurrentHashMap<String, WritableMap>()

    init {
        SharingForegroundService.listener = this
    }

    override fun getSession(promise: Promise) {
        promise.resolve(sessionToMap())
    }

    override fun saveCredentials(input: ReadableMap, promise: Promise) {
        val username = input.getString("username") ?: ""
        val password = input.getString("password") ?: ""
        if (username.isBlank() || password.isBlank()) {
            ErrorMapping.reject(promise, AppError("INVALID_INPUT", "Usuário e senha são obrigatórios."))
            return
        }
        credentialStore.save(username, password)
        promise.resolve(sessionToMap())
    }

    override fun acknowledgeWriteAccess(promise: Promise) {
        SharingForegroundService.writeAccessAcknowledged = true
        writeAccessAcknowledgedAt = Instant.now().toString()
        scope.launch {
            historyStore.record(
                HistoryStore.OP_WRITE_ACCESS_ACKNOWLEDGED,
                HistoryStore.RESULT_SUCCESS,
                "Acesso de escrita do PS2 autorizado."
            )
        }
        promise.resolve(sessionToMap())
    }

    override fun startSharing(shareName: String, promise: Promise) {
        if (state == STATE_STARTING || state == STATE_RUNNING_IDLE || state == STATE_RUNNING_CONNECTED) {
            ErrorMapping.reject(promise, AppError("ALREADY_RUNNING", "O compartilhamento já está ativo."))
            return
        }
        this.shareName = shareName.trim().ifBlank { SharingForegroundService.SHARE_NAME_DEFAULT }

        val stored = libraryPreferences.load()
        if (stored == null) {
            ErrorMapping.reject(promise, AppError("NO_LIBRARY_SELECTED", "Nenhuma biblioteca foi selecionada."))
            return
        }
        if (!stored.accessValid) {
            ErrorMapping.reject(promise, AppError("LIBRARY_ACCESS_INVALID", "O acesso à biblioteca não é mais válido."))
            return
        }
        if (!credentialStore.hasCredentials()) {
            ErrorMapping.reject(promise, AppError("CREDENTIALS_NOT_SET", "Defina um usuário e senha antes de compartilhar."))
            return
        }

        state = STATE_STARTING
        emitSessionEvent("state-changed", null, "Iniciando compartilhamento...")

        scope.launch {
            val latestCompleted = catalogStore.getLatestCompleted()
            if (latestCompleted == null) {
                state = STATE_OFF
                withPromiseError(promise, AppError("CATALOG_NOT_READY", "Catalogue a biblioteca antes de compartilhar."))
                return@launch
            }

            try {
                val intent = SharingForegroundService.startIntent(reactApplicationContext, this@SharingSessionModule.shareName)
                reactApplicationContext.startForegroundService(intent)
                startedAt = Instant.now().toString()
                state = STATE_RUNNING_IDLE
                historyStore.record(
                    HistoryStore.OP_SHARING_STARTED,
                    HistoryStore.RESULT_SUCCESS,
                    "Compartilhamento iniciado."
                )
                credentialStore.getUsername()?.let { credentialStore.recordRecentConnection(it, this@SharingSessionModule.shareName) }
                // boundAddress/boundPort aren't set yet here — startForegroundService()
                // is async. onServerBound() emits the follow-up event once real.
                promise.resolve(sessionToMap())
            } catch (e: Exception) {
                android.util.Log.e("OplForgeMobile", "startForegroundService failed", e)
                state = STATE_OFF
                lastError = "SHARING_FAILED" to (e.message ?: "Falha ao iniciar o compartilhamento.")
                emitSessionEvent("state-changed", null, "Falha ao iniciar o compartilhamento.")
                ErrorMapping.reject(promise, AppError("SHARING_FAILED", "Não foi possível iniciar o compartilhamento."))
            }
        }
    }

    override fun stopSharing(promise: Promise) {
        if (state == STATE_OFF) {
            promise.resolve(sessionToMap())
            return
        }
        state = STATE_STOPPING
        reactApplicationContext.stopService(SharingForegroundService.stopIntent(reactApplicationContext))
        state = STATE_OFF
        startedAt = null
        connectedClients.clear()
        scope.launch {
            historyStore.record(HistoryStore.OP_SHARING_STOPPED, HistoryStore.RESULT_SUCCESS, "Compartilhamento interrompido.")
        }
        promise.resolve(sessionToMap())
        emitSessionEvent("state-changed", null, "Compartilhamento interrompido.")
    }

    override fun getConnectionInstructions(promise: Promise) {
        if (state == STATE_OFF || SharingForegroundService.boundAddress == null) {
            promise.resolve(Arguments.createArray())
            return
        }
        val steps = Arguments.createArray()
        var nextOrder = 0
        fun step(field: String, value: String) {
            val order = nextOrder++
            steps.pushMap(Arguments.createMap().apply {
                putString("field", field)
                putString("value", value)
                putInt("order", order)
            })
        }
        step("Endereço IP", SharingForegroundService.boundAddress ?: "")
        step("Porta", (SharingForegroundService.boundPort ?: SharingForegroundService.DEFAULT_PORT).toString())
        step("Nome do compartilhamento", shareName)
        step("Usuário", credentialStore.getUsername() ?: "")
        promise.resolve(steps)
    }

    override fun getRecentConnections(promise: Promise) {
        val array = Arguments.createArray()
        credentialStore.getRecentConnections().forEach { entry ->
            array.pushMap(Arguments.createMap().apply {
                putString("username", entry.username)
                putString("shareName", entry.shareName)
                putString("lastUsedAt", entry.lastUsedAt)
            })
        }
        promise.resolve(array)
    }

    override fun addListener(eventName: String) = Unit
    override fun removeListeners(count: Double) = Unit

    // -- SmbServerListener (native → module bridge, single process) --

    override fun onServerBound(address: String?, port: Int) {
        // startForegroundService() is async — this fires once the socket is
        // actually bound, so the UI's boundAddress/boundPort aren't stale
        // (real bug found via on-device testing: without this, the promise
        // resolved and the first event fired before binding had happened).
        emitSessionEvent("state-changed", null, "Compartilhamento ativo.")
    }

    override fun onClientConnected(remoteAddress: String, connectionId: String) {
        state = STATE_RUNNING_CONNECTED
        val client = Arguments.createMap().apply {
            putString("id", connectionId)
            putString("remoteAddress", remoteAddress)
            putString("connectedAt", Instant.now().toString())
        }
        connectedClients[connectionId] = client
        emitSessionEvent("client-connected", client, "PS2 conectado.")
    }

    override fun onClientDisconnected(connectionId: String) {
        connectedClients.remove(connectionId)
        if (connectedClients.isEmpty() && state == STATE_RUNNING_CONNECTED) state = STATE_RUNNING_IDLE
        emitSessionEvent("client-disconnected", null, "PS2 desconectado.")
    }

    override fun onWriteConflict(path: String) {
        emitSessionEvent("write-conflict", null, "Gravação concorrente detectada em $path — última gravação aplicada.")
    }

    // -- helpers --

    private fun withPromiseError(promise: Promise, error: AppError) {
        emitSessionEvent("state-changed", null, error.message ?: error.code)
        ErrorMapping.reject(promise, error)
    }

    private fun emitSessionEvent(kind: String, client: WritableMap?, message: String) {
        val map = Arguments.createMap()
        map.putString("kind", kind)
        map.putMap("session", sessionToMap())
        client?.let { map.putMap("client", it) }
        map.putString("message", message)
        map.putString("timestamp", Instant.now().toString())
        events.emit(TypedEventEmitter.SHARING_SESSION_EVENT, map)
    }

    private fun sessionToMap(): WritableMap = Arguments.createMap().apply {
        putString("state", state)
        SharingForegroundService.boundAddress?.let { putString("boundAddress", it) }
        SharingForegroundService.boundPort?.let { putInt("port", it) }
        putString("shareName", shareName)
        putBoolean("hasCredentials", credentialStore.hasCredentials())
        writeAccessAcknowledgedAt?.let { putString("writeAccessAcknowledgedAt", it) }
        startedAt?.let { putString("startedAt", it) }
        lastError?.let { (code, message) ->
            putMap("error", Arguments.createMap().apply {
                putString("code", code)
                putString("message", message)
            })
        }
    }

    companion object {
        const val NAME = "SharingModule"

        private const val STATE_OFF = "off"
        private const val STATE_STARTING = "starting"
        private const val STATE_RUNNING_IDLE = "running-idle"
        private const val STATE_RUNNING_CONNECTED = "running-connected"
        private const val STATE_STOPPING = "stopping"

        private var writeAccessAcknowledgedAt: String? = null
    }
}
