/**
 * Room light colours offered in the editor.
 *
 * Keep in sync with LIGHT_COLORS in
 * supabase/functions/ai-image-edit/styleBuckets.ts — the ids are what travel to
 * the edge function, the hex is only for the swatch, and the label is only text.
 */
export type RoomLightColor = { id: string; label: string; hex: string; phrase: string };

export const ROOM_LIGHT_COLORS: RoomLightColor[] = [
  { id: 'red', label: 'Red', hex: '#FF2D2D', phrase: 'deep red' },
  { id: 'orange', label: 'Orange', hex: '#FF7A1A', phrase: 'burnt orange' },
  { id: 'amber', label: 'Amber', hex: '#FFB000', phrase: 'warm amber' },
  { id: 'acid', label: 'Acid Green', hex: '#8CFF3D', phrase: 'acid green' },
  { id: 'emerald', label: 'Emerald', hex: '#1FD37A', phrase: 'emerald green' },
  { id: 'teal', label: 'Teal', hex: '#17E0C6', phrase: 'teal' },
  { id: 'cyan', label: 'Cyan', hex: '#2EC8FF', phrase: 'cyan' },
  { id: 'blue', label: 'Electric Blue', hex: '#2F6BFF', phrase: 'electric blue' },
  { id: 'violet', label: 'Violet', hex: '#8B5CFF', phrase: 'violet' },
  { id: 'magenta', label: 'Magenta', hex: '#FF2BD1', phrase: 'magenta' },
  { id: 'pink', label: 'Hot Pink', hex: '#FF4D9E', phrase: 'hot pink' },
  { id: 'white', label: 'Warm White', hex: '#FFE3BC', phrase: 'warm white' },
];
