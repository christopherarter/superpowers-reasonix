import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const WRITE_TOOLS = new Set(['write_file', 'edit_file', 'multi_edit']);
const TEST_RE = /\b(node --test|npm test|npm run test|vitest|jest|pytest|go test)\b/;
const FAIL_RE = /# fail [1-9]|not ok|\bFAILED\b|\bfailed\b|Error:|exit code [1-9]/i;
const PASS_RE = /# fail 0|# pass [1-9]|all tests passed|ok \d|PASS\b/i;

function globToRe(glob) {
  const esc = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, ' ').replace(/\*/g, '[^/]*').replace(/ /g, '.*');
  return new RegExp('^' + esc + '$');
}
function pathOf(call) {
  const a = call.args || {};
  return a.path || a.file_path || a.file || a.filename || '';
}
function isWrite(call) { return WRITE_TOOLS.has(call.name); }
function isTestRun(call) { return call.name === 'bash' && TEST_RE.test(call.args?.command || ''); }
function firstWriteIndex(calls, glob) {
  const re = globToRe(glob);
  return calls.findIndex((c) => isWrite(c) && re.test(pathOf(c)));
}

export function editPrecedes(calls, aGlob, bGlob) {
  const ai = firstWriteIndex(calls, aGlob);
  const bi = firstWriteIndex(calls, bGlob);
  if (ai === -1) return { pass: false, evidence: `no write matching ${aGlob}` };
  if (bi === -1) return { pass: false, evidence: `no write matching ${bGlob}` };
  return { pass: ai < bi, evidence: `${aGlob}@${ai} ${ai < bi ? 'before' : 'after'} ${bGlob}@${bi}` };
}

export function failingTestRunBetween(calls, testGlob, implGlob) {
  const ti = firstWriteIndex(calls, testGlob);
  const ii = firstWriteIndex(calls, implGlob);
  if (ti === -1) return { pass: false, evidence: `no test write matching ${testGlob}` };
  const upper = ii === -1 ? calls.length : ii;
  for (let k = ti + 1; k < upper; k++) {
    if (isTestRun(calls[k]) && FAIL_RE.test(calls[k].resultText)) {
      return { pass: true, evidence: `failing test run at ${k}: ${calls[k].resultText.slice(0, 60)}` };
    }
  }
  return { pass: false, evidence: `no failing test run between test write and impl write` };
}

export function passingTestRunAfter(calls, implGlob) {
  const ii = firstWriteIndex(calls, implGlob);
  if (ii === -1) return { pass: false, evidence: `no impl write matching ${implGlob}` };
  for (let k = ii + 1; k < calls.length; k++) {
    if (isTestRun(calls[k]) && PASS_RE.test(calls[k].resultText) && !FAIL_RE.test(calls[k].resultText)) {
      return { pass: true, evidence: `passing test run at ${k}` };
    }
  }
  return { pass: false, evidence: `no passing test run after impl write` };
}

export function noWriteBeforeSignal(calls, signalTools) {
  const sig = new Set(signalTools);
  for (const c of calls) {
    if (sig.has(c.name)) return { pass: true, evidence: `signal ${c.name} reached with no prior write` };
    if (isWrite(c)) return { pass: false, evidence: `write ${pathOf(c)} before any of [${signalTools}]` };
  }
  return { pass: true, evidence: `no writes at all` };
}

export function calledTool(calls, name) {
  const hit = calls.some((c) => c.name === name);
  return { pass: hit, evidence: hit ? `called ${name}` : `never called ${name}` };
}

export function bashMatches(calls, reSource) {
  const re = new RegExp(reSource);
  const hit = calls.find((c) => c.name === 'bash' && re.test(c.args?.command || ''));
  return { pass: !!hit, evidence: hit ? `bash matched /${reSource}/: ${hit.args.command.slice(0, 60)}` : `no bash matched /${reSource}/` };
}

export function noBashBefore(calls, reSource, signalTools) {
  const re = new RegExp(reSource);
  const sig = new Set(signalTools);
  for (const c of calls) {
    if (sig.has(c.name)) return { pass: true, evidence: `signal reached first` };
    if (c.name === 'bash' && re.test(c.args?.command || '')) return { pass: false, evidence: `bash /${reSource}/ before signal: ${c.args.command.slice(0, 50)}` };
  }
  return { pass: true, evidence: `no matching bash` };
}

export function artifactExists(workspaceDir, glob) {
  if (!workspaceDir) return { pass: false, evidence: 'no workspace' };
  const re = globToRe(glob);
  const found = walk(workspaceDir).find((rel) => re.test(rel));
  return { pass: !!found, evidence: found ? `found ${found}` : `no file matching ${glob}` };
}

export function grepArtifactAbsent(workspaceDir, fileGlob, reSource) {
  if (!workspaceDir) return { pass: false, evidence: 'no workspace' };
  const re = globToRe(fileGlob);
  const file = walk(workspaceDir).find((rel) => re.test(rel));
  if (!file) return { pass: false, evidence: `no file matching ${fileGlob}` };
  const body = readFileSync(join(workspaceDir, file), 'utf8');
  const bad = new RegExp(reSource, 'i').exec(body);
  return { pass: !bad, evidence: bad ? `matched /${reSource}/ in ${file}: "${bad[0]}"` : `clean: ${file}` };
}

function walk(dir, base = '') {
  const out = [];
  for (const e of readdirSync(dir)) {
    if (e === '.git' || e === 'node_modules') continue;
    const abs = join(dir, e);
    const rel = base ? `${base}/${e}` : e;
    if (statSync(abs).isDirectory()) out.push(...walk(abs, rel));
    else out.push(rel);
  }
  return out;
}

const REGISTRY = {
  editPrecedes: (calls, ws, [a, b]) => editPrecedes(calls, a, b),
  failingTestRunBetween: (calls, ws, [a, b]) => failingTestRunBetween(calls, a, b),
  passingTestRunAfter: (calls, ws, [a]) => passingTestRunAfter(calls, a),
  noWriteBeforeSignal: (calls, ws, args) => noWriteBeforeSignal(calls, args),
  calledTool: (calls, ws, [a]) => calledTool(calls, a),
  bashMatches: (calls, ws, [a]) => bashMatches(calls, a),
  noBashBefore: (calls, ws, [re, ...sig]) => noBashBefore(calls, re, sig),
  artifactExists: (calls, ws, [a]) => artifactExists(ws, a),
  grepArtifactAbsent: (calls, ws, [a, b]) => grepArtifactAbsent(ws, a, b),
};

/** Parse "fn:argA:argB" and dispatch. Regex/glob args must not contain ':'. */
export function runMechanical(checkStr, calls, workspaceDir) {
  const [fn, ...args] = checkStr.split(':');
  const impl = REGISTRY[fn];
  if (!impl) return { pass: false, evidence: `unknown mechanical check: ${fn}` };
  return impl(calls, workspaceDir, args);
}
