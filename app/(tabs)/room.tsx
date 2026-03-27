import {
  AudioSession,
  LiveKitRoom,
  registerGlobals,
  useLocalParticipant,
  useRemoteParticipants,
  useSpeakingParticipants,
} from '@livekit/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import * as Notifications from 'expo-notifications';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getUserId } from '../../lib/utils';

registerGlobals();

const LIVEKIT_URL = 'wss://musictalk-b7vzplg9.livekit.cloud';
const TOKEN_SERVER = 'https://musictalk-production.up.railway.app';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function Avatar({ name, speaking }: { name: string, speaking: boolean }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <View style={[avatarStyles.circle, speaking && avatarStyles.speaking]}>
      <Text style={avatarStyles.initial}>{initial}</Text>
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  speaking: {
    borderColor: '#1DB954',
  },
  initial: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

function ParticipantControl({ participant, masterVolume, speakingIds }: {
  participant: any,
  masterVolume: number,
  speakingIds: string[],
}) {
  const [relativeVolume, setRelativeVolume] = useState(1.0);
  const [muted, setMuted] = useState(false);
  const isSpeaking = speakingIds.includes(participant.identity);

  useEffect(() => {
    participant.audioTrackPublications.forEach((publication: any) => {
      if (publication.track) {
        publication.track.setVolume(muted ? 0 : masterVolume * relativeVolume);
      }
    });
  }, [masterVolume, relativeVolume, muted]);

  const toggleMute = () => setMuted(!muted);

  return (
    <View style={participantStyles.container}>
      <Avatar name={participant.identity} speaking={isSpeaking} />
      <View style={participantStyles.info}>
        <Text style={participantStyles.name}>{participant.identity}</Text>
        <View style={participantStyles.controls}>
          <Slider
            style={participantStyles.slider}
            minimumValue={0}
            maximumValue={2}
            value={relativeVolume}
            onValueChange={setRelativeVolume}
            minimumTrackTintColor="#1DB954"
            maximumTrackTintColor="#333333"
            thumbTintColor="#1DB954"
          />
          <TouchableOpacity
            style={[participantStyles.muteBtn, muted && participantStyles.mutedBtn]}
            onPress={toggleMute}
          >
            <Text style={participantStyles.muteBtnText}>
              {muted ? '🔇' : '🔊'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const participantStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    width: '100%',
  },
  info: {
    flex: 1,
  },
  name: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slider: {
    flex: 1,
  },
  muteBtn: {
    backgroundColor: '#333333',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  mutedBtn: {
    backgroundColor: '#ff4444',
  },
  muteBtnText: {
    fontSize: 16,
  },
});

function RoomContent({ onLeave, code }: { onLeave: () => void, code: string }) {
  const insets = useSafeAreaInsets();
  const remoteParticipants = useRemoteParticipants();
  const { isMicrophoneEnabled, localParticipant } = useLocalParticipant();
  const speakingParticipants = useSpeakingParticipants();
  const speakingIds = speakingParticipants.map(p => p.identity);
  const [masterVolume, setMasterVolume] = useState(0.8);
  const [allMuted, setAllMuted] = useState(false);
  const prevCountRef = useRef(0);

  // Save new participants to recent contacts with timestamp
  useEffect(() => {
    remoteParticipants.forEach(async participant => {
      const existing = await AsyncStorage.getItem('recentContacts');
      const contacts = existing ? JSON.parse(existing) : [];
      const alreadyExists = contacts.find((c: any) => c.userId === participant.identity);
      if (!alreadyExists) {
        contacts.unshift({
          userId: participant.identity,
          name: participant.name || participant.identity,
          addedAt: Date.now()
        });
        const trimmed = contacts.slice(0, 20);
        await AsyncStorage.setItem('recentContacts', JSON.stringify(trimmed));
      }
    });
  }, [remoteParticipants.length]);

  useEffect(() => {
    const currentCount = remoteParticipants.length;
    const prevCount = prevCountRef.current;

    if (currentCount > prevCount) {
      const newParticipant = remoteParticipants[currentCount - 1];
      Notifications.scheduleNotificationAsync({
        content: {
          title: '👋 Someone joined MusicTalk',
          body: `${newParticipant.identity} joined your room`,
          sound: true,
        },
        trigger: null,
      });
    } else if (currentCount < prevCount) {
      Notifications.scheduleNotificationAsync({
        content: {
          title: '👋 Someone left MusicTalk',
          body: `A participant left your room`,
          sound: true,
        },
        trigger: null,
      });
    }
    prevCountRef.current = currentCount;
  }, [remoteParticipants.length]);

  const toggleSelfMute = async () => {
    await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  };

  const toggleMuteAll = () => {
    const newMuted = !allMuted;
    setAllMuted(newMuted);
    remoteParticipants.forEach(participant => {
      participant.audioTrackPublications.forEach((publication: any) => {
        if (publication.track) {
          publication.track.setVolume(newMuted ? 0 : masterVolume);
        }
      });
    });
  };

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitle}>Volume Control</Text>
        <View style={styles.masterSliderRow}>
          <Text style={styles.sliderLabel}>🎵</Text>
          <Slider
            style={styles.masterSlider}
            minimumValue={0}
            maximumValue={1}
            value={masterVolume}
            onValueChange={setMasterVolume}
            minimumTrackTintColor="#1DB954"
            maximumTrackTintColor="#333333"
            thumbTintColor="#1DB954"
          />
          <Text style={styles.sliderLabel}>🎤</Text>
        </View>
        <View style={styles.muteRow}>
          <TouchableOpacity
            style={[styles.muteBtn, !isMicrophoneEnabled && styles.muteBtnActive]}
            onPress={toggleSelfMute}
          >
            <Text style={styles.muteBtnText}>
              {isMicrophoneEnabled ? '🎤 Mute Self' : '🔇 Unmute Self'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.muteBtn, allMuted && styles.muteBtnActive]}
            onPress={toggleMuteAll}
          >
            <Text style={styles.muteBtnText}>
              {allMuted ? '🔇 Unmute All' : '🔊 Mute All'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Participant List */}
      <ScrollView style={styles.participantList} contentContainerStyle={styles.participantListContent}>
        {remoteParticipants.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>🎵 Listening for voices...</Text>
            <Text style={styles.emptySubtext}>Share your room code to invite others</Text>
          </View>
        )}
        {remoteParticipants.map(participant => (
          <ParticipantControl
            key={participant.identity}
            participant={participant}
            masterVolume={allMuted ? 0 : masterVolume}
            speakingIds={speakingIds}
          />
        ))}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.leaveButton} onPress={onLeave}>
          <Text style={styles.leaveText}>Leave Group</Text>
        </TouchableOpacity>
        <View style={styles.roomCodeBox}>
          <Text style={styles.roomCodeLabel}>Group Code</Text>
          <Text selectable={true} style={styles.roomCodeText}>{code}</Text>
        </View>
      </View>
    </View>
  );
}

