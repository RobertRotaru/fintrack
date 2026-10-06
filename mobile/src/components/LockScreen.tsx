import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLock } from '../lib/lock';
import { useTheme } from '../lib/theme';
import { BrandMark } from './illustrations';
import { Button, T } from './ui';

/** Covers the app until Face ID (or Touch ID / fingerprint) succeeds. */
export function LockScreen() {
  const { c } = useTheme();
  const { unlock, biometryLabel } = useLock();

  useEffect(() => {
    void unlock();
    // Ask once when the lock appears; the button asks again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 32 }]} accessibilityViewIsModal>
      <BrandMark size={64} />
      <T v="title" style={{ textAlign: 'center' }}>
        Fintrack is locked
      </T>
      <T tone="muted" style={{ textAlign: 'center' }}>
        Your finances stay private until it’s you.
      </T>
      <Button title={`Unlock with ${biometryLabel}`} icon="shield" onPress={() => void unlock()} style={{ alignSelf: 'stretch', marginTop: 12 }} />
    </View>
  );
}
