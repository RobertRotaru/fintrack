import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { storage } from './storage';

/*
 * The web app's design tokens (web/src/index.css), colour for colour.
 * Light: warm ivory paper, deep forest ink. Dark: blue-black with emerald and mint.
 */
export const light = {
  bg: '#f6f2ea',
  surface: '#fcfaf5',
  surface2: '#f2ede3',
  surface3: '#e7e0d2',
  line: '#e6dfd1',
  lineSoft: '#efe9dd',
  lineStrong: '#d8cfbd',
  ink: '#143021',
  ink2: '#3c5246',
  muted: '#6e7c72',
  brand: '#1d5c3d',
  brandInk: '#ffffff',
  brandFg: '#1d6b45',
  brandSoft: '#e2ece2',
  brandGlow: 'rgba(29, 92, 61, 0.35)',
  segment: '#ece6da',
  emerald: '#2e9a68',
  peach: '#ee9a6c',
  sky: '#78aedc',
  cobalt: '#3e63d6',
  violet: '#8a6cd1',
  sun: '#f3c46b',
  income: '#2e9a68',
  expense: '#e07f4f',
  grid: '#ebe4d6',
  chartLine: '#1f7a50',
  chartFill: '#2e9a68',
  good: '#24834f',
  goodSoft: '#e1efe3',
  bad: '#c2462c',
  badSoft: '#f8e5dc',
  warn: '#b7800f',
  shadow: '#3f321a',
  scrim: 'rgba(20, 48, 33, 0.38)',
  tabBar: 'rgba(252, 250, 245, 0.96)',
  ill: {
    sky1: '#f7efe0',
    sky2: '#eef3e6',
    sun: '#f6d48f',
    sunGlow: 0.3,
    hill1: '#cfe0c4',
    hill2: '#a9c99c',
    hill3: '#7fae78',
    hill4: '#4f8a5a',
    tree: '#2f6e48',
    water: '#cfe2ea',
  },
};

export type Palette = typeof light;

export const dark: Palette = {
  bg: '#0a101c',
  surface: '#111a2a',
  surface2: '#172236',
  surface3: '#212e46',
  line: '#1e2a40',
  lineSoft: '#1a2539',
  lineStrong: '#2a3852',
  ink: '#edf3f0',
  ink2: '#c1ccc8',
  muted: '#8593a5',
  brand: '#4fd88f',
  brandInk: '#05281a',
  brandFg: '#62e3a0',
  brandSoft: '#12301f',
  brandGlow: 'rgba(79, 216, 143, 0.4)',
  segment: '#172236',
  emerald: '#2fbf7d',
  peach: '#ff9c63',
  sky: '#66b4ff',
  cobalt: '#5b7cff',
  violet: '#9d82ff',
  sun: '#ffd27a',
  income: '#3fdb98',
  expense: '#ff9a5c',
  grid: '#1a2539',
  chartLine: '#5cf0b0',
  chartFill: '#2fbf7d',
  good: '#4fd88f',
  goodSoft: '#10291d',
  bad: '#ff7a66',
  badSoft: '#2e1714',
  warn: '#f3b84a',
  shadow: '#000000',
  scrim: 'rgba(0, 0, 0, 0.55)',
  tabBar: 'rgba(17, 26, 42, 0.96)',
  ill: {
    sky1: '#13213a',
    sky2: '#1c2d4c',
    sun: '#ffd98a',
    sunGlow: 0.12,
    hill1: '#1d3b45',
    hill2: '#1b4a3d',
    hill3: '#17583f',
    hill4: '#0f3f2c',
    tree: '#0c2f22',
    water: '#1b3150',
  },
};

export const fonts = {
  serif: 'Newsreader_400Regular',
  serifMedium: 'Newsreader_500Medium',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemiBold: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
};

export type ThemePref = 'system' | 'light' | 'dark';

interface ThemeValue {
  c: Palette;
  scheme: 'light' | 'dark';
  pref: ThemePref;
  setPref: (p: ThemePref) => void;
}

const ThemeContext = createContext<ThemeValue>({ c: light, scheme: 'light', pref: 'system', setPref: () => {} });
const PREF_KEY = 'ft.theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>('system');

  useEffect(() => {
    void storage.get(PREF_KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') setPrefState(v);
    });
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const scheme = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
    return {
      c: scheme === 'dark' ? dark : light,
      scheme,
      pref,
      setPref: (p) => {
        setPrefState(p);
        void storage.set(PREF_KEY, p);
      },
    };
  }, [pref, system]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
