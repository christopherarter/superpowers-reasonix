/**
 * @param {{id:string, expect?:string[], mustNotInvoke?:string[]}} testCase
 * @param {string[]} invocations  ordered skill names from the transcript
 */
export function scoreCase(testCase, invocations) {
  const expect = testCase.expect || [];
  const forbidden = testCase.mustNotInvoke || [];
  const invokedSet = new Set(invocations);

  const expectHit = expect.every((s) => invokedSet.has(s));
  const violated = forbidden.filter((s) => invokedSet.has(s));
  const pass = expectHit && violated.length === 0;

  const firstSkill = invocations.length ? invocations[0] : null;
  const expectedWasFirst = expect.length > 0 && firstSkill === expect[0];

  return { id: testCase.id, pass, expected: expect, invoked: invocations, firstSkill, expectedWasFirst, violated };
}
