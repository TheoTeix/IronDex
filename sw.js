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
 * Supabase, où une réponse périmée serait grave — et où une réponse REJOUÉE
 * depuis un cache serait pire, puisque les requêtes portent un jeton de session.
 */
const V = 'irondex-v43';
// cm-slugs.js (2,1 Mo) N'EST PLUS pré-caché : le télécharger pendant
// l'installation du worker, c'est-à-dire pendant le premier démarrage, volait
// de la bande passante à l'app elle-même. app.js ne le charge plus qu'à la
// première fiche Cardmarket à résoudre — et la règle « réseau d'abord » plus
// bas le met alors en cache pour l'hors-ligne, exactement comme avant.
const SHELL = ['./', './index.html', './app.js?v=ui50', './style.css?v=ui50', './cloud-config.js?v=ui50',
               './manifest.json', './logo.png', './favicon.png'];

// Le client Supabase vient d'un CDN, et il est INDISPENSABLE au démarrage :
// sans lui, impossible de relire la session, donc l'app installée afficherait
// l'écran de connexion à quelqu'un qui est déjà connecté — enfermé dehors par
// une simple perte de réseau. Il est donc mis en cache comme le reste du code.
const SB_LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';

self.addEventListener('install', e => {
  // Un `addAll` échoue EN BLOC : une seule URL indisponible (le CDN, un jour de
  // panne) et plus rien n'est caché. On met donc chaque entrée séparément.
  e.waitUntil(caches.open(V)
    .then(c => Promise.all(SHELL.concat([SB_LIB]).map(u => c.add(u).catch(() => {}))))
    .then(() => self.skipWaiting()));
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

  // Données et authentification : jamais interceptées (voir en-tête).
  if (/supabase\.co|api\.github\.com|raw\.githubusercontent\.com|api\.tcgdex\.net|pokemontcg|cardmarket|127\.0\.0\.1|localhost:46/.test(url.href)) return;

  // Le client Supabase : cache d'abord. Il est figé pour une version donnée,
  // et c'est ce qui permet à l'app installée de démarrer sans réseau.
  if (url.href === SB_LIB) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) caches.open(V).then(c => c.put(req, res.clone()));
      return res;
    }).catch(() => hit)));
    return;
  }

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
