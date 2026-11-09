/* Photos on concept cards: a photo of a handwritten page, a diagram, a graph. Shown in the Book stage, the Close stage, the
 * Concepts Notebook, the study guide and the review queue. A photo is compressed in the browser, uploaded like the Mentor photos
 * (zenith-data-writer.gs action uploadPhotos) and kept as a URL on the concept event. With no endpoint (local testing) the compressed
 * photo stays in the event in this browser.
 *
 *   ZPPhotos.controlsHTML(images)            thumbnails + "Add photo" for one card
 *   ZPPhotos.thumbsHTML(images)              thumbnails only (read-only views)
 *   ZPPhotos.bind(host, {images(cardEl), save(cardEl, images), onError(msg)})   wire a page's cards (once per host, callbacks replaceable)
 */
(function (root) {
  'use strict';
  var UI = root.ZPUI, esc = UI.esc, MAX = 4;

  function src(im) { return im.url || im.data || ''; }
  function thumbsHTML(images) {
    var list = (images || []).filter(function (im) { return src(im); });
    return list.length ? '<div class="zp-cimgs">' + list.map(function (im, i) {
      return '<span class="zp-cthumb"><button type="button" class="zp-cthumbbtn" data-photo-view="' + i + '" aria-label="View photo ' + (i + 1) + '"><img src="' + esc(src(im)) + '" alt="' + esc(im.name || 'Photo ' + (i + 1)) + '" loading="lazy"></button></span>';
    }).join('') + '</div>' : '';
  }
  function controlsHTML(images) {
    var list = images || [];
    return '<div class="zp-cphotos">' + (list.length ? '<div class="zp-cimgs">' + list.map(function (im, i) {
      return '<span class="zp-cthumb"><button type="button" class="zp-cthumbbtn" data-photo-view="' + i + '" aria-label="View photo ' + (i + 1) + '"><img src="' + esc(src(im)) + '" alt="' + esc(im.name || 'Photo ' + (i + 1)) + '" loading="lazy"></button><button type="button" class="zp-cthumbrm" data-photo-rm="' + i + '" aria-label="Remove photo ' + (i + 1) + '">×</button></span>';
    }).join('') + '</div>' : '') +
      (list.length < MAX ? '<input type="file" accept="image/*" multiple hidden data-photo-file><button type="button" class="zp-linkbtn" data-photo-add>+ Add a photo or picture</button>' : '<span class="zp-muted">Up to ' + MAX + ' photos.</span>') + '<span class="zp-muted" data-photo-msg role="status"></span></div>';
  }

  function read(file) {
    return typeof readImageAsCompressedBase64_ === 'function' ? readImageAsCompressedBase64_(file, 1100, 0.75) : Promise.reject(new Error('Photos are not available on this page.'));
  }
  function upload(photos) {
    var local = function () { return photos.map(function (p) { return { data: 'data:' + p.mimeType + ';base64,' + p.dataBase64, name: p.filename }; }); };
    if (typeof TEACHER_DATA_WRITE_URL === 'undefined' || !TEACHER_DATA_WRITE_URL) return Promise.resolve(local());
    return fetch(TEACHER_DATA_WRITE_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: 'uploadPhotos', payload: { photos: photos } }) })
      .then(function (r) { return r.json(); }).then(function (res) {
        if (!res.ok || !res.urls) throw new Error(res.error || 'upload failed');
        return res.urls.map(function (u, i) { return { url: u, name: photos[i].filename }; });
      }).catch(function (e) { if (root.ZP_CONFIG && root.ZP_CONFIG.DATA_URL) throw e; return local(); });
  }

  function lightbox(images, i) {
    var im = images[i]; if (!im) return;
    var el = document.createElement('div'); el.className = 'zp-lightbox'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Photo');
    el.innerHTML = '<img src="' + esc(src(im)) + '" alt="' + esc(im.name || 'Photo') + '"><button type="button" aria-label="Close">×</button>';
    function close() { el.remove(); document.removeEventListener('keydown', key); }
    function key(e) { if (e.key === 'Escape') close(); }
    el.addEventListener('click', close); document.addEventListener('keydown', key); document.body.appendChild(el);
  }

  function bind(host, cb) {
    host.__zpPhotosCb = cb;
    if (host.__zpPhotosBound) return;
    host.__zpPhotosBound = true;
    host.addEventListener('click', function (e) {
      var c = host.__zpPhotosCb, card = e.target.closest('[data-cp]');
      var v = e.target.closest('[data-photo-view]');
      if (v && card) return lightbox(c.images(card), +v.dataset.photoView);
      var add = e.target.closest('[data-photo-add]');
      if (add && card) return card.querySelector('[data-photo-file]').click();
      var rm = e.target.closest('[data-photo-rm]');
      if (rm && card) { var list = c.images(card).slice(); list.splice(+rm.dataset.photoRm, 1); c.save(card, list); }
    });
    host.addEventListener('change', function (e) {
      var inp = e.target.closest('[data-photo-file]'); if (!inp) return;
      var c = host.__zpPhotosCb, card = inp.closest('[data-cp]'), msg = card.querySelector('[data-photo-msg]');
      var have = c.images(card), files = Array.prototype.slice.call(inp.files).slice(0, MAX - have.length); inp.value = '';
      if (!files.length) return;
      msg.textContent = 'Uploading…';
      Promise.all(files.map(read)).then(upload).then(function (up) { c.save(card, have.concat(up)); })
        .catch(function (err) { msg.textContent = 'Could not add the photo: ' + err.message; });
    });
  }

  root.ZPPhotos = { controlsHTML: controlsHTML, thumbsHTML: thumbsHTML, bind: bind, MAX: MAX };
})(window);
