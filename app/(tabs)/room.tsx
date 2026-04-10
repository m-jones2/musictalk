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
import VIForegroundService from '@voximplant/react-native-foreground-service';
import * as Notifications from 'expo-notifications';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { startForegroundService, stopForegroundService } from '../../foregroundService';
import { getUserId } from '../../lib/utils';

registerGlobals();

const LIVEKIT_URL = 'wss://musictalk-b7vzplg9.livekit.cloud';
const TOKEN_SERVER = 'https://musictalk-production.up.railway.app';
const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = SCREEN_WIDTH * 0.82;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function BorromeanIcon({ size = 28, color = '#ffffff' }: { size?: number, color?: string }) {
  const r = size * 0.32;
  const cx1 = size * 0.5;
  const cy1 = size * 0.28;
  const cx2 = size * 0.38;
  const cy2 = size * 0.50;
  const cx3 = size * 0.62;
  const cy3 = size * 0.50;
  return (
    <View style={{ width: size, height: size }}>
      {[[cx1, cy1], [cx2, cy2], [cx3, cy3]].map(([cx, cy], i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: cx - r,
            top: cy - r,
            width: r * 2,
            height: r * 2,
            borderRadius: r,
            borderWidth: 2.5,
            borderColor: color,
            backgroundColor: 'transparent',
          }}
        />
      ))}
    </View>
  );
}

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
      <Avatar name={participant.name || participant.identity} speaking={isSpeaking} />
      <View style={participantStyles.info}>
        <Text style={participantStyles.name}>{participant.name || participant.identity}</Text>
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
            tapToSeek={true}
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
    alignItems: 'flex-start',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    width: '100%',
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 0,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slider: {
    flex: 1,
    height: 32,
    marginTop: -4,
  },
  muteBtn: {
    backgroundColor: '#333333',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    marginTop: -4,
    alignSelf: 'center',
  },
  mutedBtn: {
    backgroundColor: '#ff4444',
  },
  muteBtnText: {
    fontSize: 16,
  },
});

