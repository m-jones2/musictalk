import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function JoinScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');

  const joinGroup = () => {
    if (code.length < 4) return;
    router.push({ pathname: '/(tabs)/room', params: { code: code.toUpperCase() } });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Join a Group</Text>
      <Text style={styles.subtitle}>Enter the room code from your friend</Text>

      <TextInput
        style={styles.input}
        placeholder="Enter code e.g. X7KP2Q"
        placeholderTextColor="#555555"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        maxLength={8}
      />

      <TouchableOpacity
        style={[styles.button, code.length < 4 && styles.buttonDisabled]}
        onPress={joinGroup}
      >
        <Text style={styles.buttonText}>Join</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
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
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#888888',
    marginBottom: 40,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
    letterSpacing: 6,
    textAlign: 'center',
    borderRadius: 16,
    padding: 20,
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
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: '#1a472a',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  backButton: {
    marginTop: 8,
  },
  backText: {
    color: '#888888',
    fontSize: 16,
  },
});