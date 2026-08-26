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
const V = 'irondex-v22';
const SHELL = ['./', './index.html', './app.js?v=ui29', './style.css?v=ui29', './cm-slugs.js',
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
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) caches.open(V).then(c => c.put(req, res.clone()));
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html'))));
  }
});
