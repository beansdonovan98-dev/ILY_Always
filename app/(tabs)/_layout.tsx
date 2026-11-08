import { Tabs } from 'expo-router';
import { Pressable, Text } from 'react-native';

import TabDropdown from '@/components/TabDropdown';
import { useTheme } from '@/contexts/ThemeContext';
import { useUsage } from '@/contexts/UsageContext';

export default function TabLayout() {
  const { settings } = useTheme();
  const { logout } = useUsage();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        // Each screen renders its own H1, so the nav bar only holds the menu.
        headerTitle: '',
        sceneStyle: { backgroundColor: 'transparent' },
        headerStyle: { backgroundColor: 'transparent' },
        headerShadowVisible: false,
        headerTintColor: settings?.font_color || '#3A2A2E',
        tabBarStyle: { display: 'none' },
        headerLeft: () => (
          <Pressable onPress={logout} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: 'rgba(120,120,120,0.2)', marginLeft: 12, marginTop: 4 }}>
            <Text style={{ fontWeight: '600', fontSize: 14, color: settings?.font_color || '#3A2A2E' }}>Log out 🔒</Text>
          </Pressable>
        ),
        headerRight: () => <TabDropdown />,
      }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="our-log" />
      <Tabs.Screen name="dbt" />
      <Tabs.Screen name="playtime" />
      <Tabs.Screen name="ai-editor" />
      <Tabs.Screen name="health" />
      <Tabs.Screen name="cleaning" />
      <Tabs.Screen name="settings" />
      <Tabs.Screen name="days-of-old" />
    </Tabs>
  );
}
