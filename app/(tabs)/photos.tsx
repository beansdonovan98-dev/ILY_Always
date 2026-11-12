import { StyleSheet } from 'react-native';
import { Text, View } from '@/components/Themed';

export default function PhotosScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Photos 📸</Text>
      <Text style={styles.body}>Your photo gallery and cover photos live here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 12 },
  body: { fontSize: 16, marginBottom: 8 },
});