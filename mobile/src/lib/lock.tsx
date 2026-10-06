import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { storage } from './storage';

const KEY = 'ft.lock';
/** Coming back after this long asks for Face ID again; quick app switches don't. */
const RELOCK_AFTER_MS = 60_000;

interface LockValue {
  enabled: boolean;
  locked: boolean;
  /** Face ID / Touch ID / fingerprint is set up on this device. */
  available: boolean;
  unlock: () => Promise<boolean>;
  /** Turns the lock on (after a successful check) or off. */
  setEnabled: (on: boolean) => Promise<boolean>;
  biometryLabel: string;
}

const LockContext = createContext<LockValue | null>(null);

async function biometrics(): Promise<{ available: boolean; label: string }> {
  if (Platform.OS === 'web') return { available: false, label: 'Face ID' };
  const [hardware, enrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const label = Platform.OS === 'ios' ? (face ? 'Face ID' : 'Touch ID') : 'fingerprint';
  return { available: hardware && enrolled, label };
}

export function LockProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [locked, setLocked] = useState(false);
  const [bio, setBio] = useState({ available: false, label: 'Face ID' });
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    void (async () => {
      const [saved, b] = await Promise.all([storage.get(KEY), biometrics()]);
      setBio(b);
      const on = saved === 'on' && b.available;
      setEnabledState(on);
      setLocked(on);
    })();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') backgroundedAt.current = Date.now();
      if (state === 'active' && backgroundedAt.current !== null) {
        if (enabled && Date.now() - backgroundedAt.current > RELOCK_AFTER_MS) setLocked(true);
        backgroundedAt.current = null;
      }
    });
    return () => sub.remove();
  }, [enabled]);

  const check = useCallback(
    async (prompt: string) => {
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: prompt, cancelLabel: 'Cancel' });
      return r.success;
    },
    [],
  );

  const value = useMemo<LockValue>(
    () => ({
      enabled,
      locked,
      available: bio.available,
      biometryLabel: bio.label,
      unlock: async () => {
        const ok = await check('Unlock Fintrack');
        if (ok) setLocked(false);
        return ok;
      },
      setEnabled: async (on) => {
        if (on && !(await check(`Use ${bio.label} for Fintrack`))) return false;
        setEnabledState(on);
        await storage.set(KEY, on ? 'on' : 'off');
        return true;
      },
    }),
    [enabled, locked, bio, check],
  );

  return <LockContext.Provider value={value}>{children}</LockContext.Provider>;
}

export function useLock(): LockValue {
  const ctx = useContext(LockContext);
  if (!ctx) throw new Error('useLock outside LockProvider');
  return ctx;
}
