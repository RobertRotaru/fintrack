/**
 * Strict amount parsing for form fields, in either convention: "1,250.50",
 * "1.250,50", "1 250", "2.500.000" or plain "23,40". With both separators the
 * last one is the decimal point; one separator used once is a decimal point,
 * used repeatedly it groups thousands. A leading minus only when
 * `allowNegative`. Empty → null; anything else → NaN, so a typo never
 * silently becomes 0 on its way through JSON.
 */
export function parseAmount(text: string, allowNegative = false): number | null {
  let t = text.trim().replace(/[\s\u00a0\u202f'’]/g, '');
  if (!t) return null;
  const negative = t.startsWith('-');
  if (negative) t = t.slice(1);
  if (!/^[\d.,]+$/.test(t) || !/\d/.test(t)) return Number.NaN;

  const lastDot = t.lastIndexOf('.');
  const lastComma = t.lastIndexOf(',');
  let decimal: '.' | ',' | null = null;
  if (lastDot >= 0 && lastComma >= 0) decimal = lastDot > lastComma ? '.' : ',';
  else {
    const sep = lastDot >= 0 ? '.' : lastComma >= 0 ? ',' : null;
    // One separator, used once: a decimal point ("23,40", "12.5"). Used repeatedly: thousands ("2.500.000").
    if (sep && t.split(sep).length === 2) decimal = sep;
  }
  const group = decimal === '.' ? ',' : decimal === ',' ? '.' : null;
  const [int, rawFrac, ...rest] = decimal ? t.split(decimal) : [t];
  const frac = rawFrac || undefined; // "12." is just 12
  if (rest.length) return Number.NaN;
  // Thousands groups must be well-formed: "1.250.000" yes, "1.25.0" no.
  const grouped = group ? (int || '0').split(group) : decimal ? [int || '0'] : int.split(/[.,]/);
  if (grouped.length > 1 && (!/^\d{1,3}$/.test(grouped[0]) || grouped.slice(1).some((g) => !/^\d{3}$/.test(g)))) return Number.NaN;
  if (grouped.some((g) => !/^\d+$/.test(g)) || (frac !== undefined && !/^\d+$/.test(frac))) return Number.NaN;

  const n = Number(`${grouped.join('')}${frac !== undefined ? `.${frac}` : ''}`);
  if (negative) return allowNegative ? -n : Number.NaN;
  return n;
}
