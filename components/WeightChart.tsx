import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient as SvgGradient, Path, Polyline, Stop, Text as SvgText } from 'react-native-svg';

import { AppText as Text } from '@/components/AppText';

export interface ChartPoint {
  id: string;
  value: number;
  label: string;
}

export interface ChartSeries {
  id: string;
  label: string;
  color: string;
  data: ChartPoint[];
}

interface WeightChartProps {
  /** One or more overlaid series (His + Hers trend lines). */
  series: ChartSeries[];
  textColor: string;
}

const HEIGHT = 200;
const PAD = { top: 18, right: 14, bottom: 26, left: 38, legend: 20 };

export function WeightChart({ series, textColor }: WeightChartProps) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<{ series: number; index: number } | null>(null);

  const activeSeries = useMemo(() => series.filter((s) => s.data.length > 0), [series]);
  const totalPoints = activeSeries.reduce((sum, s) => sum + s.data.length, 0);

  if (totalPoints === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No weight logged yet. Add your first entry to start the trend 💫</Text>
      </View>
    );
  }

  const allValues = activeSeries.flatMap((s) => s.data.map((d) => d.value));
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const span = rawMax - rawMin || Math.max(rawMax * 0.04, 1);
  const lo = rawMin - span * 0.25;
  const hi = rawMax + span * 0.25;

  const chartW = Math.max(width - PAD.left - PAD.right, 1);
  const chartH = HEIGHT - PAD.top - PAD.bottom - PAD.legend;

  const xFor = (seriesIndex: number, i: number) => {
    const count = activeSeries[seriesIndex].data.length;
    return PAD.left + (count === 1 ? chartW / 2 : (i / (count - 1)) * chartW);
  };
  const y = (v: number) => PAD.top + chartH - ((v - lo) / (hi - lo)) * chartH;
  const baseline = PAD.top + chartH;

  const format = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  const firstLabel = activeSeries[0]?.data[0]?.label;
  const lastLabel = activeSeries[activeSeries.length - 1]?.data.at(-1)?.label;
  const activePoint =
    selected !== null ? activeSeries[selected.series]?.data[selected.index] : undefined;

  return (
    <View>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={styles.wrap}>
        {width > 0 && (
          <Svg width={width} height={HEIGHT}>
            <Defs>
              {activeSeries.map((s, si) => (
                <SvgGradient key={si} id={`fill${si}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={s.color} stopOpacity={0.3} />
                  <Stop offset="1" stopColor={s.color} stopOpacity={0.02} />
                </SvgGradient>
              ))}
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

            {activeSeries.map((s, si) => {
              const points = s.data.map((d, i) => `${xFor(si, i)},${y(d.value)}`).join(' ');
              const areaPath =
                s.data.length > 1
                  ? `M ${xFor(si, 0)},${baseline} L ${s.data.map((d, i) => `${xFor(si, i)},${y(d.value)}`).join(' L ')} L ${xFor(si, s.data.length - 1)},${baseline} Z`
                  : '';
              return (
                <G key={si}>
                  {areaPath ? <Path d={areaPath} fill={`url(#fill${si})`} /> : null}
                  {s.data.length > 1 ? (
                    <Polyline
                      points={points}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={3}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  ) : null}
                  {s.data.map((d, i) => (
                    <Circle
                      key={d.id}
                      cx={xFor(si, i)}
                      cy={y(d.value)}
                      r={selected?.series === si && selected.index === i ? 7 : 5}
                      fill={selected?.series === si && selected.index === i ? s.color : '#FFFFFF'}
                      stroke={s.color}
                      strokeWidth={2.5}
                      onPress={() =>
                        setSelected(
                          selected?.series === si && selected.index === i ? null : { series: si, index: i }
                        )
                      }
                    />
                  ))}
                </G>
              );
            })}

            {activeSeries.map((s, si) => (
              <SvgText key={si} x={PAD.left + si * 92} y={HEIGHT - 8} fontSize={10} fill={s.color} fontWeight="bold">
                {s.label}
              </SvgText>
            ))}

            {firstLabel ? (
              <SvgText x={PAD.left} y={PAD.top + chartH + 14} fontSize={9} fill={textColor} opacity={0.55}>
                {firstLabel}
              </SvgText>
            ) : null}
            {lastLabel ? (
              <SvgText
                x={PAD.left + chartW}
                y={PAD.top + chartH + 14}
                fontSize={9}
                fill={textColor}
                opacity={0.55}
                textAnchor="end">
                {lastLabel}
              </SvgText>
            ) : null}
          </Svg>
        )}
      </View>

      <Text style={styles.caption}>
        {activePoint
          ? `${activePoint.label} • ${format(activePoint.value)} lbs — tap a dot to close`
          : 'Tap any dot to see that day\u2019s weight'}
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
