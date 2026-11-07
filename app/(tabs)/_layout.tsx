import { Tabs } from 'expo-router';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import TabDropdown from '@/components/TabDropdown';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        headerShown: true,
        tabBarStyle: { display: 'none' },
        headerRight: () => <TabDropdown />,
      }}>
      <Tabs.Screen name="ai-editor" options={{ title: 'AI Photo Editor 📷' }} />
      <Tabs.Screen name="our-log" options={{ title: 'Our Log 📜' }} />
      <Tabs.Screen name="days-of-old" options={{ title: 'The Days of Old 🧙‍♂️' }} />
      <Tabs.Screen name="playtime" options={{ title: 'Playtime 😓' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings ⚙️', tabBarLabel: 'Settings ⚙️' }} />
    </Tabs>
  );
}