import VIForegroundService from '@voximplant/react-native-foreground-service';

const TOKEN_SERVER = 'https://musictalk-production.up.railway.app';

export const startForegroundService = async (roomCode: string, participantCount: number) => {
  try {
    await VIForegroundService.createNotificationChannel({
      id: 'soundzone_channel',
      name: 'SoundZone',
      description: 'SoundZone voice chat',
      enableVibration: false,
    });

    await VIForegroundService.startService({
      id: 1,
      title: '🎵 SoundZone Active',
      text: `Room: ${roomCode} • ${participantCount} connected`,
      icon: 'ic_notification',
      button: false,
      channelId: 'soundzone_channel',
      serviceType: 'microphone',
    });
  } catch (e: any) {
    fetch(`${TOKEN_SERVER}/log-error?error=${encodeURIComponent('fg_start: ' + (e.message || 'unknown'))}&userId=foreground`).catch(() => {});
  }
};

export const stopForegroundService = async () => {
  try {
    await VIForegroundService.stopService();
  } catch (e: any) {
    fetch(`${TOKEN_SERVER}/log-error?error=${encodeURIComponent('fg_stop: ' + (e.message || 'unknown'))}&userId=foreground`).catch(() => {});
  }
};