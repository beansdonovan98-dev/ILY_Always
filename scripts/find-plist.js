const fs = require('fs');
function walk(d) {
  let r = [];
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = d + '/' + f.name;
    if (f.isDirectory()) r = r.concat(walk(p));
    else if (f.name.endsWith('plist')) {
      try {
        const s = fs.readFileSync(p, 'utf8');
        if (s.includes('CFBundleShortVersionString') && s.includes('CFBundleVersion')) {
          console.log(p);
        }
      } catch {}
    }
  }
  return r;
}
walk('node_modules');
console.log('done');