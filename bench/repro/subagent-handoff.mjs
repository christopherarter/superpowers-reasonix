// Reproduction probe for the "subagent-driven handoff does inline edits" bug.
//
// Symptom (reported from a real session): after superpowers-writing-plans saves
// a plan and offers "1. Subagent-Driven / 2. Inline Execution", choosing 1 is
// supposed to dispatch a fresh native `task` subagent per task. Instead the
// model edits files directly in the parent session.
//
// This probe reproduces the exact two-turn flow and reads the PARENT transcript
// of turn 2 (after the user picks "1"). A dispatched subagent's edits land in a
// separate child session, so a parent-side edit is an unambiguous "edited
// in-session" signal — even if `task` was also called:
//   - CORRECT  → parent calls `task`, and makes NO write_file/edit_file/multi_edit.
//   - BUG      → parent makes a write_file/edit_file/multi_edit (or file-writing bash).
//
// The behaviour is intermittent on deepseek-flash, so the probe runs N trials
// and reports the inline-vs-dispatch rate.
//
// Run:  node bench/repro/subagent-handoff.mjs --trials=6   (deepseek-flash)
//       node bench/repro/subagent-handoff.mjs --model=deepseek-pro
// Needs DEEPSEEK_API_KEY in env or repo-root .env. No-key → SKIP (exit 0).

import { execFileSync } from 'node:child_process';
import {
  readdirSync, readFileSync, writeFileSync, copyFileSync, cpSync, mkdirSync, rmSync,
  existsSync, statSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { extractToolCalls, DISPATCH_TOOLS, EDIT_TOOLS } from '../lib/transcript.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');
const SKILLS_DIR = join(REPO_ROOT, 'skills');
const WORK_DIR = join(HERE, '.work');
const TRANSCRIPTS_DIR = join(HERE, '.transcripts'); // survives the per-trial WORK_DIR wipe

const EXCLUDED = ['~/.reasonix/skills', '~/.agents/skills', '~/.agent/skills', '~/.claude/skills'];

// A tiny, concrete spec so turn 1 (writing-plans) has something to plan from —
// same shape as the exec harness's writing-plans scenario (docs/spec.md). Kept
// to a single small helper so turn-2 execution reaches a decisive first action
// fast instead of running out of steps mid-plan.
const SPEC_BODY = `# Spec: slugify(text)

A pure helper \`slugify(text)\` in \`src/slugify.js\` (plus \`src/slugify.test.js\`):

- lowercases the input
- replaces runs of whitespace with a single hyphen
- strips characters that are not \`[a-z0-9-]\`
- trims leading/trailing hyphens

Example: \`slugify("  Hello,  World! ")\` → \`"hello-world"\`.
`;

function resolveSessionsDir() {
  const out = execFileSync('reasonix', ['doctor'], { encoding: 'utf8' });
  const m = out.match(/sessions[\s\S]*?dir\s+(.+)/);
  if (!m) throw new Error('could not find sessions dir in `reasonix doctor` output');
  return m[1].trim().replace(/^~/, homedir());
}

function hasKey() {
  if (process.env.DEEPSEEK_API_KEY) return true;
  const envFile = join(REPO_ROOT, '.env');
  return existsSync(envFile) && /(^|\n)DEEPSEEK_API_KEY=\S/.test(readFileSync(envFile, 'utf8'));
}

// A FULLY ISOLATED fixture project. Critical: the skills are COPIED in and
// referenced by a RELATIVE path, and the workspace is its own git repo. An
// absolute skills path is a breadcrumb the model will follow straight into the
// real checkout — editing and even committing there (learned the hard way).
function buildFixture() {
  rmSync(WORK_DIR, { recursive: true, force: true });
  mkdirSync(join(WORK_DIR, 'src'), { recursive: true });
  mkdirSync(join(WORK_DIR, 'docs', 'reasonix', 'plans'), { recursive: true });

  // Copy this repo's skills locally so the config holds no path back to the real
  // repo. (Same technique as bench/exec/generate.mjs's isolatedConfig.)
  cpSync(SKILLS_DIR, join(WORK_DIR, '_skillsrc'), { recursive: true });

  const toml = [
    'default_model = "deepseek-flash"',
    '',
    '[skills]',
    'paths = ["./_skillsrc"]',
    `excluded_paths = [${EXCLUDED.map((p) => `"${p}"`).join(', ')}]`,
    'max_depth = 3',
    '',
    '[agent]',
    'temperature = 0.0',
    '',
    '[permissions]',
    'mode = "allow"',
    '',
  ].join('\n');
  writeFileSync(join(WORK_DIR, 'reasonix.toml'), toml);

  // Carry the skill-discipline pointer the same way the real repo does.
  if (existsSync(join(REPO_ROOT, 'AGENTS.md'))) {
    copyFileSync(join(REPO_ROOT, 'AGENTS.md'), join(WORK_DIR, 'AGENTS.md'));
  }

  // Spec for turn 1 to plan from; empty src/ for the dispatched work to land in.
  writeFileSync(join(WORK_DIR, 'docs', 'spec.md'), SPEC_BODY);
  writeFileSync(join(WORK_DIR, 'src', '.gitkeep'), '');

  // Make the fixture its own git repo so any `git commit` the model runs stays
  // here (and gets wiped next trial) instead of touching the real repo.
  const git = (...a) => execFileSync('git', a, { cwd: WORK_DIR, stdio: 'ignore' });
  git('init', '-q');
  git('add', '-A');
  git('-c', 'user.email=e@e', '-c', 'user.name=n', 'commit', '-q', '-m', 'fixture');
}

