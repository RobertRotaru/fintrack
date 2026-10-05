import { useEffect, useState } from 'react';

export type ThemePref = 'light' | 'dark' | 'system';
export type Theme = 'light' | 'dark';

const KEY = 'theme';
const EVENT = 'ft:theme';

const media = () => (typeof window !== 'undefined' ? window.matchMedia?.('(prefers-color-scheme: dark)') : undefined);

export function readPref(): ThemePref {
  try {
    const t = localStorage.getItem(KEY);
    if (t === 'light' || t === 'dark') return t;
  } catch {
    /* storage unavailable */
  }
  return 'system';
}

export function resolveTheme(pref: ThemePref): Theme {
  if (pref !== 'system') return pref;
  return media()?.matches ? 'dark' : 'light';
}

/** Applies a preference: an explicit theme pins `data-theme`; "system" follows the OS. */
export function setThemePref(pref: ThemePref) {
  const root = document.documentElement;
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    /* storage unavailable — still apply for this visit */
  }
  if (pref === 'system') delete root.dataset.theme;
  else root.dataset.theme = pref;
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Current preference and resolved theme, kept in sync across components and with the OS. */
export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(readPref);
  const [systemDark, setSystemDark] = useState(() => !!media()?.matches);
  useEffect(() => {
    const onPref = () => setPref(readPref());
    const mq = media();
    const onMq = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    window.addEventListener(EVENT, onPref);
    mq?.addEventListener?.('change', onMq);
    return () => {
      window.removeEventListener(EVENT, onPref);
      mq?.removeEventListener?.('change', onMq);
    };
  }, []);
  const theme: Theme = pref === 'system' ? (systemDark ? 'dark' : 'light') : pref;
  return {
    pref,
    theme,
    setPref: setThemePref,
    toggle: () => setThemePref(theme === 'dark' ? 'light' : 'dark'),
  };
}
