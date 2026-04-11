import { requireNativeModule } from 'expo-modules-core';
import { PermissionsAndroid, Platform } from 'react-native';

// This will throw a clear error if the native module is not found
// Only available in production/development builds — not Expo Go
interface SoundZoneForegroundServiceModule {
  startService(roomCode: string): Promise<void>;
  updateService(roomCode: string): Promise<void>;
  stopService(): Promise<void>;
  isRunning(): boolean;
}

// Get the native module — will throw if not available
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
 * Must be called before startService().
 * Returns true if microphone permission is granted.
 */
export const requestVoicePermissions = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') return true;

  // Request RECORD_AUDIO — mandatory
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

  // Request POST_NOTIFICATIONS on Android 13+ — needed for notification visibility
  if (Platform.Version >= 33) {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
  }

  return micGranted;
};

/**
 * Start the foreground service.
 * MUST be called while the app is foregrounded (room screen visible).
 * MUST be called after requestVoicePermissions() returns true.
 * MUST be called before connecting to LiveKit.
 */
export const startForegroundService = async (roomCode: string): Promise<void> => {
  if (Platform.OS !== 'android') return;

  const module = getNativeModule();
  if (!module) return;

  try {
    await module.startService(roomCode);
    console.log('[ForegroundService] Started for room:', roomCode);
  } catch (e: any) {
    console.error('[ForegroundService] Failed to start:', e.message);
    throw e;
  }
};

/**
 * Update the notification text without restarting the service.
 * Use when room code changes or on reconnect.
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
 * Call on ALL exit paths:
 * - Leave room button
 * - LiveKit disconnect event
 * - Connection failure
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
 */
export const isForegroundServiceRunning = (): boolean => {
  if (Platform.OS !== 'android') return false;

  const module = getNativeModule();
  if (!module) return false;

  return module.isRunning();
};