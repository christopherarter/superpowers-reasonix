import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

test("Git comparison includes watched paths beyond GitHub's 300-file limit", async () => {
  const source = mkdtempSync(join(tmpdir(), "upstream-source-"));
  try {
    git(source, "init", "-q");
    writeFileSync(join(source, "README.md"), "base\n");
    git(source, "add", ".");
    git(source, "-c", "commit.gpgsign=false", "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "base");
    const from = git(source, "rev-parse", "HEAD");

    for (let i = 0; i < 300; i++) {
      writeFileSync(join(source, `file-${String(i).padStart(3, "0")}.txt`), "changed\n");
    }
    mkdirSync(join(source, "internal", "tool"), { recursive: true });
    writeFileSync(join(source, "internal", "tool", "late.go"), "package tool\n");
    git(source, "add", ".");
    git(source, "-c", "commit.gpgsign=false", "-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "many files");
    const to = git(source, "rev-parse", "HEAD");

    const compare = await import("./compare.mjs").catch(() => ({}));
    const files = compare.gitChangedFiles?.(source, from, to) ?? [];
    assert.equal(files.length, 301);
    assert.ok(files.includes("internal/tool/late.go"));
  } finally {
    rmSync(source, { recursive: true, force: true });
  }
});

test("a full API page uses Git; a smaller page stays on the API result", async () => {
  const compare = await import("./compare.mjs").catch(() => ({}));
  const calls = [];
  const fallback = () => { calls.push("git"); return ["internal/tool/late.go"]; };
  const shortPage = [{ filename: "README.md" }];
  assert.deepEqual(compare.completeCompareFiles?.({ files: shortPage }, "repo", "a", "b", fallback), ["README.md"]);
  assert.deepEqual(calls, []);
  const fullPage = Array.from({ length: 300 }, (_, i) => ({ filename: `file-${i}` }));
  assert.deepEqual(compare.completeCompareFiles?.({ files: fullPage }, "repo", "a", "b", fallback), ["internal/tool/late.go"]);
  assert.deepEqual(compare.completeCompareFiles?.({}, "repo", "a", "b", fallback), ["internal/tool/late.go"]);
  assert.deepEqual(calls, ["git", "git"]);
  assert.equal(compare.completeCompareFiles?.(null, "repo", "a", "b", fallback), null);
});
