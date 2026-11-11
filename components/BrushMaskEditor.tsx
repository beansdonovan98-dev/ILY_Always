import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Svg, Circle, Path } from 'react-native-svg';

import { AppText as Text } from '@/components/AppText';
import { useAppFont } from '@/hooks/useAppFont';
import { useAppTheme } from '@/hooks/useAppTheme';
import type { BrushStroke } from '@/lib/aiImage';

const BRUSH_SIZES = [0.025, 0.04, 0.06, 0.085];

type Props = {
  visible: boolean;
  imageUri: string;
  targetLabel: string;
  initialStrokes: BrushStroke[];
  onCancel: () => void;
  onSave: (strokes: BrushStroke[]) => void;
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function strokePath(stroke: BrushStroke, width: number, height: number) {
  return stroke.points
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x * width} ${y * height}`)
    .join(' ');
}

export default function BrushMaskEditor({
  visible,
  imageUri,
  targetLabel,
  initialStrokes,
  onCancel,
  onSave,
}: Props) {
  const font = useAppFont();
  const theme = useAppTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [imageSize, setImageSize] = useState<{ width: number; height: number }>({
    width: 3,
    height: 4,
  });
  const [brushSize, setBrushSize] = useState(BRUSH_SIZES[1]);
  const [strokes, setStrokes] = useState<BrushStroke[]>(initialStrokes);
  const [current, setCurrent] = useState<BrushStroke | null>(null);

  const brushRef = useRef(brushSize);
  const currentRef = useRef<BrushStroke | null>(null);
  const strokesRef = useRef<BrushStroke[]>(initialStrokes);
  const initialStrokesRef = useRef<BrushStroke[]>(initialStrokes);
  brushRef.current = brushSize;
  initialStrokesRef.current = initialStrokes;

  const display = useMemo(() => {
    const maxW = Math.max(180, windowWidth - 40);
    const maxH = Math.max(220, windowHeight * 0.55);
    const ratio = imageSize.width / Math.max(1, imageSize.height);
    let width = maxW;
    let height = width / ratio;
    if (height > maxH) {
      height = maxH;
      width = height * ratio;
    }
    return { width: Math.round(width), height: Math.round(height) };
  }, [imageSize, windowWidth, windowHeight]);

  useEffect(() => {
    if (!visible) return;
    const seed = initialStrokesRef.current;
    setStrokes(seed);
    strokesRef.current = seed;
    setCurrent(null);
    currentRef.current = null;
    // Only re-seed when the sheet opens, not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!visible || !imageUri) return;
    if (imageUri.startsWith('data:')) {
      setImageSize({ width: 3, height: 4 });
      return;
    }
    Image.getSize(
      imageUri,
      (width, height) => {
        if (width > 0 && height > 0) setImageSize({ width, height });
      },
      () => setImageSize({ width: 3, height: 4 })
    );
  }, [visible, imageUri]);

  const pointFromEvent = useCallback(
    (evt: { nativeEvent: { locationX?: number; locationY?: number } }) => {
      const x = Number(evt.nativeEvent.locationX);
      const y = Number(evt.nativeEvent.locationY);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      return [clamp01(x / display.width), clamp01(y / display.height)] as [number, number];
    },
    [display.width, display.height]
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (evt) => {
          const point = pointFromEvent(evt);
          if (!point) return;
          const stroke: BrushStroke = { points: [point], r: brushRef.current };
          currentRef.current = stroke;
          setCurrent(stroke);
        },
        onPanResponderMove: (evt) => {
          const point = pointFromEvent(evt);
          const stroke = currentRef.current;
          if (!point || !stroke) return;

          const last = stroke.points[stroke.points.length - 1];
          const dx = point[0] - last[0];
          const dy = point[1] - last[1];
          if (Math.hypot(dx, dy) < 0.003) return;

          const next: BrushStroke = { ...stroke, points: [...stroke.points, point] };
          currentRef.current = next;
          setCurrent(next);
        },
        onPanResponderRelease: () => {
          const stroke = currentRef.current;
          if (stroke) {
            const next = [...strokesRef.current, stroke];
            strokesRef.current = next;
            setStrokes(next);
          }
          currentRef.current = null;
          setCurrent(null);
        },
        onPanResponderTerminate: () => {
          const stroke = currentRef.current;
          if (stroke) {
            const next = [...strokesRef.current, stroke];
            strokesRef.current = next;
            setStrokes(next);
          }
          currentRef.current = null;
          setCurrent(null);
        },
      }),
    [pointFromEvent]
  );

  const undo = useCallback(() => {
    const next = strokesRef.current.slice(0, -1);
    strokesRef.current = next;
    setStrokes(next);
  }, []);

  const clear = useCallback(() => {
    strokesRef.current = [];
    setStrokes([]);
    setCurrent(null);
    currentRef.current = null;
  }, []);

  const allStrokes = current ? [...strokes, current] : strokes;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <View style={[styles.sheet, { borderColor: theme.borderColor }]}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { fontFamily: font, color: theme.textColor }]}>
                Paint the {targetLabel.toLowerCase()}
              </Text>
              <Text style={[styles.sub, { color: theme.subtitleColor }]}>
                Only the painted area gets changed. Pinch-free: drag with one finger.
              </Text>
            </View>
            <Pressable onPress={onCancel} style={[styles.close, { borderColor: theme.borderColor }]}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>

          <View
            style={[
              styles.canvas,
              { width: display.width, height: display.height, borderColor: theme.borderColor },
            ]}
            {...responder.panHandlers}>
            <Image
              source={{ uri: imageUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="contain"
            />
            <Svg
              pointerEvents="none"
              width={display.width}
              height={display.height}
              style={StyleSheet.absoluteFill}>
              {allStrokes.map((stroke, index) => {
                const width = Math.max(2, stroke.r * display.width * 2);
                if (stroke.points.length === 1) {
                  const [x, y] = stroke.points[0];
                  return (
                    <Circle
                      key={`dot-${index}`}
                      cx={x * display.width}
                      cy={y * display.height}
                      r={width / 2}
                      fill="rgba(255,45,90,0.55)"
                    />
                  );
                }
                return (
                  <Path
                    key={`stroke-${index}`}
                    d={strokePath(stroke, display.width, display.height)}
                    stroke="rgba(255,45,90,0.55)"
                    strokeWidth={width}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                );
              })}
            </Svg>
          </View>

          <View style={styles.brushRow}>
            <Text style={[styles.brushLabel, { color: theme.textColor }]}>Brush</Text>
            {BRUSH_SIZES.map((size, index) => {
              const active = Math.abs(size - brushSize) < 0.0001;
              return (
                <Pressable
                  key={size}
                  onPress={() => setBrushSize(size)}
                  style={[
                    styles.sizeChip,
                    {
                      borderColor: active ? theme.accentColor : theme.borderColor,
                      backgroundColor: active ? theme.accentSoft : 'rgba(255,255,255,0.6)',
                    },
                  ]}>
                  <View
                    style={{
                      width: Math.round(6 + index * 5),
                      height: Math.round(6 + index * 5),
                      borderRadius: 99,
                      backgroundColor: active ? theme.accentColor : 'rgba(58,42,46,0.45)',
                    }}
                  />
                </Pressable>
              );
            })}
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={undo}
              disabled={strokes.length === 0 && !current}
              style={[styles.ghost, { borderColor: theme.borderColor, opacity: strokes.length ? 1 : 0.4 }]}>
              <Text style={[styles.ghostText, { fontFamily: font, color: theme.textColor }]}>Undo</Text>
            </Pressable>
            <Pressable
              onPress={clear}
              disabled={strokes.length === 0 && !current}
              style={[styles.ghost, { borderColor: theme.borderColor, opacity: strokes.length ? 1 : 0.4 }]}>
              <Text style={[styles.ghostText, { fontFamily: font, color: theme.textColor }]}>Clear</Text>
            </Pressable>
            <Pressable
              onPress={() => onSave(strokesRef.current)}
              style={[styles.primary, { backgroundColor: theme.accentColor }]}>
              <Text style={[styles.primaryText, { fontFamily: font }]}>Use mask</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(20,10,15,0.72)',
  },
  sheet: {
    width: '92%',
    maxWidth: 520,
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    backgroundColor: '#FFF8F4',
    gap: 12,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { fontSize: 20, fontWeight: '800' },
  sub: { fontSize: 12, marginTop: 3, lineHeight: 17 },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 13, fontWeight: '800' },
  canvas: {
    alignSelf: 'center',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  brushRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  brushLabel: { fontSize: 13, fontWeight: '700', marginRight: 2 },
  sizeChip: {
    width: 38,
    height: 34,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 2 },
  ghost: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 50,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  ghostText: { fontSize: 13, fontWeight: '700' },
  primary: {
    marginLeft: 'auto',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 50,
  },
  primaryText: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
});
