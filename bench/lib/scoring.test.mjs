import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreCase } from './scoring.mjs';

test('pass when expected skill invoked anywhere', () => {
  const r = scoreCase({ id: 'a', expect: ['brainstorming'] }, ['explore', 'brainstorming']);
  assert.equal(r.pass, true);
  assert.equal(r.firstSkill, 'explore');
  assert.equal(r.expectedWasFirst, false);
});

test('fail when expected skill never invoked', () => {
  const r = scoreCase({ id: 'b', expect: ['brainstorming'] }, ['explore']);
  assert.equal(r.pass, false);
});

test('expectedWasFirst true when first invocation matches', () => {
  const r = scoreCase({ id: 'c', expect: ['systematic-debugging'] }, ['systematic-debugging']);
  assert.equal(r.expectedWasFirst, true);
});

test('mustNotInvoke fails the case if a forbidden skill fires', () => {
  const r = scoreCase({ id: 'd', expect: [], mustNotInvoke: ['brainstorming'] }, ['brainstorming']);
  assert.equal(r.pass, false);
  assert.deepEqual(r.violated, ['brainstorming']);
});

test('negative case passes when nothing forbidden fires', () => {
  const r = scoreCase({ id: 'e', expect: [], mustNotInvoke: ['brainstorming'] }, []);
  assert.equal(r.pass, true);
  assert.equal(r.firstSkill, null);
});
