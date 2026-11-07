import { useTheme } from '@/contexts/ThemeContext';
import { fontFamilyFor } from '@/lib/fonts';

const DEFAULTS = {
  text: '#3A2A2E',
  accent: '#FF6F91',
  border: 'rgba(46, 125, 79, 0.4)',
  card: 'rgba(255, 255, 255, 0.55)',
  leaf: '#2E7D4F',
};

function withAlpha(color: string, alpha: number): string {
  const hex = color.trim();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(hex);
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  let r: number | null = null;
  let g: number | null = null;
  let b: number | null = null;
  if (short) {
    r = parseInt(short[1] + short[1], 16);
    g = parseInt(short[2] + short[2], 16);
    b = parseInt(short[3] + short[3], 16);
  } else if (long) {
    r = parseInt(long[1], 16);
    g = parseInt(long[2], 16);
    b = parseInt(long[3], 16);
  }
  if (r === null || g === null || b === null) {
    return `rgba(255, 111, 145, ${alpha})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Single source of truth for anything the couple can customise.
 * Every screen pulls its colours / font / card surface from here.
 */
export function useAppTheme() {
  const { settings } = useTheme();

  const accentColor = settings?.accent_color || DEFAULTS.accent;
  const borderColor = settings?.border_color || DEFAULTS.border;

  return {
    settings,
    fontFamily: fontFamilyFor(settings?.font_id),
    textColor: settings?.font_color || DEFAULTS.text,
    accentColor,
    accentSoft: withAlpha(accentColor, 0.35),
    accentStrong: withAlpha(accentColor, 0.75),
    borderColor,
    leafColor: DEFAULTS.leaf,
    cardStyle: {
      backgroundColor: DEFAULTS.card,
      borderWidth: 1,
      borderColor,
      borderRadius: 22,
    },
    chipStyle: {
      backgroundColor: withAlpha(accentColor, 0.18),
      borderWidth: 1,
      borderColor,
    },
    activeChipStyle: {
      backgroundColor: withAlpha(accentColor, 0.45),
      borderWidth: 1,
      borderColor,
    },
    buttonStyle: {
      backgroundColor: withAlpha(accentColor, 0.4),
      borderWidth: 1,
      borderColor,
    },
  };
}
