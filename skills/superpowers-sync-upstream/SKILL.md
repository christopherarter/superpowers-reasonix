---
name: superpowers-sync-upstream
description: "Sync this port with upstream obra/superpowers or Reasonix main-v2: detect drift, re-port, bench-gate"
---

# Sync Upstream

Re-aligns this port with its two upstreams and re-pins `UPSTREAM.json`. Run when asked to sync or update from upstream, or after the `upstream-drift` CI issue fires.

## 1. Detect

Read `UPSTREAM.json` for the pinned commits and watched paths, then see what moved:

Do not run `.github/scripts/check-upstream-drift.mjs` for a read-only check: it can create or update the tracking issue. Inspect the pinned SHAs with `git ls-remote` or `gh api repos/<owner>/<repo>/commits/<branch>`, then compare the two endpoints with Git. Use the issue-writing script only when updating the tracker is intended.

For full diffs, shallow-fetch and compare from the pins:

Fetch both the pinned commit and current default-branch head into a temporary blobless clone, then run `git diff --no-renames <pin> <head> -- skills/`. A GitHub compare API response with 300 files may be truncated; do not treat it as complete.

For Reasonix, diff the pin against `main-v2` over `internal/tool internal/hook internal/skill internal/frontmatter internal/command`. Inspect actual tool registration and implementation together; a declared identity alone does not prove a callable tool exists.

Network blocked? `web_fetch` the GitHub compare page: `<repo>/compare/<pinned>...<branch>`, and label incomplete file lists. This step is read-only; dispatch it to a `task` subagent when appropriate and keep only the drift report to save context.

## 2. Classify content drift

For each changed obra skill, decide edited, new, or removed.

- New skill: port it only if no native Reasonix tool already covers it (`task`, `review`, `wait`, `explore`). Otherwise add it to `UPSTREAM.json` `retired` with a one-line reason.
- Removed upstream skill: consider retiring the port equivalent.

## 3. Re-port

Load `superpowers-writing-skills`. For each edited or to-be-ported skill, apply the Adaptations rules: snake_case tool names (`read_file`, `edit_file`, `bash`), `description` rewritten as a forceful imperative within the 130-char index budget, `references/*` auto-fold, native-tool substitution, path renames (`docs/reasonix/...`). Preserve the disciplines verbatim: Iron Laws, red-flag tables, RED-GREEN-REFACTOR. Keep bodies lean enough for the flash model.

## 4. Classify harness drift

Map each changed contract file to the port surface it touches:

- `internal/tool`: tool names in every skill body and `bench/reasonix.toml`
- `internal/hook`: `AGENTS.md` notes and any hook docs
- `internal/frontmatter`: all skill frontmatter
- `internal/skill`, `internal/command`: layout, loading, and `/name` assumptions

Update the affected skills, `AGENTS.md`, and bench config. If the change invalidated the local `reasonix` binary, rebuild it before trusting bench.

## 5. Bench-gate

- `node --test bench/structural.test.mjs` (structure of every SKILL.md)
- `node bench/bench.mjs` (invocation; prior cases must still pass)
- exec-fidelity for any re-ported discipline skill, vs `bench/BASELINE.json`

Any structural failure or exec score below baseline blocks acceptance. Fix the skill body; do not lower the baseline.

## 6. Finalize

Bump `UPSTREAM.json` commits and dates to the synced HEADs, write a short report (changed, ported, retired, bench result), and commit. Close the open `upstream-drift` issue only after the synchronized changes reach `main` (for example, via the PR's closing keyword).
