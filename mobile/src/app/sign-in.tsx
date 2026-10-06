import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../lib/auth';
import { apiBaseUrl } from '../lib/config';
import { fonts, useTheme } from '../lib/theme';
import { BrandMark, Landscape } from '../components/illustrations';
import { Button, Input, T } from '../components/ui';

export default function SignIn() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn, register } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === 'in') await signIn(email.trim(), password);
      else await register({ name: name.trim(), email: email.trim(), password, country: 'RO' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Landscape style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 260 }} fadeFrom={c.bg} sunX={0.74} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 40, paddingHorizontal: 24, paddingBottom: 220, gap: 22 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <BrandMark />
            <T v="display">Fintrack</T>
          </View>
          <View style={{ gap: 8 }}>
            <T v="title" style={{ fontSize: 44, lineHeight: 46 }}>
              {mode === 'in' ? 'Welcome back.' : 'Hello there.'}
            </T>
            <T tone="ink2" style={{ fontSize: 16 }}>
              {mode === 'in' ? 'Your money, calm and in one place.' : 'Create your account in a minute.'}
            </T>
          </View>

          <View style={{ gap: 14 }}>
            {mode === 'up' ? <Input label="Name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" returnKeyType="next" /> : null}
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <Input
              ref={passwordRef}
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              textContentType={mode === 'in' ? 'password' : 'newPassword'}
              hint={mode === 'up' ? 'At least 8 characters' : undefined}
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            {error ? (
              <T v="small" tone="bad" accessibilityLiveRegion="polite">
                {error}
              </T>
            ) : null}
            <Button title={mode === 'in' ? 'Sign in' : 'Create account'} onPress={submit} loading={busy} disabled={!email || !password || (mode === 'up' && !name)} style={{ marginTop: 6 }} />
          </View>

          <Pressable accessibilityRole="button" onPress={() => setMode(mode === 'in' ? 'up' : 'in')} style={{ alignSelf: 'center', minHeight: 44, justifyContent: 'center' }}>
            <T v="small" tone="ink2">
              {mode === 'in' ? 'New here? ' : 'Have an account? '}
              <T v="small" tone="brandFg" style={{ fontFamily: fonts.sansSemiBold }}>
                {mode === 'in' ? 'Create an account' : 'Sign in'}
              </T>
            </T>
          </Pressable>
          <T v="caption" tone="muted" style={{ textAlign: 'center' }}>
            Server: {apiBaseUrl()}
          </T>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
