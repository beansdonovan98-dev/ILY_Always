export const FONT_OPTIONS = [
  { id: 'mono', label: 'Monospace / Typewriter', family: 'SpaceMono' },
  { id: 'sans', label: 'Clean Sans-Serif', family: undefined },
  { id: 'serif', label: 'Modern Serif', family: 'serif' },
  { id: 'comic', label: 'Comic Sans', family: 'ComicNeue_400Regular' },
  { id: 'hand', label: 'Handwritten', family: 'Caveat_400Regular' },
  { id: 'script', label: 'Cursive Script', family: 'Snell Roundhand' },
];

export function fontFamilyFor(id: string | null | undefined): string | undefined {
  const opt = FONT_OPTIONS.find((o) => o.id === id);
  return opt ? opt.family : undefined;
}
