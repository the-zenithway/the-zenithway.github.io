/* Offline mode (Profile > Settings). Registered only when the student turns it on.
 * Network first: online, every page and file is fetched fresh (so a new version always wins) and a copy is kept; offline, the last copy is
 * served. "Update offline copy" in Settings pre-saves the whole platform (pages, scripts, styles, the problem banks and figures) from
 * data/offline-manifest.json. Nothing here touches POST requests or the student-data endpoint, so work done offline is saved in the
 * browser as usual and syncs when the connection is back. */
var CACHE = 'zenith-offline-v1';
var EXTERNAL = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.simpleicons.org'];

self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin && EXTERNAL.indexOf(url.hostname) < 0) return;
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && (res.ok || res.type === 'opaque')) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        if (hit) return hit;
        if (req.mode === 'navigate') return caches.match(req, { ignoreSearch: true }).then(function (page) { return page || caches.match('portal.html'); });
        return caches.match(req, { ignoreSearch: true });
      }).then(function (hit) { return hit || new Response('Offline, and this file was not saved for offline use.', { status: 503, headers: { 'Content-Type': 'text/plain' } }); });
    })
  );
});

// {type:'precache', urls:[...]} -> save each url; replies {ok, saved, failed:[...]} on the message port.
self.addEventListener('message', function (e) {
  var d = e.data || {}, port = e.ports && e.ports[0];
  if (d.type !== 'precache') return;
  e.waitUntil(caches.open(CACHE).then(function (cache) {
    var failed = [], saved = 0;
    return Promise.all((d.urls || []).map(function (u) {
      var cross = /^https?:/.test(u) && new URL(u).origin !== self.location.origin;
      return fetch(u, { cache: 'reload', mode: cross ? 'no-cors' : 'cors' })
        .then(function (res) { if (res.ok || res.type === 'opaque') { saved++; return cache.put(u, res); } failed.push(u); })
        .catch(function () { failed.push(u); });
    })).then(function () { if (port) port.postMessage({ ok: failed.length < (d.urls || []).length, saved: saved, failed: failed }); });
  }));
});
