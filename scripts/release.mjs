/**
 * Release helper — run after `cargo tauri build` to:
 *   1. Sign the NSIS installer with your private key
 *   2. Generate latest.json (the update manifest)
 *
 * Usage:
 *   node scripts/release.mjs --version 1.2.0 --notes "Bug fixes and improvements"
 *
 * Required env vars:
 *   TAURI_SIGNING_PRIVATE_KEY_PATH  — path to nova-explorer.key
 *   TAURI_SIGNING_PRIVATE_KEY_PASSWORD — password used when generating the key
 *
 * Or set defaults below for local use.
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, "..");

// ── Config ────────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => a.slice(2).split("="))
    .map(([k, ...v]) => [k, v.join("=")])
);

const version  = args.version  ?? JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const notes    = args.notes    ?? "See release notes on GitHub.";
const keyPath  = process.env.TAURI_SIGNING_PRIVATE_KEY_PATH
               ?? `${process.env.USERPROFILE ?? process.env.HOME}/.tauri/nova-explorer.key`;
const keyPass  = process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD ?? "novaexplorer";

// GitHub repo — update if you publish there
const GITHUB_REPO = "kieronbradshaw/nova-explorer";
const RELEASE_TAG = `v${version}`;

const INSTALLER = join(root, `src-tauri/target/release/bundle/nsis/Nova Explorer_${version}_x64-setup.exe`);

if (!existsSync(INSTALLER)) {
  console.error(`Installer not found: ${INSTALLER}`);
  console.error("Run: cargo tauri build   first.");
  process.exit(1);
}

if (!existsSync(keyPath)) {
  console.error(`Private key not found: ${keyPath}`);
  console.error("Run: cargo tauri signer generate -w ~/.tauri/nova-explorer.key");
  process.exit(1);
}

// ── Sign ──────────────────────────────────────────────────────────────────────
console.log(`Signing ${INSTALLER}…`);
const env = {
  ...process.env,
  TAURI_SIGNING_PRIVATE_KEY_PATH: keyPath,
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: keyPass,
  CARGO_HTTP_CHECK_REVOKE: "false",
};

const sigOutput = execSync(
  `"${process.env.USERPROFILE}\\.cargo\\bin\\cargo.exe" tauri signer sign -k "${keyPath}" -p "${keyPass}" "${INSTALLER}"`,
  { env, encoding: "utf8" }
);

// The CLI prints the base64 signature to stdout
const signature = sigOutput.trim().split("\n").pop()?.trim() ?? "";
console.log(`Signature: ${signature.slice(0, 40)}…`);

// ── Generate latest.json ──────────────────────────────────────────────────────
const manifest = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature,
      url: `https://github.com/${GITHUB_REPO}/releases/download/${RELEASE_TAG}/Nova.Explorer_${version}_x64-setup.exe`,
    },
  },
};

const outPath = join(root, "latest.json");
writeFileSync(outPath, JSON.stringify(manifest, null, 2));
console.log(`\nWritten: ${outPath}`);
console.log("\n─────────────────────────────────────────────────");
console.log("Next steps to publish the update:");
console.log(`  1. Create a GitHub release tagged "${RELEASE_TAG}"`);
console.log(`  2. Upload: Nova Explorer_${version}_x64-setup.exe`);
console.log(`  3. Upload: latest.json`);
console.log("  4. Users will be notified on next app launch.");
console.log("─────────────────────────────────────────────────\n");
