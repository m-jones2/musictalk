import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  const router = useRouter();
  const [name, setName] = useState('');

  const createGroup = () => {
    if (name.length < 2) return;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    router.push({ pathname: '/(tabs)/room', params: { code, name } });
  };

  const joinGroup = () => {
    if (name.length < 2) return;
    router.push({ pathname: '/(tabs)/join', params: { name } });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>🎵</Text>
      <Text style={styles.title}>MusicTalk</Text>
      <Text style={styles.subtitle}>Talk without missing a beat</Text>

      <TextInput
        style={styles.input}
        placeholder="Enter your name"
        placeholderTextColor="#555555"
        value={name}
        onChangeText={setName}
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
    </View>
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
  },
  buttonOutlineDisabled: {
    borderColor: '#1a472a',
  },
  buttonOutlineText: {
    color: '#1DB954',
    fontSize: 18,
    fontWeight: 'bold',
  },
});