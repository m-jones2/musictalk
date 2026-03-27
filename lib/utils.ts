import AsyncStorage from '@react-native-async-storage/async-storage';

const generateId = () => {
  return 'usr_' + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
};

export const getUserId = async (): Promise<string> => {
  const existing = await AsyncStorage.getItem('userId');
  if (existing) return existing;
  const newId = generateId();
  await AsyncStorage.setItem('userId', newId);
  return newId;
};