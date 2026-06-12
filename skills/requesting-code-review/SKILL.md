---
name: requesting-code-review
description: Finished a task or feature, or about to merge? Load this for a focused subagent review.
---

# Requesting Code Review

Dispatch a code-reviewer subagent to catch issues before they cascade. The reviewer gets precisely crafted context — never your session history. This keeps it focused on the work product and preserves your own context.

**Core principle:** Review early, review often.

## When to Request Review

**Mandatory:** after each task in subagent-driven development; after completing a major feature; before merge to main.

**Optional but valuable:** when stuck (fresh perspective); before refactoring (baseline check); after fixing a complex bug.

## How to Request

**1. Get the git range** (via `bash`):
```bash
BASE_SHA=$(git rev-parse HEAD~1)   # or origin/main
HEAD_SHA=$(git rev-parse HEAD)
```

**2. Dispatch the reviewer** with `run_skill`, passing everything in `arguments`:

```
run_skill {
  name: "code-reviewer",
  arguments: """
    What was implemented: <brief summary of what you built>
    Requirements / plan: <what it should do — task text or plan-file path>
    Git range: <BASE_SHA>..<HEAD_SHA>
  """
}
```

The `code-reviewer` subagent reads the diff itself and returns Strengths · Issues (Critical/Important/Minor) · Recommendations · Assessment.

**Alternative:** Reasonix ships a built-in **`review`** subagent skill for branch-diff review (`review {task: "..."}`). Use `code-reviewer` when you want the structured plan-alignment format above; use the built-in `review` for a quick general diff review.

**3. Act on feedback:**
- Fix **Critical** issues immediately
- Fix **Important** issues before proceeding
- Note **Minor** issues for later
- Push back if the reviewer is wrong (with technical reasoning) — see the **receiving-code-review** skill

## Example

```
[Just completed Task 2: add verifyIndex() and repairIndex()]

BASE_SHA=$(git rev-parse HEAD~1); HEAD_SHA=$(git rev-parse HEAD)

run_skill code-reviewer  arguments:
  What was implemented: verifyIndex() and repairIndex() with 4 issue types
  Requirements / plan: Task 2 from docs/reasonix/plans/deployment-plan.md
  Git range: a7981ec..3df7661

→ Strengths: clean architecture, real tests
  Issues — Important: missing progress indicators; Minor: magic number 100
  Assessment: ready to proceed with fixes

[Fix progress indicators → continue to Task 3]
```

## Red Flags

**Never:** skip review because "it's simple"; ignore Critical issues; proceed with unfixed Important issues; argue with valid technical feedback.

**If the reviewer is wrong:** push back with technical reasoning; show code/tests that prove it works; request clarification.
