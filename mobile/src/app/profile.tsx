import { useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Camera, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { countryByCode, type User } from '@ft/core';
import { api } from '../lib/api';
import { useAuth, useUser } from '../lib/auth';
import { pickPhoto, removeAvatar, uploadAvatar } from '../lib/avatar';
import { useLock } from '../lib/lock';
import { keys, useApiMutation, useCategories, useFx } from '../lib/queries';
import { fonts, useTheme, type ThemePref } from '../lib/theme';
import { Avatar, Button, Card, Divider, Input, Row, Screen, Segmented, T } from '../components/ui';

const BIO_MAX = 280;

/** You: photo, name and a few words, then how the app works for you. Features live in the tabs. */
export default function ProfileScreen() {
  const user = useUser();
  const { setUser, signOut } = useAuth();
  const { c, pref, setPref, scheme } = useTheme();
  const lock = useLock();
  const insets = useSafeAreaInsets();
  const fx = useFx();
  const categories = useCategories().data ?? [];
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio ?? '');
  const [photoBusy, setPhotoBusy] = useState(false);
  const save = useApiMutation((body: Partial<User>) => api<User>('/auth/me', { method: 'PATCH', body }), [keys.household]);
  const since = new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const changePhoto = () => {
    const run = async (source: 'library' | 'camera' | 'remove') => {
      setPhotoBusy(true);
      try {
        if (source === 'remove') setUser(await removeAvatar());
        else {
          const uri = await pickPhoto(source);
          if (uri) setUser(await uploadAvatar(uri));
        }
      } catch (e) {
        Alert.alert('Photo', e instanceof Error ? e.message : 'Something went wrong.');
      } finally {
        setPhotoBusy(false);
      }
    };
    const options = ['Take photo', 'Choose from library', ...(user.avatarUrl ? ['Remove photo'] : []), 'Cancel'];
    const handle = (i: number) => {
      if (i === 0) void run('camera');
      else if (i === 1) void run('library');
      else if (i === 2 && user.avatarUrl) void run('remove');
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: options.length - 1, destructiveButtonIndex: user.avatarUrl ? 2 : undefined }, handle);
    } else {
      Alert.alert('Profile photo', undefined, [...options.slice(0, -1).map((text, i) => ({ text, onPress: () => handle(i) })), { text: 'Cancel', style: 'cancel' as const }]);
    }
  };

  const saveProfile = async () => {
    try {
      setUser(await save.mutateAsync({ name: name.trim(), bio: bio.trim() }));
      setEditing(false);
    } catch (e) {
      Alert.alert('Couldn’t save', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  const toggleLock = async (on: boolean) => {
    if (on && !lock.available) {
      Alert.alert(`${lock.biometryLabel} isn’t set up`, `Set up ${lock.biometryLabel} in your phone’s Settings first.`);
      return;
    }
    await lock.setEnabled(on);
  };

  // The banner bleeds to the screen edges and under the status bar, and scrolls with the page.
  const banner = (
    <View style={{ height: 110 + insets.top, marginHorizontal: -20, marginTop: -(insets.top + 12) }}>
      <Svg width="100%" height="100%" style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id="banner" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={scheme === 'dark' ? '#163a2a' : '#c9e0cf'} />
            <Stop offset="0.55" stopColor={scheme === 'dark' ? '#1c2d4c' : '#cfe0ee'} />
            <Stop offset="1" stopColor={scheme === 'dark' ? '#3a2a24' : '#f3dccd'} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#banner)" />
      </Svg>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => router.back()}
        style={{ position: 'absolute', left: 14, top: insets.top + 6, width: 40, height: 40, borderRadius: 20, backgroundColor: c.surface, opacity: 0.92, alignItems: 'center', justifyContent: 'center' }}
      >
        <ChevronLeft size={22} color={c.ink} />
      </Pressable>
    </View>
  );

  return (
    <Screen tabBar={false}>
      {banner}
      <View style={{ marginTop: -72, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={user.avatarUrl ? 'Change photo' : 'Add a photo'} onPress={changePhoto} disabled={photoBusy}>
          <Avatar name={user.name} url={user.avatarUrl} size={104} ring />
          <View style={{ position: 'absolute', right: 2, bottom: 4, width: 34, height: 34, borderRadius: 17, borderWidth: 3, borderColor: c.bg, backgroundColor: c.brand, alignItems: 'center', justifyContent: 'center', opacity: photoBusy ? 0.5 : 1 }}>
            <Camera size={15} color={c.brandInk} strokeWidth={2.2} />
          </View>
        </Pressable>
        {!editing ? <Button title="Edit profile" variant="secondary" onPress={() => setEditing(true)} style={{ minHeight: 40 }} /> : null}
      </View>

      {editing ? (
        <Card style={{ gap: 14, padding: 18 }}>
          <Input label="Name" value={name} onChangeText={setName} maxLength={80} />
          <Input label="Bio" value={bio} onChangeText={setBio} maxLength={BIO_MAX} multiline style={{ minHeight: 90, paddingTop: 12, textAlignVertical: 'top' }} hint={`${bio.length}/${BIO_MAX} · A line about you or what you’re saving for`} placeholder="Saving for a sailboat, one coffee at a time." />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Cancel" variant="ghost" onPress={() => (setEditing(false), setName(user.name), setBio(user.bio ?? ''))} style={{ flex: 1 }} />
            <Button title="Save" onPress={saveProfile} loading={save.isPending} disabled={!name.trim()} style={{ flex: 2 }} />
          </View>
        </Card>
      ) : (
        <View style={{ gap: 4 }}>
          <T v="title" style={{ fontSize: 32 }} testID="profile-name">
            {user.name}
          </T>
          <T v="small" tone="muted">
            {user.email} · Member since {since}
          </T>
          {user.bio ? (
            <T tone="ink2" style={{ marginTop: 8 }}>
              {user.bio}
            </T>
          ) : null}
        </View>
      )}

      <T v="eyebrow" style={{ marginLeft: 4, marginTop: 6 }}>
        Settings
      </T>
      <Card padded={false} style={{ overflow: 'hidden' }}>
        <SettingRow label="Main currency" value={user.baseCurrency} onPress={() => router.push({ pathname: '/pick', params: { kind: 'currency' } })} />
        <Divider />
        <SettingRow label="Country" value={countryByCode(user.country)?.name ?? user.country} onPress={() => router.push({ pathname: '/pick', params: { kind: 'country' } })} />
        <Divider />
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 10 }}>
          <T style={{ fontFamily: fonts.sansMedium }}>Appearance</T>
          <Segmented<ThemePref>
            label="Appearance"
            value={pref}
            onChange={setPref}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </View>
        <Divider />
        <SettingRow label="Categories" value={String(categories.filter((x) => !x.archived).length)} onPress={() => router.push('/categories')} />
        <Divider />
        <SettingRow label="Exchange rates" value={fx.data?.updatedAt ? `Live · ${new Date(fx.data.updatedAt).toLocaleDateString()}` : 'Built-in rates'} />
      </Card>

      <T v="eyebrow" style={{ marginLeft: 4, marginTop: 6 }}>
        Security
      </T>
      <Card padded={false} style={{ overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 66 }}>
          <View style={{ flex: 1 }}>
            <T style={{ fontFamily: fonts.sansMedium }}>Lock with {lock.biometryLabel}</T>
            <T v="caption" tone="muted">
              Ask for {lock.biometryLabel} when Fintrack opens
            </T>
          </View>
          <Switch
            accessibilityLabel={`Lock with ${lock.biometryLabel}`}
            value={lock.enabled}
            onValueChange={(on) => void toggleLock(on)}
            trackColor={{ false: c.surface3, true: c.brand }}
            thumbColor="#ffffff"
            ios_backgroundColor={c.surface3}
          />
        </View>
        <Divider />
        <Row accessibilityRole="button" onPress={() => void signOut()}>
          <T tone="bad" style={{ fontFamily: fonts.sansMedium }}>
            Sign out
          </T>
        </Row>
      </Card>
    </Screen>
  );
}

function SettingRow({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  const { c } = useTheme();
  return (
    <Row onPress={onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={`${label}, ${value}`}>
      <T style={{ flex: 1, fontFamily: fonts.sansMedium }}>{label}</T>
      <T tone="muted">{value}</T>
      {onPress ? <ChevronRight size={18} color={c.muted} /> : null}
    </Row>
  );
}
