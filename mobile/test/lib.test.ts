import { absoluteUrl, apiBaseUrl } from '../src/lib/config';
import { formatDay, formatPct, moneyParts, parseAmount } from '../src/lib/format';
import { scale, smoothPath } from '../src/components/charts';

describe('where the API is', () => {
  const saved = process.env.EXPO_PUBLIC_API_URL;
  afterEach(() => {
    if (saved === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = saved;
  });

  it('defaults to the computer running Expo, on the API port', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    expect(apiBaseUrl()).toBe('http://192.168.1.20:4000');
  });

  it('uses EXPO_PUBLIC_API_URL when set (e.g. the deployed app)', () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://fintrack.example.app/';
    expect(apiBaseUrl()).toBe('https://fintrack.example.app');
  });

  it('turns relative photo URLs from the local storage driver into absolute ones', () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    expect(absoluteUrl('/api/storage/avatars/a.jpg')).toBe('http://192.168.1.20:4000/api/storage/avatars/a.jpg');
    expect(absoluteUrl('https://photos.example/a.jpg')).toBe('https://photos.example/a.jpg');
    expect(absoluteUrl(null)).toBeNull();
  });
});

describe('formatting', () => {
  it('reads amounts in either convention (shared with the web app)', () => {
    expect(parseAmount('1.250,50')).toBe(1250.5);
    expect(parseAmount('12,5')).toBe(12.5);
    expect(parseAmount('abc')).toBeNaN();
  });

  it('splits money into the label and the number', () => {
    const p = moneyParts(121986.61, 'RON');
    expect(p.currency).toBe('RON');
    expect(p.number.replace(/[^\d]/g, '')).toBe('12198661');
  });

  it('writes changes with an arrow, one decimal under 10%', () => {
    expect(formatPct(5.04)).toBe('↑ 5.0%');
    expect(formatPct(-17.2)).toBe('↓ 17%');
  });

  it('says Today and Yesterday', () => {
    const today = new Date(2026, 9, 6, 12);
    expect(formatDay('2026-10-06', today)).toBe('Today');
    expect(formatDay('2026-10-05', today)).toBe('Yesterday');
  });
});

describe('chart geometry', () => {
  it('scales series into the box with a shared range', () => {
    const pts = scale([[0, 10], [5]], 100, 40, 2, 0)([0, 10]);
    expect(pts).toEqual([
      [0, 40],
      [100, 0],
    ]);
  });

  it('draws a smooth path through the points', () => {
    expect(smoothPath([[0, 0], [10, 10]])).toBe('M0,0 Q0,0 5,5 T10,10');
    expect(smoothPath([])).toBe('');
  });
});
