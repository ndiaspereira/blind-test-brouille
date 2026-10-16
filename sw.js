// Garde une copie de l'appli pour jouer sans réseau (avec les airs connus). Le réseau passe toujours en premier.
const CACHE = 'brouille-v4';
const SHELL = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'js/app.js', 'js/audio.js', 'js/deezer.js', 'js/fx.js', 'js/music.js', 'js/player.js', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if(e.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  const fonts = /^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if(url.origin !== location.origin && !fonts) return;
  e.respondWith(fetch(e.request).then(r => {
    if(r.ok || r.type === 'opaque'){ const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, {ignoreSearch: !fonts}).then(r => r || Promise.reject(new Error('hors ligne')))));
});
