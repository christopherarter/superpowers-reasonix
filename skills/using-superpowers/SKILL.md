---
name: using-superpowers
description: Starting ANY task? Load first — it picks the right skill before you act, explore, or ask.
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this skill.
</SUBAGENT-STOP>

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST invoke the skill.

IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.

This is not negotiable. This is not optional. You cannot rationalize your way out of this.
</EXTREMELY-IMPORTANT>

## Instruction Priority

These skills override default model behavior, but **user instructions always take precedence**:

1. **User's explicit instructions** (`AGENTS.md`, `REASONIX.md`, direct requests) — highest priority
2. **Skills** — override default behavior where they conflict
3. **Default behavior** — lowest priority

If `AGENTS.md`/`REASONIX.md` says "don't use TDD" and a skill says "always use TDD," follow the user. The user is in control.

## How to Access Skills in Reasonix

The system prompt carries a **pinned skills index** — one line per skill (name + description). That index is how you discover what exists. To load and follow a skill:

- **`run_skill {name, arguments?}`** — load an inline skill into the turn and follow it. For a `runAs: subagent` skill, `arguments` is required and becomes the child's entire task.
- **`read_skill {name}`** — load an inline skill body read-only. Works in **plan mode** (where `run_skill` does not). Use it to consult a skill without executing actions.
- **`/name [args]`** — the user fires a skill by hand.

Never `read_file` a `SKILL.md` to "read" a skill — use `run_skill`/`read_skill` so scope resolution and reference auto-folding happen correctly.

# Using Skills

## The Rule

**Invoke relevant or requested skills BEFORE any response or action.** Even a 1% chance a skill might apply means you invoke it to check. If an invoked skill turns out to be wrong for the situation, you don't have to use it.

```dot
digraph skill_flow {
    "User message received" [shape=doublecircle];
    "About to plan / enter plan mode?" [shape=doublecircle];
    "Already brainstormed?" [shape=diamond];
    "run_skill brainstorming" [shape=box];
    "Might any skill apply?" [shape=diamond];
    "run_skill (or read_skill in plan mode)" [shape=box];
    "Announce: 'Using [skill] to [purpose]'" [shape=box];
    "Has checklist?" [shape=diamond];
    "todo_write one todo per item" [shape=box];
    "Follow skill exactly" [shape=box];
    "Respond (including clarifications)" [shape=doublecircle];

    "About to plan / enter plan mode?" -> "Already brainstormed?";
    "Already brainstormed?" -> "run_skill brainstorming" [label="no"];
    "Already brainstormed?" -> "Might any skill apply?" [label="yes"];
    "run_skill brainstorming" -> "Might any skill apply?";

    "User message received" -> "Might any skill apply?";
    "Might any skill apply?" -> "run_skill (or read_skill in plan mode)" [label="yes, even 1%"];
    "Might any skill apply?" -> "Respond (including clarifications)" [label="definitely not"];
    "run_skill (or read_skill in plan mode)" -> "Announce: 'Using [skill] to [purpose]'";
    "Announce: 'Using [skill] to [purpose]'" -> "Has checklist?";
    "Has checklist?" -> "todo_write one todo per item" [label="yes"];
    "Has checklist?" -> "Follow skill exactly" [label="no"];
    "todo_write one todo per item" -> "Follow skill exactly";
}
```

## Red Flags

These thoughts mean STOP—you're rationalizing:

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE clarifying questions. |
| "Let me explore the codebase first" | Skills tell you HOW to explore. Check first. |
| "I can check git/files quickly" | Files lack conversation context. Check for skills. |
| "Let me gather information first" | Skills tell you HOW to gather information. |
| "This doesn't need a formal skill" | If a skill exists, use it. |
| "I remember this skill" | Skills evolve. Load the current version. |
| "This doesn't count as a task" | Action = task. Check for skills. |
| "The skill is overkill" | Simple things become complex. Use it. |
| "I'll just do this one thing first" | Check BEFORE doing anything. |
| "This feels productive" | Undisciplined action wastes time. Skills prevent this. |
| "I know what that means" | Knowing the concept ≠ using the skill. Invoke it. |

## Skill Priority

When multiple skills could apply:

1. **Process skills first** (brainstorming, systematic-debugging) — these determine HOW to approach the task
2. **Implementation skills second** — these guide execution

"Let's build X" → brainstorming first, then implementation skills.
"Fix this bug" → systematic-debugging first, then domain-specific skills.

## Skill Types

**Rigid** (TDD, debugging): Follow exactly. Don't adapt away discipline.

**Flexible** (patterns): Adapt principles to context.

The skill itself tells you which.

## User Instructions

Instructions say WHAT, not HOW. "Add X" or "Fix Y" doesn't mean skip workflows.
