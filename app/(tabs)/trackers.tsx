import { StyleSheet } from 'react-native';
import { Text, View } from '@/components/Themed';

export default function TrackersScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Trackers 📊</Text>
      <Text style={styles.body}>Daily habits, moods, and goals tracking coming soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  body: { fontSize: 16, marginBottom: 8 },
});