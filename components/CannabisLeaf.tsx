import { View, ViewStyle } from 'react-native';
import Svg, { Ellipse, G, Path } from 'react-native-svg';

interface CannabisLeafProps {
  size?: number;
  color?: string;
  opacity?: number;
  style?: ViewStyle;
}

/**
 * Seven-leaflet cannabis leaf with serrated leaflets (saw-tooth edges),
 * like a real fan leaf. Drawn as SVG so it stays crisp and can follow
 * the couple's accent colour.
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
            {/* Serrated leaflet: saw-tooth outline with a central vein. */}
            <Path
              d="M0,0 L-1.5,-2.4 L-0.9,-3.1 L-1.8,-4.6 L-1.1,-5.3 L-1.8,-6.9 L-1,-7.6 L-1.4,-9.2 L-0.4,-9.8 L0,-11.5 L0.4,-9.8 L1.4,-9.2 L1,-7.6 L1.8,-6.9 L1.1,-5.3 L1.8,-4.6 L0.9,-3.1 L1.5,-2.4 Z"
              fill={color}
              opacity={opacity}
            />
            <Path
              d="M0,0 L0,-11"
              stroke={color}
              strokeOpacity={opacity}
              strokeWidth={0.35}
            />
          </G>
        ))}
        {/* stem to the leaflets */}
        <Path d="M0,0 L0,1" stroke={color} strokeOpacity={opacity} strokeWidth={0.8} />
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
      {/* top fan leaves — no bud, just leaves like a wild plant */}
      <G transform="translate(30,28)">
        <G transform="rotate(-18)"><Path d="M0,0 C-1.9,-6 -1.6,-13 0,-20 C1.6,-13 1.9,-6 0,0 Z" fill={color} /></G>
        <G transform="rotate(18)"><Path d="M0,0 C-1.9,-6 -1.6,-13 0,-20 C1.6,-13 1.9,-6 0,0 Z" fill={color} /></G>
        <G><Path d="M0,0 C-2.1,-7 -1.9,-15 0,-24 C1.9,-15 2.1,-7 0,0 Z" fill={color} /></G>
      </G>
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

/** A bong silhouette — dome base, water chamber, angled mouthpiece and bowl. */
export function BongSprite({ size = 90, color = '#2E7D32', opacity = 0.16 }: {
  size?: number;
  color?: string;
  opacity?: number;
}) {
  const w = size * 0.5;
  return (
    <Svg width={w} height={size} viewBox="0 0 36 72" style={{ opacity }}>
      {/* bowl */}
      <Path d="M15,2 L21,2 L20,8 L16,8 Z" fill={color} />
      {/* straight neck */}
      <Path d="M14,8 L22,8 L21,30 L15,30 Z" fill={color} />
      {/* angled mouthpiece */}
      <Path d="M19,10 C24,14 27,19 29,24" stroke={color} strokeWidth={3.4} fill="none" strokeLinecap="round" />
      {/* downstem */}
      <Path d="M19,28 L13,52" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      {/* chamber */}
      <Ellipse cx={18} cy={52} rx={12} ry={15} fill={color} />
      {/* water shine */}
      <Ellipse cx={14} cy={48} rx={3.4} ry={6} fill="#FFFFFF" opacity={0.35} transform="rotate(-12 14 48)" />
      {/* foot */}
      <Ellipse cx={18} cy={65} rx={13} ry={4.6} fill={color} />
    </Svg>
  );
}
