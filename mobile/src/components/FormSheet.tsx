import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, useTheme } from '../lib/theme';
import { T } from './ui';

/** A modal sheet with a title and a scrolling form that stays clear of the keyboard. */
export function FormSheet({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 14, paddingBottom: insets.bottom + 24, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: c.lineStrong }} />
        <View style={{ gap: 4 }}>
          <T v="display" accessibilityRole="header">
            {title}
          </T>
          {subtitle ? (
            <T v="small" tone="muted">
              {subtitle}
            </T>
          ) : null}
        </View>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** A row of choice chips. */
export function Chips<V extends string>({ value, onChange, options, label }: { value: V; onChange: (v: V) => void; options: { value: V; label: string }[]; label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <T v="small" tone="ink2">
        {label}
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {options.map((o) => (
          <Chip key={o.value} label={o.label} on={o.value === value} onPress={() => onChange(o.value)} />
        ))}
      </View>
    </View>
  );
}


function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      onPress={onPress}
      style={{ minHeight: 38, paddingHorizontal: 14, borderRadius: 999, justifyContent: 'center', borderWidth: 1, borderColor: on ? c.brand : c.line, backgroundColor: on ? c.brandSoft : c.surface }}
    >
      <T v="small" tone={on ? 'brandFg' : 'ink2'} style={{ fontFamily: on ? fonts.sansSemiBold : fonts.sansMedium }}>
        {label}
      </T>
    </Pressable>
  );
}
