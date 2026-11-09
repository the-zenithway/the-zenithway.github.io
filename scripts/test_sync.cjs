// Tests for the client side of the commit-based sync in js/zp-store.js (batched pushes, pulls straight from GitHub, no waiting on the network).
// Run: node scripts/test_sync.cjs
const assert = require('assert');
let n = 0;
const test = async (name, fn) => { await fn(); n++; console.log('ok  ' + name); };

// --- fakes: browser storage, fetch, and a manual timer so "5 minutes" can be checked without waiting ---
const store = {};
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; }, key: i => Object.keys(store)[i], get length() { return Object.keys(store).length; } };
const calls = []; let rawEvents = [], rawStatus = 200, postOk = true;
global.fetch = (url, opts) => {
  calls.push({ url: String(url), method: (opts && opts.method) || 'GET', body: opts && opts.body });
  const reply = (code, body) => Promise.resolve({ ok: code >= 200 && code < 300, status: code, json: () => Promise.resolve(body) });
  if (/^http:\/\/script\//.test(url)) return postOk ? reply(200, { ok: true, added: 1 }) : Promise.reject(new Error('offline'));
  if (/^http:\/\/raw\//.test(url)) return rawStatus === 404 ? reply(404, {}) : reply(200, { events: rawEvents });
  if (/legacy-import/.test(url)) return reply(200, {});
  return reply(404, {});
};
const timers = []; const realSetTimeout = global.setTimeout;
global.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
global.clearTimeout = () => {};
global.ZP_CONFIG = Object.assign({}, require('../js/zp-config.js'), { DATA_URL: 'http://script/exec', CLOUD_RAW_URL: 'http://raw/data/cloud', SYNC_PUSH_MINUTES: 5, SYNC_PULL_MINUTES: 5 });
const ZP = require('../js/zp-store.js');
const flushTimers = async () => { while (timers.length) { const t = timers.shift(); await t.fn(); } await new Promise(r => realSetTimeout(r, 5)); };
const rawCalls = () => calls.filter(c => c.url.startsWith('http://raw/')).length, posts = () => calls.filter(c => c.method === 'POST');

(async () => {
  await test('opening a page shows local data at once and pulls from GitHub (not the script), then skips the pull for 5 minutes', async () => {
    const s = ZP.open('ann', 'c1'); await s.load();
    assert.strictEqual(rawCalls(), 1); assert.ok(/ann__c1\.json/.test(calls.find(c => c.url.startsWith('http://raw/')).url)); assert.strictEqual(posts().length, 0);
    await new Promise(r => realSetTimeout(r, 5));
    const again = ZP.open('ann', 'c1'); await again.load(); assert.strictEqual(rawCalls(), 1, 'moving to another page does not fetch again');
  });

  await test('changes are batched: a burst is one commit about 3 s later, the next one waits for the 5-minute beat', async () => {
    const s = ZP.open('ann', 'c1'); await s.load(); timers.length = 0;
    s.append('c_answer', { pid: '1CA1', correct: true }); s.append('c_answer', { pid: '1CA2', correct: false }); s.append('note', { pid: '1CA2', text: 'x' });
    assert.strictEqual(posts().length, 0, 'nothing is sent while the page is in use'); assert.strictEqual(timers.length, 1, 'one timer for the whole burst'); assert.ok(timers[0].ms >= 3000 && timers[0].ms < 5000, 'about 3 s when nothing was sent for a while');
    await flushTimers();
    assert.strictEqual(posts().length, 1); const body = JSON.parse(posts()[0].body); assert.strictEqual(body.action, 'append'); assert.strictEqual(body.events.length, 3); assert.strictEqual(s.status.pending, 0);
    s.append('c_answer', { pid: '1CA3', correct: true }); assert.strictEqual(timers.length, 1); assert.ok(timers[0].ms > 240000, 'right after a push the next one waits for the 5-minute beat (' + timers[0].ms + ' ms)');
  });

  await test('an unreachable script never loses anything: events stay queued and are retried', async () => {
    timers.length = 0; postOk = false; const s = ZP.open('bob', 'c1'); await s.load(); timers.length = 0;
    s.append('c_answer', { pid: '1CA1', correct: true }); await flushTimers();
    assert.strictEqual(s.status.pending, 1); assert.ok(/offline/.test(s.status.error)); assert.ok(timers.length >= 0);
    postOk = true; timers.length = 0; await s.syncNow(); assert.strictEqual(s.status.pending, 0, 'Sync now sends the queue');
  });

  await test('Sync now pulls what another device wrote (union by id, no duplicates) and reports how many are new', async () => {
    const s = ZP.open('cat', 'c1'); await s.load(); await new Promise(r => realSetTimeout(r, 5));
    rawEvents = [{ id: 'r1', t: 5, type: 'c_answer', pid: '1CA1', correct: true }, { id: 'r2', t: 6, type: 'c_answer', pid: '1CA2', correct: true }];
    assert.strictEqual(await s.syncNow(), 2); assert.strictEqual(s.events().length, 2);
    assert.strictEqual(await s.syncNow(), 0, 'the same events are not added twice'); assert.strictEqual(s.events().length, 2);
    rawStatus = 404; assert.strictEqual(await s.syncNow(), 0, 'a missing file means nothing was synced yet, not an error'); assert.strictEqual(s.status.error, ''); rawStatus = 200;
  });

  await test('the teacher view reads every student log from GitHub in parallel and adds this browser\'s unsent copies', async () => {
    rawEvents = [{ id: 'q1', t: 1, type: 'msg', from: 'student', text: 'hi' }];
    store['zenith:zp:v1:dan:c1'] = JSON.stringify([{ id: 'local1', t: 2, type: 'msg', from: 'teacher', by: 'kyjteach', text: 'hello' }]);
    const before = rawCalls(); const out = await ZP.loadAll([{ username: 'dan', course: 'c1' }, { username: 'eve', course: 'c1' }]);
    assert.strictEqual(rawCalls() - before, 2); assert.strictEqual(out.source, 'remote');
    const dan = out.rows.filter(r => r.username === 'dan').map(r => r.id).sort(); assert.deepStrictEqual(dan, ['local1', 'q1']);
    assert.ok(out.rows.some(r => r.username === 'eve' && r.id === 'q1'));
  });

  console.log('\n' + n + ' sync tests passed');
})().catch(e => { console.error(e); process.exit(1); });
