package com.mjones4.soundzone

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import kotlinx.coroutines.*
import java.net.HttpURLConnection
import java.net.URL

class SoundZoneForegroundService : Service() {

    private var wakeLock: PowerManager.WakeLock? = null
    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private var heartbeatJob: Job? = null

    companion object {
        const val ACTION_START = "soundzone.action.START"
        const val ACTION_UPDATE = "soundzone.action.UPDATE"
        const val ACTION_STOP = "soundzone.action.STOP"
        const val EXTRA_ROOM_CODE = "roomCode"
        const val EXTRA_HEARTBEAT_URL = "heartbeatUrl"
        const val EXTRA_USER_ID = "userId"
        const val NOTIFICATION_ID = 101
        const val CHANNEL_ID = "soundzone_mic_channel"

        @Volatile
        var isRunning = false
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        isRunning = true
        createNotificationChannel()

        // Acquire WakeLock with 10 minute timeout for safety
        // Prevents battery drain if service fails to stop cleanly
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "SoundZone::MicrophoneWakeLock"
        ).apply {
            acquire(10 * 60 * 1000L)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Defensive null intent handling
        val action = intent?.action ?: run {
            stopSelf()
            return START_NOT_STICKY
        }

        when (action) {
            ACTION_STOP -> {
                stopHeartbeat()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }

            ACTION_START, ACTION_UPDATE -> {
                val roomCode = intent.getStringExtra(EXTRA_ROOM_CODE) ?: "Active"
                val heartbeatUrl = intent.getStringExtra(EXTRA_HEARTBEAT_URL)
                val userId = intent.getStringExtra(EXTRA_USER_ID)

                val notification = buildNotification(roomCode)

                // Pass FOREGROUND_SERVICE_TYPE_MICROPHONE at runtime
                // Required by Android 14 — manifest declaration alone is not enough
                ServiceCompat.startForeground(
                    this,
                    NOTIFICATION_ID,
                    notification,
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
                    } else {
                        0
                    }
                )

                // Refresh notification text on update
                val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                manager.notify(NOTIFICATION_ID, notification)

                // Start native heartbeat if url and userId provided
                // JS thread is suspended when screen locks so heartbeat must be native
                if (action == ACTION_START && heartbeatUrl != null && userId != null) {
                    startHeartbeat(heartbeatUrl, userId, roomCode)
                }
            }
        }

        return START_NOT_STICKY
    }

    override fun onDestroy() {
        isRunning = false
        stopHeartbeat()
        serviceScope.cancel()
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
        stopForeground(STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }

    private fun startHeartbeat(heartbeatUrl: String, userId: String, roomCode: String) {
        heartbeatJob?.cancel()
        heartbeatJob = serviceScope.launch {
            while (isActive) {
                try {
                    sendHeartbeat(heartbeatUrl, userId, roomCode)
                } catch (e: Exception) {
                    // Network may be briefly unavailable — log but don't crash
                }
                delay(30_000L)
            }
        }
    }

    private fun stopHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = null
    }

    private fun sendHeartbeat(heartbeatUrl: String, userId: String, roomCode: String) {
        val url = URL("$heartbeatUrl?userId=$userId&room=$roomCode")
        val connection = url.openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "GET"
            connection.connectTimeout = 10_000
            connection.readTimeout = 10_000
            connection.responseCode
        } finally {
            connection.disconnect()
        }
    }

    private fun buildNotification(roomCode: String): Notification {
        // Use Expo-generated notification_icon drawable
        // Configured via app.config.js android.notification.icon
        // Falls back to system icon if not found
        val iconRes = resources.getIdentifier(
            "notification_icon", "drawable", packageName
        ).takeIf { it != 0 } ?: android.R.drawable.ic_btn_speak_now

        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
        }

        val pendingIntent = launchIntent?.let {
            PendingIntent.getActivity(
                this,
                0,
                it,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("SoundZone Active")
            .setContentText("Room: $roomCode")
            .setSmallIcon(iconRes)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "SoundZone Voice Chat",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Active while you are in a SoundZone voice room"
                setShowBadge(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }
}