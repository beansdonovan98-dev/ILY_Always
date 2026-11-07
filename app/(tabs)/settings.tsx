import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Sentry } from '@/lib/sentry';
import { Text, View } from '@/components/Themed';

export default function SettingsScreen() {
  const router = useRouter();
  const [taps, setTaps] = useState(0);

  const handleSecretTap = () => {
    const next = taps + 1;
    setTaps(next);
    if (next >= 5) {
      setTaps(0);
      router.push('/playtime');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Settings ⚙️</Text>
      <Text style={styles.body}>App preferences, account, and data management.</Text>
      <Pressable style={styles.btn} onPress={() => Sentry.captureException(new Error('Test crash from settings'))}>
        <Text style={styles.btnText}>Test Crash (Sentry)</Text>
      </Pressable>
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
  secret: { position: 'absolute', bottom: 16, right: 16, opacity: 0.3 },
  secretText: { fontSize: 10 },
});