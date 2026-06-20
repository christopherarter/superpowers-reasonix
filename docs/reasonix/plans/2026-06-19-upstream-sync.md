# Upstream Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep this port aligned with both upstreams (obra/superpowers content and DeepSeek-Reasonix `main-v2` harness) via a pinned provenance manifest, an in-session bench-gated re-port skill, and a scheduled GitHub Action that files one drift issue.

**Architecture:** A root `UPSTREAM.json` pins each upstream's commit and the watched paths. Pure modules under `lib/upstream/` compute drift and compose an issue; an orchestrator takes injected deps so it unit-tests with fakes. A thin CI script wires real `git ls-remote` + GitHub API + `gh`; a weekly workflow runs it. A new skill drives the human-reviewed re-port and re-pins the manifest. Detection is mechanical (data + pure functions); porting is judgment (the skill).

**Tech Stack:** Node 20 (ESM `.mjs`, `node:test`, global `fetch`), `git`, `gh` CLI, GitHub Actions. No new runtime dependencies.

## Global Constraints

- Node 20+; ESM only (`.mjs`); tests use `node:test` and run via `node --test <file>`.
- No new npm dependencies (use global `fetch`, `node:child_process`, `node:fs`).
- Pure modules in `lib/upstream/` do no I/O; all network/process/`gh` calls live in the `.github/scripts/` wrapper or are injected.
- Reasonix tool names in the skill body are snake_case (`read_file`, `edit_file`, `bash`, `grep`, …); never TitleCase.
- The skill `description` plus `name` must fit the 130-char pinned-index budget and pass the structural gate.
- Prose (skill body, README) follows the port's deslop rule: no em dashes, no unicode arrows in prose.
- Commit after each task with the message shown in its final step.

---

### Task 1: Provenance manifest + validation

**Files:**
- Create: `lib/upstream/manifest.mjs`
- Create: `lib/upstream/manifest.test.mjs`
- Create: `UPSTREAM.json`

**Interfaces:**
- Produces: `loadManifest(path) -> object`; `validateManifest(manifest, skillDirs: string[]) -> string[]` (empty array = valid).

- [ ] **Step 1: Write the failing test**

`lib/upstream/manifest.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadManifest, validateManifest } from "./manifest.mjs";

const sha = "a".repeat(40);
const base = () => ({
  obra: { repo: "https://github.com/obra/superpowers", skillsPath: "skills", lastSyncedCommit: sha, lastSyncedDate: "2026-06-19" },
  reasonix: { repo: "https://github.com/esengine/DeepSeek-Reasonix", branch: "main-v2", contractPaths: ["internal/tool"], lastVerifiedCommit: sha, lastVerifiedDate: "2026-06-19" },
  skillMap: { "superpowers-brainstorming": "skills/brainstorming/SKILL.md" },
  retired: { "subagent-driven-development": "native task covers it" },
});

test("valid manifest returns no errors", () => {
  assert.deepEqual(validateManifest(base(), ["superpowers-brainstorming", "superpowers-sync-upstream"]), []);
});

test("skill dir missing from skillMap is an error", () => {
  const errs = validateManifest(base(), ["superpowers-brainstorming", "superpowers-writing-plans"]);
  assert.ok(errs.some((e) => e.includes("superpowers-writing-plans")));
});

test("retired name also in skillMap is an error", () => {
  const m = base();
  m.retired["superpowers-brainstorming"] = "oops";
  assert.ok(validateManifest(m, ["superpowers-brainstorming"]).some((e) => e.includes("superpowers-brainstorming")));
});

test("bad SHA and date are errors", () => {
  const m = base();
  m.obra.lastSyncedCommit = "xyz";
  m.obra.lastSyncedDate = "June 19";
  const errs = validateManifest(m, ["superpowers-brainstorming"]);
  assert.ok(errs.some((e) => e.includes("SHA")));
  assert.ok(errs.some((e) => e.includes("YYYY-MM-DD")));
});

test("the real UPSTREAM.json validates against the real skills/ dirs", () => {
  const manifest = loadManifest(new URL("../../UPSTREAM.json", import.meta.url));
  const skillsDir = fileURLToPath(new URL("../../skills", import.meta.url));
  const dirs = readdirSync(skillsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  assert.deepEqual(validateManifest(manifest, dirs), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test lib/upstream/manifest.test.mjs`
