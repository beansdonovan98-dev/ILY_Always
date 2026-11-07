import { Text, TextProps } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAppFont } from '@/hooks/useAppFont';

export default function ThemedText(props: TextProps) {
  const { settings } = useTheme();
  const font = useAppFont();
  const color = settings?.font_color || undefined;
  return <Text {...props} style={[{ fontFamily: font, color }, props.style]} />;
}