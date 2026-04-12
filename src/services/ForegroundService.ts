import { requireNativeModule } from 'expo-modules-core';
import { PermissionsAndroid, Platform } from 'react-native';

const TOKEN_SERVER = 'https://musictalk-production.up.railway.app';

interface SoundZoneForegroundServiceModule {
  startService(roomCode: string, heartbeatUrl: string, userId: string): Promise<void>;
  updateService(roomCode: string): Promise<void>;
  stopService(): Promise<void>;
  isRunning(): boolean;
}

const getNativeModule = (): SoundZoneForegroundServiceModule | null => {
  if (Platform.OS !== 'android') return null;
  try {
    return requireNativeModule<SoundZoneForegroundServiceModule>('SoundZoneForeground');
  } catch (e) {
    console.warn('[ForegroundService] Native module not available. Are you using a development build?');
    return null;
  }
};

/**
 * Request all permissions required for the foreground service.
 * Must be called before startForegroundService().
 * Returns true if microphone permission is granted.
 */
export const requestVoicePermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;

  // Request RECORD_AUDIO — mandatory before starting service
  const micResult = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: 'Microphone Permission',
      message: 'SoundZone needs microphone access for voice chat.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    }
  );

  const micGranted = micResult === PermissionsAndroid.RESULTS.GRANTED;

  // Request POST_NOTIFICATIONS on Android 13+
  // Required for foreground service notification to appear in shade
  if (Platform.Version >= 33) {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
  }

  return micGranted;
};

/**
 * Start the foreground service.
 * MUST be called while app is foregrounded (room screen visible).
 * MUST be called after requestVoicePermissions() returns true.
 * MUST be called BEFORE connecting to LiveKit.
 * Passes heartbeat URL and userId so native Kotlin can send
 * heartbeats while JS thread is suspended.
 */
export const startForegroundService = async (
  roomCode: string,
  userId: string
): Promise<void> => {
  if (Platform.OS !== 'android') return;

  const module = getNativeModule();
  if (!module) return;

  const heartbeatUrl = `${TOKEN_SERVER}/heartbeat`;

  try {
    await module.startService(roomCode, heartbeatUrl, userId);
    console.log('[ForegroundService] Started for room:', roomCode);
    fetch(`${TOKEN_SERVER}/log-error?error=FGS_STARTED_OK&userId=${userId}`).catch(() => {});
  } catch (e: any) {
    console.error('[ForegroundService] Failed to start:', e.message);
    fetch(`${TOKEN_SERVER}/log-error?error=${encodeURIComponent('FGS_FAILED: ' + (e.message || 'unknown'))}&userId=${userId}`).catch(() => {});
    throw e;
  }
};

/**
 * Update the notification text without restarting the service.
 * Use when participant count changes or on reconnect.
 */
export const updateForegroundService = async (roomCode: string): Promise<void> => {
  if (Platform.OS !== 'android') return;

  const module = getNativeModule();
  if (!module) return;

  try {
    await module.updateService(roomCode);
  } catch (e: any) {
    console.error('[ForegroundService] Failed to update:', e.message);
  }
};

/**
 * Stop the foreground service.
 * Must be called on ALL exit paths:
 * - Leave room button
 * - LiveKit disconnect event
 * - Connection failure after service started
 * - Component unmount
 * - Any fatal error
 */
export const stopForegroundService = async (): Promise<void> => {
  if (Platform.OS !== 'android') return;

  const module = getNativeModule();
  if (!module) return;

  try {
    await module.stopService();
    console.log('[ForegroundService] Stopped');
  } catch (e: any) {
    console.error('[ForegroundService] Failed to stop:', e.message);
  }
};

/**
 * Check if the foreground service is currently running.
 * Uses companion object flag — more reliable than ActivityManager on Android 14+
 */
export const isForegroundServiceRunning = (): boolean => {
  if (Platform.OS !== 'android') return false;

  const module = getNativeModule();
  if (!module) return false;

  return module.isRunning();
};