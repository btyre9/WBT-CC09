#!/usr/bin/env node
/**
 * Copies VO audio files from a shared OneDrive folder into the project.
 * Run: npm run sync-audio
 *
 * OneDrive path is resolved automatically by platform, or override with:
 *   ONEDRIVE_PATH=<path> npm run sync-audio
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ── Resolve source ────────────────────────────────────────────────────────────

const ASSET_SUBPATH = path.join('Porsche-WBT-Assets', 'CC09', 'vo');

function findOneDrive() {
  if (process.env.ONEDRIVE_PATH) return process.env.ONEDRIVE_PATH;

  const home = os.homedir();

  const candidates = [
    // Windows – personal
    path.join(home, 'OneDrive'),
    // Windows – work/school account
    path.join(home, 'OneDrive - Porsche'),
    // macOS – personal (modern)
    path.join(home, 'Library', 'CloudStorage', 'OneDrive-Personal'),
    // macOS – work/school (modern)
    path.join(home, 'Library', 'CloudStorage', 'OneDrive-PorscheAG'),
    // macOS – legacy mount
    path.join(home, 'OneDrive'),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

const oneDriveRoot = findOneDrive();
if (!oneDriveRoot) {
  console.error('ERROR: Could not locate OneDrive folder.');
  console.error('Set ONEDRIVE_PATH=<path> to override, e.g.:');
  console.error('  ONEDRIVE_PATH="/Users/you/OneDrive" npm run sync-audio');
  process.exit(1);
}

const src = path.join(oneDriveRoot, ASSET_SUBPATH);
if (!fs.existsSync(src)) {
  console.error(`ERROR: Source folder not found:\n  ${src}`);
  console.error('\nCreate that folder in OneDrive and place your VO mp3 files there.');
  process.exit(1);
}

// ── Resolve destination ───────────────────────────────────────────────────────

const dest = path.join(__dirname, '..', 'course', 'assets', 'audio', 'vo');
fs.mkdirSync(dest, { recursive: true });

// ── Copy ──────────────────────────────────────────────────────────────────────

const files = fs.readdirSync(src).filter(f => f.endsWith('.mp3'));
if (files.length === 0) {
  console.warn(`WARNING: No .mp3 files found in:\n  ${src}`);
  process.exit(0);
}

let copied = 0, skipped = 0;

for (const file of files) {
  const srcFile  = path.join(src, file);
  const destFile = path.join(dest, file);

  // Skip if destination is already up to date (same size)
  if (fs.existsSync(destFile)) {
    const srcStat  = fs.statSync(srcFile);
    const destStat = fs.statSync(destFile);
    if (srcStat.size === destStat.size && srcStat.mtimeMs <= destStat.mtimeMs) {
      skipped++;
      continue;
    }
  }

  fs.copyFileSync(srcFile, destFile);
  console.log(`  copied  ${file}`);
  copied++;
}

console.log(`\nDone — ${copied} copied, ${skipped} already up to date.`);
console.log(`Destination: ${dest}`);
