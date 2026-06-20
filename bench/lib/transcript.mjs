// Tools whose invocation means "a skill was loaded".
export const SKILL_TOOLS = new Set(['run_skill', 'read_skill']);
// Dedicated wrappers that ARE a skill (the skill name is the tool name).
export const WRAPPER_TOOLS = new Set(['explore', 'review', 'research', 'security_review']);

// Reasonix's native subagent-dispatch tool. A call to this in the PARENT
// transcript means work was handed to an isolated child session.
export const DISPATCH_TOOLS = new Set(['task']);
// Native tools that mutate files directly in the CURRENT session. Seeing these
// in the parent transcript after a subagent-driven handoff means the model did
// the work inline instead of dispatching.
export const EDIT_TOOLS = new Set(['write_file', 'edit_file', 'multi_edit']);

/**
 * Parse a Reasonix session JSONL transcript into the ordered list of every
 * tool call, tolerating both the flat `{id,name,arguments}` shape and the
 * OpenAI-nested `{function:{name,arguments}}` shape. `arguments` is returned
 * raw (the JSON string Reasonix emits) plus a best-effort parsed `args`.
 * @param {string} jsonlText
 * @returns {{name:string, rawArgs:string, args:any}[]}
 */
export function extractToolCalls(jsonlText) {
  const calls = [];
  for (const line of jsonlText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj;
    try { obj = JSON.parse(trimmed); } catch { continue; }
    if (obj.role !== 'assistant' || !Array.isArray(obj.tool_calls)) continue;
    for (const tc of obj.tool_calls) {
      if (!tc) continue;
      const name = tc.name ?? tc.function?.name;
      const rawArgs = tc.arguments ?? tc.function?.arguments ?? '';
      if (!name) continue;
      let args = null;
      try { args = JSON.parse(rawArgs || '{}'); } catch { /* leave null */ }
      calls.push({ name, rawArgs, args });
    }
  }
  return calls;
}

/**
 * Parse a Reasonix session JSONL transcript into the ordered list of skills invoked.
 * @param {string} jsonlText
 * @returns {string[]} skill names, in invocation order (duplicates preserved)
 */
export function extractSkillInvocations(jsonlText) {
  const invocations = [];
  for (const line of jsonlText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj;
    try { obj = JSON.parse(trimmed); } catch { continue; }
    if (obj.role !== 'assistant' || !Array.isArray(obj.tool_calls)) continue;
    for (const tc of obj.tool_calls) {
      if (!tc) continue;
      // Reasonix's npm build uses a FLAT tool-call shape: {id, name, arguments}.
      // Tolerate the OpenAI-nested shape {function:{name, arguments}} as a fallback.
      const name = tc.name ?? tc.function?.name;
      const rawArgs = tc.arguments ?? tc.function?.arguments;
      if (!name) continue;
      if (SKILL_TOOLS.has(name)) {
        try {
          const args = JSON.parse(rawArgs || '{}');
          if (args && typeof args.name === 'string') invocations.push(args.name);
        } catch { /* unparseable args: skip this call */ }
      } else if (name === 'slash_command') {
        // The model can also invoke a skill via its user slash-command path:
        // slash_command({ command: "<skill-name>", arguments: "..." }).
        try {
          const args = JSON.parse(rawArgs || '{}');
          if (args && typeof args.command === 'string') {
            invocations.push(args.command.replace(/^\//, ''));
          }
        } catch { /* unparseable args: skip this call */ }
      } else if (WRAPPER_TOOLS.has(name)) {
        invocations.push(name);
      }
    }
  }
  return invocations;
}
