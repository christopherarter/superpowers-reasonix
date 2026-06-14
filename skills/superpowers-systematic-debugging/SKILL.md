---
name: superpowers-systematic-debugging
description: Any bug, failing or flaky test, or surprise behavior? Load BEFORE you investigate or guess.
---

# Systematic Debugging

## Overview

Random fixes waste time and create new bugs. Quick patches mask underlying issues.

**Core principle:** ALWAYS find root cause before attempting fixes. Symptom fixes are failure.

**Violating the letter of this process is violating the spirit of debugging.**

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

If you haven't completed Phase 1, you cannot propose fixes.

## When to Use

Use for ANY technical issue: test failures, bugs in production, unexpected behavior, performance problems, build failures, integration issues.

**Use this ESPECIALLY when:**
- Under time pressure (emergencies make guessing tempting)
- "Just one quick fix" seems obvious
- You've already tried multiple fixes
- Previous fix didn't work
- You don't fully understand the issue

**Don't skip when:**
- Issue seems simple (simple bugs have root causes too)
- You're in a hurry (rushing guarantees rework)
- Manager wants it fixed NOW (systematic is faster than thrashing)

## The Four Phases

You MUST complete each phase before proceeding to the next.

### Phase 1: Root Cause Investigation

**BEFORE attempting ANY fix:**

1. **Read Error Messages Carefully**
   - Don't skip past errors or warnings — they often contain the exact solution
   - Read stack traces completely; note line numbers, file paths, error codes

2. **Reproduce Consistently**
   - Can you trigger it reliably? What are the exact steps?
   - If not reproducible → gather more data, don't guess

3. **Check Recent Changes**
   - What changed that could cause this? (`git diff`, recent commits, new deps, config)

4. **Gather Evidence in Multi-Component Systems**

   **WHEN system has multiple components (CI → build → signing, API → service → database), BEFORE proposing fixes, add diagnostic instrumentation at each boundary:**
   ```
   For EACH component boundary:
     - Log what data enters the component
     - Log what data exits the component
     - Verify environment/config propagation
   Run once to gather evidence showing WHERE it breaks
   THEN investigate that specific component
   ```

   **Example (multi-layer system):**
   ```bash
   echo "=== Secrets available in workflow ==="
   echo "IDENTITY: ${IDENTITY:+SET}${IDENTITY:-UNSET}"
   echo "=== Env vars in build script ==="
   env | grep IDENTITY || echo "IDENTITY not in environment"
   echo "=== Keychain state ==="
   security find-identity -v
   ```
   **This reveals** which layer fails (secrets → workflow ✓, workflow → build ✗).

5. **Trace Data Flow**

   **WHEN error is deep in call stack:** see the **Root Cause Tracing** reference (auto-included below) for the complete backward-tracing technique.

   **Quick version:** Where does the bad value originate? What called this with the bad value? Keep tracing up until you find the source. Fix at source, not at symptom.

### Phase 2: Pattern Analysis

1. **Find Working Examples** — locate similar working code in the same codebase
2. **Compare Against References** — if implementing a pattern, read the reference implementation COMPLETELY (every line, no skimming)
3. **Identify Differences** — list every difference between working and broken, however small. Don't assume "that can't matter"
4. **Understand Dependencies** — what components, settings, config, environment, and assumptions does this need?

### Phase 3: Hypothesis and Testing

1. **Form Single Hypothesis** — "I think X is the root cause because Y." Write it down. Be specific.
2. **Test Minimally** — make the SMALLEST possible change to test it. One variable at a time.
3. **Verify Before Continuing** — Worked? → Phase 4. Didn't? → form a NEW hypothesis. DON'T pile fixes on top.
4. **When You Don't Know** — say "I don't understand X." Don't pretend. Ask for help. Research more.

### Phase 4: Implementation

**Fix the root cause, not the symptom:**

