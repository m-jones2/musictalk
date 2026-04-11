package com.mjones4.soundzone

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SoundZoneForegroundModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("SoundZoneForeground")

        AsyncFunction("startService") { roomCode: String ->
            val context = appContext.reactContext?.applicationContext
                ?: throw Exception("React context not available")

            // Check RECORD_AUDIO permission before starting service
            // Prevents SecurityException crash on Android 14
            val audioPermission = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.RECORD_AUDIO
            )

            if (audioPermission != PackageManager.PERMISSION_GRANTED) {
                throw Exception("RECORD_AUDIO permission not granted")
            }

            val intent = Intent(context, SoundZoneForegroundService::class.java).apply {
                action = SoundZoneForegroundService.ACTION_START
                putExtra(SoundZoneForegroundService.EXTRA_ROOM_CODE, roomCode)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        AsyncFunction("updateService") { roomCode: String ->
            val context = appContext.reactContext?.applicationContext
                ?: throw Exception("React context not available")

            val intent = Intent(context, SoundZoneForegroundService::class.java).apply {
                action = SoundZoneForegroundService.ACTION_UPDATE
                putExtra(SoundZoneForegroundService.EXTRA_ROOM_CODE, roomCode)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        AsyncFunction("stopService") {
            val context = appContext.reactContext?.applicationContext
                ?: throw Exception("React context not available")

            val intent = Intent(context, SoundZoneForegroundService::class.java).apply {
                action = SoundZoneForegroundService.ACTION_STOP
            }

            context.startService(intent)
        }

        Function("isRunning") {
            // Returns whether the service is currently running
            // Used by JS to avoid double-starting
            try {
                val context = appContext.reactContext?.applicationContext
                    ?: return@Function false
                val manager = context.getSystemService(android.app.ActivityManager::class.java)
                manager?.getRunningServices(Integer.MAX_VALUE)?.any {
                    it.service.className == SoundZoneForegroundService::class.java.name
                } ?: false
            } catch (e: Exception) {
                false
            }
        }
    }
}