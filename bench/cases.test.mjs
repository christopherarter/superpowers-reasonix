import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadSkills, EXPECT_NO_DESCRIPTION } from './lib/skills.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const lines = readFileSync(join(here, 'cases.jsonl'), 'utf8').split('\n').filter((l) => l.trim());
const cases = lines.map((l) => JSON.parse(l)); // throws if any line is malformed

test('every case has id, prompt, and an expect array', () => {
  const ids = new Set();
  for (const c of cases) {
    assert.ok(c.id && !ids.has(c.id), `unique id required: ${c.id}`);
    ids.add(c.id);
    assert.equal(typeof c.prompt, 'string');
    assert.ok(Array.isArray(c.expect));
  }
});

test('every discoverable skill is covered by at least one positive case', () => {
  const discoverable = loadSkills(join(here, '..', 'skills'))
    .filter((s) => !EXPECT_NO_DESCRIPTION.has(s.name))
    .map((s) => s.name);
  const covered = new Set(cases.flatMap((c) => c.expect));
  const missing = discoverable.filter((n) => !covered.has(n));
  assert.deepEqual(missing, [], `uncovered skills: ${missing.join(', ')}`);
});

test('has at least two negative cases', () => {
  const negatives = cases.filter((c) => c.expect.length === 0);
  assert.ok(negatives.length >= 2, 'need >=2 negative cases');
});
