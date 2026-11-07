import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { getItem } from '@/lib/storage';
import { getCoupleId } from '@/lib/couple';
import { unlockWithCode } from '@/lib/lock';

export default function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [bgUri, setBgUri] = useState<string>('');

  useEffect(() => {
    (async () => {
      const uri = await getItem<string>('lockBackgroundUri', '');
      setBgUri(uri);
    })();
  }, []);

  const handleSubmit = async () => {
    const cid = await getCoupleId();
    const ok = await unlockWithCode(cid, code);
    if (ok) {
      onUnlock();
    } else {
      setError('Incorrect code. Try again.');
    }
  };

  return (
    <View style={styles.container}>
      {bgUri ? (
        <Image source={{ uri: bgUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : null}
      <View style={styles.overlay}>
        <Text style={styles.title}>Enter Today's Room Code 🔒</Text>
        <Text style={styles.body}>A new code is texted to each of you at the start of the day. It lasts from 12 AM to 12 AM.</Text>
        <TextInput value={code} onChangeText={setCode} placeholder="6-character code" style={styles.input} autoCapitalize="characters" />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.btn} onPress={handleSubmit}>
          <Text style={styles.btnText}>Unlock</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111' },
  overlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.45)' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12, textAlign: 'center', color: '#fff' },
  body: { fontSize: 14, opacity: 0.9, marginBottom: 16, textAlign: 'center', color: '#fff' },
  input: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: 12, fontSize: 18, textAlign: 'center', marginBottom: 8, color: '#fff' },
  error: { color: '#FF6B6B', marginBottom: 8, textAlign: 'center' },
  btn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, backgroundColor: 'rgba(100,150,255,0.6)', alignSelf: 'center' },
  btnText: { fontWeight: '600', color: '#fff' },
});