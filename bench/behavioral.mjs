import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { extractSkillInvocations } from './lib/transcript.mjs';
import { scoreCase } from './lib/scoring.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..');
const RESULTS_DIR = join(HERE, 'results');

// Resolve the sessions dir from `reasonix doctor` (OS-independent), expanding ~.
export function resolveSessionsDir() {
  const out = execFileSync('reasonix', ['doctor'], { encoding: 'utf8' });
  const m = out.match(/sessions[\s\S]*?dir\s+(.+)/);
  if (!m) throw new Error('could not find sessions dir in `reasonix doctor` output');
  return m[1].trim().replace(/^~/, homedir());
}

function listSessions(dir) {
  return new Set(readdirSync(dir).filter((f) => f.endsWith('.jsonl')));
}

// Copy bench/reasonix.toml -> repo-root/reasonix.toml so config resolution picks it up.
function installBenchConfig() {
  copyFileSync(join(HERE, 'reasonix.toml'), join(REPO_ROOT, 'reasonix.toml'));
}

export function runCase(testCase, { model, sessionsDir, maxSteps = 8 }) {
  const before = listSessions(sessionsDir);
  const metricsPath = join(RESULTS_DIR, `${testCase.id}.metrics.json`);
  try {
    execFileSync('reasonix', [
      'run', '-dir', REPO_ROOT, '-model', model,
      '-max-steps', String(maxSteps), '-metrics', metricsPath,
      testCase.prompt,
    ], { stdio: ['ignore', 'pipe', 'pipe'], env: process.env, timeout: 240000 });
  } catch {
    // reasonix may exit non-zero (e.g. hit max-steps); the session is still saved.
  }
  const after = readdirSync(sessionsDir).filter((f) => f.endsWith('.jsonl') && !before.has(f));
  if (after.length === 0) {
    return { ...scoreCase(testCase, []), error: 'no new session file found' };
  }
  const newest = after
    .map((f) => ({ f, t: statSync(join(sessionsDir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)[0].f;
  const sessionPath = join(sessionsDir, newest);
  copyFileSync(sessionPath, join(RESULTS_DIR, `${testCase.id}.jsonl`));
  const invocations = extractSkillInvocations(readFileSync(sessionPath, 'utf8'));
  return scoreCase(testCase, invocations);
}

function loadCases() {
  return readFileSync(join(HERE, 'cases.jsonl'), 'utf8')
    .split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
}

function hasKey() {
  if (process.env.DEEPSEEK_API_KEY) return true;
  const envFile = join(REPO_ROOT, '.env');
  return existsSync(envFile) && /(^|\n)DEEPSEEK_API_KEY=\S/.test(readFileSync(envFile, 'utf8'));
}

function main() {
  const args = process.argv.slice(2);
  const model = (args.find((a) => a.startsWith('--model=')) || '--model=deepseek-flash').split('=')[1];
  const only = (args.find((a) => a.startsWith('--only=')) || '').split('=')[1] || null;

  if (!hasKey()) {
    console.log('behavioral: SKIPPED — no DEEPSEEK_API_KEY in env or .env');
    process.exit(0);
  }

  mkdirSync(RESULTS_DIR, { recursive: true });
  installBenchConfig();
  const sessionsDir = resolveSessionsDir();
  let cases = loadCases();
  if (only) cases = cases.filter((c) => c.id === only);

  const results = [];
  for (const c of cases) {
    process.stdout.write(`running ${c.id} ... `);
    const r = runCase(c, { model, sessionsDir });
    results.push(r);
    console.log(r.pass ? 'PASS' : 'FAIL', `(first: ${r.firstSkill ?? '—'}, invoked: [${r.invoked.join(', ')}])${r.error ? ' ' + r.error : ''}`);
  }

  const passed = results.filter((r) => r.pass).length;
  const firstHit = results.filter((r) => r.expectedWasFirst).length;
  writeFileSync(join(RESULTS_DIR, 'report.json'),
    JSON.stringify({ model, total: results.length, passed, firstHit, results }, null, 2));
  console.log(`\n${passed}/${results.length} passed · expected-fired-first ${firstHit}/${results.length} · model ${model}`);
  console.log(`report: bench/results/report.json`);
  process.exit(passed === results.length ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
