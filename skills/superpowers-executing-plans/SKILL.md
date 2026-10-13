---
name: superpowers-executing-plans
description: Executing a written plan yourself? Load first to track progress and verify each task.
---

# Executing Plans

Execute the plan yourself, task by task, in this session. The plan carries the design; a persistent ledger carries your decisions and progress through compaction. TDD is the per-task gate, and a fresh whole-branch review is the final second opinion.

**Announce at start:** "I'm using the superpowers-executing-plans skill to implement this plan."

Continue from one task to the next without asking the user to say "continue." User instructions and approvals already given remain valid. Keep commentary concise; the ledger and test output carry the detail.

## Setup

1. Verify an isolated worktree using **superpowers-using-git-worktrees**. Do not implement on `main` without explicit authorization.
2. Read the plan and linked spec. If they conflict, the spec is binding; when neither answers, make a reasonable ruling.
3. Create a task list with Reasonix `todo_write`. Todos show current status; they do not replace the ledger.
4. Create a ledger at `~/.reasonix/plan-ledgers/<repo>/<plan-name>.md` (or another persistent, plan-specific location). Its first line names the absolute plan path. Check for an existing ledger first; after compaction, trust its completed-task lines and `git log` rather than your memory. Never overwrite a ledger for a different plan.
5. Load **superpowers-test-driven-development** before Task 1. Scan task interfaces for conflicts and record pre-flight findings in the ledger. Record `Pre-flight: no shared interfaces` when none exist.

Keep plan-specific artifacts together. Don't remove another plan's ledger. If the ledger is lost, reconstruct completion from commits and tests before continuing.

## Task Loop

For each incomplete task:

1. Read that task's exact brief and note `BASE`, the commit before its work. Mark the todo in progress.
2. Follow its steps in RED-GREEN order. Run each command and compare actual output with its `Expected:` line. A test that passes before implementation needs investigation.
3. If code is wrong, load **superpowers-systematic-debugging** and find the cause. If the plan is wrong or ambiguous, make the smallest decision satisfying the spec and add `Task N: Ruling: <decision> — <why> — <cost if wrong>` to the ledger. Continue. An unrecorded deviation is a hidden decision.
4. Commit as the plan directs. Verify every named test exists and ran, every expected output was checked, and the final task test command passed. Load **superpowers-verification-before-completion** before claiming task completion.
5. Append `Task N: complete (commits <BASE>..<HEAD>, tests: <command> → <result>)` to the ledger only after the test passes. Mark the todo complete and take the next task.

Record rulings and completion as work happens, not at the end. After compaction, resume at the first task without a completion line. A task spanning multiple commits uses its saved `BASE`, not `HEAD~1`.

## When to Stop

Resolve routine conflicts and plan gaps by ruling and continuing. Stop only for an irreversible or destructive action, a security-sensitive action, an external side effect that normally needs user approval, or a plan so broken that every path forward is a guess. Existing user authorization satisfies a gate; do not ask twice.

## Whole-Branch Review

After all tasks pass, review the full range from the branch's merge base to `HEAD`, not only the last commit. Give a fresh native Reasonix `review` or `task` reviewer the plan, spec, diff, ledger rulings, and the plan's Review Focus. If no independent reviewer is available, perform a separate self-review and disclose that limit.

Re-grade findings by the effect on a reasonable user, even when the spec is silent. Fix critical and important findings in one pass: reproduce each with a failing test, make it pass, run the full suite, and record `Final: fixed <finding> — <test> RED→GREEN, suite <result>`. Record deferred minor findings in the ledger and final handoff. If you decline a substantive finding, ledger a ruling with the cost if wrong. Do not silently discard reviewer concerns.

Then load **superpowers-finishing-a-development-branch**. Report the verification evidence and all rulings and deferred minors. Preserve the ledger until the branch result is settled; remove only this plan's scratch files when they are no longer needed.

## Red Flags

| Thought | Reality |
|---|---|
| "I remember Task N" | Read the exact brief; memory is a summary. |
| "The test should pass" | Run it and read the output. |
| "I'll write ledger lines later" | Compaction may happen before later. Record each decision now. |
| "The plan is wrong, so I'll just do the right thing" | Rule, ledger the reason and cost, then continue. |
| "I should check in before the next task" | Continue through the authorized plan. |
| "I reviewed my own diff, so a fresh review adds nothing" | A fresh context can catch assumptions carried from implementation. |
