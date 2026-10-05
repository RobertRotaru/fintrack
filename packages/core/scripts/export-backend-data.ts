import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { GOLDEN_PATH, REFERENCE_PATH, buildGolden, buildReference, serialize } from './backend-data';

const root = resolve(import.meta.dirname, '../../..');
for (const [path, data] of [[REFERENCE_PATH, buildReference()], [GOLDEN_PATH, buildGolden()]] as const) {
  const file = resolve(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, serialize(data));
  console.log(`wrote ${path}`);
}
