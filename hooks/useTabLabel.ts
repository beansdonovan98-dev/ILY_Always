import { useTheme } from '@/contexts/ThemeContext';

/** Returns the (possibly renamed) label for a tab from the couple's tab config. */
export function useTabLabel(id: string, fallback: string): string {
  const { settings } = useTheme();
  const config = settings?.tab_config as Array<{ id: string; label: string }> | null | undefined;
  return config?.find((t) => t.id === id)?.label ?? fallback;
}
