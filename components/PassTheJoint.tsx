import { useEffect, useRef, useState } from 'react';
import { Animated, DeviceEventEmitter, Dimensions, Easing, Pressable, StyleSheet, View } from 'react-native';
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
  const flight = useRef(new Animated.Value(0)).current;
  const trail = useRef(Array.from({ length: 6 }, () => new Animated.Value(0))).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, []);

  const later = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const pass = async () => {
    setFlying(true);
    setStatus('Lighting it up…');
    flight.setValue(0);
    trail.forEach((v) => v.setValue(0));

    Animated.timing(flight, {
      toValue: 1,
      duration: 1600,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    }).start();

    // glowing ember trail behind the joint
    trail.forEach((v, i) => {
      Animated.sequence([
        Animated.delay(i * 140),
        Animated.timing(v, { toValue: 1, duration: 820, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
    });

    void bongHaptic();
    DeviceEventEmitter.emit(SMOKE_BURST_EVENT);

    later(360, () => DeviceEventEmitter.emit(SMOKE_BURST_EVENT));
    later(820, () => {
      DeviceEventEmitter.emit(SMOKE_BURST_EVENT);
      setStatus(currentUser === 'daddy' ? 'Passing it to her 🔥' : 'Passing it to him 🔥');
    });
    later(1280, () => DeviceEventEmitter.emit(SMOKE_BURST_EVENT));
    later(1650, () => {
      setFlying(false);
      setStatus(currentUser === 'daddy' ? 'She’s got it — enjoy, gorgeous 💋' : 'He’s got it — enjoy, gorgeous 💋');
    });
    later(4300, () => setStatus(''));

    const cid = await getCoupleId();
    void notifyPartner(cid, currentUser, 'joint');
  };

  const screenWidth = Dimensions.get('window').width;
  const translateX = flight.interpolate({
    inputRange: [0, 1],
    outputRange: [-130, screenWidth + 130],
  });
  const translateY = flight.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -110, 6],
  });
  const rotate = flight.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['0deg', '-26deg', '18deg'],
  });
  const scale = flight.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.9, 1.18, 0.95],
  });
  const glow = flight.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.25, 0.9, 0.2],
  });

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={pass}
        disabled={flying}
        style={[styles.btn, theme.buttonStyle, flying && { opacity: 0.85 }]}>
        <View style={styles.jointWrap}>
          <JointVector size={44} />
          <Animated.View pointerEvents="none" style={[styles.ember, { opacity: glow }]} />
        </View>
        <Text style={[styles.text, { color: theme.textColor }]}>{flying ? 'Passing…' : 'Pass the Joint'}</Text>
      </Pressable>
      {status ? <Text style={[styles.status, { color: theme.textColor }]}>{status}</Text> : null}

      {flying && (
        <View pointerEvents="none" style={styles.stage}>
          {trail.map((v, i) => {
            const tx = v.interpolate({ inputRange: [0, 1], outputRange: [-40, screenWidth + 40] });
            const ty = v.interpolate({ inputRange: [0, 1], outputRange: [0, -40 - i * 6] });
            const op = v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.8, 0] });
            const sc = v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.6] });
            return (
              <Animated.View
                key={i}
                style={[styles.trailPuff, { opacity: op, transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }] }]}
              />
            );
          })}
          <Animated.View style={[styles.flight, { transform: [{ translateX }, { translateY }, { rotate }, { scale }] }]}>
            <JointVector size={104} />
            <Animated.View pointerEvents="none" style={[styles.emberBig, { opacity: glow }]} />
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999 },
  jointWrap: { alignItems: 'center', justifyContent: 'center' },
  ember: {
    position: 'absolute',
    right: 2,
    bottom: 6,
    width: 9,
    height: 9,
    borderRadius: 9,
    backgroundColor: '#FF7A18',
    shadowColor: '#FF4D00',
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  text: { fontWeight: '800', fontSize: 13 },
  status: { marginTop: 6, fontWeight: '700', fontSize: 12, textAlign: 'center' },
  stage: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 999, elevation: 999 },
  flight: { position: 'absolute', left: 0, top: 210 },
  emberBig: {
    position: 'absolute',
    right: 6,
    bottom: 14,
    width: 18,
    height: 18,
    borderRadius: 18,
    backgroundColor: '#FF8A1F',
    shadowColor: '#FF3D00',
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  trailPuff: {
    position: 'absolute',
    left: 0,
    top: 250,
    width: 26,
    height: 26,
    borderRadius: 26,
    backgroundColor: 'rgba(214,220,232,0.55)',
    shadowColor: '#E2E8F0',
    shadowOpacity: 0.8,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
});
