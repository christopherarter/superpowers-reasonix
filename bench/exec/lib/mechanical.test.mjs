import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { editPrecedes, failingTestRunBetween, passingTestRunAfter, noWriteBeforeSignal, runMechanical } from './mechanical.mjs';

const calls = [
  { name: 'write_file', args: { path: 'tests/slug.test.mjs' }, resultText: 'wrote' },
  { name: 'bash', args: { command: 'node --test tests/' }, resultText: 'tests 1\n# fail 1' },
  { name: 'write_file', args: { path: 'src/strings.mjs' }, resultText: 'wrote' },
  { name: 'bash', args: { command: 'node --test tests/' }, resultText: 'tests 1\n# pass 1\n# fail 0' },
];

test('editPrecedes: test file before impl file', () => {
  assert.equal(editPrecedes(calls, 'tests/**', 'src/strings.mjs').pass, true);
  assert.equal(editPrecedes(calls, 'src/strings.mjs', 'tests/**').pass, false);
});

test('failingTestRunBetween: a failing run sits between test-edit and impl-edit', () => {
  assert.equal(failingTestRunBetween(calls, 'tests/**', 'src/strings.mjs').pass, true);
});

test('passingTestRunAfter: a passing run after the impl edit', () => {
  assert.equal(passingTestRunAfter(calls, 'src/strings.mjs').pass, true);
});

test('noWriteBeforeSignal: false when a write precedes the signal tool', () => {
  const c = [{ name: 'write_file', args: { path: 'a' }, resultText: '' }, { name: 'ask', args: {}, resultText: '' }];
  assert.equal(noWriteBeforeSignal(c, ['ask']).pass, false);
  const c2 = [{ name: 'ask', args: {}, resultText: '' }, { name: 'write_file', args: { path: 'a' }, resultText: '' }];
  assert.equal(noWriteBeforeSignal(c2, ['ask']).pass, true);
});

test('runMechanical dispatches by string and reports unknown checks', () => {
  assert.equal(runMechanical('editPrecedes:tests/**:src/strings.mjs', calls, null).pass, true);
  const r = runMechanical('bogusCheck:x', calls, null);
  assert.equal(r.pass, false);
  assert.match(r.evidence, /unknown/i);
});

test('globs match ABSOLUTE tool-call paths as a suffix, and **/*.test.mjs matches test/ or tests/', () => {
  // Real reasonix tool calls use absolute temp paths; the model may use test/ (singular).
  const abs = [
    { name: 'write_file', args: { path: '/tmp/exec-x/test/strings.test.mjs' }, resultText: 'wrote' },
    { name: 'bash', args: { command: 'cd /tmp/exec-x && node --test test/' }, resultText: '# fail 1' },
    { name: 'edit_file', args: { path: '/tmp/exec-x/src/strings.mjs' }, resultText: 'ok' },
    { name: 'bash', args: { command: 'cd /tmp/exec-x && node --test test/' }, resultText: '# pass 1\n# fail 0' },
  ];
  assert.equal(editPrecedes(abs, '**/*.test.mjs', 'src/strings.mjs').pass, true);
  assert.equal(failingTestRunBetween(abs, '**/*.test.mjs', 'src/strings.mjs').pass, true);
  assert.equal(passingTestRunAfter(abs, 'src/strings.mjs').pass, true);
});

test('artifactExists + grepArtifactAbsent via runMechanical over a temp workspace', () => {
  const dir = mkdtempSync(join(tmpdir(), 'exec-'));
  mkdirSync(join(dir, 'docs'));
  writeFileSync(join(dir, 'docs/plan.md'), '# Plan\n- [ ] Task 1\nreal content');
  assert.equal(runMechanical('artifactExists:docs/*.md', [], dir).pass, true);
  assert.equal(runMechanical('grepArtifactAbsent:docs/plan.md:TODO|TBD', [], dir).pass, true);
  writeFileSync(join(dir, 'docs/plan.md'), '# Plan\nTODO: fill in');
  assert.equal(runMechanical('grepArtifactAbsent:docs/plan.md:TODO|TBD', [], dir).pass, false);
});
