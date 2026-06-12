// Merge per-skill judge verdicts (results/<skill>/verdict.json, written by the
// in-session judge step) with mechanical.json into a single report.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const RESULTS = join(HERE, 'results');

export function buildReport(model = 'deepseek-flash') {
  const scenarios = readdirSync(join(HERE, 'scenarios')).filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(HERE, 'scenarios', f), 'utf8')));
  const perSkill = [];
  for (const s of scenarios) {
    const dir = join(RESULTS, s.skill);
    const mech = existsSync(join(dir, 'mechanical.json')) ? JSON.parse(readFileSync(join(dir, 'mechanical.json'), 'utf8')) : { mechanical: {}, skillLoaded: false };
    const verdict = existsSync(join(dir, 'verdict.json')) ? JSON.parse(readFileSync(join(dir, 'verdict.json'), 'utf8')) : { criteria: [] };
    const byId = Object.fromEntries((verdict.criteria || []).map((c) => [c.id, c]));
    const criteria = s.rubric.map((c) => {
      if (c.mechanical && mech.mechanical[c.id]) return { id: c.id, pass: mech.mechanical[c.id].pass, evidence: mech.mechanical[c.id].evidence, source: 'mechanical', hardGate: !!c.hardGate };
      const j = byId[c.id] || { pass: false, evidence: 'no judge verdict' };
      return { id: c.id, pass: !!j.pass, evidence: j.evidence, source: 'judge', hardGate: !!c.hardGate };
    });
    const passed = criteria.filter((c) => c.pass).length;
    perSkill.push({
      skill: s.skill, skillLoaded: mech.skillLoaded, score: criteria.length ? passed / criteria.length : 0,
      passed, total: criteria.length, hardGateFails: criteria.filter((c) => c.hardGate && !c.pass).map((c) => c.id), criteria,
    });
  }
  const scored = perSkill.filter((p) => p.skillLoaded);
  const overall = scored.length ? scored.reduce((a, p) => a + p.score, 0) / scored.length : 0;
  return { model, overall, notInvoked: perSkill.filter((p) => !p.skillLoaded).map((p) => p.skill), perSkill };
}

function main() {
  const report = buildReport();
  writeFileSync(join(RESULTS, 'report.json'), JSON.stringify(report, null, 2));
  for (const p of report.perSkill) {
    const mark = !p.skillLoaded ? 'NOT-INVOKED' : `${p.passed}/${p.total}`;
    console.log(`${(p.score).toFixed(2)}  ${p.skill.padEnd(32)} ${mark}${p.hardGateFails.length ? '  ✗HG:' + p.hardGateFails.join(',') : ''}`);
  }
  console.log(`\noverall execution fidelity: ${report.overall.toFixed(2)} (over ${report.perSkill.filter((p) => p.skillLoaded).length} invoked skills)`);
  console.log(`report: bench/exec/results/report.json`);
}
if (import.meta.url === `file://${process.argv[1]}`) main();
