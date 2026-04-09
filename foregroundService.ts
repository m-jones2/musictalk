import VIForegroundService from '@supersami/rn-foreground-service';

export const startForegroundService = async (roomCode: string, participantCount: number) => {
  try {
    await VIForegroundService.start({
      id: 1,
      title: '🎵 SoundZone Active',
      message: `Room: ${roomCode} • ${participantCount} connected`,
      vibration: false,
      visibility: 'public',
      icon: 'ic_launcher',
      importance: 'high',
      number: '0',
      button: false,
    });
  } catch (e) {
    console.log('Foreground service start error:', e);
  }
};

export const stopForegroundService = async () => {
  try {
    await VIForegroundService.stop();
  } catch (e) {
    console.log('Foreground service stop error:', e);
  }
};