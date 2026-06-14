# Testing Skills With Subagents

How to run RED-GREEN-REFACTOR on a skill using Reasonix subagents.

## The Setup

A subagent (`task`, `explore`, or a throwaway subagent skill) is your test harness. Its only input is the `arguments`/`task` string and its skill body — so you control exactly what context it has. That makes it a clean way to measure "what does an agent do here, with vs. without the skill?"

- **Baseline (RED):** dispatch with the pressure scenario but **no** skill loaded. Record what it actually does.
- **With skill (GREEN):** include the skill content (paste it into the task input, or load it) and re-run the *same* scenario. Compare.

## Writing Pressure Scenarios

A pressure scenario tempts the agent to violate the rule. For discipline skills, combine pressures — one is easy to resist, three is realistic:

| Pressure | How to apply in the scenario |
|---|---|
| **Time** | "The demo is in 10 minutes." "This is blocking the release." |
| **Sunk cost** | "You already wrote 300 lines — don't throw them away." |
| **Authority** | "The senior engineer said to just ship it." |
| **Exhaustion** | "This is the 5th attempt, it's late, just get it working." |
| **Plausibility** | Give a case where the shortcut *seems* genuinely fine. |

Make the scenario concrete and specific. Vague scenarios produce vague behavior you can't learn from.

## What to Record (verbatim)

During the baseline run, capture:
- The exact decision the agent made (did it skip the test? guess the fix?)
- The **exact words** of each rationalization ("This is too simple to need a test...")
- Which pressure tipped it over

Those verbatim rationalizations become the rows of your skill's rationalization table and red-flags list. You are mining the agent's own excuses to inoculate against them.

## GREEN: Verify Compliance

Re-run the identical scenarios with the skill present. The agent should now comply *and* you should see it reference the relevant rule. If it complies for the wrong reason (got lucky, different path), the test isn't proving anything — tighten the scenario.

## REFACTOR: Plug Holes Systematically

Each new run surfaces new rationalizations. For every one:
1. Add an explicit counter (a table row, a red flag, a closed loophole).
2. Re-run all prior scenarios — make sure the new wording didn't loosen an earlier guard.
3. Repeat until several runs surface nothing new (loop-until-dry).

## Meta-Testing the Description

Separately test discovery: give a subagent a realistic *trigger* situation and the pinned-index line only (name + description), and ask whether it would load the skill. If it wouldn't, the description's triggering conditions are wrong — fix them. Remember the description must be *when to use*, never *what it does* (a workflow summary makes the model follow the summary and skip the body).

## Success Criteria by Skill Type

- **Discipline skills** (TDD, verification): agent follows the rule under maximum combined pressure.
- **Technique skills** (how-to): agent applies the technique correctly to a *new* scenario, including edge cases.
- **Pattern skills** (mental models): agent recognizes when the pattern applies AND when it doesn't.
- **Reference skills** (APIs/docs): agent retrieves the right information and uses it correctly; common use cases are covered (gap test).