function RoomContent({ onLeave, code, userId, displayName }: {
  onLeave: () => void,
  code: string,
  userId: string,
  displayName: string,
}) {
  const insets = useSafeAreaInsets();
  const remoteParticipants = useRemoteParticipants();
  const { isMicrophoneEnabled, localParticipant } = useLocalParticipant();
  const speakingParticipants = useSpeakingParticipants();
  const speakingIds = speakingParticipants.map(p => p.identity);
  const [masterVolume, setMasterVolume] = useState(0.8);
  const [allMuted, setAllMuted] = useState(false);
  const prevCountRef = useRef(0);

  useEffect(() => {
    startForegroundService(code, remoteParticipants.length + 1);
  }, [remoteParticipants.length]);
  const [friends, setFriends] = useState<any[]>([]);
  const [recents, setRecents] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    const savedFriends = await AsyncStorage.getItem('friends');
    const friendsList = savedFriends ? JSON.parse(savedFriends) : [];
    setFriends(friendsList);

    const savedRecents = await AsyncStorage.getItem('recentContacts');
    const recentsList = savedRecents ? JSON.parse(savedRecents) : [];
    setRecents(recentsList);

    const allIds = [...friendsList.map((f: any) => f.userId), ...recentsList.map((r: any) => r.userId)];
    if (allIds.length > 0) {
      try {
        const res = await fetch(`${TOKEN_SERVER}/status?ids=${allIds.join(',')}`);
        const data = await res.json();
        setStatuses(data);
      } catch (e) {}
    }
  };

  const openDrawer = () => {
    if (animating) return;
    setAnimating(true);
    setDrawerOpen(true);
    Animated.parallel([
      Animated.spring(drawerAnim, { toValue: 0, useNativeDriver: true, bounciness: 0 }),
      Animated.timing(overlayAnim, { toValue: 0.5, duration: 300, useNativeDriver: true }),
    ]).start(() => setAnimating(false));
  };

  const closeDrawer = () => {
    if (animating) return;
    setAnimating(true);
    Animated.parallel([
      Animated.spring(drawerAnim, { toValue: -DRAWER_WIDTH, useNativeDriver: true, bounciness: 0, speed: 20 }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => { setDrawerOpen(false); setAnimating(false); });
  };

  const sendInvite = async (contact: any) => {
    try {
      await fetch(`${TOKEN_SERVER}/invite?fromUserId=${userId}&toUserId=${contact.userId}&room=${code}&fromName=${encodeURIComponent(displayName)}`);
      Alert.alert('Invite Sent!', `${contact.name} has been invited to join your group.`);
    } catch (e) {
      Alert.alert('Error', 'Could not send invite.');
    }
  };

  const toggleLock = async () => {
      const action = isLocked ? 'unlock' : 'lock';
      try {
        await fetch(`${TOKEN_SERVER}/lock?room=${code}&action=${action}`);
        setIsLocked(!isLocked);
      } catch (e) {
        Alert.alert('Error', 'Could not update room lock.');
      }
    };

  // Save new participants to recent contacts
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

  // Join/leave notifications
  useEffect(() => {
    const currentCount = remoteParticipants.length;
    const prevCount = prevCountRef.current;

    if (currentCount > prevCount) {
      const newParticipant = remoteParticipants[currentCount - 1];
      Notifications.scheduleNotificationAsync({
        content: {
          title: '👋 Someone joined MusicTalk',
          body: `${newParticipant.name || newParticipant.identity} joined your room`,
          sound: true,
        },
        trigger: null,
      });
    } else if (currentCount < prevCount) {
      Notifications.scheduleNotificationAsync({
        content: {
          title: '👋 Someone left MusicTalk',
          body: 'A participant left your room',
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
      <View style={[styles.header, { paddingTop: insets.top + 16, paddingHorizontal: 16 }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={openDrawer} style={styles.ringsBtnLeft}>
            <BorromeanIcon size={28} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Volume Control</Text>
          <TouchableOpacity onPress={toggleLock} style={styles.lockBtn}>
            <Text style={styles.lockIcon}>{isLocked ? '🔒' : '🔓'}</Text>
          </TouchableOpacity>
        </View>
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
            tapToSeek={true}
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
            <Text style={styles.emptySubtext}>Tap the rings icon to invite others</Text>
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
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16, paddingHorizontal: 16 }]}>
        <TouchableOpacity style={styles.leaveButton} onPress={onLeave}>
          <Text style={styles.leaveText}>Leave Group</Text>
        </TouchableOpacity>
        <View style={styles.roomCodeBox}>
          <Text style={styles.roomCodeLabel}>Group Code</Text>
          <Text selectable={true} style={styles.roomCodeText}>{code}</Text>
        </View>
      </View>

      {/* Overlay */}
      {drawerOpen && (
        <TouchableWithoutFeedback onPress={closeDrawer}>
          <Animated.View style={[styles.overlay, { opacity: overlayAnim }]} />
        </TouchableWithoutFeedback>
      )}

      {/* Invite Drawer */}
      <Animated.View
        pointerEvents={drawerOpen ? 'auto' : 'none'}
        style={[styles.leftDrawer, { transform: [{ translateX: drawerAnim }], paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}
      >
        <View style={inviteStyles.header}>
          <Text style={inviteStyles.title}>Invite to Group</Text>
          <TouchableOpacity onPress={closeDrawer}>
            <Text style={inviteStyles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView>
          {friends.length === 0 && recents.length === 0 && (
            <Text style={inviteStyles.emptyText}>No contacts yet!</Text>
          )}
          {friends.length > 0 && (
            <View style={inviteStyles.section}>
              <Text style={inviteStyles.sectionTitle}>Friends</Text>
              {friends.map((contact: any) => {
                const status = statuses[contact.userId];
                const isOnline = status?.online;
                return (
                  <View key={contact.userId} style={inviteStyles.contactRow}>
                    <View style={inviteStyles.contactLeft}>
                      <View style={[inviteStyles.statusDot, isOnline ? inviteStyles.dotOnline : inviteStyles.dotOffline]} />
                      <View style={inviteStyles.avatar}>
                        <Text style={inviteStyles.avatarText}>{contact.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={inviteStyles.name}>{contact.name}</Text>
                    </View>
                    <TouchableOpacity style={inviteStyles.inviteBtn} onPress={() => sendInvite(contact)}>
                      <Text style={inviteStyles.inviteBtnText}>Invite</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
          {recents.length > 0 && (
            <View style={inviteStyles.section}>
              <Text style={inviteStyles.sectionTitle}>Recent Contacts</Text>
              {recents.map((contact: any) => {
                const status = statuses[contact.userId];
                const isOnline = status?.online;
                return (
                  <View key={contact.userId} style={inviteStyles.contactRow}>
                    <View style={inviteStyles.contactLeft}>
                      <View style={[inviteStyles.statusDot, isOnline ? inviteStyles.dotOnline : inviteStyles.dotOffline]} />
                      <View style={inviteStyles.avatar}>
                        <Text style={inviteStyles.avatarText}>{contact.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={inviteStyles.name}>{contact.name}</Text>
                    </View>
                    <TouchableOpacity style={inviteStyles.inviteBtn} onPress={() => sendInvite(contact)}>
                      <Text style={inviteStyles.inviteBtnText}>Invite</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

export default function RoomScreen() {
  const { code, name } = useLocalSearchParams();
  const displayName = Array.isArray(name) ? name[0] : (name || 'Anonymous');
  const [userId, setUserId] = useState<string>('');
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const roomCode = Array.isArray(code) ? code[0] : code;

  useEffect(() => {
    getUserId().then(id => setUserId(id));
    VIForegroundService.createNotificationChannel({
      id: 'soundzone_channel',
      name: 'SoundZone',
      description: 'SoundZone voice chat',
      enableVibration: false,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!userId) return;

    const registerPushToken = async () => {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === 'granted') {
          await new Promise(resolve => setTimeout(resolve, 2000));
          let pushToken = '';
          try {
            const expoToken = await Notifications.getExpoPushTokenAsync({
              projectId: '9e5dc256-5eee-4850-acf7-44568d9cb25f',
            });
            pushToken = expoToken.data;
          } catch {
            const deviceToken = await Notifications.getDevicePushTokenAsync();
            pushToken = deviceToken.data;
          }
          console.log('Registering push token for userId:', userId, 'token:', pushToken);
          const response = await fetch(`${TOKEN_SERVER}/register-push?userId=${userId}&token=${encodeURIComponent(pushToken)}`);
          const result = await response.json();
          console.log('Push registration result:', result);
        }
      } catch (e: any) {
        fetch(`${TOKEN_SERVER}/log-error?error=${encodeURIComponent(e.message || 'unknown')}&userId=${userId}`).catch(() => {});
      }
    };

    registerPushToken();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    setToken(null);
    setConnected(false);
    AudioSession.startAudioSession();

    // Heartbeat
    const sendHeartbeat = () => {
      fetch(`${TOKEN_SERVER}/heartbeat?room=${roomCode}&userId=${userId}`).catch(() => {});
    };
    sendHeartbeat();
    const heartbeat = setInterval(sendHeartbeat, 30000);

    const controller = new AbortController();

    fetch(
      `${TOKEN_SERVER}?room=${roomCode}&userId=${userId}&name=${encodeURIComponent(displayName)}&key=mt_secure_2026`,
      { signal: controller.signal }
    )
      .then(res => res.json())
      .then(data => {
        if (data.locked) {
          Alert.alert(
            '🔒 Room Locked',
            'This room is locked. You need an invite to join.',
            [{ text: 'OK', onPress: () => router.back() }]
          );
          return;
        }
        if (data.error) {
          Alert.alert(
            '🔒 Room Locked',
            'This room is locked. You need an invite to join.',
            [{ text: 'OK', onPress: () => router.back() }]
          );
          return;
        }
        setToken(data.token);
        setConnected(true);
        startForegroundService(roomCode, 1);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('Token error:', err);
        }
      });

    return () => {
      controller.abort();
      clearInterval(heartbeat);
      stopForegroundService();
      setToken(null);
      setConnected(false);
      AudioSession.stopAudioSession();
    };
  }, [roomCode, userId]);

  const handleLeave = async () => {
    fetch(`${TOKEN_SERVER}/leave?userId=${userId}`).catch(() => {});
    await stopForegroundService();
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
      audio={{
        noiseSuppression: true,
        echoCancellation: true,
        autoGainControl: true,
      }}
      video={false}
    >
      <RoomContent onLeave={handleLeave} code={roomCode} userId={userId} displayName={displayName} />
    </LiveKitRoom>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f0f0f',
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
  header: {
    paddingHorizontal: 8,
    paddingVertical: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  ringsBtn: {
    padding: 4,
  },
  ringsBtnLeft: {
    padding: 4,
    position: 'absolute',
    left: 0,
  },
  masterSliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  masterSlider: {
    flex: 1,
    marginHorizontal: 8,
    height: 40,
  },
  sliderLabel: {
    fontSize: 18,
  },
  muteRow: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 20,
    marginBottom: 0,
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
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 16,
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
    paddingHorizontal: 8,
    paddingVertical: 20,
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
  lockBtn: {
    padding: 4,
    position: 'absolute',
    right: 0,
  },
  lockIcon: {
    fontSize: 22,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    zIndex: 998,
    elevation: 998,
  },
  leftDrawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#161616',
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 999,
    zIndex: 999,
  },
});

const inviteStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeBtn: {
    color: '#888888',
    fontSize: 18,
    padding: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#888888',
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  contactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  dotOnline: {
    backgroundColor: '#1DB954',
  },
  dotOffline: {
    backgroundColor: '#555555',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  name: {
    color: '#ffffff',
    fontSize: 15,
  },
  inviteBtn: {
    backgroundColor: '#1DB954',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  inviteBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyText: {
    color: '#555555',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 32,
  },
});