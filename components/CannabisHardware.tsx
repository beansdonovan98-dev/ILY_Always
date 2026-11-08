import { View, ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import { CannabisLeaf } from '@/components/CannabisLeaf';

/** Glass water bong — dome base, water chamber, angled neck, bowl. */
export function BongVector({ size = 40, color = '#2E7D4F', opacity = 0.95 }: {
  size?: number; color?: string; opacity?: number;
}) {
  const w = size * 0.5;
  return (
    <Svg width={w} height={size} viewBox="0 0 36 72" style={{ opacity }}>
      <Path d="M15,2 L21,2 L20,8 L16,8 Z" fill={color} />
      <Path d="M14,8 L22,8 L21,30 L15,30 Z" fill={color} />
      <Path d="M19,10 C24,14 27,19 29,24" stroke={color} strokeWidth={3.2} fill="none" strokeLinecap="round" />
      <Path d="M19,28 L13,50" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Ellipse cx={18} cy={52} rx={12} ry={15} fill={color} />
      <Ellipse cx={18} cy={56} rx={9} ry={9} fill="#FFFFFF" opacity={0.28} />
      <Ellipse cx={18} cy={65} rx={13} ry={4.6} fill={color} />
    </Svg>
  );
}

/** Rolled joint with a glowing ember tip + thin smoke wisp. */
export function JointVector({ size = 40, color = '#F5E6C8', opacity = 0.95, lit = true }: {
  size?: number; color?: string; opacity?: number; lit?: boolean;
}) {
  const h = size * 0.55;
  return (
    <Svg width={size} height={h} viewBox="0 0 100 55" style={{ opacity, transform: [{ rotate: '-18deg' }] }}>
      {/* smoke wisp rising from the tip */}
      {lit && (
        <Path d="M14,40 C8,34 18,30 12,24 C7,19 14,14 11,8" stroke="#CBD5E1" strokeWidth={2.4} fill="none" strokeLinecap="round" opacity={0.65} />
      )}
      {/* paper body */}
      <Path d="M12,44 L78,20 L86,30 L20,54 Z" fill={color} stroke="rgba(0,0,0,0.15)" strokeWidth={1} />
      {/* filter end */}
      <Path d="M78,20 L86,30 L82,33 L74,23 Z" fill="#D9B98A" />
      {/* seam line */}
      <Path d="M16,46 L80,23" stroke="rgba(0,0,0,0.18)" strokeWidth={1.2} />
      {/* glowing ember */}
      {lit && (
        <>
          <Circle cx={14} cy={46} r={10} fill="#FF7A1A" opacity={0.3} />
          <Circle cx={14} cy={46} r={5.2} fill="#FF7A1A" opacity={0.75} />
          <Circle cx={14} cy={46} r={2.6} fill="#FFE45E" />
        </>
      )}
    </Svg>
  );
}

/** Mini badge combining both silhouettes — used as card title icons. */
export function HardwareBadge({ size = 30, color = '#2E7D4F' }: { size?: number; color?: string }) {
  const kind = Math.random() > 0.5 ? 'joint' : 'bong';
  return kind === 'joint' ? <JointVector size={size} color={color} /> : <BongVector size={size} color={color} />;
}

/** Horizontal divider: line — joint — leaf — bong — line. */
export function CannabisDivider({ color = '#2E7D4F', style }: { color?: string; style?: ViewStyle }) {
  return (
    <View
      pointerEvents="none"
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 10, opacity: 0.85 },
        style,
      ]}>
      <View style={{ flex: 1, height: 1, backgroundColor: color, opacity: 0.45 }} />
      <JointVector size={42} color="#F5E6C8" />
      <CannabisLeaf size={18} color={color} opacity={0.85} />
      <BongVector size={30} color={color} opacity={0.85} />
      <View style={{ flex: 1, height: 1, backgroundColor: color, opacity: 0.45 }} />
    </View>
  );
}

/** Reusable cannabis card: watermark leaf, hardware title badge, divider-ready. */
export function WeedCard({ title, badge, children, style }: {
  title?: React.ReactNode;
  badge?: 'joint' | 'bong' | 'auto';
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[{ padding: 18, borderRadius: 22, overflow: 'hidden' }, style]}>
      {/* watermark leaf, bottom-right */}
      <View pointerEvents="none" style={{ position: 'absolute', right: -10, bottom: -12, opacity: 0.09 }}>
        <CannabisLeaf size={110} color="#2E7D4F" />
      </View>
      {title && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          {badge === 'joint' ? (
            <JointVector size={34} />
          ) : badge === 'bong' ? (
            <BongVector size={30} />
          ) : (
            <HardwareBadge size={30} />
          )}
          <View style={{ flex: 1 }}>{title}</View>
        </View>
      )}
      {children}
    </View>
  );
}
