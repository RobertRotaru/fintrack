#!/usr/bin/env node
/**
 * Runs the backend's Gradle wrapper on any OS, so npm scripts work in
 * PowerShell/cmd as well as bash:  node scripts/gradle.mjs bootRun
 */
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const backend = resolve(import.meta.dirname, '..', 'backend');
const windows = process.platform === 'win32';
// Batch files can only be launched through a shell on Windows.
const child = spawn(windows ? 'gradlew.bat' : './gradlew', process.argv.slice(2), { cwd: backend, stdio: 'inherit', shell: windows });

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', (e) => {
  console.error(`Could not start Gradle: ${e.message}`);
  process.exit(1);
});
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
