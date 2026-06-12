// Benchmark entry point: structural gate first, then behavioral.
// Stage 1 is deterministic (no API). If it fails, we stop before spending any
// tokens on Stage 2. Extra args (e.g. --only=, --model=) pass through to Stage 2.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

function run(script, args = []) {
  try {
    execFileSync('node', [join(HERE, script), ...args], { stdio: 'inherit' });
    return 0;
  } catch (e) {
    return typeof e.status === 'number' ? e.status : 1;
  }
}

console.log('=== Stage 1: structural ===');
const structural = run('structural.mjs');
if (structural !== 0) {
  console.error('\nStructural checks failed — fix SKILL.md issues before the behavioral stage.');
  process.exit(structural);
}

console.log('\n=== Stage 2: behavioral ===');
const behavioral = run('behavioral.mjs', process.argv.slice(2));
process.exit(behavioral);
