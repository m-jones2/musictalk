// This file now delegates to the native module via src/services/ForegroundService.ts
// Kept for backwards compatibility with existing imports in room.tsx

export {
  isForegroundServiceRunning,
  requestVoicePermissions, startForegroundService,
  stopForegroundService,
  updateForegroundService
} from './src/services/ForegroundService';
