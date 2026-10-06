import { forwardRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
  type PressableProps, type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { absoluteUrl } from '../lib/config';
import { Icon } from '../lib/icons';
import { fonts, useTheme, type Palette } from '../lib/theme';

type Variant = 'body' | 'small' | 'caption' | 'label' | 'title' | 'display' | 'heading' | 'eyebrow' | 'figure' | 'button';

const variants: Record<Variant, TextStyle> = {
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 21 },
  small: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 16 },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 15, lineHeight: 20 },
  button: { fontFamily: fonts.sansSemiBold, fontSize: 15 },
  eyebrow: { fontFamily: fonts.sansSemiBold, fontSize: 11, letterSpacing: 1.3, textTransform: 'uppercase' },
  figure: { fontFamily: fonts.sansSemiBold, fontVariant: ['tabular-nums'], letterSpacing: -0.6 },
  // Newsreader: editorial headlines, set large and tight.
  heading: { fontFamily: fonts.serif, fontSize: 24, lineHeight: 28, letterSpacing: -0.4 },
  title: { fontFamily: fonts.serif, fontSize: 36, lineHeight: 38, letterSpacing: -0.8 },
  display: { fontFamily: fonts.serif, fontSize: 28, lineHeight: 30, letterSpacing: -0.6 },
};

/** Text in the design system's styles. `tone` picks a token colour. */
export function T({
  v = 'body',
  tone = 'ink',
  style,
  ...props
}: TextProps & { v?: Variant; tone?: keyof Pick<Palette, 'ink' | 'ink2' | 'muted' | 'good' | 'bad' | 'brandFg' | 'brandInk' | 'expense'> }) {
  const { c } = useTheme();
  const color = v === 'eyebrow' && tone === 'ink' ? c.muted : c[tone];
  return <Text {...props} style={[variants[v], { color }, style]} />;
}

/** The web app's --shadow and --shadow-lg, as React Native box shadows. */
export function useShadow(level: 'card' | 'lifted' = 'card'): ViewStyle {
  const { scheme } = useTheme();
  const dark = scheme === 'dark';
  if (level === 'card') return { boxShadow: dark ? '0 1px 2px rgba(0,0,0,0.3), 0 8px 24px -12px rgba(0,0,0,0.5)' : '0 1px 2px rgba(63,50,26,0.04), 0 6px 20px -8px rgba(63,50,26,0.10)' };
  return {
    boxShadow: dark
      ? '0 2px 4px rgba(0,0,0,0.3), 0 24px 48px -16px rgba(0,0,0,0.6), 0 30px 80px -40px rgba(79,216,143,0.35)'
      : '0 2px 4px rgba(63,50,26,0.04), 0 24px 48px -16px rgba(63,50,26,0.18), 0 30px 80px -40px rgba(29,92,61,0.18)',
  };
}

export function Card({ children, style, lifted, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; lifted?: boolean; padded?: boolean }) {
  const { c } = useTheme();
  const shadow = useShadow(lifted ? 'lifted' : 'card');
  return (
    <View style={[{ backgroundColor: c.surface, borderColor: c.line, borderWidth: StyleSheet.hairlineWidth * 2, borderRadius: 20 }, padded && { padding: 16 }, shadow, style]}>
      {children}
    </View>
  );
}

/** Content that rises in after the one before it; off when the system asks for reduced motion. */
export function Rise({ i = 0, children, style }: { i?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={FadeInDown.delay(Math.min(i, 7) * 70).duration(480)} style={style}>
      {children}
    </Animated.View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  style,
  accessibilityLabel,
}: {
  title?: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const { c } = useTheme();
  const bg = variant === 'primary' ? c.brand : variant === 'secondary' ? c.surface : 'transparent';
  const fg = variant === 'primary' ? c.brandInk : variant === 'danger' ? c.bad : variant === 'ghost' ? c.brandFg : c.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 48,
          paddingHorizontal: 18,
          borderRadius: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: bg,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: c.line,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={18} color={fg} strokeWidth={2.2} /> : null}
      {title ? <Text style={[variants.button, { color: fg }]}>{title}</Text> : null}
    </Pressable>
  );
}

/** A pill-shaped switch between a few views, like the web app's Segmented. */
export function Segmented<V extends string>({ value, onChange, options, label }: { value: V; onChange: (v: V) => void; options: { value: V; label: string }[]; label: string }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={{ flexDirection: 'row', padding: 4, gap: 4, borderRadius: 999, backgroundColor: c.segment }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[
              { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
              on && { backgroundColor: c.surface, boxShadow: '0 1px 3px rgba(63,50,26,0.12)' },
            ]}
          >
            <Text numberOfLines={1} style={{ fontFamily: on ? fonts.sansSemiBold : fonts.sansMedium, fontSize: 13, color: on ? c.ink : c.muted }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function IconTile({ icon, color, size = 40 }: { icon: string; color: string; size?: number }) {
  const { scheme } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, alignItems: 'center', justifyContent: 'center', backgroundColor: tint(color, scheme === 'dark' ? 0.22 : 0.16) }}>
      <Icon name={icon} size={size * 0.46} color={color} strokeWidth={2} />
    </View>
  );
}

