import { Tabs } from 'expo-router';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        headerShown: true,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home Is Where the Heart Is 💗',
          tabBarLabel: 'Home 💗',
        }}
      />
      <Tabs.Screen
        name="our-log"
        options={{
          title: 'Our Log 📜',
          tabBarLabel: 'Our Log',
        }}
      />
      <Tabs.Screen
        name="days-of-old"
        options={{
          title: 'The Days of Old 🧙‍♂️',
          tabBarLabel: 'Days of Old',
        }}
      />
      <Tabs.Screen
        name="playtime"
        options={{
          title: 'Playtime 🔞',
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings ⚙️',
          href: null,
        }}
      />
    </Tabs>
  );
}