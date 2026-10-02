import { useCallback } from 'react';
import { formatMoney } from '@ft/core';
import { useUser } from './auth';

/** Formats amounts in the user's base currency unless told otherwise. */
export function useMoney() {
  const user = useUser();
  return useCallback(
    (amount: number, opts: { currency?: string; compact?: boolean; sign?: boolean } = {}) =>
      formatMoney(amount, opts.currency ?? user.baseCurrency, opts),
    [user.baseCurrency],
  );
}

export const percent = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`;

export function formatDay(date: string): string {
  const today = new Date();
  const d = new Date(`${date}T00:00:00`);
  const diff = Math.round((new Date(today.toDateString()).getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: diff < 7 ? 'long' : undefined, day: 'numeric', month: 'short', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
}

export function greeting(): string {
  const h = new Date().getHours();
  return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/** Readable text colour on top of an arbitrary background colour. */
export function onColor(hex: string): string {
  const m = hex.replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const n = parseInt(full, 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (r * 299 + g * 587 + b * 114) / 1000 > 160 ? '#0f1020' : '#ffffff';
}

/** Resize an uploaded image to a square-ish data URL so it stays small. */
export function resizeImage(file: File, max = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the image'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not an image'));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
