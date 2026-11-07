import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Polyline, Stop, Text as SvgText } from 'react-native-svg';

import { AppText as Text } from '@/components/AppText';

export interface ChartPoint {
  id: string;
  value: number;
  label: string;
}

interface WeightChartProps {
  data: ChartPoint[];
  accentColor: string;
  textColor: string;
}

const HEIGHT = 190;
const PAD = { top: 18, right: 14, bottom: 26, left: 34 };

export function WeightChart({ data, accentColor, textColor }: WeightChartProps) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No weight logged yet. Add your first entry to start the trend 💫</Text>
      </View>
    );
  }

  const values = data.map((d) => d.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = rawMax - rawMin || Math.max(rawMax * 0.04, 1);
  const lo = rawMin - span * 0.2;
  const hi = rawMax + span * 0.2;

  const chartW = Math.max(width - PAD.left - PAD.right, 1);
  const chartH = HEIGHT - PAD.top - PAD.bottom;

  const x = (i: number) => PAD.left + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW);
  const y = (v: number) => PAD.top + chartH - ((v - lo) / (hi - lo)) * chartH;

  const points = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  const baseline = PAD.top + chartH;
  const areaPath = data.length > 1
    ? `M ${x(0)},${baseline} L ${data.map((d, i) => `${x(i)},${y(d.value)}`).join(' L ')} L ${x(data.length - 1)},${baseline} Z`
    : '';

  const format = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  const active = selected === null ? null : data[selected];

  return (
    <View>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={styles.wrap}>
        {width > 0 && (
          <Svg width={width} height={HEIGHT}>
            <Defs>
              <SvgGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={accentColor} stopOpacity={0.35} />
                <Stop offset="1" stopColor={accentColor} stopOpacity={0.02} />
              </SvgGradient>
            </Defs>

            {[0, 0.5, 1].map((f) => (
              <Path
                key={f}
                d={`M ${PAD.left} ${PAD.top + chartH * f} L ${PAD.left + chartW} ${PAD.top + chartH * f}`}
                stroke={textColor}
                strokeOpacity={0.12}
                strokeWidth={1}
              />
            ))}

            <SvgText x={4} y={PAD.top + 4} fontSize={9} fill={textColor} opacity={0.55}>
              {format(Math.round(hi))}
            </SvgText>
            <SvgText x={4} y={baseline} fontSize={9} fill={textColor} opacity={0.55}>
              {format(Math.round(lo))}
            </SvgText>

            {areaPath ? <Path d={areaPath} fill="url(#weightFill)" /> : null}

            {data.length > 1 && (
              <Polyline points={points} fill="none" stroke={accentColor} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
            )}

            {data.map((d, i) => (
              <Circle
                key={d.id}
                cx={x(i)}
                cy={y(d.value)}
                r={selected === i ? 7 : 5}
                fill={selected === i ? accentColor : '#FFFFFF'}
                stroke={accentColor}
                strokeWidth={2.5}
                onPress={() => setSelected(selected === i ? null : i)}
              />
            ))}

            <SvgText x={PAD.left} y={HEIGHT - 8} fontSize={9} fill={textColor} opacity={0.55}>
              {data[0].label}
            </SvgText>
            {data.length > 1 && (
              <SvgText x={PAD.left + chartW} y={HEIGHT - 8} fontSize={9} fill={textColor} opacity={0.55} textAnchor="end">
                {data[data.length - 1].label}
              </SvgText>
            )}
          </Svg>
        )}
      </View>

      <Text style={styles.caption}>
        {active ? `${active.label} • ${format(active.value)} — tap a dot to close` : 'Tap any dot to see that day’s weight'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', height: HEIGHT },
  empty: { paddingVertical: 18 },
  emptyText: { fontSize: 14, opacity: 0.65, textAlign: 'center' },
  caption: { fontSize: 12, opacity: 0.6, textAlign: 'center', marginTop: 4 },
});

export default WeightChart;
