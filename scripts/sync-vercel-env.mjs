/**
 * Push .env.local variables to Vercel (production, preview, development).
 *
 * Usage:
 *   node scripts/sync-vercel-env.mjs
 *
 * Requires: linked Vercel project (`npx vercel link`) and logged-in CLI.
 * Does NOT print secret values.
 */

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "../.env.local");

function parseEnvFile(content) {
  const entries = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const name = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (name && value) {
      entries.push({ name, value });
    }
  }

  return entries;
}

function addToVercel(name, value, target) {
  const result = spawnSync(
    "npx",
    [
      "vercel",
      "env",
      "add",
      name,
      target,
      "--value",
      value,
      "--yes",
      "--sensitive",
      "--force",
    ],
    { stdio: ["pipe", "pipe", "pipe"], encoding: "utf8" },
  );

  const ok = result.status === 0;
  const detail = (result.stderr || result.stdout || "").trim().split("\n").pop();
  console.log(`${ok ? "✓" : "✗"} ${name} → ${target}${detail ? ` (${detail})` : ""}`);
  return ok;
}

const content = readFileSync(envPath, "utf8");
const entries = parseEnvFile(content);

console.log(`Syncing ${entries.length} variables from .env.local to Vercel...\n`);

let failed = 0;
const targets = process.argv.includes("--all")
  ? ["production", "preview", "development"]
  : ["production"];

for (const { name, value } of entries) {
  for (const target of targets) {
    if (!addToVercel(name, value, target)) failed += 1;
  }
}

console.log(
  failed === 0
    ? "\nDone. Redeploy: npx vercel --prod --yes"
    : `\nFinished with ${failed} failures. Check output above.`,
);

process.exit(failed > 0 ? 1 : 0);
