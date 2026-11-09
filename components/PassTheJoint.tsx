import { useEffect, useState } from 'react';
import { DeviceEventEmitter, Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { JointVector } from '@/components/CannabisHardware';
import { SMOKE_BURST_EVENT } from '@/components/CannabisOverlay';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useUsage } from '@/contexts/UsageContext';
import { getCoupleId } from '@/lib/couple';
import { notifyPartner } from '@/lib/push';
import { bongHaptic } from '@/components/CannabisFeatures';

export { JointVector };

export function PassTheJoint() {
  const theme = useAppTheme();
  const { currentUser } = useUsage();
  const [flying, setFlying] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!flying) return;
    const t = setTimeout(() => setFlying(false), 1400);
    return () => clearTimeout(t);
  }, [flying]);

  const pass = async () => {
    setFlying(true);
    DeviceEventEmitter.emit(SMOKE_BURST_EVENT);
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
      {flying && (
        <View pointerEvents="none" style={styles.flight}>
          <JointVector size={90} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999 },
  text: { fontWeight: '800', fontSize: 13 },
  flight: {
    position: 'absolute',
    left: 0,
    top: 100,
    zIndex: 999,
    elevation: 999,
    transform: [{ translateX: 120 }, { translateY: -60 }, { rotate: '20deg' }],
  },
});
