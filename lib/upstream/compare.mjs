import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// GitHub's compare API returns at most 300 files. Fetch just the two trees
// when that page is full so watched paths cannot disappear from the report.
export function gitChangedFiles(repo, from, to) {
  const dir = mkdtempSync(join(tmpdir(), "upstream-compare-"));
  try {
    execFileSync("git", ["init", "-q", dir]);
    execFileSync("git", ["-C", dir, "remote", "add", "origin", repo]);
    execFileSync("git", ["-C", dir, "fetch", "-q", "--no-tags", "--filter=blob:none", "--depth=1", "origin", from, to], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const output = execFileSync("git", ["-C", dir, "diff", "--no-renames", "--name-only", "-z", from, to], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
    return output.split("\0").filter(Boolean);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function completeCompareFiles(data, repo, from, to, fallback = gitChangedFiles) {
  if (data == null) return null;
  if (!Array.isArray(data.files) || data.files.length >= 300) {
    return fallback(repo, from, to);
  }
  return data.files.map((file) => file.filename);
}
