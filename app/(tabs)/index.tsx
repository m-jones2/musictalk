import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const TOKEN_SERVER = 'https://musictalk-production.up.railway.app';
const FOURTEEN_DAYS = 14 * 24 * 60 * 60 * 1000;

type Contact = {
  name: string;
  addedAt: number;
};

type ContactStatus = {
  online: boolean;
  room?: string;
};

export default function HomeScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<Contact[]>([]);
  const [recents, setRecents] = useState<Contact[]>([]);
  const [statuses, setStatuses] = useState<Record<string, ContactStatus>>({});

  useEffect(() => {
    AsyncStorage.getItem('username').then(savedName => {
      if (savedName) setName(savedName);
      setLoading(false);
    });
  }, []);

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
    const friendNames = friendsList.map(f => f.name);
    const filteredRecents = validRecents.filter(c => !friendNames.includes(c.name));

    if (validRecents.length !== recentsList.length) {
      await AsyncStorage.setItem('recentContacts', JSON.stringify(validRecents));
    }
    setRecents(filteredRecents);

    const allNames = [...friendsList.map(f => f.name), ...filteredRecents.map(r => r.name)];
    if (allNames.length > 0) {
      try {
        const res = await fetch(`${TOKEN_SERVER}/status?names=${allNames.join(',')}`);
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
    if (!friendsList.find(f => f.name === contact.name)) {
      friendsList.unshift({ name: contact.name, addedAt: Date.now() });
      await AsyncStorage.setItem('friends', JSON.stringify(friendsList));
    }
    const updatedRecents = recents.filter(r => r.name !== contact.name);
    await AsyncStorage.setItem('recentContacts', JSON.stringify(updatedRecents));
    loadContacts();
  };

  const deleteFriend = (friendName: string) => {
    Alert.alert(
      'Remove Friend',
      `Remove ${friendName} from your friends list? They will be moved to recent contacts.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const updated = friends.filter(f => f.name !== friendName);
            await AsyncStorage.setItem('friends', JSON.stringify(updated));
            const savedRecents = await AsyncStorage.getItem('recentContacts');
            const recentsList = savedRecents ? JSON.parse(savedRecents) : [];
            const alreadyInRecents = recentsList.find((r: any) => r.name === friendName);
            if (!alreadyInRecents) {
              recentsList.unshift({ name: friendName, addedAt: Date.now() });
              await AsyncStorage.setItem('recentContacts', JSON.stringify(recentsList));
            }
            loadContacts();
          },
        },
      ]
    );
  };

  const deleteRecent = async (recentName: string) => {
    const updated = recents.filter(r => r.name !== recentName);
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
    const status = statuses[contact.name];
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

  const renderContact = (contact: Contact, isFriend: boolean) => {
    const status = statuses[contact.name];
    const isOnline = status?.online;
    return (
      <View key={contact.name} style={[styles.contactRow, isOnline && styles.contactRowOnline]}>
        <View style={styles.contactLeft}>
          <View style={[styles.statusDot, isOnline ? styles.dotOnline : styles.dotOffline]} />
          <View style={styles.contactAvatar}>
            <Text style={styles.contactAvatarText}>{contact.name.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.contactName}>{contact.name}</Text>
        </View>
        <View style={styles.contactRight}>
          {isOnline && (
            <TouchableOpacity style={styles.joinBtn} onPress={() => joinContact(contact)}>
              <Text style={styles.joinBtnText}>Join</Text>
            </TouchableOpacity>
          )}
          {!isFriend && (
            <TouchableOpacity style={styles.starBtn} onPress={() => addFriend(contact)}>
              <Text style={styles.starBtnText}>⭐</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => isFriend ? deleteFriend(contact.name) : deleteRecent(contact.name)}
          >
            <Text style={styles.deleteBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.subtitle}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.logo}>🎵</Text>
      <Text style={styles.title}>MusicTalk</Text>
      <Text style={styles.subtitle}>Talk without missing a beat</Text>

      <TextInput
        style={styles.input}
        placeholder="Enter your name"
        placeholderTextColor="#555555"
        value={name}
        onChangeText={saveName}
        maxLength={20}
      />

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

      {friends.length > 0 && (
        <View style={styles.contactsSection}>
          <Text style={styles.contactsTitle}>Friends</Text>
          {friends.map(f => renderContact(f, true))}
        </View>
      )}

      {recents.length > 0 && (
        <View style={styles.contactsSection}>
          <Text style={styles.contactsTitle}>Recent Contacts</Text>
          {recents.map(r => renderContact(r, false))}
        </View>
      )}

      {recents.length > 0 && (
        <TouchableOpacity style={styles.clearAllBtn} onPress={clearRecents}>
          <Text style={styles.clearAllText}>Clear Recent Contacts</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#0f0f0f',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logo: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#888888',
    marginBottom: 32,
  },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    fontSize: 18,
    textAlign: 'center',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#333333',
  },
  button: {
    backgroundColor: '#1DB954',
    paddingVertical: 16,
    paddingHorizontal: 48,
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
    paddingHorizontal: 48,
    borderRadius: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 32,
  },
  buttonOutlineDisabled: {
    borderColor: '#1a472a',
  },
  buttonOutlineText: {
    color: '#1DB954',
    fontSize: 18,
    fontWeight: 'bold',
  },
  contactsSection: {
    width: '100%',
    marginBottom: 16,
  },
  contactsTitle: {
    color: '#888888',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333333',
  },
  contactRowOnline: {
    borderColor: '#1DB954',
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
  contactAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  contactAvatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  contactName: {
    color: '#ffffff',
    fontSize: 16,
  },
  contactRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  clearAllBtn: {
    marginTop: 8,
    paddingVertical: 10,
  },
  clearAllText: {
    color: '#555555',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});