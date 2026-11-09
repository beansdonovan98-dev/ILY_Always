import { useEffect, useRef, useState } from 'react';
import { Animated, DeviceEventEmitter, Dimensions, Pressable, StyleSheet, View } from 'react-native';
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
  const flightX = useRef(new Animated.Value(-110)).current;

  useEffect(() => {
    if (!flying) return;
    const screenWidth = Dimensions.get('window').width;
    flightX.setValue(-110);
    const animation = Animated.timing(flightX, {
      toValue: screenWidth + 110,
      duration: 1400,
      useNativeDriver: true,
    });
    animation.start();
    const t = setTimeout(() => setFlying(false), 1400);
    return () => {
      animation.stop();
      clearTimeout(t);
    };
  }, [flying, flightX]);

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
        <Animated.View pointerEvents="none" style={[styles.flight, { transform: [{ translateX: flightX }, { rotate: '20deg' }] }]}>
          <JointVector size={90} />
        </Animated.View>
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
    top: 240,
    zIndex: 999,
    elevation: 999,
  },
});
