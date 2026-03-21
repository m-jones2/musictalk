import {
    AudioSession,
    LiveKitRoom,
    registerGlobals,
    useLocalParticipant,
    useRemoteParticipants,
} from '@livekit/react-native';
import Slider from '@react-native-community/slider';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

registerGlobals();

const LIVEKIT_URL = 'wss://musictalk-b7vzplg9.livekit.cloud';
const TOKEN_SERVER = 'https://musictalk-production.up.railway.app';

function RoomContent({ onLeave, code }: { onLeave: () => void, code: string }) {
  const remoteParticipants = useRemoteParticipants();
  const participantCount = remoteParticipants.length + 1;
const { isMicrophoneEnabled, localParticipant } = useLocalParticipant();
  const [volume, setVolume] = useState(0.8);

  useEffect(() => {
    remoteParticipants.forEach(participant => {
      participant.audioTrackPublications.forEach(publication => {
        if (publication.track) {
          publication.track.setVolume(volume);
        }
      });
    });
  }, [volume, remoteParticipants]);
  
  const toggleMute = async () => {
    await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Room Code</Text>
      <Text style={styles.roomCode}>{code}</Text>
      <Text style={styles.hint}>Share this code with your group</Text>

      <View style={styles.statusBox}>
        <Text style={styles.statusText}>
          👥 {participantCount} {participantCount === 1 ? 'person' : 'people'} connected
        </Text>
        <Text style={styles.listeningText}>🎤 Listening for voices...</Text>
      </View>

      <TouchableOpacity
        style={[styles.muteButton, !isMicrophoneEnabled && styles.mutedButton]}
        onPress={toggleMute}
      >
        <Text style={styles.muteText}>
          {isMicrophoneEnabled ? '🎤 Mute' : '🔇 Unmute'}
        </Text>
      </TouchableOpacity>

      <View style={styles.sliderContainer}>
        <Text style={styles.sliderLabel}>🎵 Music</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={1}
          value={volume}
          onValueChange={setVolume}
          minimumTrackTintColor="#1DB954"
          maximumTrackTintColor="#333333"
          thumbTintColor="#1DB954"
        />
        <Text style={styles.sliderLabel}>🎤 Voice</Text>
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
  const [token, setToken] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const roomCode = Array.isArray(code) ? code[0] : code;

  useEffect(() => {
    setToken(null);
    setConnected(false);
    AudioSession.startAudioSession();

    const controller = new AbortController();

    fetch(
      `${TOKEN_SERVER}?room=${roomCode}&user=user-${Math.random().toString(36).substring(2, 6)}`,
      { signal: controller.signal }
    )
      .then(res => res.json())
      .then(data => {
        console.log('Token received for room:', roomCode);
        setToken(data.token);
        setConnected(true);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('Token error:', err);
        }
      });

    return () => {
      controller.abort();
      setToken(null);
      setConnected(false);
      AudioSession.stopAudioSession();
    };
  }, [roomCode]);

  const handleLeave = () => {
    setToken(null);
    setConnected(false);
    AudioSession.stopAudioSession();
    router.back();
  };

  if (!token || !connected) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>Connecting...</Text>
      </View>
    );
  }

  return (
    <LiveKitRoom
      key={`${roomCode}-${token}`}
      serverUrl={LIVEKIT_URL}
      token={token}
      connect={true}
      audio={true}
      video={false}
    >
      <RoomContent onLeave={handleLeave} code={roomCode} />
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
  muteButton: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  mutedButton: {
    backgroundColor: '#ff4444',
  },
  muteText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
    sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  slider: {
    flex: 1,
    marginHorizontal: 8,
  },
  sliderLabel: {
    color: '#888888',
    fontSize: 12,
  },
});