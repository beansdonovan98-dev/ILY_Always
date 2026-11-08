import { View, ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

import { CannabisLeaf } from '@/components/CannabisLeaf';

/** Glass water bong — hi-end beaker: water line, percolator, downstem, bubbles. */
export function BongVector({ size = 52, color = '#2E7D4F', opacity = 0.95 }: {
  size?: number; color?: string; opacity?: number;
}) {
  const w = size * 0.62;
  return (
    <Svg width={w} height={size} viewBox="0 0 48 80" style={{ opacity }}>
      {/* bowl + stem */}
      <Circle cx={24} cy={6} r={6} fill={color} />
      <Circle cx={24} cy={6} r={2.5} fill="#1A0B2E" />
      <Path d="M21,10 L27,10 L26,26 L22,26 Z" fill={color} />
      {/* angled mouthpiece */}
      <Path d="M26,12 C34,18 39,24 42,30" stroke={color} strokeWidth={4} fill="none" strokeLinecap="round" />
      {/* downstem */}
      <Path d="M24,24 L14,56" stroke="#E5E7EB" strokeWidth={3} strokeLinecap="round" />
      <Path d="M24,24 L14,56" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeDasharray="3 2" />
      {/* beaker chamber */}
      <Path d="M12,30 L36,30 L38,66 C38,70 34,72 24,72 C14,72 10,70 10,66 Z" fill={color} opacity={0.92} />
      {/* water */}
      <Path d="M13,52 L35,52 L36,64 C36,66 32,68 24,68 C16,68 12,66 12,64 Z" fill="#7DD3FC" opacity={0.85} />
      {/* bubbles */}
      <Circle cx={18} cy={60} r={2} fill="#FFFFFF" opacity={0.7} />
      <Circle cx={24} cy={62} r={1.6} fill="#FFFFFF" opacity={0.6} />
      <Circle cx={29} cy={59} r={1.8} fill="#FFFFFF" opacity={0.7} />
      {/* ice catchers */}
      <Circle cx={15} cy={40} r={2} fill="#FFFFFF" opacity={0.5} />
      <Circle cx={21} cy={43} r={2} fill="#FFFFFF" opacity={0.5} />
      <Circle cx={27} cy={40} r={2} fill="#FFFFFF" opacity={0.5} />
      {/* water reflection */}
      <Ellipse cx={18} cy={34} rx={3} ry={12} fill="#FFFFFF" opacity={0.3} />
      {/* foot */}
      <Ellipse cx={24} cy={72} rx={15} ry={4} fill={color} />
    </Svg>
  );
}

/** Rolled joint — clean paper, filter, cherry ember, smoky halo. */
export function JointVector({ size = 52, color = '#F5E6C8', opacity = 0.95, lit = true }: {
  size?: number; color?: string; opacity?: number; lit?: boolean;
}) {
  const h = size * 0.55;
  return (
    <Svg width={size} height={h} viewBox="0 0 100 55" style={{ opacity, transform: [{ rotate: '-18deg' }] }}>
      {/* smoke wisp */}
      {lit && (
        <>
          <Path d="M14,40 C8,34 18,30 12,24 C7,19 14,14 11,8" stroke="#CBD5E1" strokeWidth={2.6} fill="none" strokeLinecap="round" opacity={0.7} />
          <Path d="M18,42 C14,36 22,32 17,26" stroke="#E2E8F0" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.5} />
        </>
      )}
      {/* paper */}
      <Path d="M12,44 L78,20 L86,30 L20,54 Z" fill={color} stroke="rgba(0,0,0,0.18)" strokeWidth={1} />
      {/* paper texture lines */}
      <Path d="M20,48 L80,24 M24,50 L84,26" stroke="rgba(0,0,0,0.08)" strokeWidth={1} />
      {/* filter */}
      <Path d="M78,20 L86,30 L82,33 L74,23 Z" fill="#D9B98A" stroke="rgba(0,0,0,0.15)" strokeWidth={0.8} />
      {/* seam */}
      <Path d="M16,46 L80,23" stroke="rgba(0,0,0,0.2)" strokeWidth={1.4} />
      {/* glowing cherry */}
      {lit && (
        <>
          <Circle cx={14} cy={46} r={13} fill="#FF7A1A" opacity={0.25} />
          <Circle cx={14} cy={46} r={7} fill="#FF7A1A" opacity={0.8} />
          <Circle cx={14} cy={46} r={3.4} fill="#FFE45E" />
          <Circle cx={14} cy={46} r={1.4} fill="#FFF7D6" />
        </>
      )}
      {!lit && <Circle cx={14} cy={46} r={4} fill="#9AA0A6" opacity={0.6} />}
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
      <JointVector size={44} color="#F5E6C8" />
      <CannabisLeaf size={20} color={color} opacity={0.85} />
      <BongVector size={44} color={color} opacity={0.85} />
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
