import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  PermissionsAndroid, Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getUserId } from '../../lib/utils';

const TOKEN_SERVER = 'https://musictalk-production.up.railway.app';
const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;
const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = SCREEN_WIDTH * 0.82;

type Contact = {
  userId: string;
  name: string;
  addedAt: number;
};

type ContactStatus = {
  online: boolean;
  room?: string;
  displayName?: string;
  locked?: boolean;
};

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
          key={`ring-${i}`}
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

function ContactRow({ contact, isFriend, statuses, onJoin, onAddFriend, onDelete }: {
  contact: Contact,
  isFriend: boolean,
  statuses: Record<string, ContactStatus>,
  onJoin: (contact: Contact) => void,
  onAddFriend: (contact: Contact) => void,
  onDelete: (contact: Contact) => void,
}) {
  const status = statuses[contact.userId];
  const isOnline = status?.online;
  const isLocked = status?.locked;

  const handleAvatarPress = () => {
    if (isFriend) {
      Alert.alert(
        contact.name,
        'What would you like to do?',
        [
          {
            text: 'Remove Friend',
            style: 'destructive',
            onPress: () => onDelete(contact),
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } else {
      Alert.alert(
        contact.name,
        'What would you like to do?',
        [
          {
            text: 'Add to Friends',
            onPress: () => onAddFriend(contact),
          },
          {
            text: 'Remove from Recents',
            style: 'destructive',
            onPress: () => onDelete(contact),
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  return (
    <View style={[drawerStyles.contactRow, isOnline && drawerStyles.contactRowOnline]}>
      <TouchableOpacity
        style={[drawerStyles.contactAvatar, isOnline && drawerStyles.contactAvatarOnline]}
        onPress={handleAvatarPress}
      >
        <Text style={drawerStyles.contactAvatarText}>{contact.name.charAt(0).toUpperCase()}</Text>
      </TouchableOpacity>
      <Text style={drawerStyles.contactName} numberOfLines={1} ellipsizeMode="tail">{contact.name}</Text>
      <View style={drawerStyles.contactRight}>
        {isOnline && (
          isLocked ? (
            <Text style={drawerStyles.lockIcon}>🔒</Text>
          ) : (
            <TouchableOpacity style={drawerStyles.joinBtn} onPress={() => onJoin(contact)}>
              <Text style={drawerStyles.joinBtnText}>Join</Text>
            </TouchableOpacity>
          )
        )}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<Contact[]>([]);
  const [recents, setRecents] = useState<Contact[]>([]);
  const [statuses, setStatuses] = useState<Record<string, ContactStatus>>({});
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);
  const [animating, setAnimating] = useState(false);

  const leftAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const rightAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('username'),
      getUserId(),
    ]).then(async ([savedName, id]) => {
      if (savedName) setName(savedName);
      setUserId(id);
      setLoading(false);

      // Register push token on app launch
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === 'granted') {
          const deviceToken = await Notifications.getDevicePushTokenAsync();
          const pushToken = deviceToken.data;
          console.log('App launch push token for userId:', id, 'token:', pushToken);
          await fetch(`${TOKEN_SERVER}/register-push?userId=${id}&token=${encodeURIComponent(pushToken)}`);
        }
      } catch (e) {
        console.error('App launch push token error:', e);
      }
    });

    if (Platform.OS === 'android') {
      PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'SoundZone Microphone Permission',
          message: 'SoundZone needs access to your microphone to enable voice chat.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        }
      );
    }
  }, []);

  const openLeftDrawer = () => {
    if (animating) return;
    setAnimating(true);
    setLeftDrawerOpen(true);
    Animated.parallel([
      Animated.spring(leftAnim, { toValue: 0, useNativeDriver: true, bounciness: 0 }),
      Animated.timing(overlayAnim, { toValue: 0.5, duration: 300, useNativeDriver: true }),
    ]).start(() => setAnimating(false));
  };

  const closeLeftDrawer = () => {
    if (animating) return;
    setAnimating(true);
    Animated.parallel([
      Animated.spring(leftAnim, { toValue: -DRAWER_WIDTH, useNativeDriver: true, bounciness: 0, speed: 20 }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => { setLeftDrawerOpen(false); setAnimating(false); });
  };

  const openRightDrawer = () => {
    if (animating) return;
    setAnimating(true);
    setRightDrawerOpen(true);
    Animated.parallel([
      Animated.spring(rightAnim, { toValue: 0, useNativeDriver: true, bounciness: 0 }),
      Animated.timing(overlayAnim, { toValue: 0.5, duration: 300, useNativeDriver: true }),
    ]).start(() => setAnimating(false));
  };

  const closeRightDrawer = () => {
    if (animating) return;
    setAnimating(true);
    Animated.parallel([
      Animated.spring(rightAnim, { toValue: DRAWER_WIDTH, useNativeDriver: true, bounciness: 0, speed: 20 }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => { setRightDrawerOpen(false); setAnimating(false); });
  };

  const saveName = async (value: string) => {
    setName(value);
    await AsyncStorage.setItem('username', value);
  };

  const loadContacts = async () => {
    const savedFriends = await AsyncStorage.getItem('friends');
    const friendsList: Contact[] = savedFriends ? JSON.parse(savedFriends) : [];
    setFriends(friendsList);

    const savedRecents = await AsyncStorage.getItem('recentContacts');
    const recentsList: Contact[] = savedRecents ? JSON.parse(savedRecents) : [];
    const now = Date.now();
    const validRecents = recentsList.filter(c => now - c.addedAt < FOURTEEN_DAYS);
    const friendIds = friendsList.map(f => f.userId);
    const filteredRecents = validRecents.filter(c => !friendIds.includes(c.userId));

    if (validRecents.length !== recentsList.length) {
      await AsyncStorage.setItem('recentContacts', JSON.stringify(validRecents));
    }
    setRecents(filteredRecents);

    const allIds = [...friendsList.map(f => f.userId), ...filteredRecents.map(r => r.userId)];
    if (allIds.length > 0) {
      try {
        const res = await fetch(`${TOKEN_SERVER}/status?ids=${allIds.join(',')}`);
        const data = await res.json();
        setStatuses(data);
      } catch (e) {
        console.log('Status check failed:', e);
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadContacts();
      const interval = setInterval(loadContacts, 10000);
      return () => clearInterval(interval);
    }, [])
  );

  const addFriend = async (contact: Contact) => {
    const savedFriends = await AsyncStorage.getItem('friends');
    const friendsList: Contact[] = savedFriends ? JSON.parse(savedFriends) : [];
    if (!friendsList.find(f => f.userId === contact.userId)) {
      friendsList.unshift({ userId: contact.userId, name: contact.name, addedAt: Date.now() });
      await AsyncStorage.setItem('friends', JSON.stringify(friendsList));
    }
    const updatedRecents = recents.filter(r => r.userId !== contact.userId);
    await AsyncStorage.setItem('recentContacts', JSON.stringify(updatedRecents));
    loadContacts();
  };

  const deleteFriend = (contact: Contact) => {
    Alert.alert(
      'Remove Friend',
      `Remove ${contact.name} from your friends list? They will be moved to recent contacts.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const updated = friends.filter(f => f.userId !== contact.userId);
            await AsyncStorage.setItem('friends', JSON.stringify(updated));
            const savedRecents = await AsyncStorage.getItem('recentContacts');
            const recentsList = savedRecents ? JSON.parse(savedRecents) : [];
            const alreadyInRecents = recentsList.find((r: any) => r.userId === contact.userId);
            if (!alreadyInRecents) {
              recentsList.unshift({ userId: contact.userId, name: contact.name, addedAt: Date.now() });
              await AsyncStorage.setItem('recentContacts', JSON.stringify(recentsList));
            }
            loadContacts();
          },
        },
      ]
    );
  };

  const deleteRecent = async (contact: Contact) => {
    const updated = recents.filter(r => r.userId !== contact.userId);
    await AsyncStorage.setItem('recentContacts', JSON.stringify(updated));
    loadContacts();
  };

  const clearRecents = () => {
    Alert.alert(
      'Clear Recent Contacts',
      'This will remove all recent contacts. Friends will not be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Recents',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.setItem('recentContacts', JSON.stringify([]));
            loadContacts();
          },
        },
      ]
    );
  };

  const joinContact = (contact: Contact) => {
    const status = statuses[contact.userId];
    if (status?.online && status.room) {
      router.push({ pathname: '/(tabs)/room', params: { code: status.room, name } });
    }
  };

  const createGroup = () => {
    if (name.length < 2) return;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    router.push({ pathname: '/(tabs)/room', params: { code, name } });
  };

  const joinGroup = () => {
    if (name.length < 2) return;
    router.push({ pathname: '/(tabs)/join', params: { name } });
  };

  const onlineContacts = [...friends, ...recents]
    .filter(c => statuses[c.userId]?.online)
    .slice(0, 3);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.welcome}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Main Screen */}
      <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={openLeftDrawer} style={styles.iconBtn}>
            <BorromeanIcon size={32} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={openRightDrawer} style={styles.iconBtn}>
            <Text style={styles.gearIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Welcome */}
        <View style={styles.welcomeSection}>
          <Text style={styles.logo}>🎵</Text>
          <Text style={styles.title}>SoundZone</Text>
          <Text style={styles.welcome}>Welcome{name ? `, ${name}` : ''}!</Text>
        </View>

        {/* Buttons */}
        <View style={styles.buttonSection}>
          <TouchableOpacity
            style={[styles.button, name.length < 2 && styles.buttonDisabled]}
            onPress={createGroup}
          >
            <Text style={styles.buttonText}>Create a Group</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.buttonOutline, name.length < 2 && styles.buttonOutlineDisabled]}
            onPress={joinGroup}
          >
            <Text style={styles.buttonOutlineText}>Join a Group</Text>
          </TouchableOpacity>
        </View>

        {/* Online Now */}
        {onlineContacts.length > 0 && (
          <View style={styles.onlineSection}>
            <Text style={styles.onlineTitle}>🟢 Online Now</Text>
            {onlineContacts.map((contact, index) => {
              const status = statuses[contact.userId];
              const isLocked = status?.locked;
              return (
                <View
                  key={contact.userId || `online-${index}`}
                  style={styles.onlineRow}
                >
                  <View style={[styles.onlineAvatar, { borderWidth: 2, borderColor: '#1DB954' }]}>
                    <Text style={styles.onlineAvatarText}>{contact.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.onlineName}>{contact.name}</Text>
                  {isLocked ? (
                    <Text style={{ fontSize: 18 }}>🔒</Text>
                  ) : (
                    <TouchableOpacity style={styles.joinBtn} onPress={() => joinContact(contact)}>
                      <Text style={styles.joinBtnText}>Join</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {name.length < 2 && (
          <Text style={styles.nameHint}>Set your name in ⚙️ Settings to get started</Text>
        )}
      </View>

      {/* Overlay */}
      {(leftDrawerOpen || rightDrawerOpen) && (
        <TouchableWithoutFeedback onPress={leftDrawerOpen ? closeLeftDrawer : closeRightDrawer}>
          <Animated.View 
            pointerEvents={leftDrawerOpen || rightDrawerOpen ? 'auto' : 'none'}
            style={[styles.overlay, { opacity: overlayAnim }]} 
          />
        </TouchableWithoutFeedback>
      )}

      {/* Left Drawer — Friends & Recents */}
      <Animated.View pointerEvents={leftDrawerOpen ? 'auto' : 'none'} style={[styles.leftDrawer, { transform: [{ translateX: leftAnim }], paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <View style={drawerStyles.header}>
          <Text style={drawerStyles.title}>Contacts</Text>
          <TouchableOpacity onPress={closeLeftDrawer}>
            <Text style={drawerStyles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={drawerStyles.scroll}>
          {friends.length > 0 && (
            <View style={drawerStyles.section}>
              <Text style={drawerStyles.sectionTitle}>Friends</Text>
              {friends.map(f => (
            <ContactRow
              key={f.userId}
              contact={f}
              isFriend={true}
              statuses={statuses}
              onJoin={(c) => { joinContact(c); closeLeftDrawer(); }}
              onAddFriend={addFriend}
              onDelete={deleteFriend}
            />
          ))}
            </View>
          )}
          {recents.length > 0 && (
            <View style={drawerStyles.section}>
              <Text style={drawerStyles.sectionTitle}>Recent Contacts</Text>
              {recents.map(r => (
            <ContactRow
              key={r.userId}
              contact={r}
              isFriend={false}
              statuses={statuses}
              onJoin={(c) => { joinContact(c); closeLeftDrawer(); }}
              onAddFriend={addFriend}
              onDelete={deleteRecent}
            />
          ))}
            </View>
          )}
          {friends.length === 0 && recents.length === 0 && (
            <Text style={drawerStyles.emptyText}>No contacts yet. Join a group to meet people!</Text>
          )}
          {recents.length > 0 && (
            <TouchableOpacity style={drawerStyles.clearBtn} onPress={clearRecents}>
              <Text style={drawerStyles.clearBtnText}>Clear Recent Contacts</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </Animated.View>

      {/* Right Drawer — Settings */}
      <Animated.View pointerEvents={rightDrawerOpen ? 'auto' : 'none'} style={[styles.rightDrawer, { transform: [{ translateX: rightAnim }], paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <View style={drawerStyles.header}>
          <Text style={drawerStyles.title}>Settings</Text>
          <TouchableOpacity onPress={closeRightDrawer}>
            <Text style={drawerStyles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={drawerStyles.scroll}>
          <View style={drawerStyles.section}>
            <Text style={drawerStyles.sectionTitle}>Your Name</Text>
            <TextInput
              style={drawerStyles.input}
              placeholder="Enter your name"
              placeholderTextColor="#555555"
              value={name}
              onChangeText={saveName}
              maxLength={20}
            />
            <Text style={drawerStyles.hint}>This is how others will see you in groups</Text>
          </View>

          <View style={drawerStyles.section}>
            <Text style={drawerStyles.sectionTitle}>How To Use SoundZone</Text>

            <View style={drawerStyles.howToItem}>
              <Text style={drawerStyles.howToTitle}>🎵 Creating a Group</Text>
              <Text style={drawerStyles.howToText}>Tap "Create a Group" on the home screen. Share the room code with friends so they can join. Play your music and talk freely — your voice overlays on everyone's music.</Text>
            </View>

            <View style={drawerStyles.howToItem}>
              <Text style={drawerStyles.howToTitle}>🔗 Joining a Group</Text>
              <Text style={drawerStyles.howToText}>Tap "Join a Group" and enter the room code shared by your friend. You can also tap "Join" next to any online contact on the home screen or in your contacts list.</Text>
            </View>

            <View style={drawerStyles.howToItem}>
              <Text style={drawerStyles.howToTitle}>📨 Inviting Friends</Text>
              <Text style={drawerStyles.howToText}>While in a group, tap the rings icon in the top left to open your contacts. Tap "Invite" next to any friend to send them a push notification with your room code.</Text>
            </View>

            <View style={drawerStyles.howToItem}>
              <Text style={drawerStyles.howToTitle}>🔊 Volume Controls</Text>
              <Text style={drawerStyles.howToText}>Use the master slider to balance voice vs music for everyone. Each participant has their own slider to adjust their volume individually. Slide left for less voice, right for more.</Text>
            </View>

            <View style={drawerStyles.howToItem}>
              <Text style={drawerStyles.howToTitle}>🔇 Muting</Text>
              <Text style={drawerStyles.howToText}>Tap "Mute Self" to stop transmitting your voice. Tap "Mute All" to silence everyone at once. Each participant also has their own mute button for individual control.</Text>
            </View>

            <View style={drawerStyles.howToItem}>
              <Text style={drawerStyles.howToTitle}>🔒 Locking a Group</Text>
              <Text style={drawerStyles.howToText}>Tap the padlock icon in the top right of the room to lock it. Locked rooms can only be joined by invite — the Join button won't appear for others. The room unlocks automatically when everyone leaves.</Text>
            </View>

            <View style={drawerStyles.howToItem}>
              <Text style={drawerStyles.howToTitle}>👥 Friends & Contacts</Text>
              <Text style={drawerStyles.howToText}>Anyone you share a room with appears in Recent Contacts. Tap their avatar to add them as a Friend for easy access. Friends appear at the top of your contacts list and never expire.</Text>
            </View>

            <View style={drawerStyles.howToItem}>
              <Text style={drawerStyles.howToTitle}>🎤 Best Audio Tips</Text>
              <Text style={drawerStyles.howToText}>For best results use earbuds or headphones to prevent echo. Talk at a normal volume — noise suppression handles background noise. The app works on WiFi and mobile data.</Text>
            </View>
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconBtn: {
    padding: 8,
  },
  gearIcon: {
    fontSize: 26,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 56,
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  welcome: {
    fontSize: 18,
    color: '#888888',
  },
  buttonSection: {
    width: '100%',
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#1DB954',
    paddingVertical: 16,
    borderRadius: 32,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#1a472a',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonOutline: {
    borderColor: '#1DB954',
    borderWidth: 2,
    paddingVertical: 16,
    borderRadius: 32,
    width: '100%',
    alignItems: 'center',
  },
  buttonOutlineDisabled: {
    borderColor: '#1a472a',
  },
  buttonOutlineText: {
    color: '#1DB954',
    fontSize: 18,
    fontWeight: 'bold',
  },
  onlineSection: {
    width: '100%',
  },
  onlineTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1DB954',
  },
  onlineAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  onlineAvatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  onlineName: {
    color: '#ffffff',
    fontSize: 16,
    flex: 1,
  },
  joinBtn: {
    backgroundColor: '#1DB954',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  joinBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  lockIcon: {
    fontSize: 18,
  },
  nameHint: {
    color: '#555555',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
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
    elevation: 16,
  },
  rightDrawer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#161616',
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 16,
  },
});

const drawerStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  closeBtn: {
    color: '#888888',
    fontSize: 18,
    padding: 4,
  },
  scroll: {
    flex: 1,
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
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333333',
    gap: 10,
  },
  contactRowOnline: {
    borderColor: '#1DB954',
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#333333',
    flexShrink: 0,
  },
  contactAvatarOnline: {
    borderColor: '#1DB954',
  },
  contactAvatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  contactName: {
    color: '#ffffff',
    fontSize: 15,
    flex: 1,
  },
  contactRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  joinBtn: {
    backgroundColor: '#1DB954',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  joinBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  starBtn: {
    backgroundColor: '#1a1a1a',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#444444',
  },
  starBtnText: {
    fontSize: 14,
  },
  deleteBtn: {
    backgroundColor: '#1a1a1a',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#444444',
  },
  deleteBtnText: {
    color: '#888888',
    fontSize: 14,
    fontWeight: 'bold',
  },
  clearBtn: {
    marginTop: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  clearBtnText: {
    color: '#555555',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  lockIcon: {
    fontSize: 18,
  },
  input: {
    backgroundColor: '#222222',
    color: '#ffffff',
    fontSize: 18,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#333333',
    marginBottom: 8,
  },
  hint: {
    color: '#555555',
    fontSize: 13,
  },
  emptyText: {
    color: '#555555',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 32,
  },
  howToItem: {
    marginBottom: 16,
    borderLeftWidth: 2,
    borderLeftColor: '#1DB954',
    paddingLeft: 12,
  },
  howToTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  howToText: {
    color: '#888888',
    fontSize: 13,
    lineHeight: 20,
  },
});