import { Tabs } from 'expo-router';

import TabDropdown from '@/components/TabDropdown';
import { useTheme } from '@/contexts/ThemeContext';

export default function TabLayout() {
  const { settings } = useTheme();

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
        headerRight: () => <TabDropdown />,
      }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="our-log" />
      <Tabs.Screen name="playtime" />
      <Tabs.Screen name="ai-editor" />
      <Tabs.Screen name="health" />
      <Tabs.Screen name="cleaning" />
      <Tabs.Screen name="settings" />
      <Tabs.Screen name="days-of-old" />
    </Tabs>
  );
}
