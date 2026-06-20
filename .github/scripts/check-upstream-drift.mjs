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
