import { View, ViewStyle } from 'react-native';
import Svg, { Ellipse, G, Path } from 'react-native-svg';

interface CannabisLeafProps {
  size?: number;
  color?: string;
  opacity?: number;
  style?: ViewStyle;
}

/**
 * Stylised seven-leaflet cannabis leaf.
 * Drawn as SVG so it stays crisp and can follow the couple's accent colour.
 */
export function CannabisLeaf({ size = 14, color = '#2E7D4F', opacity = 0.9, style }: CannabisLeafProps) {
  const leaflets = [
    { angle: 0, scale: 1 },
    { angle: 22, scale: 0.9 },
    { angle: -22, scale: 0.9 },
    { angle: 45, scale: 0.72 },
    { angle: -45, scale: 0.72 },
    { angle: 68, scale: 0.52 },
    { angle: -68, scale: 0.52 },
  ];

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <G transform="translate(12, 23)">
        {leaflets.map((leaf, i) => (
          <G key={i} transform={`rotate(${leaf.angle}) scale(${leaf.scale})`}>
            <Path
              d="M0,0 C-2.1,-3.1 -1.8,-7.6 0,-11.5 C1.8,-7.6 2.1,-3.1 0,0 Z"
              fill={color}
              opacity={opacity}
            />
          </G>
        ))}
      </G>
    </Svg>
  );
}

/** Two little leaf clusters sitting on the top edge of a glass card. */
export function LeafBorder({ color = '#2E7D4F', size = 24 }: { color?: string; size?: number }) {
  return (
    <>
      <View pointerEvents="none" style={styles.clusterLeft}>
        <CannabisLeaf size={size * 0.72} color={color} opacity={0.55} style={styles.tiltLeft} />
        <CannabisLeaf size={size} color={color} opacity={0.95} />
        <CannabisLeaf size={size * 0.72} color={color} opacity={0.55} style={styles.tiltRight} />
      </View>
      <View pointerEvents="none" style={styles.clusterRight}>
        <CannabisLeaf size={size * 0.72} color={color} opacity={0.55} style={styles.tiltLeft} />
        <CannabisLeaf size={size} color={color} opacity={0.95} />
        <CannabisLeaf size={size * 0.72} color={color} opacity={0.55} style={styles.tiltRight} />
      </View>
      <View pointerEvents="none" style={styles.trailLeft}>
        <CannabisLeaf size={size * 0.55} color={color} opacity={0.4} style={styles.tiltRight} />
        <CannabisLeaf size={size * 0.45} color={color} opacity={0.3} />
      </View>
      <View pointerEvents="none" style={styles.trailRight}>
        <CannabisLeaf size={size * 0.45} color={color} opacity={0.3} />
        <CannabisLeaf size={size * 0.55} color={color} opacity={0.4} style={styles.tiltLeft} />
      </View>
      <View pointerEvents="none" style={styles.bottomLeft}>
        <CannabisLeaf size={size * 0.6} color={color} opacity={0.35} style={styles.tiltRight} />
        <CannabisLeaf size={size * 0.45} color={color} opacity={0.25} />
      </View>
      <View pointerEvents="none" style={styles.bottomRight}>
        <CannabisLeaf size={size * 0.45} color={color} opacity={0.25} />
        <CannabisLeaf size={size * 0.6} color={color} opacity={0.35} style={styles.tiltLeft} />
      </View>
    </>
  );
}

