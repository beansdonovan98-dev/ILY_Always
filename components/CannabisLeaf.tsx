import { View, ViewStyle } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

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

/** Leaf clusters on the top corners, with a few small leaves trailing along the top edge. */
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
