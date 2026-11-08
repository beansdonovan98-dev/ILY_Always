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
    { angle: 0, scale: 0.7 },
    { angle: 22, scale: 0.62 },
    { angle: -22, scale: 0.62 },
    { angle: 45, scale: 0.5 },
    { angle: -45, scale: 0.5 },
    { angle: 68, scale: 0.36 },
    { angle: -68, scale: 0.36 },
  ];

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      <G transform="translate(12, 23)">
        {leaflets.map((leaf, i) => (
          <G key={i} transform={`rotate(${leaf.angle}) scale(${leaf.scale})`}>
            {/* Broad lanceolate leaflet: wide middle, pointed tip, serrated edges. */}
            <Path
              d={LEAFLET}
              fill={color}
              opacity={opacity}
              stroke={color}
              strokeWidth={0.2}
            />
            {/* Centre vein + side veins */}
            <Path d="M0,0 L0,-16" stroke="#000000" strokeOpacity={0.22} strokeWidth={0.4} />
            <Path d="M0,-4 L-1.6,-6.2 M0,-4 L1.6,-6.2 M0,-8 L-1.4,-10.4 M0,-8 L1.4,-10.4 M0,-12 L-1,-14 M0,-12 L1,-14" stroke="#000000" strokeOpacity={0.15} strokeWidth={0.3} />
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

/**
 * A realistic cannabis plant: main stem with lateral branches, serrated
 * 7-leaflet fan leaves at the nodes, and a stacked top cola plus side
 * buds — bracts with centre veins, orange pistils and frosted trichomes.
 * Drawn as smooth vector paths (no blocky/stencil shapes).
 */
const LEAFLET =
  'M0,0 L-2.2,-3.2 L-1.4,-4.2 L-2.8,-6.4 L-1.5,-7.6 L-2.9,-10 L-1.3,-11.2 L-1.2,-13.8 L0,-17 L1.2,-13.8 L1.3,-11.2 L2.9,-10 L1.5,-7.6 L2.8,-6.4 L1.4,-4.2 L2.2,-3.2 Z';

const FAN_ANGLES = [0, 24, -24, 48, -48, 70, -70];
const FAN_SCALES = [0.68, 0.58, 0.58, 0.46, 0.46, 0.34, 0.34];

export function FanLeaf({ x, y, s = 1, rot = 0, color, opacity = 1 }: {
  x: number; y: number; s?: number; rot?: number; color: string; opacity?: number;
}) {
  return (
    <G transform={`translate(${x},${y}) rotate(${rot}) scale(${s})`}>
      {FAN_ANGLES.map((a, i) => (
        <G key={i} transform={`rotate(${a}) scale(${FAN_SCALES[i]})`}>
          <Path d={LEAFLET} fill={color} opacity={opacity} stroke={color} strokeWidth={0.2} />
          <Path d="M0,0 L0,-16" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={0.5} strokeLinecap="round" />
          <Path d="M0,-4 L-1.6,-6.2 M0,-4 L1.6,-6.2 M0,-8 L-1.4,-10.4 M0,-8 L1.4,-10.4 M0,-12 L-1,-14 M0,-12 L1,-14" stroke="#000000" strokeOpacity={0.15} strokeWidth={0.3} />
        </G>
      ))}
      <Path d="M0,0 L0,2" stroke={color} strokeOpacity={opacity} strokeWidth={0.7} />
    </G>
  );
}

function BudBract({ x, y, s = 1, rot = 0, bud, leaf, pistil }: {
  x: number; y: number; s?: number; rot?: number; bud: string; leaf: string; pistil: string;
}) {
  return (
    <G transform={`translate(${x},${y}) rotate(${rot}) scale(${s})`}>
      {/* bract */}
      <Path d="M0,0 C-6,-6 -8,-16 0,-24 C8,-16 6,-6 0,0 Z" fill={bud} opacity={0.92} />
      {/* calyx shade */}
      <Path d="M0,-24 C2,-16 2,-8 0,0 C-2,-8 -2,-16 0,-24 Z" fill={leaf} opacity={0.35} />
      {/* centre vein */}
      <Path d="M0,0 L0,-22" stroke="#0B1F12" strokeOpacity={0.35} strokeWidth={0.5} />
      {/* pistils */}
      <Path d="M0,-20 C-4,-26 -8,-28 -12,-29" stroke={pistil} strokeWidth={0.9} fill="none" strokeLinecap="round" opacity={0} />
      <Path d="M0,-22 C4,-27 7,-30 10,-32" stroke={pistil} strokeWidth={0.9} fill="none" strokeLinecap="round" />
      <Path d="M0,-21 C-3,-27 -5,-30 -7,-33" stroke={pistil} strokeWidth={0.9} fill="none" strokeLinecap="round" />
      {/* trichome frost */}
      <Ellipse cx={-2} cy={-14} rx={0.9} ry={1.6} fill="#FFFFFF" opacity={0.55} />
      <Ellipse cx={2.4} cy={-10} rx={0.8} ry={1.4} fill="#FFFFFF" opacity={0.45} />
      <Ellipse cx={0} cy={-6} rx={0.7} ry={1.2} fill="#FFFFFF" opacity={0.4} />
    </G>
  );
}

function Cola({ x, y, s = 1, bud, leaf, pistil }: {
  x: number; y: number; s?: number; bud: string; leaf: string; pistil: string;
}) {
  // stacked bracts forming a dense top cola
  const bracts = [
    { dy: 0, rot: -28, s: 0.9 },
    { dy: 0, rot: 28, s: 0.9 },
    { dy: -9, rot: -18, s: 1 },
    { dy: -9, rot: 18, s: 1 },
    { dy: -18, rot: -10, s: 1 },
    { dy: -18, rot: 10, s: 1 },
    { dy: -27, rot: 0, s: 1 },
    { dy: -34, rot: 0, s: 0.92 },
  ];
  return (
    <G transform={`translate(${x},${y}) scale(${s})`}>
      {bracts.map((b, i) => (
        <BudBract key={i} x={0} y={b.dy} rot={b.rot} s={b.s} bud={bud} leaf={leaf} pistil={pistil} />
      ))}
    </G>
  );
}

export function WeedPlant({ height = 80, color = '#2E7D32', budColor = '#7B1FA2', opacity = 0.9 }: {
  height?: number;
  color?: string;
  budColor?: string;
  opacity?: number;
}) {
  const w = height * 0.75;
  const pistil = '#E8842B';
  return (
    <Svg width={w} height={height} viewBox="0 0 120 160" style={{ opacity }}>
      {/* lateral branches */}
      <Path d="M60,150 C58,120 58,96 60,66" stroke={color} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <Path d="M60,124 C48,114 38,104 32,94" stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <Path d="M60,124 C72,114 82,104 88,94" stroke={color} strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <Path d="M60,100 C50,92 42,84 37,76" stroke={color} strokeWidth={1.4} fill="none" strokeLinecap="round" />
      <Path d="M60,100 C70,92 78,84 83,76" stroke={color} strokeWidth={1.4} fill="none" strokeLinecap="round" />
      <Path d="M60,80 C52,72 47,64 44,56" stroke={color} strokeWidth={1.3} fill="none" strokeLinecap="round" />
      <Path d="M60,80 C68,72 73,64 76,56" stroke={color} strokeWidth={1.3} fill="none" strokeLinecap="round" />

      {/* fan leaves at lower nodes */}
      <FanLeaf x={32} y={94} s={1.1} rot={-40} color={color} />
      <FanLeaf x={88} y={94} s={1.1} rot={40} color={color} />
      <FanLeaf x={37} y={76} s={0.9} rot={-30} color={color} opacity={0.9} />
      <FanLeaf x={83} y={76} s={0.9} rot={30} color={color} opacity={0.9} />
      <FanLeaf x={44} y={58} s={0.75} rot={-20} color={color} opacity={0.8} />
      <FanLeaf x={76} y={58} s={0.75} rot={20} color={color} opacity={0.8} />

      {/* side buds on branch tips */}
      <Cola x={30} y={96} s={0.38} bud={budColor} leaf={color} pistil={pistil} />
      <Cola x={90} y={96} s={0.38} bud={budColor} leaf={color} pistil={pistil} />
      <Cola x={35} y={78} s={0.32} bud={budColor} leaf={color} pistil={pistil} />
      <Cola x={85} y={78} s={0.32} bud={budColor} leaf={color} pistil={pistil} />
      <Cola x={42} y={58} s={0.28} bud={budColor} leaf={color} pistil={pistil} />
      <Cola x={78} y={58} s={0.28} bud={budColor} leaf={color} pistil={pistil} />

      {/* sugar leaves around the top cola */}
      <FanLeaf x={47} y={66} s={0.7} rot={-24} color={color} opacity={0.85} />
      <FanLeaf x={73} y={66} s={0.7} rot={24} color={color} opacity={0.85} />

      {/* main top cola */}
      <Cola x={60} y={74} s={0.62} bud={budColor} leaf={color} pistil={pistil} />

      {/* soil line */}
      <Path d="M28,152 L92,152" stroke={color} strokeWidth={1.6} opacity={0.5} strokeLinecap="round" />
    </Svg>
  );
}

/** A soft smoke puff: a cloud of overlapping translucent billows. */
export function SmokePuff({ size = 60, color = '#CBD5E1', opacity = 0.16 }: {
  size?: number;
  color?: string;
  opacity?: number;
}) {
  const w = size * 1.7;
  // billow circles: cx, cy, r, alpha multiplier
  const billows: Array<[number, number, number, number]> = [
    [26, 38, 13, 0.5],
    [40, 26, 16, 0.65],
    [58, 20, 20, 0.8],
    [76, 26, 15, 0.7],
    [90, 36, 12, 0.5],
    [50, 38, 15, 0.45],
    [66, 38, 14, 0.5],
    [32, 48, 10, 0.35],
    [84, 48, 9, 0.35],
    [58, 46, 16, 0.4],
  ];
  return (
    <Svg width={w} height={size} viewBox="0 0 110 68" style={{ opacity }}>
      {billows.map(([cx, cy, r, a], i) => (
        <Ellipse key={i} cx={cx} cy={cy} rx={r * 1.6} ry={r} fill={color} opacity={a} />
      ))}
      {/* brighter core billow */}
      <Ellipse cx={58} cy={28} rx={24} ry={14} fill="#FFFFFF" opacity={0.18} />
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
