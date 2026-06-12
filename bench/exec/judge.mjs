import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');

export const JUDGE_INSTRUCTION = `You are scoring whether an agent followed a skill's discipline once it loaded the skill.
You are given: the SKILL BODY (the rules), the RUBRIC, the agent's TRANSCRIPT (ordered tool calls + its text), deterministic MECHANICAL RESULTS, and a listing of FILES the agent produced.
For EACH rubric criterion return { id, pass, evidence } where evidence is a short verbatim quote or concrete observation.
Rules:
- MECHANICAL RESULTS are authoritative. If a criterion has a mechanical result, use it exactly; never mark a mechanically-failed hardGate criterion as pass.
- Be strict. Absence of evidence is a fail, not a pass.
- Judge ONLY what the transcript shows. Do not assume good intent.
Return ONLY the criteria array.`;

export const JUDGE_SCHEMA = {
  type: 'object',
  required: ['criteria'],
  properties: {
    criteria: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'pass', 'evidence'],
        properties: { id: { type: 'string' }, pass: { type: 'boolean' }, evidence: { type: 'string' } },
      },
    },
  },
};

function renderTranscript(jsonl) {
  const out = [];
  for (const line of jsonl.split('\n')) {
    const t = line.trim(); if (!t) continue;
    let o; try { o = JSON.parse(t); } catch { continue; }
    if (o.role === 'user') out.push(`USER: ${String(o.content).slice(0, 400)}`);
    else if (o.role === 'assistant') {
      if (o.content) out.push(`ASSISTANT: ${String(o.content).slice(0, 600)}`);
      for (const tc of o.tool_calls || []) out.push(`  CALL ${tc.name ?? tc.function?.name}(${String(tc.arguments ?? tc.function?.arguments ?? '').slice(0, 160)})`);
    } else if (o.role === 'tool') out.push(`  -> ${String(o.content).slice(0, 200)}`);
  }
  return out.join('\n');
}

/** Build the judge payload for a generated skill result. */
export function buildJudgePayload(scenario) {
  const dir = join(HERE, 'results', scenario.skill);
  const skillBody = readFileSync(join(REPO_ROOT, 'skills', scenario.skill, 'SKILL.md'), 'utf8');
  const mechanical = existsSync(join(dir, 'mechanical.json')) ? JSON.parse(readFileSync(join(dir, 'mechanical.json'), 'utf8')) : { mechanical: {} };
  const transcript = existsSync(join(dir, 'transcript.jsonl')) ? renderTranscript(readFileSync(join(dir, 'transcript.jsonl'), 'utf8')) : '(no transcript)';
  return { skill: scenario.skill, skillBody, rubric: scenario.rubric, mechanicalResults: mechanical.mechanical, transcript };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1];
  const scenario = JSON.parse(readFileSync(join(HERE, 'scenarios', `${only}.json`), 'utf8'));
  console.log(JSON.stringify(buildJudgePayload(scenario), null, 2));
}
