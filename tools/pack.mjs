// Writes dist/ac-commit-<version>.zip from the last commit, without tests and tools.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url)));
mkdirSync('dist', { recursive: true });
const out = `dist/ac-commit-${version}.zip`;
execFileSync('git', ['archive', '--format=zip', `--prefix=ac-commit-${version}/`, '-o', out, 'HEAD']);
console.log(out);
