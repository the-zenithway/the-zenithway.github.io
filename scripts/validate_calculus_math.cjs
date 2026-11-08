/* Compile every reviewed math span using the site's KaTeX version.
 * Usage: node scripts/validate_calculus_math.cjs /path/to/katex.js
 * Obtain KaTeX 0.16.9 from the site's existing dependency or npm; no network
 * requests or package installation are performed by this validator.
 */
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const katex = require(process.argv[2] ? path.resolve(process.argv[2]) : 'katex');
const errors = [];
let equations = 0;
for (const name of fs.readdirSync(path.join(root, 'data/calculus-reviewed')).filter(n => n.endsWith('.json'))) {
  for (const p of JSON.parse(fs.readFileSync(path.join(root, 'data/calculus-reviewed', name), 'utf8'))) {
    const fields = [['stem', p.stem_tex], ['explanation', p.explanation_tex], ...(p.choices_tex || []).map((s, i) => ['choice ' + i, s])];
    for (const [field, value] of fields) {
      if (!value) continue;
      const re = /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|(?<!\\)\$((?:\\.|[^$])*)\$/g;
      for (const m of value.matchAll(re)) {
        equations++;
        try { katex.renderToString(m[1] ?? m[2] ?? m[3] ?? m[4], { throwOnError: true, strict: 'error', trust: false }); }
        catch (e) { errors.push({ file: name, id: p.id, field, error: e.message }); }
      }
    }
  }
}
console.log(JSON.stringify({ equations, errors }, null, 2));
process.exitCode = errors.length ? 1 : 0;
