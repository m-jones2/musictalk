import VIForegroundService from '@supersami/rn-foreground-service';

const TOKEN_SERVER = 'https://musictalk-production.up.railway.app';

export const startForegroundService = async (roomCode: string, participantCount: number) => {
  try {
    await VIForegroundService.start({
      id: 1,
      title: '🎵 SoundZone Active',
      message: `Room: ${roomCode} • ${participantCount} connected`,
      vibration: false,
      visibility: 'public',
      icon: 'ic_notification',
      importance: 'high',
      number: '0',
      button: false,
      serviceType: 'microphone',
    });
  } catch (e: any) {
    fetch(`${TOKEN_SERVER}/log-error?error=${encodeURIComponent('fg_start: ' + (e.message || 'unknown'))}&userId=foreground`).catch(() => {});
  }
};

export const stopForegroundService = async () => {
  try {
    await VIForegroundService.stop();
  } catch (e: any) {
    fetch(`${TOKEN_SERVER}/log-error?error=${encodeURIComponent('fg_stop: ' + (e.message || 'unknown'))}&userId=foreground`).catch(() => {});
  }
};