Expected: FAIL — `Cannot find module './manifest.mjs'`.

- [ ] **Step 3: Write the implementation**

`lib/upstream/manifest.mjs`:

```js
import { readFileSync } from "node:fs";

const SHA_RE = /^[0-9a-f]{40}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function loadManifest(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function validateManifest(manifest, skillDirs) {
  const errors = [];
  for (const key of ["obra", "reasonix", "skillMap", "retired"]) {
    if (!manifest[key]) errors.push(`missing top-level key: ${key}`);
  }
  if (manifest.obra) {
    if (!SHA_RE.test(manifest.obra.lastSyncedCommit ?? "")) errors.push("obra.lastSyncedCommit is not a 40-char SHA");
    if (!DATE_RE.test(manifest.obra.lastSyncedDate ?? "")) errors.push("obra.lastSyncedDate is not YYYY-MM-DD");
  }
  if (manifest.reasonix) {
    if (!SHA_RE.test(manifest.reasonix.lastVerifiedCommit ?? "")) errors.push("reasonix.lastVerifiedCommit is not a 40-char SHA");
    if (!DATE_RE.test(manifest.reasonix.lastVerifiedDate ?? "")) errors.push("reasonix.lastVerifiedDate is not YYYY-MM-DD");
    if (!Array.isArray(manifest.reasonix.contractPaths) || manifest.reasonix.contractPaths.length === 0) {
      errors.push("reasonix.contractPaths must be a non-empty array");
    }
  }
  const mapped = new Set(Object.keys(manifest.skillMap ?? {}));
  const retired = new Set(Object.keys(manifest.retired ?? {}));
  for (const dir of skillDirs) {
    if (dir === "superpowers-sync-upstream") continue;
    if (!mapped.has(dir)) errors.push(`skill dir not in skillMap: ${dir}`);
  }
  for (const name of retired) {
    if (mapped.has(name)) errors.push(`retired skill also in skillMap: ${name}`);
  }
  return errors;
}
```

- [ ] **Step 4: Create `UPSTREAM.json` with real pinned data**

Fetch the live HEADs and confirm each obra source path resolves, then write the file.

Run:
```bash
git ls-remote https://github.com/obra/superpowers HEAD
git ls-remote https://github.com/esengine/DeepSeek-Reasonix refs/heads/main-v2
tmp=$(mktemp -d) && git clone --depth 1 --filter=blob:none https://github.com/obra/superpowers "$tmp/obra" && ls "$tmp/obra/skills"
```
Use the two SHAs as `lastSyncedCommit` / `lastVerifiedCommit`, today's date (2026-06-19), and confirm each `skillMap` value exists under `"$tmp/obra/skills"`. If obra's folder names differ from the values below, correct the `skillMap` paths to match the real tree before writing.

`UPSTREAM.json`:

```json
{
  "obra": {
    "repo": "https://github.com/obra/superpowers",
    "skillsPath": "skills",
    "lastSyncedCommit": "PASTE_OBRA_HEAD_SHA",
    "lastSyncedDate": "2026-06-19"
  },
  "reasonix": {
    "repo": "https://github.com/esengine/DeepSeek-Reasonix",
    "branch": "main-v2",
    "contractPaths": ["internal/tool", "internal/hook", "internal/skill", "internal/frontmatter", "internal/command"],
    "lastVerifiedCommit": "PASTE_REASONIX_MAINV2_SHA",
    "lastVerifiedDate": "2026-06-19"
  },
  "skillMap": {
    "superpowers-brainstorming": "skills/brainstorming/SKILL.md",
    "superpowers-writing-plans": "skills/writing-plans/SKILL.md",
    "superpowers-test-driven-development": "skills/test-driven-development/SKILL.md",
    "superpowers-systematic-debugging": "skills/systematic-debugging/SKILL.md",
    "superpowers-verification-before-completion": "skills/verification-before-completion/SKILL.md",
    "superpowers-executing-plans": "skills/executing-plans/SKILL.md",
    "superpowers-using-git-worktrees": "skills/using-git-worktrees/SKILL.md",
    "superpowers-finishing-a-development-branch": "skills/finishing-a-development-branch/SKILL.md",
    "superpowers-receiving-code-review": "skills/receiving-code-review/SKILL.md",
    "superpowers-writing-skills": "skills/writing-skills/SKILL.md"
  },
  "retired": {
    "subagent-driven-development": "Native task covers per-task subagent dispatch; benchmarking showed the model prefers it.",
    "requesting-code-review": "Native review covers code-review of a diff.",
    "dispatching-parallel-agents": "Native task + wait cover parallel dispatch; only read-only work parallelizes cleanly.",
    "worker-subagents": "Reasonix runAs: subagent replaces bespoke worker skills."
  }
}
```