export default function RoomScreen() {
  const { code, name } = useLocalSearchParams();
  const displayName = Array.isArray(name) ? name[0] : (name || 'Anonymous');
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    getUserId().then(id => setUserId(id));
  }, []);
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const roomCode = Array.isArray(code) ? code[0] : code;

  useEffect(() => {
    setToken(null);
    setConnected(false);
    AudioSession.startAudioSession();
    Notifications.requestPermissionsAsync();
    // Send heartbeat immediately and every 30 seconds
    const sendHeartbeat = () => {
      fetch(`${TOKEN_SERVER}/leave?userId=${userId}`).catch(() => {});
    };
    sendHeartbeat();
    const heartbeat = setInterval(sendHeartbeat, 30000);

    const controller = new AbortController();

    if (!userId) return;
    fetch(
      `${TOKEN_SERVER}?room=${roomCode}&userId=${userId}&name=${encodeURIComponent(displayName)}`,
      { signal: controller.signal }
    )
      .then(res => res.json())
      .then(data => {
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
      clearInterval(heartbeat);
      setToken(null);
      setConnected(false);
      AudioSession.stopAudioSession();
    };
  }, [roomCode, userId]);

  const handleLeave = async () => {
    // Check out from server
    fetch(`${TOKEN_SERVER}/leave?userId=${userId}`).catch(() => {});
    setToken(null);
    setConnected(false);
    AudioSession.stopAudioSession();
    router.back();
  };

  if (!token || !connected) {
    return (
      <View style={styles.connecting}>
        <Text style={styles.connectingText}>Connecting...</Text>
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
  screen: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    paddingHorizontal: 16,
  },
  connecting: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectingText: {
    color: '#888888',
    fontSize: 16,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  masterSliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  masterSlider: {
    flex: 1,
    marginHorizontal: 8,
  },
  sliderLabel: {
    fontSize: 18,
  },
  muteRow: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 20,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#444444',
  },
  muteBtn: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  muteBtnActive: {
    backgroundColor: '#ff4444',
    borderColor: '#ff4444',
  },
  muteBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  participantList: {
    flex: 1,
  },
  participantListContent: {
    paddingHorizontal: 0,
    paddingVertical: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 48,
  },
  emptyText: {
    color: '#888888',
    fontSize: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#555555',
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 36,
    borderTopWidth: 1,
    borderTopColor: '#222222',
  },
  leaveButton: {
    borderColor: '#ff4444',
    borderWidth: 2,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
  },
  leaveText: {
    color: '#ff4444',
    fontSize: 15,
    fontWeight: 'bold',
  },
  roomCodeBox: {
    alignItems: 'flex-end',
  },
  roomCodeLabel: {
    color: '#888888',
    fontSize: 12,
  },
  roomCodeText: {
    color: '#1DB954',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 4,
  },
});