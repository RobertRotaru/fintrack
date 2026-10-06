import { View } from 'react-native';
import { apiBaseUrl } from '../lib/config';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { BrandMark } from './illustrations';
import { Button, T } from './ui';

/** Shown at startup when a saved session can't be checked because the API is unreachable. */
export function OfflineScreen() {
  const { c } = useTheme();
  const { retry } = useAuth();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 }}>
      <BrandMark size={56} />
      <T v="title" style={{ textAlign: 'center' }}>
        Can’t reach Fintrack
      </T>
      <T tone="muted" style={{ textAlign: 'center' }}>
        Check your connection. If you’re running the API on your computer, make sure it’s on and your phone is on the same Wi-Fi.
      </T>
      <T v="caption" tone="muted" selectable>
        {apiBaseUrl()}
      </T>
      <Button title="Try again" onPress={retry} style={{ alignSelf: 'stretch', marginTop: 8 }} />
    </View>
  );
}
