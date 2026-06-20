# Repro: subagent-driven handoff edits in-session

A focused reproduction for a reported bug: after `superpowers-writing-plans`
saves a plan and offers its two execution options —

> **1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task
> **2. Inline Execution** — execute in this session

— choosing **1** is supposed to dispatch a fresh native **`task`** subagent per
task. On `deepseek-flash` it *sometimes* ignores that and edits the files
directly in the current session instead. The behaviour is **intermittent**, so
a single run proves nothing — this probe runs N trials and reports the rate.

## Run

```bash
node bench/repro/subagent-handoff.mjs              # 3 trials, deepseek-flash
node bench/repro/subagent-handoff.mjs --trials=8   # more trials → tighter rate
node bench/repro/subagent-handoff.mjs --model=deepseek-pro
```

Needs `DEEPSEEK_API_KEY` in the shell env or `.env` at the repo root; without it
the probe SKIPs (exit 0). Each trial makes two live `reasonix run` calls, so a
trial takes a couple of minutes.

## Observed (deepseek-flash)

**Before the handoff was hardened**, the bug fired on roughly **1 in 5–6 trials**
(a 6-trial batch: 5 `dispatch`, 1 `inline`; earlier single trials similar). The
failure mode is usually *not* "no `task` at all" — flash dispatches a `task` per
task and then **writes the source itself in the parent anyway**, or (the dominant
sub-mode) the subagent stops early and the parent **finishes its work in-session**
(e.g. repairing ESM/CJS mismatches with `multi_edit`/`edit_file`, then committing).
Both match the reported session where `Task(...)` showed up yet edits landed
in-session.

**After hardening** `superpowers-writing-plans`'s Execution Handoff (orchestrator
prohibition + "re-dispatch, never finish a subagent's work yourself" + step-budget
guidance): **0 `inline` across 21 conclusive trials** (an 8-trial run then a
16-trial confirmation), with trials visibly re-dispatching (up to 5 `task` calls)
instead of editing. Against the ~15% pre-fix rate, 0/21 is unlikely by chance
(P(0 | 15%) ≈ 0.03) — strong evidence the fix took, though not absolute proof for
an intermittent behaviour. The probe exits non-zero whenever any trial reproduces
the bug, so it doubles as the before/after gate; re-run periodically to guard
against regression.

## Isolation (don't skip this)

Each trial runs in a throwaway fixture under `.work/` (gitignored). The fixture
**copies this repo's `skills/` into `_skillsrc` and references them by a relative
path**, carries the repo `AGENTS.md`, holds a small `docs/spec.md`, and is its
own `git init`'d repo. This isolation is load-bearing: an earlier version pointed
the config at the real `skills/` by **absolute path**, and the model followed
that breadcrumb straight into the real checkout — editing files and committing
there. With skills copied in and a relative path, every file op stays in `.work/`.

## What each trial does

The fixture runs the exact two-turn flow from the reported session:

1. **Turn 1** force-loads `superpowers-writing-plans` and asks it to plan the
   spec. The skill's *Execution Handoff* section emits the "1) Subagent-Driven /
   2) Inline" offer. (Force-loading guarantees the skill body — including the
   "dispatch via `task`" rule — is in context, the same state the real session
   was in.)
2. **Turn 2** sends `1` — the user picking Subagent-Driven.

It then classifies **only turn-2** tool calls (everything after the last user
message) from the saved session JSONL:

| signal in the parent transcript (turn 2) | meaning | verdict |
| --- | --- | --- |
| `task` called, **no** edit of a source file | work handed to isolated children | `dispatch` (correct) |
| `write_file`/`edit_file`/`multi_edit` of a **source** file (or a file-writing `bash`) | the parent wrote code itself | `inline` (**the bug**) |
| neither | model didn't reach a decisive action | `inconclusive` |
| turn 1 never offered the choice | setup miss | `no-handoff` |

Only **source** edits count (paths ending in a code extension, not under `docs/`,
not `.md`). Writing the plan document in-session is legitimately the parent's
job, so it must not register as the bug — the reported symptom is the parent
editing *implementation* files (e.g. `PhotoManager.svelte`).

A dispatched subagent's edits land in a **separate** child session, so they
never appear in the parent transcript — that's why a parent-side source edit is
an unambiguous "edited in-session" signal **even if `task` was also called**
(the observed failure mode: dispatch a `task`, then write the source anyway).

Per-trial transcripts are saved to `.transcripts/trial-*.jsonl` (gitignored) for
inspection. The probe exits non-zero if any trial reproduces the bug, so it
doubles as a regression signal.

## Why a standalone multi-trial probe (not a `bench/exec/` scenario)

`bench/exec/` grades each skill's execution fidelity with **single-shot**
mechanical gates against a committed baseline. This bug is **probabilistic** —
flash dispatches correctly on some runs and edits inline on others — so a
single-shot hard gate would flip between runs and poison the baseline. Measuring
a *rate* across trials is the honest shape for it. The reusable tool-call
extractor and the dispatch/edit tool sets live in `bench/lib/transcript.mjs`
(unit-tested in `transcript.test.mjs`).
