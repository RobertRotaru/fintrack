import { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useTheme } from '../lib/theme';

/** The sun breathes slowly, as on the web; still when reduced motion is on. */
function useBreathing() {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (!reduce) t.value = withRepeat(withTiming(1, { duration: 3500, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduce, t]);
  return useAnimatedStyle(() => ({ transform: [{ scale: 1 + t.value * 0.1 }], opacity: 1 - t.value * 0.18 }));
}

/**
 * Rolling hills under a sun, drawn with theme tokens: a soft morning in light
 * mode, a calm dusk in dark. `fadeFrom` blends the sky into the card above it.
 */
export function Landscape({ style, fadeFrom, sunX = 0.86 }: { style?: StyleProp<ViewStyle>; fadeFrom?: string; sunX?: number }) {
  const { c } = useTheme();
  const ill = c.ill;
  const breathe = useBreathing();
  return (
    <View style={[{ overflow: 'hidden' }, style]} aria-hidden>
      <Svg width="100%" height="100%" viewBox="0 0 640 220" preserveAspectRatio="xMidYMax slice" style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="land-sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={fadeFrom ?? ill.sky1} />
            <Stop offset="1" stopColor={ill.sky2} />
          </LinearGradient>
        </Defs>
        <Rect width="640" height="220" fill="url(#land-sky)" />
        <Path d="M0 130 C 90 90 170 104 250 84 C 330 64 410 98 480 90 C 550 82 600 70 640 76 L640 220 L0 220Z" fill={ill.hill1} />
        <Path d="M0 158 C 70 132 150 138 220 126 C 300 112 360 140 450 130 C 530 122 590 108 640 114 L640 220 L0 220Z" fill={ill.hill2} />
        <Path d="M0 186 C 90 166 180 172 260 164 C 340 156 420 176 520 168 C 580 164 620 158 640 160 L640 220 L0 220Z" fill={ill.hill3} />
        <Path d="M420 220 C 450 200 490 186 540 182 C 580 180 610 182 640 184 L640 220Z" fill={ill.hill4} />
      </Svg>
      <Animated.View style={[{ position: 'absolute', left: `${sunX * 100 - 9}%`, top: 10, width: 46, height: 46 }, breathe]}>
        <Svg width={46} height={46}>
          <Circle cx={23} cy={23} r={22} fill={ill.sun} opacity={ill.sunGlow} />
          <Circle cx={23} cy={23} r={11} fill={ill.sun} />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** A path winding up through the hills to a flag: the Goals hero. */
export function PathScene({ style }: { style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const ill = c.ill;
  return (
    <View style={[{ overflow: 'hidden' }, style]} aria-hidden>
      <Svg width="100%" height="100%" viewBox="0 0 360 240" preserveAspectRatio="xMidYMax slice">
        <Rect width="360" height="240" fill={ill.sky2} />
        <Circle cx="300" cy="52" r="20" fill={ill.sun} />
        <Path d="M0 130 C 60 96 120 110 180 90 C 240 70 300 96 360 84 L360 240 L0 240Z" fill={ill.hill1} />
        <Path d="M0 168 C 70 140 140 150 210 132 C 270 118 320 136 360 128 L360 240 L0 240Z" fill={ill.hill2} />
        <Path d="M0 206 C 80 180 160 192 240 178 C 300 168 340 176 360 172 L360 240 L0 240Z" fill={ill.hill3} />
        <Path d="M150 240 C 172 214 228 212 228 192 C 228 172 182 170 196 150 C 208 134 246 134 254 118 C 260 106 246 98 252 90" fill="none" stroke={c.surface} strokeOpacity={0.85} strokeWidth={7} strokeLinecap="round" />
        <G>
          <Path d="M252 90 l0 -18 l14 6 l-14 6" fill={c.peach} stroke={ill.tree} strokeWidth={1.4} strokeLinejoin="round" />
        </G>
      </Svg>
    </View>
  );
}

/** The brand mark: a rising line inside a forest-green tile. */
export function BrandMark({ size = 38 }: { size?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: c.brand, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size * 0.62} height={size * 0.62} viewBox="0 0 32 32">
        <Path d="M7 21l5.5-5.5 4 4L25 11" stroke={c.brandInk} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}
