import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const TOKEN_SERVER = 'https://musictalk-production.up.railway.app';

type ContactStatus = {
  online: boolean;
  room?: string;
};

export default function HomeScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [recentContacts, setRecentContacts] = useState<string[]>([]);
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
    const existing = await AsyncStorage.getItem('recentContacts');
    const contacts = existing ? JSON.parse(existing) : [];
    setRecentContacts(contacts);

    if (contacts.length > 0) {
      try {
        const res = await fetch(`${TOKEN_SERVER}/status?names=${contacts.join(',')}`);
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

  const createGroup = () => {
    if (name.length < 2) return;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    router.push({ pathname: '/(tabs)/room', params: { code, name } });
  };

  const joinGroup = () => {
    if (name.length < 2) return;
    router.push({ pathname: '/(tabs)/join', params: { name } });
  };

  const joinContact = (contact: string) => {
    const status = statuses[contact];
    if (status?.online && status.room) {
      router.push({ pathname: '/(tabs)/room', params: { code: status.room, name } });
    }
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

      {recentContacts.length > 0 && (
        <View style={styles.contactsSection}>
          <Text style={styles.contactsTitle}>Recent Contacts</Text>
          {recentContacts.map(contact => {
            const status = statuses[contact];
            const isOnline = status?.online;
            return (
              <TouchableOpacity
                key={contact}
                style={[styles.contactRow, isOnline && styles.contactRowOnline]}
                onPress={() => isOnline && joinContact(contact)}
                disabled={!isOnline}
              >
                <View style={styles.contactLeft}>
                  <View style={[styles.statusDot, isOnline ? styles.dotOnline : styles.dotOffline]} />
                  <View style={styles.contactAvatar}>
                    <Text style={styles.contactAvatarText}>{contact.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.contactName}>{contact}</Text>
                </View>
                {isOnline && (
                  <TouchableOpacity
                    style={styles.joinBtn}
                    onPress={() => joinContact(contact)}
                  >
                    <Text style={styles.joinBtnText}>Join</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
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
  joinBtn: {
    backgroundColor: '#1DB954',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  joinBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});