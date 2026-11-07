import { readFileSync, writeFileSync } from 'node:fs';

const arg = process.argv[2];
const n = Number.parseInt(arg, 10);
if (!Number.isInteger(n) || n <= 0) {
  console.error('Usage: node scripts/set-build-number.mjs <positive-integer>');
  process.exit(1);
}

const OFFSET = 1000;
const buildNumber = n + OFFSET;
const patch = Math.max(0, n - 1);
const version = `1.0.${patch}`;

const targets = ['app.config.ts', 'app.json'];
let updated = false;
for (const file of targets) {
  try {
    let src = readFileSync(file, 'utf8');
    if (file.endsWith('.ts')) {
      if (/version\s*:/.test(src)) {
        src = src.replace(/version\s*:\s*['"][^'"]*['"]/, `version: '${version}'`);
      } else {
        src = src.replace(/name:\s*['"][^'"]*['"]/, (m) => `${m},\n  version: '${version}'`);
      }
      if (/buildNumber\s*:/.test(src)) {
        src = src.replace(/buildNumber\s*:\s*\d+/, `buildNumber: ${buildNumber}`);
      } else {
        src = src.replace(
          /ios:\s*\{/,
          `ios: {\n    buildNumber: ${buildNumber},`
        );
      }
    } else {
      const json = JSON.parse(src);
      if (!json.expo) json.expo = {};
      json.expo.version = version;
      if (!json.expo.ios) json.expo.ios = {};
      json.expo.ios.buildNumber = buildNumber;
      src = JSON.stringify(json, null, 2) + '\n';
    }
    writeFileSync(file, src, 'utf8');
    updated = true;
    console.log(`Updated ${file} buildNumber=${buildNumber}`);
  } catch (e) {
    // file may not exist; skip
  }
}

if (!updated) {
  console.error('No config file updated');
  process.exit(1);
}