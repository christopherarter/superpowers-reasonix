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
