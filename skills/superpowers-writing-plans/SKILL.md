---
name: superpowers-writing-plans
description: Got a spec or requirements for a multi-step task? Load first, before touching code.
---

# Writing Plans

## Overview

Write plans for an engineer who has not seen the codebase or spec but can write idiomatic code once the interface and test are exact. Record decisions they cannot know: files, names and signatures, values from the spec, and tests proving each task. DRY. YAGNI. TDD. Frequent commits.

**Announce at start:** "I'm using the superpowers-writing-plans skill to create the implementation plan."

**Context:** Isolated worktree? Created via the **superpowers-using-git-worktrees** skill at execution time.

**Save plans to:** `docs/reasonix/plans/YYYY-MM-DD-<feature-name>.md`
- (User plan-location preferences override this default)

## Scope Check

Spec spans multiple independent subsystems? Should have been split into sub-project specs during superpowers-brainstorming. If not, suggest separate plans — one per subsystem. Each plan produces working, testable software on its own.

## File Structure

Before tasks, map which files get created/modified and each one's responsibility. Decomposition locks in here.

- Clear boundaries, well-defined interfaces. One responsibility per file.
- You reason best about code held in context at once; focused files = reliable edits. Prefer small, focused files.
- Files that change together live together. Split by responsibility, not technical layer.
- Existing codebases: follow established patterns. Modifying an unwieldy file? Planning a split is fine.

## Step Granularity

**Each step = one action with a checkable result:**
- "Write the failing test" — step
- "Run it to make sure it fails" — step
- "Implement the minimal code to make the test pass" — step
- "Run the tests and make sure they pass" — step
- "Commit" — step

## Plan Document Header

**Every plan MUST start with this header:**

```markdown
# [Feature Name] Implementation Plan

> **For agentic workers:** implement this plan task-by-task — dispatch a fresh subagent per task with the native `task` tool (recommended for quality), or use the superpowers-executing-plans skill to work through it inline. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

**Spec:** [path to the spec/design doc this plan implements — the plan
argues from the spec, so the spec travels with it; executors read both]

## Review Focus

[List the five input classes or failure modes implied by the spec that no task's tests yet exercise and are most likely to affect users. For each, state the input or condition and expected behavior. Add a test for each to the owning task. If none, say you checked and found none.]

---
```

## Task Structure

````markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`

- [ ] **Step 1: Write the failing test**

```python
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/path/test.py::test_name -v`
Expected: FAIL with "function not defined"

- [ ] **Step 3: Implement `function(input: InputType) -> ResultType` in `exact/path/to/file.py`**

One line on the approach if the signature and test leave a material choice. Include a body only for an algorithm they do not determine or exact code the spec fixes.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/path/test.py::test_name -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/path/test.py src/path/file.py
git commit -m "feat: add specific feature"
```
````

## What Each Step Contains

A step should let the implementer write exactly one reasonable thing:

- **Test:** test name and assertions as code, with the spec's exact values.
- **Code:** exact file and signature, plus values fixed by the spec. Include a body only when the test and signature do not determine the algorithm.
- **Verification:** exact command and expected pass output.
- **Cross-task reference:** name the interface from the producing task's Interfaces block. Do not duplicate its code.

Reject placeholders such as "TBD", "handle edge cases", or "write tests for the above". Also reject a plan that writes out an obvious implementation body: it adds volume without deciding anything.

## Remember
- Exact file paths always
- Exact signatures and tests; code bodies only where needed to remove ambiguity
- Exact commands with expected output
- DRY, YAGNI, TDD, frequent commits

## Self-Review

After the full plan, reread the spec fresh and check the plan against it. Checklist you run yourself — not a subagent dispatch.

**1. Spec coverage:** Skim each spec section/requirement. Point to a task implementing it? List gaps.

**2. Step scan:** Each step permits exactly one reasonable implementation choice. Remove vague placeholders and redundant bodies.

**3. Type consistency:** Types, method signatures, property names in later tasks match earlier tasks? `clearLayers()` in Task 3 but `clearFullLayers()` in Task 7 is a bug.

**4. Review Focus:** Identify the five most likely input classes or failure modes implied by the spec but not yet covered. Add each test to its owning task. Silence in the spec is not permission for common input to break.

**5. Proportion:** If the plan is several times longer than the spec or code blocks dominate, replace obvious bodies with signatures and assertions while preserving all decisions.

Fix inline. No re-review — fix and move on. Spec requirement with no task? Add the task.

## Execution Handoff

After saving and reviewing the plan, link it for the user to inspect. If they already chose an execution method, preserve it; otherwise explain the native `task` per-task approach and inline execution, recommend one based on the plan, and ask for their choice. Existing user authorization for the work and method still applies.

**"Plan complete and saved to `docs/reasonix/plans/<filename>.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session with checkpoints.

**Which approach?"**

**If Subagent-Driven chosen — you are the ORCHESTRATOR, not the implementer.** Dispatch a fresh subagent per task with the native **`task`** tool, each with a step budget big enough to implement + test + commit (a too-small budget makes the subagent stop early and tempts you to finish its work). **You do NOT call `write_file`/`edit_file`/`multi_edit`, run the implementation, or commit code in this session — every code change happens INSIDE a dispatched subagent.** Per task: the subagent implements + tests + commits (folding in superpowers-test-driven-development); then before moving on, verify it matches the spec (nothing more/less) and code-review the result with the native **`review`** tool. Use **`wait`** to join parallel jobs. Keep the implementer free of parent context — give it exactly the task text it needs.

**Two traps that put edits back in this session — both forbidden:**
- Dispatching a `task` and *then* editing the code yourself anyway.
- A subagent stops early, leaves the task incomplete, or gets it wrong — and you "just finish it" / "quickly fix it" / "clean it up" yourself. **No.** Dispatch ANOTHER `task` to finish or redo it (give the new subagent a generous step budget). Completing a subagent's work in-session is still doing it in-session.

Catch yourself about to touch a source file for ANY reason — implementing, finishing, fixing, reformatting — STOP and dispatch a `task` instead.

**If Inline Execution chosen:** REQUIRED SUB-SKILL — use the **superpowers-executing-plans** skill (batch execution with checkpoints).
