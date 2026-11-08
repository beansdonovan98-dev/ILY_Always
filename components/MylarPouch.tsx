import { useState } from 'react';
import { DeviceEventEmitter, Pressable, ScrollView, StyleSheet, TextInput, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText as Text } from '@/components/AppText';
import { useAppTheme } from '@/hooks/useAppTheme';
import { SMOKE_BURST_EVENT } from '@/components/CannabisOverlay';

/**
 * Pastel & Matte Boutique Mylar Stash Bag.
 * Top ziplock strip (tear notches + editable strain header) -> foil-trimmed
 * boutique sticker label -> stamped metadata footer (official bottom line).
 */
export function MylarPouch({ title, hint, defaultStrain, stampRight, children, style }: {
  title: React.ReactNode;
  hint?: string;
  defaultStrain?: string;
  stampRight?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const theme = useAppTheme();
  const tokens = theme.tokens;
  const font = theme.fontFamily;
  const pouchBg = tokens?.cardBg ?? theme.cardStyle.backgroundColor;
  const pouchBorder = tokens?.cardBorder ?? theme.borderColor;
  const foilColors = [tokens?.ember ?? '#F59E0B', theme.accentColor, tokens?.smoke ?? '#D8B4FE'];
  const [strain, setStrain] = useState(defaultStrain ?? '');
  const [editing, setEditing] = useState(false);

  return (
    <View
      style={[
        {
          backgroundColor: pouchBg,
          borderWidth: 2,
          borderColor: pouchBorder,
          borderRadius: 22,
          borderBottomLeftRadius: 44,
          borderBottomRightRadius: 44,
          shadowColor: '#000',
          shadowOpacity: 0.68,
          shadowRadius: 45,
          shadowOffset: { width: 0, height: 20 },
          elevation: 16,
          overflow: 'hidden',
          marginBottom: 36,
          maxHeight: 760,
          flexDirection: 'column',
        },
        style,
      ]}>
      {/* inset foil reflections */}
      <View pointerEvents="none" style={[styles.reflectionLeft, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />
      <View pointerEvents="none" style={[styles.reflectionRight, { backgroundColor: 'rgba(0,0,0,0.18)' }]} />

      {/* zipper header strip */}
      <View style={[styles.strip, { backgroundColor: 'rgba(0,0,0,0.25)', borderBottomColor: 'rgba(255,255,255,0.25)' }]}>
        <View style={[styles.notchLeft, { backgroundColor: tokens?.bgDeep ?? '#1A0B2E' }]} />
        {editing ? (
          <TextInput
            value={strain}
            onChangeText={setStrain}
            onBlur={() => setEditing(false)}
            onSubmitEditing={() => setEditing(false)}
            autoFocus
            style={[styles.strainInput, { fontFamily: font, color: theme.textColor, borderColor: theme.subtitleColor }]}
          />
        ) : (
          <Pressable onPress={() => setEditing(true)} style={[styles.strainPill, { borderColor: theme.subtitleColor }]}>
            <Text style={[styles.strainText, { fontFamily: font, color: theme.textColor }]}>{strain || 'EDIT STRAIN'}</Text>
          </Pressable>
        )}
        <Pressable onPress={() => DeviceEventEmitter.emit(SMOKE_BURST_EVENT)}>
          <Text style={[styles.zipHint, { fontFamily: font, color: theme.subtitleColor }]}>🔒 PRESS-TO-SEAL ZIPPER</Text>
        </Pressable>
        <View style={[styles.notchRight, { backgroundColor: tokens?.bgDeep ?? '#1A0B2E' }]} />
      </View>

      {/* boutique sticker with foil trim — height-locked & scrollable (max-height 760) */}
      <View style={styles.foilWrap}>
        <LinearGradient colors={[foilColors[0], foilColors[1], '#E2E8F0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.foilMid}>
          <ScrollView style={styles.labelWindow} showsVerticalScrollIndicator contentContainerStyle={{ gap: 6 }}>
            <View style={styles.badgeRow}>
              <Text style={styles.badgeSmall}>PREMIUM RESERVE</Text>
              <Text style={styles.badgeSmall}>LAB TESTED</Text>
            </View>
            <View style={{ marginBottom: 6 }}>{title}</View>
            {hint ? <Text style={{ fontFamily: font, color: '#52525b', fontSize: 13, marginBottom: 10, fontStyle: 'italic' as const }}>{hint}</Text> : null}
            {children}
          </ScrollView>
        </LinearGradient>
      </View>

      {/* stamped footer */}
      <View style={[styles.stamps]}>
        <Text style={[styles.prop65, { fontFamily: font, color: theme.textColor, borderColor: theme.subtitleColor }]}>
          ⚠️ CA PROP 65{'\n'}COMPLIANT
        </Text>
        <Text style={[styles.stamp, { fontFamily: font, color: theme.textColor }]}>3.5G INDOOR FLOWER</Text>
        <Text style={[styles.stamp, { fontFamily: font, color: theme.textColor }]}>{stampRight || 'THC: ' + (18 + (foilColors[0].length % 12)) + '.5%'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  reflectionLeft: { position: 'absolute', left: -40, top: 0, bottom: 0, width: 90, transform: [{ rotate: '8deg' }] },
  reflectionRight: { position: 'absolute', right: -40, top: 0, bottom: 0, width: 110, transform: [{ rotate: '-8deg' }] },
  strip: {
    height: 44, borderBottomWidth: 2, borderStyle: 'dashed',
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, position: 'relative',
  },
  notchLeft: { position: 'absolute', top: -2, left: 14, width: 9, height: 13, borderRadius: 6 },
  notchRight: { position: 'absolute', top: -2, right: 14, width: 9, height: 13, borderRadius: 6 },
  zipHint: { fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '700' },
  strainPill: {
    backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderRadius: 6,
    paddingVertical: 4, paddingHorizontal: 8, minWidth: 120, alignItems: 'flex-start',
  },
  strainText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  strainInput: {
    backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderRadius: 6,
    paddingVertical: 4, paddingHorizontal: 8, minWidth: 120, fontSize: 11,
    fontWeight: '800', textTransform: 'uppercase', textAlign: 'left',
  },
  foilWrap: { padding: 2.5, borderRadius: 16, margin: 14, backgroundColor: '#F59E0B' },
  foilMid: { borderRadius: 14, padding: 2, backgroundColor: '#A855F7' },
  labelWindow: { backgroundColor: '#FDFBF7', borderRadius: 12, padding: 14, maxHeight: 620 },
  badgeRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: '#e4e4e7', paddingBottom: 6, marginBottom: 6,
  },
  badgeSmall: { fontSize: 10, letterSpacing: 1, color: '#71717a', fontWeight: '700', textTransform: 'uppercase' },
  stamps: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingHorizontal: 16, paddingBottom: 14, paddingTop: 2,
  },
  prop65: { fontSize: 9, lineHeight: 11, textAlign: 'center', borderWidth: 1, borderRadius: 4, padding: 3, overflow: 'hidden' },
  stamp: { fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase', fontWeight: '700' },
  foilSmoke: { height: 2.5 },
});
