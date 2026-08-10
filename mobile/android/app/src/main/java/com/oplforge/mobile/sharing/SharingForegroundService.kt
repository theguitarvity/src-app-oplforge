package com.oplforge.mobile.sharing

import com.oplforge.mobile.shared.WriteLock

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.getSystemService
import com.oplforge.mobile.MainActivity
import com.oplforge.mobile.library.LibraryPreferences
import com.oplforge.mobile.library.SafDocumentTree
import com.oplforge.mobile.sharing.smb.SmbServer
import com.oplforge.mobile.sharing.smb.SmbServerListener
import java.net.Inet4Address
import java.net.NetworkInterface

/**
 * Foreground Service hosting the SMB1 server (FR-013/FR-020–FR-022).
 * `connectedDevice` type, not `dataSync` — Android 15+ caps `dataSync` at 6
 * hours, incompatible with an open-ended PS2 usage session (research.md R6).
 */
class SharingForegroundService : Service() {

    private var smbServer: SmbServer? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val shareName = intent?.getStringExtra(EXTRA_SHARE_NAME) ?: SHARE_NAME_DEFAULT
        startForeground(NOTIFICATION_ID, buildNotification())

        val stored = LibraryPreferences(this).load()
        if (stored == null) {
            // The module already validated a library exists before starting this service —
            // reaching here would mean state drifted between that check and this run.
            stopSelf()
            return START_NOT_STICKY
        }

        val tree = SafDocumentTree(this, Uri.parse(stored.treeUri))
        val credentialStore = CredentialStore(this)
        val lanAddress = findLanAddress()

        val server = SmbServer(
            port = DEFAULT_PORT,
            context = this,
            tree = tree,
            credentialStore = credentialStore,
            shareName = shareName,
            writeLock = writeLock,
            isWriteAccessAcknowledged = { writeAccessAcknowledged },
            listener = listener,
            bindAddress = lanAddress
        )

        try {
            // Set before start(): SmbServer.start() invokes listener.onServerBound()
            // synchronously as its last step, and that callback (SharingSessionModule)
            // reads these companion fields to build the session it emits to JS.
            boundAddress = lanAddress
            boundPort = DEFAULT_PORT
            server.start()
            smbServer = server
        } catch (e: Exception) {
            android.util.Log.e("OplForgeMobile", "SmbServer failed to start", e)
            boundAddress = null
            boundPort = null
            stopSelf()
            return START_NOT_STICKY
        }

        // Never auto-restarts after the process is killed (FR-032) — always
        // requires a new explicit user action to start sharing again.
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        smbServer?.stop()
        smbServer = null
        boundAddress = null
        boundPort = null
        super.onDestroy()
    }

    private fun findLanAddress(): String? {
        return try {
            NetworkInterface.getNetworkInterfaces().asSequence()
                .flatMap { it.inetAddresses.asSequence() }
                .filterIsInstance<Inet4Address>()
                .firstOrNull { !it.isLoopbackAddress }
                ?.hostAddress
        } catch (e: Exception) {
            null
        }
    }

    private fun buildNotification(): Notification {
        val manager = getSystemService<NotificationManager>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Compartilhamento OPL",
                NotificationManager.IMPORTANCE_LOW
            )
            manager?.createNotificationChannel(channel)
        }

        val contentIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Compartilhando biblioteca com o PS2")
            .setContentText("Toque para abrir o OPL Forge")
            .setSmallIcon(android.R.drawable.stat_sys_upload)
            .setOngoing(true)
            .setContentIntent(contentIntent)
            .build()
    }

    companion object {
        const val DEFAULT_PORT = 1445 // 445 is a privileged port on Android — EACCES for unprivileged apps.
        const val SHARE_NAME_DEFAULT = "OPLFORGE"
        private const val CHANNEL_ID = "sharing_service"
        private const val NOTIFICATION_ID = 1
        private const val EXTRA_SHARE_NAME = "shareName"

        @Volatile var writeAccessAcknowledged = false
        @Volatile var boundAddress: String? = null; private set
        @Volatile var boundPort: Int? = null; private set
        var listener: SmbServerListener? = null
        val writeLock = WriteLock()

        fun startIntent(context: Context, shareName: String): Intent =
            Intent(context, SharingForegroundService::class.java).putExtra(EXTRA_SHARE_NAME, shareName)

        fun stopIntent(context: Context): Intent = Intent(context, SharingForegroundService::class.java)
    }
}
