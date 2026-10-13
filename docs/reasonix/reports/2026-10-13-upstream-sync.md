# Upstream sync, 2026-10-13

## Pinned sources

| Source | Verified head | Prior pin |
|---|---|---|
| obra/superpowers | `bb92a77741419a4ab5f06e711a283343f1ada0c3` | `b36e0829c6d0140e93cfef2ca599b1b07d4a7797` |
| Reasonix `main-v2` | `afbc1c0a07e0c3a5dd85489eb9b6be622e22324b` | `a8c41e239491727b9596bb399037b06dfa819d01` |

Both remote heads were refreshed on 2026-10-13. `UPSTREAM.json` records that verification date.

## Drift fixed

The GitHub compare API returned exactly 300 files for the Reasonix range and omitted the watched `internal/*` files. The detector now obtains a full Git diff when the API page is full or lacks a file list. A local 301-file regression test places the watched file after the API limit. The full Reasonix comparison contained 7,224 changed paths, including 191 watched paths.

## Skill port

- Refreshed **brainstorming** for open questions, playback, quick clear tasks, explicit assumptions, and a builder check for written designs. Reasonix's terminal workflow uses text sketches; the upstream browser visual companion and server scripts were not copied.
- Refreshed **executing-plans** for a persistent per-plan ledger, rulings, uninterrupted task execution, TDD evidence, and a whole-branch review. These are expressed with Reasonix-native tools and a ledger rather than upstream's `sdd` helper scripts, which depend on an upstream retired skill.
- Refreshed **writing-plans** for precise signatures and tests, a Review Focus on uncovered likely inputs, and proportionate code examples.
- Updated **test-driven-development** to require a full-suite run before completion and **systematic-debugging** to avoid printing secret environment values in an example.
- Updated **writing-skills** for YAML frontmatter, dynamic session-context discovery, current tool names, and interpreter-based invocation of bundled scripts.
- Added **diagnosing-superpowers** with the upstream analyst prompts, references, and report templates adapted for this repository and Reasonix. It requires problem intake and exact-text approval before filing an issue.

Previously retired upstream skills remain retired where Reasonix has native `task`, `review`, or `explore` tools. No existing port skill was removed.

## Reasonix contract findings

Current source uses `yaml.v3` frontmatter, a dynamic session-context skill catalog, `run_skill`, `read_only_skill`, `use_capability`, and conditional `web_search`. The benchmark's tool allowlist and its dependency-free frontmatter subset now cover the forms authored by this port, including block scalars. Historical transcript parsing still recognizes `read_skill` calls.

At the verified Reasonix head, `internal/boot/boot.go` still calls `skill.NewReadSkillTool`, but `internal/skill/tools.go` no longer defines that constructor. This source mismatch needs an upstream fix before that head can be treated as build-verified. This repository no longer recommends authoring new dependencies on `read_skill`. A Go toolchain and a Reasonix binary were unavailable locally, so the upstream build was not tested.

The sync playbook now treats `.github/scripts/check-upstream-drift.mjs` as issue-writing, uses read-only Git comparisons for inspection, and leaves issue #11 open until the synchronized PR reaches `main`.

## Verification

- `npm test`: 75 passed, 0 failed.
- `node bench/bench.mjs`: structural gate 12/12 skills passed; behavioral gate skipped because `DEEPSEEK_API_KEY` is unavailable.
- Execution-fidelity pressure tests: before/after subagent scenarios checked the changed brainstorming, writing-plans, executing-plans, writing-skills, and new diagnosis guidance. The API-backed execution-fidelity baseline could not run without `DEEPSEEK_API_KEY`.
- `git diff --check`: clean.

The behavioral and execution-fidelity gates remain unverified. The PR should remain reviewable with those limits stated explicitly; merging it will close #11 via the PR's existing closing keyword.
