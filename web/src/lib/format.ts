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

/**
 * Strict amount parsing for form fields: accepts "12", "12.5" or "12,5" (and a
 * leading minus when `allowNegative`). Empty → null; anything else → NaN, so a
 * typo never silently becomes 0 on its way through JSON.
 */
export function parseAmount(text: string, allowNegative = false): number | null {
  const t = text.trim().replace(',', '.');
  if (!t) return null;
  const re = allowNegative ? /^-?\d+(\.\d+)?$/ : /^\d+(\.\d+)?$/;
  return re.test(t) ? Number(t) : Number.NaN;
}

/**
 * Splits a formatted amount into its currency label and its number so the
 * number can be emphasised ("RON" small, "122,955.19" large).
 */
export function moneyParts(amount: number, currency: string): { currency: string; number: string; before: boolean } {
  try {
    const parts = new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).formatToParts(amount);
    const idx = parts.findIndex((p) => p.type === 'currency');
    const number = parts.filter((p) => p.type !== 'currency' && !(p.type === 'literal' && !p.value.trim())).map((p) => p.value).join('');
    return { currency: parts[idx]?.value ?? currency, number, before: idx <= parts.findIndex((p) => p.type === 'integer') };
  } catch {
    return { currency, number: amount.toFixed(2), before: false };
  }
}
