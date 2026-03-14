import {
    AudioSession,
    LiveKitRoom,
    registerGlobals,
    useTracks
} from '@livekit/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Track } from 'livekit-client';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

registerGlobals();

const LIVEKIT_URL = 'wss://musictalk-b7vzplg9.livekit.cloud';
const TOKEN_SERVER = 'http://192.168.1.244:3000';

function RoomContent({ onLeave, code }: { onLeave: () => void, code: string }) {
  const tracks = useTracks([{ source: Track.Source.Microphone, withPlaceholder: true }]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Room Code</Text>
      <Text style={styles.roomCode}>{code}</Text>
      <Text style={styles.hint}>Share this code with your group</Text>

      <View style={styles.statusBox}>
        <Text style={styles.statusText}>
          👥 {tracks.length} {tracks.length === 1 ? 'person' : 'people'} connected
        </Text>
        <Text style={styles.listeningText}>🎤 Listening for voices...</Text>
      </View>

      <TouchableOpacity style={styles.leaveButton} onPress={onLeave}>
        <Text style={styles.leaveText}>Leave Room</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function RoomScreen() {
  const { code } = useLocalSearchParams();
  const router = useRouter();
  const [token, setToken] = useState('');
  const roomCode = Array.isArray(code) ? code[0] : code;

  useEffect(() => {
    AudioSession.startAudioSession();
    fetch(`${TOKEN_SERVER}?room=${roomCode}&user=user-${Math.random().toString(36).substring(2, 6)}`)
      .then(res => res.json())
      .then(data => {
        console.log('Token received for room:', roomCode);
        console.log('Token:', data.token);
        setToken(data.token);
      })
      .catch(err => console.error('Token error:', err));
    return () => {
      AudioSession.stopAudioSession();
    };
  }, [roomCode]);

  if (!token) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>Connecting...</Text>
      </View>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={LIVEKIT_URL}
      token={token}
      connect={true}
      audio={true}
      video={false}
    >
      <RoomContent onLeave={() => router.back()} code={roomCode} />
    </LiveKitRoom>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  label: {
    fontSize: 16,
    color: '#888888',
    marginBottom: 8,
  },
  roomCode: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#1DB954',
    letterSpacing: 8,
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    color: '#555555',
    marginBottom: 48,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 48,
  },
  statusBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    marginBottom: 48,
  },
  statusText: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 8,
  },
  listeningText: {
    fontSize: 14,
    color: '#888888',
  },
  leaveButton: {
    borderColor: '#ff4444',
    borderWidth: 2,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 32,
    width: '100%',
    alignItems: 'center',
  },
  leaveText: {
    color: '#ff4444',
    fontSize: 18,
    fontWeight: 'bold',
  },
});