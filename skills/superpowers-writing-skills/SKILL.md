---
name: superpowers-writing-skills
description: Use when creating, editing, or testing Reasonix skills, before deploying them
---

# Writing Skills (for Reasonix)

## Overview

**Writing skills IS Test-Driven Development applied to process documentation.**

You write test cases (pressure scenarios with subagents), watch them fail (baseline behavior), write the skill, watch tests pass (the agent complies), and refactor (close loopholes).

**Core principle:** If you didn't watch an agent fail without the skill, you don't know if the skill teaches the right thing.

**REQUIRED BACKGROUND:** Understand the **superpowers-test-driven-development** skill first — it defines RED-GREEN-REFACTOR. This skill adapts it to documentation.

**Platform spec:** For the full Reasonix skill/hook/MCP contract, consult the `extending-reasonix` skill (or its reference files). This skill is the *authoring discipline*; that one is the *exhaustive spec*.

## What is a Skill?

A reusable playbook the model invokes via `run_skill` / `read_skill` (or the user via `/name`). Two kinds:

- **Inline** — the body folds into the turn as a tool result. Default.
- **Subagent** (`runAs: subagent`) — the body becomes a child agent's *system prompt*; it runs in isolation and returns only its final answer. Use only when the work is context-heavy and only the conclusion matters.

**Skills are:** reusable techniques, patterns, tools, reference guides. **Skills are NOT:** narratives about how you solved a problem once.

## Reasonix Skill Anatomy (get these right)

### Where skills live & how they're found
- Discovery roots, highest priority first: project `{.reasonix,.agents,.agent,.claude}/skills/` → `[skills] paths` in `reasonix.toml` → home `~/{.reasonix,...}/skills/` → built-ins.
- First match by name wins. A user skill named `review` overrides the built-in.
- Canonical layout: `<root>/skills/<name>/SKILL.md`. Flat `<name>.md` also works.

### Name
Regex: `^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$`. Letters/digits/`.`/`_`/`-`, ≤64 chars, alphanumeric start. Frontmatter `name:` overrides the directory stem.

### Frontmatter — parsed by Reasonix's OWN minimal parser, not real YAML
- `---` opens, next `---` closes. **An unclosed fence makes the WHOLE file the body** (no frontmatter at all). Always close the fence.
- Lines are `key: value`. Keys are **lowercased** (`runAs` = `runas`). Values trimmed of one layer of quotes.
- A key with empty value + `- item` lines = a list (joined comma-separated) — so `allowed-tools` can be a YAML list.
- **No block scalars** (`>`/`|`), no multi-line values, no real nesting. Keep every value on one line.

Recognized keys:

