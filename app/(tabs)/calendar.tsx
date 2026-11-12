import { StyleSheet } from 'react-native';
import { Text, View } from '@/components/Themed';

export default function CalendarScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Calendar 📅</Text>
      <Text style={styles.body}>Upcoming events and important dates will appear here.</Text>
      <Text style={styles.body}>Relationship anniversary: 08/09 (every year)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  body: { fontSize: 16, marginBottom: 8 },
});