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
