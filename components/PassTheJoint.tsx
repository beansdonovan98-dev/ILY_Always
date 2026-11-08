import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { JointVector } from '@/components/CannabisHardware';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useUsage } from '@/contexts/UsageContext';
import { getCoupleId } from '@/lib/couple';
import { notifyPartner } from '@/lib/push';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { bongHaptic } from '@/components/CannabisFeatures';

export { JointVector };

/** Flying joint that arcs across the screen when someone passes it. */
function FlyingJoint({ run, onDone }: { run: number; onDone: () => void }) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const opacity = useSharedValue(0);
  useEffect(() => {
    if (!run) return;
    opacity.value = 1;
    x.value = withTiming(360, { duration: 1400 }, () => {
      opacity.value = 0;
      onDone();
    });
    y.value = withTiming(-140, { duration: 1400 });
  }, [run, x, y, opacity, onDone]);
  const style = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: 0,
    top: 240,
    transform: [{ translateX: x.value }, { translateY: y.value }, { rotate: `${(x.value / 360) * 360}deg` }],
    opacity: opacity.value,
  }));
  if (!run) return null;
  return (
    <Animated.View pointerEvents="none" style={style}>
      <JointVector size={90} />
    </Animated.View>
  );
}

export function PassTheJoint() {
  const theme = useAppTheme();
  const { currentUser } = useUsage();
  const [run, setRun] = useState(0);
  const [status, setStatus] = useState('');

  const pass = async () => {
    setRun((r) => r + 1);
    void bongHaptic();
    const cid = await getCoupleId();
    void notifyPartner(cid, currentUser, 'joint');
    setStatus('Passed 🔥');
    setTimeout(() => setStatus(''), 1800);
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <Pressable onPress={pass} style={[styles.btn, theme.buttonStyle]}>
        <JointVector size={44} />
        <Text style={[styles.text, { color: theme.textColor }]}>Pass the Joint</Text>
      </Pressable>
      {status ? <Text style={{ color: theme.textColor, marginTop: 4, fontWeight: '700' }}>{status}</Text> : null}
      <FlyingJoint run={run} onDone={() => {}} />
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999 },
  text: { fontWeight: '800', fontSize: 13 },
});