Note: `PASTE_*` are filled from the commands above in this step; they are not left in the committed file. The real-manifest test in Step 1 fails until they are valid SHAs and every `skills/` dir is mapped.

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test lib/upstream/manifest.test.mjs`
Expected: PASS (all five tests, including the real-manifest check).

- [ ] **Step 6: Commit**

```bash
git add lib/upstream/manifest.mjs lib/upstream/manifest.test.mjs UPSTREAM.json
git commit -m "feat(sync): provenance manifest + validation"
```

---

### Task 2: Drift computation (pure)

**Files:**
- Create: `lib/upstream/drift.mjs`
- Create: `lib/upstream/drift.test.mjs`

**Interfaces:**
- Consumes: a manifest object (Task 1 shape).
- Produces: `computeDrift(manifest, latest, compareFiles) -> report`; `hasDrift(report) -> boolean`; `composeIssueBody(report) -> string`.
  - `latest`: `{ obra: sha, reasonix: sha }`.
  - `compareFiles`: `{ obra: string[]|null, reasonix: string[]|null }` (`null` = compare unresolved, e.g. 404).
  - `report`: `{ obra: side, reasonix: side }` where `side = { drifted, from, to, label, items: string[], degraded }`.

- [ ] **Step 1: Write the failing test**

`lib/upstream/drift.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeDrift, hasDrift, composeIssueBody } from "./drift.mjs";

const manifest = {
  obra: { skillsPath: "skills", lastSyncedCommit: "obra000" },
  reasonix: { contractPaths: ["internal/tool", "internal/hook"], lastVerifiedCommit: "rx000" },
  skillMap: { "superpowers-brainstorming": "skills/brainstorming/SKILL.md" },
};

test("no change → no drift", () => {
  const r = computeDrift(manifest, { obra: "obra000", reasonix: "rx000" }, { obra: null, reasonix: null });
  assert.equal(hasDrift(r), false);
});

test("obra change maps changed file to skill name", () => {
  const r = computeDrift(manifest, { obra: "obra111", reasonix: "rx000" },
    { obra: ["skills/brainstorming/SKILL.md", "README.md"], reasonix: null });
  assert.equal(r.obra.drifted, true);
  assert.deepEqual(r.obra.items, ["superpowers-brainstorming"]);
  assert.equal(r.reasonix.drifted, false);
});

test("reasonix change keeps only watched contract paths", () => {
  const r = computeDrift(manifest, { obra: "obra000", reasonix: "rx111" },
    { obra: null, reasonix: ["internal/tool/read.go", "internal/tooling/x.go", "docs/x.md"] });
  assert.deepEqual(r.reasonix.items, ["internal/tool/read.go"]);
});

test("unreachable compare (null while drifted) is degraded", () => {
  const r = computeDrift(manifest, { obra: "obra111", reasonix: "rx000" }, { obra: null, reasonix: null });
  assert.equal(r.obra.degraded, true);
});

