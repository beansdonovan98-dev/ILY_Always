import { useTheme } from '@/contexts/ThemeContext';
import { fontFamilyFor } from '@/lib/fonts';

const DEFAULTS = {
  text: '#3A2A2E',
  accent: '#FF6F91',
  border: 'rgba(46, 125, 79, 0.4)',
  card: 'rgba(255, 255, 255, 0.55)',
  leaf: '#2E7D4F',
};

function luminance(hex: string): number {
  const h = hex.replace('#', '').trim();
  if (!/^[0-9a-f]{6}$/i.test(h)) return 1;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** True when the active strain palette is dark (cards need dark glass). */
function isDarkTheme(gradient: string | null | undefined): boolean {
  if (!gradient) return true; // OG Kush default is dark
  let colors: string[] | null = null;
  try {
    const parsed = JSON.parse(gradient);
    if (Array.isArray(parsed)) colors = parsed.filter((c) => typeof c === 'string');
  } catch {
    if (gradient.includes(',')) colors = gradient.split(',').map((c) => c.trim());
  }
  if (!colors || !colors.length) return true;
  const avg = colors.reduce((sum, c) => sum + luminance(c), 0) / colors.length;
  return avg < 0.62;
}

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
  const dark = isDarkTheme(settings?.background_gradient);

  return {
    settings,
    fontFamily: fontFamilyFor(settings?.font_id),
    textColor: settings?.font_color || DEFAULTS.text,
    subtitleColor: settings?.subtitle_color || withAlpha(settings?.font_color || DEFAULTS.text, 0.75),
    accentColor,
    accentSoft: withAlpha(accentColor, 0.35),
    accentStrong: withAlpha(accentColor, 0.75),
    borderColor,
    leafColor: accentColor,
    // Auto-contrast glass: dark frosted on dark strains, light frosted on light ones.
    cardStyle: dark
      ? {
          backgroundColor: 'rgba(8, 22, 14, 0.62)',
          borderWidth: 1.5,
          borderColor: withAlpha(accentColor, 0.55),
          borderBottomWidth: 3,
          borderBottomColor: 'rgba(0, 0, 0, 0.55)',
          borderRadius: 20,
          shadowColor: '#000000',
          shadowOpacity: 0.45,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 7 },
          elevation: 10,
        }
      : {
          backgroundColor: 'rgba(255, 255, 255, 0.72)',
          borderWidth: 1.5,
          borderColor: 'rgba(46, 125, 79, 0.45)',
          borderBottomWidth: 3,
          borderBottomColor: 'rgba(27, 58, 36, 0.3)',
          borderRadius: 20,
          shadowColor: '#1B3A24',
          shadowOpacity: 0.22,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 7 },
          elevation: 9,
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
