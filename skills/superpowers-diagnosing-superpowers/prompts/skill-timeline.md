Read the analyst-common.md at the absolute path supplied in your task first; it gives your role, inputs,
context-safety rules, and the return format. This file adds the dimension.

Dimension: Skill timeline

Build the per-human-turn record of skill and plugin use, then look for gaps.

1. List the human prompts with line numbers and timestamps.
2. Using the skill-invocation and attribution meanings established in the case
   file, list every explicit invocation, active-skill attribution, or read of a
   file named `SKILL.md`. Record the line, the skill name, and the human turn it
   happened in.
3. List every non-superpowers plugin, skill, agent type, MCP server, or
   hook used. Use only the evidenced tool, attribution, agent-dispatch, MCP,
   and hook meanings recorded in the case file; identify values associated
   with something other than `superpowers`.
4. For each human turn, compare the request text against trigger
   descriptions **evidenced for that session at that time**: a captured
   session-context catalog, archived installation, or dated file content
   established in CASE. A currently installed `SKILL.md` is only a current
   observation; do not use it to claim a past missed or late trigger unless
   you have evidence that the same description was active then. If historical
   descriptions are unavailable, mark this comparison unresolved. Report as findings:
   - a skill invoked, with the request that preceded it (one finding per
     invocation is fine when there are few; group by skill when many);
   - a turn whose request matches a skill's trigger description with no
     invocation in that turn (state which description matched and quote
     the request);
   - a skill invoked one or more turns after the matching request (late);
   - each non-superpowers plugin/skill/tool used, with where.

Do not say whether a missed or late trigger was wrong. Report the match
and the absence; the reader decides.
