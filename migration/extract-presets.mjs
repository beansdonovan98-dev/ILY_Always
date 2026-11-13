import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const src = readFileSync('supabase/functions/ai-image-edit/styleBuckets.ts', 'utf8');
mkdirSync('migration/presets', { recursive: true });

const grabArray = (startMarker, endMarker = '];') => {
  const start = src.indexOf(startMarker);
  if (start === -1) throw new Error('missing ' + startMarker);
  const end = src.indexOf(endMarker, start);
  const body = src.slice(start, end);
  const items = [...body.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) =>
    m[1].replace(/\\'/g, "'")
  );
  return items;
};

const poses = grabArray('export const POSE_OPTIONS = [');
const envs = grabArray('export const MASSIVE_AUTHENTIC_WEED_ENVIRONMENTS = [');
const seen = new Map();
for (const m of src.matchAll(/id:\s*'([a-z0-9-]+)',\s*bucket:\s*'([a-z0-9_]+)'/g)) {
  seen.set(m[1], { id: m[1], bucket: m[2] });
}
const styles = [...seen.values()];

writeFileSync('migration/presets/poses.json', JSON.stringify({ count: poses.length, poses }, null, 2));
writeFileSync('migration/presets/environments.json', JSON.stringify({ count: envs.length, environments: envs }, null, 2));
writeFileSync('migration/presets/styles.json', JSON.stringify({ count: styles.length, styles }, null, 2));

const byBucket = {};
for (const s of styles) byBucket[s.bucket] = (byBucket[s.bucket] || 0) + 1;
writeFileSync('migration/presets/buckets.json', JSON.stringify(byBucket, null, 2));

console.log(`poses=${poses.length} envs=${envs.length} styles=${styles.length}`);
console.log(JSON.stringify(byBucket));