test("issue body names both upstreams and the command", () => {
  const r = computeDrift(manifest, { obra: "obra111", reasonix: "rx000" },
    { obra: ["skills/brainstorming/SKILL.md"], reasonix: null });
  const body = composeIssueBody(r);
  assert.match(body, /\/superpowers-sync-upstream/);
  assert.match(body, /obra\/superpowers/);
  assert.match(body, /superpowers-brainstorming/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test lib/upstream/drift.test.mjs`
Expected: FAIL — `Cannot find module './drift.mjs'`.

- [ ] **Step 3: Write the implementation**

`lib/upstream/drift.mjs`:

```js
// Pure drift computation and issue-body composition. No I/O.

export function computeDrift(manifest, latest, compareFiles) {
  return {
    obra: side({
      from: manifest.obra.lastSyncedCommit,
      to: latest.obra,
      files: compareFiles.obra,
      roots: [manifest.obra.skillsPath],
      label: "skill",
      skillMap: manifest.skillMap,
    }),
    reasonix: side({
      from: manifest.reasonix.lastVerifiedCommit,
      to: latest.reasonix,
      files: compareFiles.reasonix,
      roots: manifest.reasonix.contractPaths,
      label: "contract file",
    }),
  };
}

function side({ from, to, files, roots, label, skillMap }) {
  const drifted = from !== to;
  const out = { drifted, from, to, label, items: [], degraded: false };
  if (!drifted) return out;
  if (files == null) { out.degraded = true; return out; }
  const matched = files.filter((f) => roots.some((r) => f === r || f.startsWith(r + "/")));
  if (skillMap) {
    const pathToName = new Map(Object.entries(skillMap).map(([n, p]) => [p, n]));
    out.items = matched.map((f) => pathToName.get(f) ?? f);
  } else {
    out.items = matched;
  }
  return out;
}

export function hasDrift(report) {
  return report.obra.drifted || report.reasonix.drifted;
}

export function composeIssueBody(report) {
  const lines = ["Upstream drift detected. Run `/superpowers-sync-upstream` to re-port and re-pin.", ""];
  const sides = [["obra/superpowers", report.obra], ["DeepSeek-Reasonix main-v2", report.reasonix]];
  for (const [name, d] of sides) {
    if (!d.drifted) continue;
    lines.push(`### ${name}`, `\`${short(d.from)}\` to \`${short(d.to)}\``);
    if (d.degraded) {
      lines.push("Pinned commit unreachable (history rewritten); full diff unavailable. Re-pin during sync.");
    } else if (d.items.length) {
      lines.push(`Changed ${d.label}s:`, ...d.items.map((i) => `- ${i}`));
    } else {
      lines.push(`Advanced, but no watched ${d.label}s changed.`);
    }
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}

function short(sha) {
  return sha ? sha.slice(0, 9) : "unknown";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test lib/upstream/drift.test.mjs`
Expected: PASS (five tests).

- [ ] **Step 5: Commit**

```bash
git add lib/upstream/drift.mjs lib/upstream/drift.test.mjs
git commit -m "feat(sync): pure drift computation + issue body"
```

---

### Task 3: Drift-check orchestrator (injected deps)

**Files:**
- Create: `lib/upstream/check.mjs`
- Create: `lib/upstream/check.test.mjs`

**Interfaces:**
- Consumes: `computeDrift`, `hasDrift`, `composeIssueBody` (Task 2); a manifest (Task 1).
- Produces: `runDriftCheck(manifest, deps) -> Promise<{ drifted, report, issue? }>`.
  - `deps`: `{ fetchLatest(): Promise<{obra, reasonix}>, fetchCompare(which, from, to): Promise<string[]|null>, issues: { findOpen(label), create({title,body,label}), update(number, body) }, log(msg) }`.

- [ ] **Step 1: Write the failing test**

`lib/upstream/check.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { runDriftCheck } from "./check.mjs";

const manifest = {
  obra: { skillsPath: "skills", lastSyncedCommit: "obra000" },
  reasonix: { contractPaths: ["internal/tool"], lastVerifiedCommit: "rx000" },
  skillMap: { "superpowers-brainstorming": "skills/brainstorming/SKILL.md" },
};

function fakeIssues() {
  const calls = [];
  return {
    calls,
    open: null,
    async findOpen() { return this.open; },
    async create(x) { calls.push(["create", x]); },
    async update(n, b) { calls.push(["update", n, b]); },
  };
}

test("no drift creates no issue", async () => {
  const issues = fakeIssues();
  const res = await runDriftCheck(manifest, {
    fetchLatest: async () => ({ obra: "obra000", reasonix: "rx000" }),
    fetchCompare: async () => [],
    issues, log() {},
  });
  assert.equal(res.drifted, false);
  assert.equal(issues.calls.length, 0);
});

test("drift with no open issue creates one", async () => {
  const issues = fakeIssues();
  await runDriftCheck(manifest, {
    fetchLatest: async () => ({ obra: "obra111", reasonix: "rx000" }),
    fetchCompare: async () => ["skills/brainstorming/SKILL.md"],
    issues, log() {},
  });
  assert.equal(issues.calls[0][0], "create");
  assert.match(issues.calls[0][1].body, /superpowers-brainstorming/);
});

test("drift with an open issue updates it", async () => {
  const issues = fakeIssues();
  issues.open = { number: 7 };
  await runDriftCheck(manifest, {
    fetchLatest: async () => ({ obra: "obra111", reasonix: "rx000" }),
    fetchCompare: async () => ["skills/brainstorming/SKILL.md"],
    issues, log() {},
  });
  assert.equal(issues.calls[0][0], "update");
  assert.equal(issues.calls[0][1], 7);
});

test("compare is only fetched for the drifted upstream", async () => {
  const seen = [];
  await runDriftCheck(manifest, {
    fetchLatest: async () => ({ obra: "obra111", reasonix: "rx000" }),
    fetchCompare: async (which) => { seen.push(which); return ["skills/brainstorming/SKILL.md"]; },
    issues: fakeIssues(), log() {},
  });
  assert.deepEqual(seen, ["obra"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test lib/upstream/check.test.mjs`
Expected: FAIL — `Cannot find module './check.mjs'`.

- [ ] **Step 3: Write the implementation**

`lib/upstream/check.mjs`:

```js
import { computeDrift, hasDrift, composeIssueBody } from "./drift.mjs";

export async function runDriftCheck(manifest, deps) {
  const latest = await deps.fetchLatest();
  const need = {
    obra: latest.obra !== manifest.obra.lastSyncedCommit,
    reasonix: latest.reasonix !== manifest.reasonix.lastVerifiedCommit,
  };
  const compareFiles = {
    obra: need.obra ? await deps.fetchCompare("obra", manifest.obra.lastSyncedCommit, latest.obra) : null,
    reasonix: need.reasonix ? await deps.fetchCompare("reasonix", manifest.reasonix.lastVerifiedCommit, latest.reasonix) : null,
  };
  const report = computeDrift(manifest, latest, compareFiles);
  if (!hasDrift(report)) {
    deps.log("no upstream drift");
    return { drifted: false, report };
  }
  const body = composeIssueBody(report);
  const existing = await deps.issues.findOpen("upstream-drift");
  if (existing) {
    await deps.issues.update(existing.number, body);
    return { drifted: true, report, issue: existing.number };
  }
  await deps.issues.create({ title: "Upstream drift: superpowers + Reasonix", body, label: "upstream-drift" });
  return { drifted: true, report, issue: "new" };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test lib/upstream/check.test.mjs`
Expected: PASS (four tests).

- [ ] **Step 5: Commit**

```bash
git add lib/upstream/check.mjs lib/upstream/check.test.mjs
git commit -m "feat(sync): drift-check orchestrator with injected deps"
```

---

### Task 4: CI wiring (real script + workflow)

**Files:**
- Create: `.github/scripts/check-upstream-drift.mjs`
- Create: `.github/workflows/upstream-drift.yml`
- Modify: `package.json` (add a `drift` script)

**Interfaces:**
- Consumes: `loadManifest` (Task 1), `runDriftCheck` (Task 3).
- Produces: an executable CLI entrypoint; no exported API.

- [ ] **Step 1: Write the real wiring script**

`.github/scripts/check-upstream-drift.mjs`:

```js
import { execFileSync } from "node:child_process";
import { loadManifest } from "../../lib/upstream/manifest.mjs";
import { runDriftCheck } from "../../lib/upstream/check.mjs";

const manifest = loadManifest(new URL("../../UPSTREAM.json", import.meta.url));

function lsRemote(repo, ref) {
  const out = execFileSync("git", ["ls-remote", repo, ref], { encoding: "utf8" });
  const line = out.split("\n").find(Boolean) ?? "";
  return line.split("\t")[0].trim();
}

function slug(repoUrl) {
  return new URL(repoUrl).pathname.replace(/^\//, "").replace(/\.git$/, "");
}

async function ghApi(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "upstream-drift-check",
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${path}`);
  return res.json();
}

function gh(args) {
  execFileSync("gh", args, { stdio: "inherit", env: process.env });
}

const deps = {
  async fetchLatest() {
    return {
      obra: lsRemote(manifest.obra.repo, "HEAD"),
      reasonix: lsRemote(manifest.reasonix.repo, `refs/heads/${manifest.reasonix.branch}`),
    };
  },
  async fetchCompare(which, from, to) {
    const repo = which === "obra" ? manifest.obra.repo : manifest.reasonix.repo;
    const data = await ghApi(`/repos/${slug(repo)}/compare/${from}...${to}`);
    if (!data) return null;
    return (data.files ?? []).map((f) => f.filename);
  },
  issues: {
    async findOpen(label) {
      const data = await ghApi(`/repos/${process.env.GITHUB_REPOSITORY}/issues?state=open&labels=${label}`);
      return data && data.length ? { number: data[0].number } : null;
    },
    async create({ title, body, label }) {
      try { gh(["label", "create", label, "--color", "FBCA04", "--description", "Upstream drift", "--force"]); } catch {}
      gh(["issue", "create", "--title", title, "--body", body, "--label", label]);
    },
    async update(number, body) {
      gh(["issue", "edit", String(number), "--body", body]);
    },
  },
  log: (m) => console.log(m),
};

runDriftCheck(manifest, deps)
  .then((r) => console.log(r.drifted ? `drift -> issue ${r.issue}` : "clean"))
  .catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Syntax-check the script**

Run: `node --check .github/scripts/check-upstream-drift.mjs`
Expected: no output, exit 0.

- [ ] **Step 3: Local dry run against the fresh pins**

Run: `GITHUB_TOKEN=$(gh auth token) GITHUB_REPOSITORY=christopherarter/superpowers-reasonix node .github/scripts/check-upstream-drift.mjs`
Expected: prints `clean` (pins were just set to HEAD in Task 1, so no drift). If `gh` is not authenticated locally, skip this step; the workflow exercises it in CI.

- [ ] **Step 4: Write the workflow**

`.github/workflows/upstream-drift.yml`:

```yaml
name: Upstream drift check

on:
  schedule:
    - cron: "0 9 * * 1"
  workflow_dispatch:

permissions:
  contents: read
  issues: write

jobs:
  drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: node .github/scripts/check-upstream-drift.mjs
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITHUB_REPOSITORY: ${{ github.repository }}
```

- [ ] **Step 5: Add the npm script**

In `package.json` `scripts`, add: `"drift": "node .github/scripts/check-upstream-drift.mjs"`.

- [ ] **Step 6: Commit**

```bash
git add .github/scripts/check-upstream-drift.mjs .github/workflows/upstream-drift.yml package.json
git commit -m "feat(sync): scheduled CI drift check"
```

Post-merge verification (manual, after the workflow exists on the default branch): run the workflow from the Actions tab via `workflow_dispatch`; expected result is a green run printing `clean` and no issue opened.

---

### Task 5: The `superpowers-sync-upstream` skill

**Files:**
- Create: `skills/superpowers-sync-upstream/SKILL.md`

**Interfaces:**
- Consumes: `UPSTREAM.json` (Task 1), the CI script (Task 4), `superpowers-writing-skills` and `bench/` (existing).
- Produces: a discoverable skill the structural gate covers.

- [ ] **Step 1: Write the skill**

`skills/superpowers-sync-upstream/SKILL.md`:

```markdown
---
name: superpowers-sync-upstream
description: "Sync this port with upstream obra/superpowers or Reasonix main-v2: detect drift, re-port, bench-gate."
---

# Sync Upstream

Re-aligns this port with its two upstreams and re-pins `UPSTREAM.json`. Run when asked to sync or update from upstream, or after the `upstream-drift` CI issue fires.

## 1. Detect

Read `UPSTREAM.json` for the pinned commits and watched paths, then see what moved:

`node .github/scripts/check-upstream-drift.mjs` prints which upstreams drifted (read-only).

For full diffs, shallow-fetch and compare from the pins:

`git clone --filter=blob:none --no-checkout <obra.repo> /tmp/obra && git -C /tmp/obra diff <obra.lastSyncedCommit>..HEAD -- skills/`

`git clone --filter=blob:none --no-checkout <reasonix.repo> /tmp/rx && git -C /tmp/rx diff <reasonix.lastVerifiedCommit>..origin/main-v2 -- internal/tool internal/hook internal/skill internal/frontmatter internal/command`

Network blocked? `web_fetch` the GitHub compare page: `<repo>/compare/<pinned>...<branch>`. This step is read-only; dispatch it to a `task` subagent and keep only the drift report to save context.

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

Bump `UPSTREAM.json` commits and dates to the synced HEADs, close the open `upstream-drift` issue, write a short report (changed, ported, retired, bench result), and commit.
```

- [ ] **Step 2: Verify the structural gate accepts the new skill**

Run: `node --test bench/structural.test.mjs`
Expected: PASS, including `superpowers-sync-upstream`. If it flags the index budget, trim the `description` until it passes (drop words, keep the trigger phrase "sync" plus both upstream names).

- [ ] **Step 3: Commit**

```bash
git add skills/superpowers-sync-upstream/SKILL.md
git commit -m "feat(sync): superpowers-sync-upstream skill"
```

---

### Task 6: Document staying current in the README

**Files:**
- Modify: `README.md` (add a "Staying current" subsection)

**Interfaces:**
- Consumes: everything above. No code.

- [ ] **Step 1: Add the subsection**

Insert a `## Staying current` section after "Design notes" and before "Adaptations from Claude Code superpowers":

```markdown
## Staying current

This is a port, so it drifts from two upstreams: `obra/superpowers` (content) and DeepSeek-Reasonix `main-v2` (the harness). `UPSTREAM.json` pins the commit last synced from each.

Run `/superpowers-sync-upstream` to check both, re-port what changed through the Adaptations rules, and re-pin once `bench/` passes. A weekly GitHub Action (`.github/workflows/upstream-drift.yml`) does the detection on its own: when either upstream advances past its pin, it opens one `upstream-drift` issue listing the changed skills or contract files.
```

- [ ] **Step 2: Verify prose is clean**

Confirm no em dashes and no unicode arrows were introduced (the repo's deslop rule). Read the new section back.

Run: `grep -nE "—|→" README.md`
Expected: no matches in the new section (existing literal example content elsewhere is unchanged).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(readme): document upstream sync and drift check"
```

---

## Self-Review

**Spec coverage:**
- Manifest (`UPSTREAM.json`) with obra/reasonix pins, skillMap, retired → Task 1. ✓
- In-session skill: detect, classify content, re-port, classify harness, bench-gate, finalize → Task 5. ✓
- Scheduled CI that diffs pins and opens one idempotent issue → Tasks 3 (logic) + 4 (wiring/workflow). ✓
- Detection via git diff in-session and compare API in CI → Task 5 body + Task 4 `fetchCompare`. ✓
- 404 / force-push degraded path → Task 2 (`degraded`) + Task 4 (`ghApi` returns null on 404). ✓
- Pure functions for testability → Tasks 2 and 3. ✓
- Bench gate + structural coverage of the new skill → Task 5 Step 2; manifest validation test → Task 1. ✓
- Retired list stops re-flagging → Task 1 `retired` + Task 2 mapping (retired skills are absent from changed-skill names unless their file changes, which is the intended signal). ✓
- README "Staying current" → Task 6. ✓
- Non-goal (no exec-fidelity scenario for the maintenance skill; structural gate only) → recorded in plan header. ✓

**Placeholder scan:** The only tokens left to fill are `PASTE_OBRA_HEAD_SHA` / `PASTE_REASONIX_MAINV2_SHA` in Task 1, which Step 4 fills from the `git ls-remote` output in that same step; the real-manifest test fails until they are valid. The `<obra.repo>` / `<pinned>` tokens in the skill body are intentional template slots the skill resolves from `UPSTREAM.json` at run time, not plan gaps.

**Type consistency:** `computeDrift` / `hasDrift` / `composeIssueBody` signatures match between Task 2 (definition), its tests, and Task 3 (`runDriftCheck` consumer). `runDriftCheck(manifest, deps)` and the `deps` shape match between Task 3 definition, its fakes, and Task 4's real `deps`. `loadManifest` / `validateManifest` from Task 1 are used as defined in Task 4 and the manifest test. ✓