1. **Create Failing Test Case** — simplest reproduction, automated if possible. MUST have before fixing. Use the **superpowers-test-driven-development** skill.
2. **Implement Single Fix** — address the root cause. ONE change. No "while I'm here" improvements, no bundled refactoring.
3. **Verify Fix** — test passes now? No other tests broken? Issue actually resolved? (Use the **superpowers-verification-before-completion** skill.)
4. **If Fix Doesn't Work** — STOP. Count fixes tried. If < 3: return to Phase 1 with new info. **If ≥ 3: STOP and question the architecture (step 5).** DON'T attempt fix #4 without architectural discussion.
5. **If 3+ Fixes Failed: Question Architecture**
   - Pattern: each fix reveals new coupling elsewhere; fixes require "massive refactoring"; each fix creates new symptoms.
   - STOP and question fundamentals: Is this pattern sound? Are we continuing through inertia? Refactor vs. keep patching symptoms?
   - **Discuss with your human partner before more fixes.** This is NOT a failed hypothesis — it's a wrong architecture.

## Red Flags - STOP and Follow Process

If you catch yourself thinking:
- "Quick fix for now, investigate later"
- "Just try changing X and see if it works"
- "Add multiple changes, run tests"
- "Skip the test, I'll manually verify"
- "It's probably X, let me fix that"
- "I don't fully understand but this might work"
- "Here are the main problems: [lists fixes without investigation]"
- Proposing solutions before tracing data flow
- **"One more fix attempt" (when already tried 2+)**
- **Each fix reveals a new problem in a different place**

**ALL of these mean: STOP. Return to Phase 1.** If 3+ fixes failed: question the architecture (Phase 4.5).

## Signals You're Doing It Wrong

Watch for these redirections from your human partner:
- "Is that not happening?" — you assumed without verifying
- "Will it show us...?" — you should have added evidence gathering
- "Stop guessing" — you're proposing fixes without understanding
- "We're stuck?" (frustrated) — your approach isn't working

**When you see these:** STOP. Return to Phase 1.

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Issue is simple, don't need process" | Simple issues have root causes too. Process is fast for simple bugs. |
| "Emergency, no time for process" | Systematic debugging is FASTER than guess-and-check thrashing. |
| "Just try this first, then investigate" | First fix sets the pattern. Do it right from the start. |
| "I'll write test after confirming fix works" | Untested fixes don't stick. Test first proves it. |
| "Multiple fixes at once saves time" | Can't isolate what worked. Causes new bugs. |
| "Reference too long, I'll adapt the pattern" | Partial understanding guarantees bugs. Read it completely. |
| "I see the problem, let me fix it" | Seeing symptoms ≠ understanding root cause. |
| "One more fix attempt" (after 2+ failures) | 3+ failures = architectural problem. Question pattern, don't fix again. |

## Quick Reference

| Phase | Key Activities | Success Criteria |
|-------|---------------|------------------|
| **1. Root Cause** | Read errors, reproduce, check changes, gather evidence | Understand WHAT and WHY |
| **2. Pattern** | Find working examples, compare | Identify differences |
| **3. Hypothesis** | Form theory, test minimally | Confirmed or new hypothesis |
| **4. Implementation** | Create test, fix, verify | Bug resolved, tests pass |

## When Process Reveals "No Root Cause"

If systematic investigation reveals the issue is truly environmental, timing-dependent, or external: you've completed the process, document what you investigated, implement appropriate handling (retry, timeout, error message), add monitoring/logging.

**But:** 95% of "no root cause" cases are incomplete investigation.

## Supporting Techniques (auto-included references)

- **Root Cause Tracing** — trace bugs backward through the call stack to the original trigger
- **Defense in Depth** — add validation at multiple layers after finding root cause
- **Condition-Based Waiting** — replace arbitrary timeouts with condition polling

**Related skills:** **superpowers-test-driven-development** (Phase 4 failing test) · **superpowers-verification-before-completion** (confirm the fix).
