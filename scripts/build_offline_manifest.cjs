// Lists every file "Update offline copy" saves (Profile > Settings > Offline mode): node scripts/build_offline_manifest.cjs
// Re-run after adding pages, scripts or banks. Writes data/offline-manifest.json.
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const ls = (dir, ok) => fs.existsSync(path.join(root, dir)) ? fs.readdirSync(path.join(root, dir)).filter(ok).map(f => dir + '/' + f) : [];
const PAGES = ['index.html', 'login.html', 'portal.html', 'roadmap.html', 'chapter.html', 'practice.html', 'notebook.html', 'right-now.html', 'calendar.html', 'mentor.html', 'profile.html'];
const DATA_SKIP = /(log|signup|scheduled|announcements|changelog|requests)/i;
const urls = [].concat(
  PAGES, ls('js', f => f.endsWith('.js')), ls('css', f => f.endsWith('.css')),
  ls('data', f => f.endsWith('.json') && !DATA_SKIP.test(f) && f !== 'offline-manifest.json'),
  ls('data/calculus-figures', f => /\.(png|jpe?g|svg|webp)$/i.test(f)),
  ['favicon.ico', 'favicon-16x16.png', 'favicon-32x32.png', 'apple-touch-icon.png'],
  ['https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css', 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js', 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js']
).filter(u => /^https?:/.test(u) || fs.existsSync(path.join(root, u)));
fs.writeFileSync(path.join(root, 'data', 'offline-manifest.json'), JSON.stringify({ built: new Date().toISOString().slice(0, 10), urls }, null, 1) + '\n');
console.log(urls.length + ' files');