/** A colour at a given opacity, for soft icon backgrounds. */
export function tint(hex: string, alpha: number): string {
  const m = hex.replace('#', '');
  const full = m.length === 3 ? m.split('').map((x) => x + x).join('') : m;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

const AVATAR_TONES = ['#2e9a68', '#3e63d6', '#8a6cd1', '#e07f4f', '#d6457f', '#0e9aa7'];

export function Avatar({ name, url, size = 40, ring }: { name: string; url?: string | null; size?: number; ring?: boolean }) {
  const { c } = useTheme();
  const src = absoluteUrl(url);
  // A photo that fails to load falls back to initials rather than an empty circle.
  const [failed, setFailed] = useState<string | null>(null);
  const ringStyle = ring ? { borderWidth: 3, borderColor: c.surface } : {};
  if (src && failed !== src) {
    return (
      <Image
        source={{ uri: src }}
        accessibilityIgnoresInvertColors
        onError={() => setFailed(src)}
        style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.surface2 }, ringStyle]}
        contentFit="cover"
        transition={150}
      />
    );
  }
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';
  const tone = AVATAR_TONES[[...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % AVATAR_TONES.length]!;
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: tint(tone, 0.22) }, ringStyle]}>
      <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: size * 0.36, color: tone }}>{initials}</Text>
    </View>
  );
}

export function ProgressBar({ value, color, height = 8 }: { value: number; color?: string; height?: number }) {
  const { c } = useTheme();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }} style={{ height, borderRadius: height / 2, backgroundColor: c.surface3, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height, borderRadius: height / 2, backgroundColor: color ?? c.emerald }} />
    </View>
  );
}

/** "↓ 17%" in a soft pill, green when the change is good. */
export function Delta({ value, inverse }: { value: number | null; inverse?: boolean }) {
  const { c } = useTheme();
  if (value === null || !Number.isFinite(value)) return null;
  const flat = Math.abs(value) < 0.5;
  const good = inverse ? value < 0 : value > 0;
  const fg = flat ? c.muted : good ? c.good : c.bad;
  const bg = flat ? c.surface2 : good ? c.goodSoft : c.badSoft;
  return (
    <View style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: bg }}>
      <Text style={{ fontFamily: fonts.sansSemiBold, fontSize: 12, color: fg, fontVariant: ['tabular-nums'] }}>
        {flat ? '' : value > 0 ? '↑ ' : '↓ '}
        {Math.abs(Math.round(value))}%
      </Text>
    </View>
  );
}

/** A scrolling screen under the status bar, with pull-to-refresh and room for the tab bar. */
export function Screen({ children, onRefresh, refreshing = false, tabBar = true, header }: { children: ReactNode; onRefresh?: () => void; refreshing?: boolean; tabBar?: boolean; header?: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {header}
      <ScrollView
        contentContainerStyle={{ paddingTop: header ? 0 : insets.top + 12, paddingHorizontal: 20, paddingBottom: (tabBar ? 110 : 40) + insets.bottom, gap: 16 }}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.brandFg} colors={[c.brandFg]} /> : undefined}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 8 }}>
      <T v="heading">{title}</T>
      {action && onAction ? (
        <Pressable accessibilityRole="link" onPress={onAction} hitSlop={10} style={{ minHeight: 32, justifyContent: 'center' }}>
          <T v="small" tone="brandFg" style={{ fontFamily: fonts.sansSemiBold }}>
            {action} ›
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

export const Input = forwardRef<TextInput, TextInputProps & { label: string; hint?: string }>(function Input({ label, hint, style, ...props }, ref) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <T v="small" tone="ink2" style={{ fontFamily: fonts.sansMedium }}>
        {label}
      </T>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        {...props}
        style={[{ minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, paddingHorizontal: 14, fontFamily: fonts.sans, fontSize: 16, color: c.ink }, style]}
      />
      {hint ? (
        <T v="caption" tone="muted">
          {hint}
        </T>
      ) : null}
    </View>
  );
});

export function Empty({ icon, title, children, action }: { icon: string; title: string; children?: ReactNode; action?: ReactNode }) {
  const { c } = useTheme();
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 32, gap: 10 }}>
      <IconTile icon={icon} color={c.emerald} size={52} />
      <T v="heading" style={{ textAlign: 'center' }}>
        {title}
      </T>
      {children ? (
        <T v="small" tone="muted" style={{ textAlign: 'center', maxWidth: 280 }}>
          {children}
        </T>
      ) : null}
      {action}
    </Card>
  );
}

export function Loading() {
  const { c } = useTheme();
  return (
    <View style={{ paddingVertical: 80, alignItems: 'center' }}>
      <ActivityIndicator color={c.brandFg} />
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Empty icon="alert-triangle" title="Something didn’t load" action={<Button title="Try again" variant="secondary" onPress={onRetry} />}>
      {message}
    </Empty>
  );
}

/** A tappable row inside a grouped list. */
export function Row({ children, onPress, style, ...props }: { children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle> } & Omit<PressableProps, 'style' | 'children'>) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 56, backgroundColor: pressed ? c.surface2 : 'transparent' }, style]}
      {...props}
    >
      {children}
    </Pressable>
  );
}

export function Divider() {
  const { c } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth * 2, backgroundColor: c.lineSoft, marginLeft: 16 }} />;
}