| Key | Effect |
|---|---|
| `name` | identifier (must pass the regex) |
| `description` | one-liner for the pinned index. **Missing = the skill is invisible** (loads, runs by exact name, but the model can't discover it) |
| `runAs` | `subagent` → isolated child; else inline |
| `model` | subagent only: child model (`provider`, bare model, or `provider/model`) |
| `effort` | subagent only: effort hint (`high`, `max`) |
| `allowed-tools` | subagent only: comma/list of literal registry tool names; scopes the child's tools |

### The pinned index is 130 chars per line
The system prompt lists every described skill as `- <name> [🧬 subagent] — <description>`, clipped to **130 chars including the name**. The whole block is capped at 4000 chars. So:
- **Front-load the description** with triggering conditions. The tail gets cut.
- Keep descriptions short. For a 22-char name you have ~100 chars of description before truncation.
- A skill meant only to be dispatched by another skill (a worker role) can OMIT `description` to stay out of the index entirely.

### references/ auto-fold (undocumented but load-bearing)
Every `references/*.md` sibling is **appended to the skill body at load time**, sorted by filename, each under `## Reference: <name>`. Put depth material there — it ships inline, no separate `read_file`. `scripts/`, `assets/`, `references/`, and dot-dirs are **never scanned** as nested skills. For a subagent skill, references become part of the child's system prompt — budget accordingly.

### Tool names are snake_case
`allowed-tools` and any tool you mention use registry names: `read_file`, `write_file`, `edit_file`, `multi_edit`, `ls`, `glob`, `grep`, `bash`, `web_fetch`, `todo_write`, `run_skill`, `read_skill`, `task`, `explore`. There is **no `web_search`** — only `web_fetch`. TitleCase names like `Read`/`Edit`/`Bash` do not exist; a typo in `allowed-tools` is silently dropped (the subagent just lacks that tool).

## Subagent Skills (authoring rules)

The body is the child's **system prompt**, not a message to the parent. Write it as: persona + procedure + output format, and state that the `arguments`/`task` string is its **entire** context.

- The child's only input is the `arguments` string. It has no conversation history. Tell it exactly what its task input will contain.
- It **cannot recurse** — `run_skill`/`task`/skill tools are stripped. It cannot load other skills. Fold any needed discipline (e.g. TDD) directly into the body or a `references/` file.
- It cannot have a back-and-forth mid-run; it returns one final message. Design "ask the controller" as a *status it reports* (e.g. `NEEDS_CONTEXT`) rather than an interactive question.
- Scope `allowed-tools` to the minimum. Empty = inherit all parent tools (minus meta-tools).

## When to Create a Skill

**Create when:** the technique wasn't intuitively obvious; you'd reference it again across projects; it applies broadly; others would benefit.

**Don't create for:** one-off solutions; standard well-documented practices; project-specific conventions (put those in `AGENTS.md`/`REASONIX.md`); mechanical constraints enforceable with a hook/lint (automate those — save skills for judgment calls).

## Claude/Agent Search Optimization (CSO)

**Critical:** future agents must FIND your skill via the description.

### Description = WHEN to use, NOT what it does

The single most important rule. The description should ONLY describe triggering conditions. Do NOT summarize the workflow.

**Why:** testing shows that when a description summarizes the workflow, the model follows the *description* instead of reading the skill body. A description saying "code review between tasks" caused a single review even though the skill specified TWO. When changed to just "Use when executing implementation plans with independent tasks," the model read the body and followed both steps.

```yaml
# ❌ BAD: summarizes workflow — the model may follow this instead of the skill
description: Use when executing plans - dispatches a subagent per task with review between tasks
# ❌ BAD: too much process detail
description: Use for TDD - write test first, watch it fail, write minimal code, refactor
# ✅ GOOD: triggering conditions only
description: Use when implementing any feature or bugfix, before writing implementation code
```

### Keyword coverage & naming
- Use words the model would search for: error messages ("race condition", "ENOTEMPTY"), symptoms ("flaky", "hanging"), tools (command/library names).
- Write the description in the third person (it's injected into the system prompt).
- Name by what you DO or the core insight, verb-first / gerund: `condition-based-waiting` > `async-test-helpers`; `superpowers-writing-plans` > `plan-authoring`.

### Cross-referencing other skills
Reference by bare name with an explicit marker: `**REQUIRED SUB-SKILL:** use the superpowers-test-driven-development skill`. Don't `read_file` another SKILL.md and don't `@`-link it — use `run_skill`/`read_skill` so scope resolution and auto-folding work.

## The Iron Law (Same as TDD)

```
NO SKILL WITHOUT A FAILING TEST FIRST
```

Applies to NEW skills AND EDITS. Write the skill before testing? Delete it. Start over. No exceptions for "simple additions" or "just a docs update."

## RED-GREEN-REFACTOR for Skills (with Reasonix subagents)

**RED — baseline.** Dispatch a subagent (`task`, `explore`, or a throwaway subagent skill) with a pressure scenario but **without** your skill in its context. Record verbatim: what choices it made, what rationalizations it used, which pressures triggered violations. You must see it fail before writing the skill.

**GREEN — minimal skill.** Write a skill addressing those *specific* rationalizations. Don't add content for hypothetical cases. Re-run the same scenarios with the skill loaded; the agent should now comply.

**REFACTOR — close loopholes.** New rationalization appears? Add an explicit counter. Re-test until bulletproof.

See the **Testing Skills With Subagents** reference (auto-included below) for pressure types and methodology.

## Bulletproofing Against Rationalization (for discipline skills)

- **Close every loophole explicitly.** Not "delete it" but "delete it. Start over. Don't keep it as reference. Don't adapt it. Delete means delete."
- **Address spirit-vs-letter** early: "Violating the letter of the rules is violating the spirit of the rules." Cuts off a whole class of rationalizations.
- **Build a rationalization table** from baseline testing — every excuse the agent made, with the reality.
- **Create a Red Flags list** so the agent can self-check when it's about to violate.

## Flowchart Usage

Use a small inline `dot` flowchart ONLY for non-obvious decision points, loops where you might stop too early, or "A vs B" choices. Never for reference material (use tables), code (use code blocks), or linear steps (use numbered lists).

## Anti-Patterns

- **❌ Narrative example** ("In session 2025-10-03 we found…") — too specific, not reusable
- **❌ Multi-language dilution** — one excellent example beats five mediocre ones
- **❌ Code inside flowcharts** — can't copy-paste
- **❌ Generic labels** (`step1`, `helper2`) — labels should carry meaning
- **❌ Summarizing the workflow in `description`** — the #1 discovery bug

## STOP: Before Moving to the Next Skill

After writing ANY skill, STOP and complete its test+deploy cycle. Do not batch-create skills without testing each. Deploying untested skills = deploying untested code.

## Skill Creation Checklist (TDD Adapted)

Use `todo_write` for each item.

**RED:** [ ] write pressure scenarios (3+ combined pressures for discipline skills) · [ ] run WITHOUT the skill, record baseline verbatim · [ ] identify rationalization patterns

**GREEN:** [ ] valid name (regex) · [ ] frontmatter fence closed; `name` + `description` present · [ ] description is triggering-conditions-only, front-loaded, fits ~130-char index line · [ ] third person · [ ] keywords for search · [ ] addresses the baseline failures · [ ] one excellent example · [ ] correct snake_case tool names · [ ] run WITH the skill, verify compliance

**REFACTOR:** [ ] add counters for new rationalizations · [ ] rationalization table · [ ] red-flags list · [ ] re-test until bulletproof

**Subagent skills:** [ ] body written as a system prompt · [ ] states the task is its entire context · [ ] `allowed-tools` scoped to minimum, valid names · [ ] no reliance on recursion or mid-run questions

**Deploy:** [ ] confirm discovery (the skill appears when you list skills / in the index) · [ ] invoke it with `/name` or `run_skill` to confirm it loads · [ ] commit to git

## The Bottom Line

Creating skills IS TDD for process documentation. Same Iron Law (no skill without a failing test first), same cycle (RED → GREEN → REFACTOR), same payoff (better quality, fewer surprises, bulletproof results).
