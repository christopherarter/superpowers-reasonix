import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractSkillInvocations, extractToolCalls, DISPATCH_TOOLS, EDIT_TOOLS } from './transcript.mjs';

const jsonl = [
  JSON.stringify({ role: 'system', content: 'sys' }),
  JSON.stringify({ role: 'user', content: 'help me add a feature' }),
  JSON.stringify({ role: 'assistant', tool_calls: [
    { id: 'c1', type: 'function', function: { name: 'run_skill', arguments: JSON.stringify({ name: 'brainstorming', arguments: 'x' }) } },
  ] }),
  JSON.stringify({ role: 'tool', name: 'run_skill', tool_call_id: 'c1', content: 'ok' }),
  JSON.stringify({ role: 'assistant', tool_calls: [
    { id: 'c2', type: 'function', function: { name: 'explore', arguments: JSON.stringify({ task: 'look around' }) } },
    { id: 'c3', type: 'function', function: { name: 'read_file', arguments: JSON.stringify({ path: 'a' }) } },
  ] }),
].join('\n');

test('extracts run_skill name and wrapper tools, in order, ignoring plain tools', () => {
  assert.deepEqual(extractSkillInvocations(jsonl), ['brainstorming', 'explore']);
});

test('handles read_skill and tolerates malformed lines/arguments', () => {
  const t = [
    'not json',
    JSON.stringify({ role: 'assistant', tool_calls: [
      { function: { name: 'read_skill', arguments: '{bad json' } },
      { function: { name: 'run_skill', arguments: JSON.stringify({ name: 'systematic-debugging' }) } },
    ] }),
  ].join('\n');
  assert.deepEqual(extractSkillInvocations(t), ['systematic-debugging']);
});

test('empty transcript yields empty list', () => {
  assert.deepEqual(extractSkillInvocations(''), []);
});

test('parses the REAL flat reasonix tool-call shape {id,name,arguments}', () => {
  // Captured verbatim from a reasonix npm-v1.4.0-rc.1 session JSONL.
  const t = [
    JSON.stringify({ role: 'assistant', tool_calls: [
      { id: 'call_00_x', name: 'bash', arguments: '{"command": "ls -la"}' },
    ] }),
    JSON.stringify({ role: 'assistant', tool_calls: [
      { id: 'call_00_y', name: 'run_skill', arguments: JSON.stringify({ name: 'systematic-debugging', arguments: 'help' }) },
      { id: 'call_00_z', name: 'explore', arguments: '{"task":"look"}' },
    ] }),
  ].join('\n');
  assert.deepEqual(extractSkillInvocations(t), ['systematic-debugging', 'explore']);
});

test('counts a skill invoked via the slash_command path', () => {
  // Captured verbatim: the model ran the writing-skills skill as a slash command.
  const t = JSON.stringify({ role: 'assistant', tool_calls: [
    { id: 'c1', name: 'slash_command', arguments: JSON.stringify({ command: 'writing-skills', arguments: 'Explain the SKILL.md structure' }) },
  ] });
  assert.deepEqual(extractSkillInvocations(t), ['writing-skills']);
});

test('extractToolCalls returns every tool call in order with parsed args', () => {
  const t = [
    JSON.stringify({ role: 'user', content: 'go' }),
    JSON.stringify({ role: 'assistant', tool_calls: [
      { id: 'a', name: 'task', arguments: '{"description":"Task 1"}' },
      { id: 'b', name: 'write_file', arguments: '{"path":"src/x.js"}' },
    ] }),
    JSON.stringify({ role: 'assistant', tool_calls: [
      { function: { name: 'bash', arguments: '{"command":"git commit -m x"}' } },
    ] }),
  ].join('\n');
  const calls = extractToolCalls(t);
  assert.deepEqual(calls.map((c) => c.name), ['task', 'write_file', 'bash']);
  assert.equal(calls[0].args.description, 'Task 1');
  assert.equal(calls[1].args.path, 'src/x.js');
  assert.equal(calls[2].args.command, 'git commit -m x');
});

test('extractToolCalls tolerates malformed args (args=null, raw preserved)', () => {
  const t = JSON.stringify({ role: 'assistant', tool_calls: [
    { id: 'a', name: 'edit_file', arguments: '{bad json' },
  ] });
  const calls = extractToolCalls(t);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].args, null);
  assert.equal(calls[0].rawArgs, '{bad json');
});

test('dispatch vs edit tool sets classify the subagent-handoff bug', () => {
  // The whole point of the subagent-handoff probe: `task` = dispatched to a
  // child; write_file/edit_file/multi_edit = edited in THIS session.
  assert.ok(DISPATCH_TOOLS.has('task'));
  for (const e of ['write_file', 'edit_file', 'multi_edit']) assert.ok(EDIT_TOOLS.has(e));
  assert.ok(!EDIT_TOOLS.has('task'));
  assert.ok(!DISPATCH_TOOLS.has('write_file'));
});
