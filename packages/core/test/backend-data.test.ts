import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GOLDEN_PATH, REFERENCE_PATH, buildGolden, buildReference, serialize } from '../scripts/backend-data';
import { FX_PER_EUR, setRates } from '../src';

const root = resolve(__dirname, '../../..');
const committed = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('data shared with the Java backend', () => {
  it('reference.json matches @ft/core (run `npm run export:backend-data` if this fails)', () => {
    expect(committed(REFERENCE_PATH)).toBe(serialize(buildReference()));
  });
  it('the habit-summary golden fixture matches @ft/core (run `npm run export:backend-data` if this fails)', () => {
    expect(committed(GOLDEN_PATH)).toBe(serialize(buildGolden()));
    setRates(FX_PER_EUR);
  });
});
