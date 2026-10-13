---
name: superpowers-brainstorming
description: Starting a feature, project, or rough idea? Load first to learn what the user wants.
---

# Brainstorming Ideas Into Designs

You can build quickly, but your first guess about what the user wants may be thin. Find out what matters before you make the decisions they did not mention. User instructions and approvals already given in this conversation govern; do not ask them to approve the same work twice.

## First: What Do You Know?

- **Everything that matters is in the request** (for example, an exact color or an existing function to change). This is a quick, clear task. Do it through the normal workflow and report what changed.
- **A nontrivial product choice is missing.** Start a conversation. A broad request is not a license to choose the product for them.

## First Message for an Open Idea

Tell the user in one line that they may ask you to start with reasonable assumptions if they prefer. Then ask **one open question** about a concrete moment or desired result. That is the entire first message. If they opt out of questions, state any significant platform, language, or medium choice you make, and continue through the normal workflow.

Each later message ends with one question, without a list of suggested answers unless the user is stuck. Use their words. Ask for a concrete example, the last time the need arose, what success would look like, or what would make the result wrong. When they ask you to choose, propose something specific and label your assumptions.

### Ground to cover as needed

- Who uses it, what they do, and why now.
- Goals, non-goals, and outcomes that would count as failure.
- What exists already, what they tried, and prior art they liked or disliked.
- Which choices about platform, language, tools, and resources they want to make, and which they leave to you.

Use project files and repository history to ground your questions and proposals. Offer a visual sketch or prototype when seeing a page, layout, flow, or set of alternatives would help the user decide. In a terminal-only Reasonix session, use a concise text sketch; use a native visual tool only when it is actually available.

Privately consider several approaches before presenting one. Show alternatives and trade-offs when they help the user decide. A short, disposable spike can answer a feasibility question; label it disposable, keep its tests minimal, and bring the result back into the conversation. Keeping spike code is a new implementation choice.

## Play It Back

As each part becomes clear, describe your understanding in a short chunk and ask what is wrong or missing. Separate what the user said from your assumptions. For a visual result, pair the description with a sketch when helpful. Continue until the user can recognize the intended outcome and the remaining decisions are small enough for the implementer to make.

## Size the Work

| Size | Description | Next step |
|---|---|---|
| Quick, clear task | The request itself is enough | Do it |
| Small change | A concise description in chat | Build through the normal development workflow after it is accepted |
| Project | Written design document | Use **superpowers-writing-plans** after the document is accepted |

If the work grows, say so and step up a size. If the request contains several independent projects, agree on an order and develop each design separately.

## Written Design for a Project

Write `docs/reasonix/specs/YYYY-MM-DD-<topic>-design.md` unless the user chooses another location. Cover intent and why, goals and non-goals, constraints, the implementation choices the user actually made, and decisions left to the builder. Commit the document.

Ask a fresh Reasonix `task` subagent to read the design as a builder who has no conversation history. Give it the absolute design path and the absolute path to `builder-check-prompt.md` next to this `SKILL.md` (the loader header gives this skill's path). Resolve questions answerable from the conversation or repo in the document. Mark minor decisions you make as your own. Ask the user only about choices that change the result. If no subagent tool is available, perform that check yourself and say so.

Present the document and the decisions you made for review. Once accepted, load **superpowers-writing-plans**. Do not start product implementation from an unapproved project design unless the user already authorized that scope or opted out of design questions.

## Hard Gate for Unsettled Designs

For an open idea, product code, scaffolding, dependency installation, and implementation skills wait until the user accepts the description of what will be built. A small change needs only an in-chat description; a project needs its design document. Reading, probing, and reversible investigation may proceed. A user who asks you to start with assumptions has opted out of this gate; a user who already approved the scope has satisfied it.

## Red Flags

| Thought | Reality |
|---|---|
| "I can pick a plausible app from this vague request" | Ask what the user wants to accomplish first. |
| "A menu of features will save them effort" | Options steer; ask them to describe the situation first. |
| "The sensible default needs no mention" | State consequential choices so they can correct them. |
| "The spike worked, so I'll keep building" | Ask whether its result matches what they want before making it permanent. |
| "They approved the idea, so every detail is approved" | Approval covers the description they saw. Surface a material new decision. |
