/* IronDex — service worker
 *
 * Deux règles, et pas une de plus :
 *  · le CODE (html, js, css) est servi RÉSEAU D'ABORD. Une app installée sur
 *    l'iPhone qui garde une vieille version en cache est un piège : on préfère
 *    payer quelques centaines de ms que d'afficher du code périmé. Le cache ne
 *    sert que de filet hors ligne.
 *  · les VISUELS de cartes (assets.tcgdex.net) sont servis CACHE D'ABORD :
 *    immuables, lourds, et c'est ce qui rend le défilement fluide en mobilité.
 *
 * Les données (collection, cotes) ne passent JAMAIS par ici : elles viennent de
 * l'API GitHub / raw.githubusercontent, où une réponse périmée serait grave.
 */
const V = 'irondex-v36';
const SHELL = ['./', './index.html', './app.js?v=ui43', './style.css?v=ui43', './cm-slugs.js',
               './manifest.json', './logo.png', './favicon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== V).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Données : jamais interceptées (voir en-tête).
  if (/api\.github\.com|raw\.githubusercontent\.com|api\.tcgdex\.net|pokemontcg|cardmarket|127\.0\.0\.1|localhost:46/.test(url.href)) return;

  // Visuels de cartes : cache d'abord, réseau en secours.
  if (/assets\.tcgdex\.net|static\.cardmarket\.com/.test(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) caches.open(V).then(c => c.put(req, res.clone()));
      return res;
    }).catch(() => hit)));
    return;
  }

  // Code et pages : réseau d'abord, cache si hors ligne.
  //
  // LA PAGE est demandée en `cache:'reload'`, c'est-à-dire en IGNORANT le cache
  // HTTP. C'était le trou : `index.html` est la seule ressource SANS `?v=` — les
  // autres portent leur version dans l'URL — donc une copie périmée d'elle
  // suffisait à épingler l'app sur l'ancien app.js et l'ancien style.css, quel
  // que soit le nombre de réouvertures. « Réseau d'abord » ne servait à rien si
  // le réseau répondait depuis le cache du navigateur.
  if (url.origin === location.origin) {
    const isDoc = req.mode === 'navigate' || req.destination === 'document'
      || url.pathname.endsWith('/') || /\.html?$/.test(url.pathname)
      || /(^|\/)version\.json$/.test(url.pathname);
    e.respondWith(fetch(isDoc ? new Request(req, { cache: 'reload' }) : req).then(res => {
      if (res.ok) caches.open(V).then(c => c.put(req, res.clone()));
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html'))));
  }
});