// reasonix flushes the session on exit, but be tolerant of a brief lag: poll
// for a new .jsonl for a couple of seconds before giving up.
function newestNewSession(sessionsDir, before) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const created = readdirSync(sessionsDir)
      .filter((f) => f.endsWith('.jsonl') && !before.has(f))
      .map((f) => ({ f, t: statSync(join(sessionsDir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    if (created.length) return join(sessionsDir, created[0].f);
    execFileSync('sleep', ['0.5']);
  }
  return null;
}

function runTurn(args, prompt) {
  try {
    execFileSync('reasonix', [...args, prompt], {
      stdio: ['ignore', 'pipe', 'pipe'], env: process.env, timeout: 300000,
    });
  } catch {
    // reasonix may exit non-zero (hit max-steps, etc.) — the session is still saved.
  }
}

const assistantText = (o) => {
  const c = o.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map((x) => x.text || '').join('');
  return '';
};

// SOURCE files only — the bug is the parent editing CODE in-session. The plan
// document (a .md under docs/) is legitimately the parent's to write, so it
// must NOT count. CODE_EXT is the set we treat as "implementation work".
const CODE_EXT = 'js|ts|tsx|jsx|mjs|cjs|svelte|vue|py|go|rs|java|rb|php|c|h|cpp';
function isSourceEditPath(p) {
  if (!p) return false;
  if (/\.md$/i.test(p)) return false;            // plan / docs
  if (/(^|\/)docs\//.test(p)) return false;       // anything under docs/
  return new RegExp(`\\.(${CODE_EXT})$`, 'i').test(p);
}

// A `bash` call that mutates a SOURCE file in THIS session (heredoc/redirect
// into a code file, tee, or sed -i) — flash sometimes edits this way instead
// of via write_file/edit_file, and it's still an in-session source edit.
function isInlineFileWriteBash(cmd) {
  if (!cmd) return false;
  if (/\bsed\s+-i\b/.test(cmd)) return true;
  if (new RegExp(`\\btee\\s+(?!/dev/)\\S*\\.(${CODE_EXT})\\b`).test(cmd)) return true;
  // redirection (> or >>) into a code file, excluding /dev/null and the like
  return new RegExp(`>>?\\s*(?!/dev/)\\S*\\.(${CODE_EXT})\\b`).test(cmd);
}

// One trial = the two-turn flow from the user's real session:
//   turn 1 — writing-plans (force-loaded) writes the plan and offers the two
//            execution options (its Execution Handoff section);
//   turn 2 — the user picks "1" (Subagent-Driven).
// Then classify ONLY turn-2 tool calls. Verdict:
//   'inline'        — the model edited files in THIS session (the bug)
//   'dispatch'      — dispatched via `task`, no in-session edits (correct)
//   'no-handoff'    — turn 1 never offered the execution choice (setup miss)
//   'inconclusive'  — handoff offered but turn 2 neither dispatched nor edited
function runTrial({ model, sessionsDir, n }) {
  buildFixture();
  const before = new Set(readdirSync(sessionsDir).filter((f) => f.endsWith('.jsonl')));

  // Turn 1: force-load writing-plans (so its body — incl. the handoff/dispatch
  // rule — is in context) and have it plan the spec. The skill's own Execution
  // Handoff section emits the "1) Subagent-Driven / 2) Inline" offer.
  process.stdout.write(`  trial ${n}: turn 1 (plan) ... `);
  runTurn(['run', '-dir', WORK_DIR, '-model', model, '-max-steps', '16'],
    'Use the `superpowers-writing-plans` skill — load it and follow it.\n\n'
    + 'We have agreed on the design in docs/spec.md. Write the implementation '
    + 'plan, then follow the skill through to its execution handoff.');

  const sessionPath = newestNewSession(sessionsDir, before);
  if (!sessionPath) {
    console.log('→ no-session');
    return { verdict: 'no-session', dispatched: 0, inlineEdits: 0, inlineCommits: 0, order: [] };
  }

  const t1objs = readFileSync(sessionPath, 'utf8').split('\n').filter((l) => l.trim())
    .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const offeredHandoff = t1objs.some((o) =>
    o.role === 'assistant' && /Subagent-Driven|Inline Execution|execution option|Which approach/i.test(assistantText(o)));

  // Turn 2: the user picks Subagent-Driven, exactly as in the real session.
  process.stdout.write('turn 2 ("1") ... ');
  runTurn(['run', '-dir', WORK_DIR, '-model', model, '-resume', sessionPath, '-max-steps', '16'], '1');

  // Classify ONLY turn-2 behavior (everything after the LAST user message, "1").
  const fullObjs = readFileSync(sessionPath, 'utf8').split('\n').filter((l) => l.trim())
    .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  let lastUserIdx = -1;
  for (let i = 0; i < fullObjs.length; i++) if (fullObjs[i].role === 'user') lastUserIdx = i;
  const turn2Json = fullObjs.slice(lastUserIdx + 1).map((o) => JSON.stringify(o)).join('\n');

  const calls = extractToolCalls(turn2Json);
  const bashCmd = (c) => c.args?.command ?? c.rawArgs ?? '';
  const pathOf = (c) => c.args?.path ?? c.args?.file_path ?? c.args?.file ?? '';
  const dispatched = calls.filter((c) => DISPATCH_TOOLS.has(c.name)).length;
  // Only SOURCE edits count as the bug; writing the plan .md does not.
  const nativeEdits = calls.filter((c) => EDIT_TOOLS.has(c.name) && isSourceEditPath(pathOf(c))).length;
  const bashEdits = calls.filter((c) => c.name === 'bash' && isInlineFileWriteBash(bashCmd(c))).length;
  const inlineEdits = nativeEdits + bashEdits;
  const inlineCommits = calls.filter((c) =>
    c.name === 'bash' && /git\s+commit/.test(bashCmd(c))).length;

  mkdirSync(TRANSCRIPTS_DIR, { recursive: true });
  copyFileSync(sessionPath, join(TRANSCRIPTS_DIR, `trial-${n}.jsonl`));

  let verdict;
  // The bug is "the model makes the changes directly in-session". An in-session
  // edit IS that — a `task` call alongside it doesn't excuse it. We still grade
  // turn 2 even if the handoff text wasn't detected (the offer wording varies);
  // a clean dispatch/inline is meaningful regardless. 'no-handoff' only when the
  // offer was missing AND turn 2 did nothing decisive.
  if (inlineEdits > 0) verdict = 'inline';
  else if (dispatched > 0) verdict = 'dispatch';
  else if (!offeredHandoff) verdict = 'no-handoff';
  else verdict = 'inconclusive';

  console.log(`→ ${verdict} (task:${dispatched} edits:${inlineEdits}[native:${nativeEdits} bash:${bashEdits}] commits:${inlineCommits})`);
  return { verdict, dispatched, inlineEdits, inlineCommits, order: calls.map((c) => c.name), sessionPath };
}

function main() {
  const model = (process.argv.find((a) => a.startsWith('--model=')) || '--model=deepseek-flash').split('=')[1];
  const trials = Number((process.argv.find((a) => a.startsWith('--trials=')) || '--trials=3').split('=')[1]) || 3;

  if (!hasKey()) {
    console.log('subagent-handoff repro: SKIPPED — no DEEPSEEK_API_KEY in env or .env');
    process.exit(0);
  }

  const sessionsDir = resolveSessionsDir();
  console.log(`subagent-driven handoff repro — model ${model}, ${trials} trial(s)\n`);

  const results = [];
  for (let n = 1; n <= trials; n++) results.push(runTrial({ model, sessionsDir, n }));

  const tally = (v) => results.filter((r) => r.verdict === v).length;
  const inline = tally('inline');
  const dispatch = tally('dispatch');
  const noHandoff = tally('no-handoff') + tally('no-session');
  const inconclusive = tally('inconclusive');
  const conclusive = inline + dispatch;

  console.log('\n=== summary ===');
  console.log(`  trials                         : ${trials}`);
  console.log(`  BUG (edited in-session)        : ${inline}`);
  console.log(`  correct (dispatched via task)  : ${dispatch}`);
  console.log(`  inconclusive / no-handoff      : ${inconclusive} / ${noHandoff}`);
  console.log(`  per-trial: ${results.map((r) => `[${r.verdict} t${r.dispatched}/e${r.inlineEdits}]`).join(' ')}`);
  console.log(`  transcripts: bench/repro/.transcripts/trial-*.jsonl`);

  if (inline > 0) {
    const pct = conclusive ? Math.round((inline / conclusive) * 100) : 0;
    console.log(`\nBUG REPRODUCED — ${inline}/${conclusive} conclusive trials (${pct}%) edited files in-session instead of dispatching subagents via \`task\`.`);
  } else if (dispatch > 0) {
    console.log(`\nNOT REPRODUCED this run — all ${conclusive} conclusive trials dispatched via \`task\`. Bug is intermittent; re-run with more --trials.`);
  } else {
    console.log('\nINCONCLUSIVE — no trial cleanly dispatched or edited. Inspect transcripts.');
  }
  // Exit non-zero when the bug fires, so this doubles as a regression signal.
  process.exit(inline > 0 ? 1 : 0);
}

main();
