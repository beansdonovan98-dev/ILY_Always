import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { getCoupleId } from '@/lib/couple';
import { dailyRoomCode } from '@/lib/lock';
import { setItem } from '@/lib/storage';
import { Sentry } from '@/lib/sentry';

export default function SettingsScreen() {
  const router = useRouter();
  const [taps, setTaps] = useState(0);
  const [roomCode, setRoomCode] = useState('');

  useEffect(() => {
    (async () => {
      const cid = await getCoupleId();
      setRoomCode(dailyRoomCode(cid));
    })();
  }, []);

  const handleSecretTap = () => {
    const next = taps + 1;
    setTaps(next);
    if (next >= 5) {
      setTaps(0);
      router.push('/playtime');
    }
  };

  const setLockBackground = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    const dir = `${FileSystem.documentDirectory}lockbg/`;
    try { await FileSystem.makeDirectoryAsync(dir, { intermediates: true }); } catch {}
    const dest = `${dir}lockbg.jpg`;
    try { await FileSystem.copyAsync({ from: uri, to: dest }); await setItem('lockBackgroundUri', dest); }
    catch { await setItem('lockBackgroundUri', uri); }
  };

  const clearLockBackground = async () => {
    await setItem('lockBackgroundUri', '');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings ⚙️</Text>
      <Text style={styles.body}>App preferences, account, and data management.</Text>

      <Pressable style={styles.btn} onPress={setLockBackground}>
        <Text style={styles.btnText}>Set Lock Screen Background</Text>
      </Pressable>
      <Pressable style={styles.btn} onPress={clearLockBackground}>
        <Text style={styles.btnText}>Clear Lock Background</Text>
      </Pressable>

      <Pressable style={styles.btn} onPress={() => Sentry.captureException(new Error('Test crash from settings'))}>
        <Text style={styles.btnText}>Test Crash (Sentry)</Text>
      </Pressable>

      <Text style={styles.body}>Today's room code is sent to you by SMS.</Text>

      <Pressable onPress={handleSecretTap} style={styles.secret}>
        <Text style={styles.secretText}>v1.0.0</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  body: { fontSize: 16, marginBottom: 8 },
  btn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: 'rgba(100,150,255,0.4)', marginBottom: 12, alignSelf: 'flex-start' },
  btnText: { fontWeight: '600' },
  muted: { fontSize: 12, opacity: 0.6, marginBottom: 8 },
  secret: { position: 'absolute', bottom: 16, right: 16, opacity: 0.3 },
  secretText: { fontSize: 10 },
});