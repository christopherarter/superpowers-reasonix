---
name: superpowers-receiving-code-review
description: Got review feedback? Load BEFORE changing anything — verify each point, push back if wrong.
---

# Code Review Reception

## Overview

Code review requires technical evaluation, not emotional performance.

**Core principle:** Verify before implementing. Ask before assuming. Technical correctness over social comfort.

## The Response Pattern

```
WHEN receiving code review feedback:

1. READ: Complete feedback without reacting
2. UNDERSTAND: Restate requirement in own words (or ask)
3. VERIFY: Check against codebase reality
4. EVALUATE: Technically sound for THIS codebase?
5. RESPOND: Technical acknowledgment or reasoned pushback
6. IMPLEMENT: One item at a time, test each
```

## Forbidden Responses

**NEVER:**
- "You're absolutely right!" (performative agreement)
- "Great point!" / "Excellent feedback!" (performative)
- "Let me implement that now" (before verification)

**INSTEAD:** restate the technical requirement; ask clarifying questions; push back with technical reasoning if wrong; or just start working (actions > words).

## Handling Unclear Feedback

```
IF any item is unclear:
  STOP - do not implement anything yet
  ASK for clarification on unclear items

WHY: Items may be related. Partial understanding = wrong implementation.
```

**Example:**
```
Partner: "Fix 1-6"
You understand 1,2,3,6. Unclear on 4,5.

❌ WRONG: Implement 1,2,3,6 now, ask about 4,5 later
✅ RIGHT: "I understand items 1,2,3,6. Need clarification on 4 and 5 before proceeding."
```

## Source-Specific Handling

### From your human partner
- **Trusted** — implement after understanding
- **Still ask** if scope unclear
- **No performative agreement** — skip to action or technical acknowledgment

### From External Reviewers (or a reviewer subagent)
```
BEFORE implementing:
  1. Technically correct for THIS codebase?
  2. Breaks existing functionality?
  3. Reason for the current implementation?
  4. Works on all platforms/versions?
  5. Does the reviewer understand full context?

IF suggestion seems wrong: push back with technical reasoning
IF can't easily verify: "I can't verify this without [X]. Should I [investigate/ask/proceed]?"
IF conflicts with your human partner's prior decisions: stop and discuss first
```

**Rule:** External feedback — be skeptical, but check carefully.

## YAGNI Check for "Professional" Features

```
IF reviewer suggests "implementing properly":
  grep codebase for actual usage
  IF unused: "This endpoint isn't called. Remove it (YAGNI)?"
  IF used: implement properly
```

## Implementation Order

```
FOR multi-item feedback:
  1. Clarify anything unclear FIRST
  2. Then implement in this order:
     - Blocking issues (breaks, security)
     - Simple fixes (typos, imports)
     - Complex fixes (refactoring, logic)
  3. Test each fix individually
  4. Verify no regressions
```

## When To Push Back

Push back when the suggestion: breaks existing functionality; comes from a reviewer lacking full context; violates YAGNI (unused feature); is technically incorrect for this stack; ignores legacy/compatibility reasons; conflicts with your human partner's architectural decisions.

**How:** use technical reasoning, not defensiveness; ask specific questions; reference working tests/code; involve your human partner if architectural.

## Acknowledging Correct Feedback

```
✅ "Fixed. [Brief description of what changed]"
✅ "Good catch - [specific issue]. Fixed in [location]."
✅ [Just fix it and show it in the code]

❌ "You're absolutely right!"  ❌ "Great point!"  ❌ "Thanks for catching that!"
❌ ANY gratitude expression
```

**Why no thanks:** actions speak. Just fix it — the code shows you heard the feedback. If you catch yourself about to write "Thanks," delete it and state the fix instead.

## Gracefully Correcting Your Pushback

If you pushed back and were wrong:
```
✅ "You were right - I checked [X] and it does [Y]. Implementing now."
✅ "Verified this and you're correct. My understanding was wrong because [reason]. Fixing."

❌ Long apology   ❌ Defending why you pushed back   ❌ Over-explaining
```

State the correction factually and move on.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Performative agreement | State requirement or just act |
| Blind implementation | Verify against codebase first |
| Batch without testing | One at a time, test each |
| Assuming reviewer is right | Check if it breaks things |
| Avoiding pushback | Technical correctness > comfort |
| Partial implementation | Clarify all items first |
| Can't verify, proceed anyway | State limitation, ask for direction |

## GitHub Thread Replies

When replying to inline review comments on GitHub, reply in the comment thread (`gh api repos/{owner}/{repo}/pulls/{pr}/comments/{id}/replies`), not as a top-level PR comment.

## The Bottom Line

**External feedback = suggestions to evaluate, not orders to follow.**

Verify. Question. Then implement. No performative agreement. Technical rigor always.