const styles = {
  clusterLeft: {
    position: 'absolute' as const,
    top: -13,
    left: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 2,
  },
  clusterRight: {
    position: 'absolute' as const,
    top: -13,
    right: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 2,
  },
  tiltLeft: { transform: [{ rotate: '-18deg' }] },
  tiltRight: { transform: [{ rotate: '18deg' }] },
  trailLeft: {
    position: 'absolute' as const,
    top: -11,
    left: 76,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  trailRight: {
    position: 'absolute' as const,
    top: -11,
    right: 76,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  bottomLeft: {
    position: 'absolute' as const,
    bottom: -11,
    left: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  bottomRight: {
    position: 'absolute' as const,
    bottom: -11,
    right: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
};

export default CannabisLeaf;

/** A little rooted weed plant — stem, paired fan leaves and a top bud. */
export function WeedPlant({ height = 80, color = '#2E7D32', budColor = '#7B1FA2', opacity = 0.9 }: {
  height?: number;
  color?: string;
  budColor?: string;
  opacity?: number;
}) {
  const w = height * 0.75;
  return (
    <Svg width={w} height={height} viewBox="0 0 60 80" style={{ opacity }}>
      {/* stem */}
      <Path d="M30,78 C30,60 30,44 30,30" stroke={color} strokeWidth={2.6} fill="none" strokeLinecap="round" />
      {/* lower fan leaves */}
      <G transform="translate(30,62)">
        <G transform="rotate(-42)"><Path d="M0,0 C-1.4,-6 -1.2,-12 0,-16 C1.2,-12 1.4,-6 0,0 Z" fill={color} /></G>
        <G transform="rotate(42)"><Path d="M0,0 C-1.4,-6 -1.2,-12 0,-16 C1.2,-12 1.4,-6 0,0 Z" fill={color} /></G>
        <G transform="rotate(-78)"><Path d="M0,0 C-1.4,-6 -1.2,-12 0,-16 C1.2,-12 1.4,-6 0,0 Z" fill={color} opacity={0.7} /></G>
        <G transform="rotate(78)"><Path d="M0,0 C-1.4,-6 -1.2,-12 0,-16 C1.2,-12 1.4,-6 0,0 Z" fill={color} opacity={0.7} /></G>
      </G>
      {/* middle fan leaves */}
      <G transform="translate(30,44)">
        <G transform="rotate(-30)"><Path d="M0,0 C-1.6,-7 -1.4,-14 0,-18 C1.4,-14 1.6,-7 0,0 Z" fill={color} /></G>
        <G transform="rotate(30)"><Path d="M0,0 C-1.6,-7 -1.4,-14 0,-18 C1.4,-14 1.6,-7 0,0 Z" fill={color} /></G>
      </G>
      {/* top bud */}
      <Path d="M30,28 C24,20 24,10 30,2 C36,10 36,20 30,28 Z" fill={budColor} opacity={0.85} />
      <Path d="M30,22 C27,17 27,11 30,7 C33,11 33,17 30,22 Z" fill={budColor} opacity={0.5} />
      {/* soil line */}
      <Path d="M12,78 L48,78" stroke={color} strokeWidth={1.6} opacity={0.6} strokeLinecap="round" />
    </Svg>
  );
}

/** A soft smoke puff made of overlapping translucent circles. */
export function SmokePuff({ size = 60, color = '#9AA0A6', opacity = 0.16 }: {
  size?: number;
  color?: string;
  opacity?: number;
}) {
  const w = size * 1.6;
  return (
    <Svg width={w} height={size} viewBox="0 0 96 60" style={{ opacity }}>
      <Ellipse cx={26} cy={38} rx={20} ry={14} fill={color} />
      <Ellipse cx={52} cy={26} rx={24} ry={16} fill={color} />
      <Ellipse cx={74} cy={38} rx={18} ry={12} fill={color} />
    </Svg>
  );
}

/** A tiny pipe/bong silhouette — base, chamber, neck and bowl. */
export function BongSprite({ size = 56, color = '#2E7D32', opacity = 0.13 }: {
  size?: number;
  color?: string;
  opacity?: number;
}) {
  const w = size * 0.55;
  return (
    <Svg width={w} height={size} viewBox="0 0 32 58" style={{ opacity }}>
      {/* bowl */}
      <Path d="M13,3 L19,3 L18,8 L14,8 Z" fill={color} />
      {/* neck */}
      <Path d="M13.5,8 L18.5,8 L18,26 L14,26 Z" fill={color} />
      {/* chamber */}
      <Ellipse cx={16} cy={42} rx={11} ry={14} fill={color} />
      {/* base */}
      <Ellipse cx={16} cy={54} rx={12} ry={4} fill={color} />
      {/* slide tube */}
      <Path d="M21,30 L27,35" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
