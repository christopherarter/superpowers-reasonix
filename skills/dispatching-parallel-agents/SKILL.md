---
name: dispatching-parallel-agents
description: 2+ unrelated problems, no shared state? Load this — run each in its own subagent.
---

# Dispatching Parallel Agents

## Overview

You delegate problems to focused subagents with isolated context. By crafting their input precisely, you keep them on task and preserve your own context for coordination. They never inherit your session history — you construct exactly what they need.

When you have multiple unrelated failures (different test files, different subsystems, different bugs), investigating them sequentially wastes time. Each investigation is independent.

**Core principle:** One subagent per independent problem domain.

## How Reasonix Runs Subagents (read this first)

Two dispatch mechanisms:
- **`explore`** (built-in subagent skill, read-only) — `explore {task: "..."}`. Best for investigation: read-only subagents are dispatched as a **parallel batch** by the harness.
- **`task`** (generic subagent) / **`run_skill`** against a subagent skill — for custom roles.

The load-bearing constraint: **only read-only work parallelizes cleanly.** A batch of subagents that all just read/search runs concurrently. Subagents that *write* the same files will conflict, and the permission layer serializes writers. So:

- **Parallel investigation** (find root causes, map subsystems, gather evidence) → dispatch multiple read-only subagents at once. ✅
- **Parallel fixing** (editing code) → do NOT fan out writers over shared files. Either fix sequentially after the parallel investigation returns, or give each writer its own **worktree** (see the **using-git-worktrees** skill) so they can't collide.

The high-value pattern: **fan out to investigate in parallel, then integrate and fix yourself (or one domain at a time).**

## When to Use

**Use when:** 3+ test files failing with different root causes; multiple subsystems broken independently; each problem can be understood without context from the others; no shared state between investigations.

**Don't use when:** failures are related (fixing one might fix others — investigate together first); you need full system context to understand any of it; you don't yet know what's broken (exploratory); the work is write-heavy over shared files (isolate with worktrees or go sequential).

## The Pattern

### 1. Identify Independent Domains
Group failures by what's broken — e.g. File A: tool approval flow · File B: batch completion · File C: abort functionality. Each is independent.

### 2. Create Focused Subagent Tasks
Each subagent's `task`/`arguments` gives it:
- **Specific scope** — one test file or subsystem
- **Clear goal** — "find the root cause of these failures" (investigation) 
- **Constraints** — "read-only; do not edit code; report findings"
- **Expected output** — a summary of root cause with `file:line`

### 3. Dispatch the Investigation Batch
```
explore  task: "Find the root cause of the 3 failures in src/agents/agent-tool-abort.test.ts: <names + errors>. Read-only — report root cause with file:line, don't fix."
explore  task: "Find the root cause of the 2 failures in batch-completion-behavior.test.ts: <names + errors>. Read-only — report root cause with file:line."
explore  task: "Find the root cause of the failure in tool-approval-race-conditions.test.ts: <name + error>. Read-only — report root cause with file:line."
```

### 4. Integrate and Fix
When the subagents return: read each summary; confirm the root causes don't overlap; then apply fixes yourself (or one domain at a time, or in per-domain worktrees). Run the full test suite. Verify (use the **verification-before-completion** skill).

## Good Subagent Input

1. **Focused** — one clear problem domain
2. **Self-contained** — all context needed to understand the problem (paste the error messages and test names; the subagent has nothing else)
3. **Specific about output** — what should it return, in what shape?

```
Investigate the 3 failing tests in src/agents/agent-tool-abort.test.ts:
1. "should abort tool with partial output capture" — expects 'interrupted at' in message
2. "should handle mixed completed and aborted tools" — fast tool aborted instead of completed
3. "should properly track pendingToolCount" — expects 3 results, gets 0

These look like timing/race issues. Read the test file and the abort implementation.
Identify the root cause of each. READ-ONLY — do not edit. Do NOT just suggest increasing
timeouts; find the real issue.

Return: for each test, the root cause with file:line and a one-line proposed fix.
```

## Common Mistakes

- **❌ Too broad** ("fix all the tests") → **✅** one focused domain per subagent
- **❌ No context** ("fix the race condition") → **✅** paste the errors and test names
- **❌ Fanning out writers over shared files** → **✅** investigate in parallel, fix sequentially or in worktrees
- **❌ Vague output** ("fix it") → **✅** "return root cause + file:line + proposed fix"

## Verification

After subagents return: review each summary; check for overlap; apply fixes; run the full suite; spot-check (subagents can make systematic errors). Never claim done without running the verification command yourself.
