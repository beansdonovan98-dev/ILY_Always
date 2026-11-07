import { useTheme } from '@/contexts/ThemeContext';
import { fontFamilyFor } from '@/lib/fonts';

export function useAppFont() {
  const { settings } = useTheme();
  return fontFamilyFor(settings?.font_id);
}