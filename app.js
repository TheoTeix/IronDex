// ── Constants ──────────────────────────────────────────────────
const API = 'https://api.tcgdex.net/v2/fr';
// Les chemins TCGdex prennent un suffixe de qualité ; les URL de repli externe
// (pokemontcg.io) sont déjà complètes et portées par le préfixe sentinelle
// DIRECT:: posé par resolveMissingImage() — on les distingue ici.
const IMG = (path, qual = 'high') => {
  if (!path) return '';
  if (path.startsWith('DIRECT::')) return path.slice(8);
  return `${path}/${qual}.webp`;
};
// Placeholder propre pour les cartes sans visuel (certains sets TCGdex, ex.
// « Destinées Occultes » sm115, n'ont pas d'images) — évite le squelette
// de chargement infini et garde la carte lisible + sélectionnable. Les
// attributs data-fb-* permettent à hydrateFallbackImages() de retrouver ce
// placeholder après coup et de le remplacer si un visuel est retrouvé
// ailleurs (autre langue TCGdex, ou pokemontcg.io en dernier recours).
function noImgHTML(localId, name, setId, extraClass = '') {
  return `<div class="card-noimg ${extraClass}" data-fb-set="${esc(setId || '')}" data-fb-local="${esc(String(localId || ''))}" data-fb-name="${esc(name || '')}"><span class="card-noimg-n">N°${esc(String(localId || '?'))}</span><span class="card-noimg-tag">Visuel indisponible</span></div>`;
}
// À placer sur onerror d'une <img> : remplace l'image cassée par le placeholder
// PUIS relance toute la chaîne de repli (autres locales TCGdex, pokemontcg.io)
// quand on connaît le set — une URL FR morte ne condamne plus le visuel.
// _imgFailedSrc évite de re-tenter une source déjà en échec (pas de boucle).
const _imgFailedSrc = new Set();
function imgFail(img, localId, setId = '', name = '') {
  if (img.src) _imgFailedSrc.add(img.src);
  const ph = document.createElement('div');
  ph.className = 'card-noimg';
  ph.dataset.fbSet = setId || '';
  ph.dataset.fbLocal = String(localId == null ? '' : localId);
  ph.dataset.fbName = name || '';
  ph.innerHTML = `<span class="card-noimg-n">N°${localId || '?'}</span><span class="card-noimg-tag">Visuel indisponible</span>`;
  img.replaceWith(ph);
  if (setId && localId) {
    resolveMissingImage(setId, localId).then(found => {
      if (found && ph.isConnected) swapPlaceholder(ph, found, localId);
    });
  }
}
// Remplace un placeholder « visuel indisponible » par l'image de repli trouvée.
// Renvoie l'<img> insérée, ou null si la source a déjà échoué (anti-boucle).
function swapPlaceholder(ph, found, localId) {
  const url = IMG(found);
  if (_imgFailedSrc.has(url)) return null;
  const img = document.createElement('img');
  img.src = url;
  img.alt = ph.dataset.fbName || '';
  img.loading = 'lazy';
  img.className = ph.className.replace('card-noimg', '').trim();
  // Échec de la source de repli elle-même : placeholder terminal (pas de retry).
  img.onerror = () => { _imgFailedSrc.add(url); imgFail(img, localId); };
  ph.replaceWith(img);
  return img;
}
const STORAGE_KEY = 'pkm_collection_v2';

/* ════════════════════════════════════════════════════════════════
   ICÔNES — un seul jeu, vectoriel, même graisse de trait (1.9), mêmes
   arrondis. Aucune emoji comme icône structurelle : une emoji dépend de
   la police du système, change d'un OS à l'autre et ne se pilote pas par
   les tokens de couleur.
   ════════════════════════════════════════════════════════════════ */
const SVG = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"${extra}>${d}</svg>`;
const ICO = {
  vault:   SVG('<path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>'),
  heart:   SVG('<path d="M12 20.3S3.3 15.4 3.3 9.2C3.3 6.3 5.4 4.3 8 4.3c1.9 0 3.1 1 4 2.2.9-1.2 2.1-2.2 4-2.2 2.6 0 4.7 2 4.7 4.9 0 6.2-8.7 11.1-8.7 11.1z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>'),
  chart:   SVG('<path d="M4 19V5M4 19h16" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="m7 14 3.4-3.6 3 2.4L20.5 6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>'),
  book:    SVG('<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H19a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5.5A1.5 1.5 0 0 1 4 18.5z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M8 4v16" stroke="currentColor" stroke-width="1.6"/>'),
  card:    SVG('<rect x="5" y="3.5" width="14" height="17" rx="2.2" stroke="currentColor" stroke-width="1.9"/><path d="M8.5 8h7M8.5 11.5h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'),
  sync:    SVG('<path d="M20.5 12a8.5 8.5 0 0 1-13.9 6.6M3.5 12a8.5 8.5 0 0 1 13.9-6.6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M17.4 2.2v3.6h-3.6M6.6 21.8v-3.6h3.6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>'),
  refresh: SVG('<path d="M20 11a8 8 0 1 0-.5 3.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M20 4v5h-5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>'),
  plus:    SVG('<path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  check:   SVG('<path d="M5 12.5 10 17.5 19 7.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'),
  close:   SVG('<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>'),
  left:    SVG('<path d="M14.5 5 8 12l6.5 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
  right:   SVG('<path d="M9.5 5 16 12l-6.5 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
  search:  SVG('<circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.9"/><path d="m20 20-3.4-3.4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>'),
  zoom:    SVG('<circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.9"/><path d="m20 20-3.2-3.2M11 8.5v5M8.5 11h5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>'),
  edit:    SVG('<path d="M4 20h4L18.5 9.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="m13.5 6.5 4 4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>'),
  trash:   SVG('<path d="M5 7h14M9 7V5h6v2m-8 0 .7 12.3A1.5 1.5 0 0 0 9.2 20.7h5.6a1.5 1.5 0 0 0 1.5-1.4L17 7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>'),
  spark:   SVG('<path d="M12 3.5 13.8 9l5.5 1.8-5.5 1.8L12 18.1l-1.8-5.5L4.7 10.8 10.2 9z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>'),
  info:    SVG('<circle cx="12" cy="12" r="8.4" stroke="currentColor" stroke-width="1.8"/><path d="M12 11v5.4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><circle cx="12" cy="8" r="1.05" fill="currentColor"/>'),
  drag:    SVG('<circle cx="9" cy="6" r="1.5" fill="currentColor"/><circle cx="15" cy="6" r="1.5" fill="currentColor"/><circle cx="9" cy="12" r="1.5" fill="currentColor"/><circle cx="15" cy="12" r="1.5" fill="currentColor"/><circle cx="9" cy="18" r="1.5" fill="currentColor"/><circle cx="15" cy="18" r="1.5" fill="currentColor"/>'),
  ext:     SVG('<path d="M14 4h6v6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 4 11 13" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M18 15v3.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H9" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>'),
  upload:  SVG('<path d="M12 15V4m0 0 4 4m-4-4L8 8" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>'),
  layers:  SVG('<path d="M12 3.6 3.6 8 12 12.4 20.4 8z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m3.6 13 8.4 4.4L20.4 13" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" opacity=".6"/>'),
  box:     SVG('<path d="M4 8.2 12 4l8 4.2v7.6L12 20l-8-4.2z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M4 8.2 12 12.4l8-4.2M12 12.4V20" stroke="currentColor" stroke-width="1.6" opacity=".6"/>'),
};
// Icône « + » (héritée) : même glyphe vectoriel que ICO.plus.
const PLUS = '<span class="ico-plus" aria-hidden="true">' + ICO.plus + '</span>';

const state = {
  view: 'home',
  wishlists: [], milobellus: {},   // milobellus : { [slotKey]: true } — cartes cochées « possédées »
  gradedCards: [],            // LEGACY : l'onglet Gradées n'existe plus. Le tableau reste
                              // relu/réécrit tel quel pour ne PAS effacer les anciennes
                              // sauvegardes (aucune UI ne l'utilise).
  binders: [],                // classeurs personnalisés : { id, name, perPage(4|9), cards:[…] }
  sealed: [],                 // produits scellés : { id, cat, name, buyPrice, values:{ 'AAAA-MM': valeur } }
  sealedPeriods: [],          // colonnes de valeur (semestres) : ['2026-07','2026-12', …]
  investCards: [],            // cartes suivies : { id, cardId, name, setId, setName, logo, number, localId, rarity, type, qty, image, buyPrice }
  investMode: 'sealed',       // volet actif de la section Investissement : 'sealed' | 'cards'
  investSeriesOpen: null,     // set ouvert dans le volet Cartes (détail) — runtime
  setDates: {},               // { setId: 'AAAA-MM-JJ' } — dates de sortie, pour le tri chronologique
  currentBinder: 'milobellus',// classeur ouvert dans la vue détail ('milobellus' ou id custom)
  activeWishlistId: null,
  pickerMode: null, pickerSeries: null, pickerSeriesName: '', pickerSet: null,
  pickerSetName: '', pickerCards: [], pickerSearch: '', sessionAdded: 0,
  heroRef: null,     // { type:'loose', cardId, name, … } — pièce maîtresse choisie à la main
};

// ══════════════════════════════════════════════════════════════════
//  TÉLÉPHONE — un contexte, pas une fenêtre étroite
//  L'iPhone n'est pas « le desktop en plus petit » : écran tactile, réseau
//  mobile, batterie. Deux décisions prises ici une fois pour toutes :
//   · la créature 3D d'ambiance (2 modèles GLB, ~9 Mo, un contexte WebGL
//     permanent) ne se charge PAS sur téléphone — la vedette y est la carte ;
//   · `model-data.js` (12 Mo de GLB en base64) n'a de raison d'être QUE pour
//     l'app ouverte en file://, où fetch() ne peut pas lire un fichier local.
//     Servie en https (GitHub Pages), l'app charge les .glb directement : on
//     ne télécharge donc plus jamais ces 12 Mo.
//  `mobile` sert aussi de crochet CSS (<html data-mobile>).
// ══════════════════════════════════════════════════════════════════
// Fonction, pas constante : un onglet encore masqué peut annoncer
// `innerWidth === 0` (on passerait pour un téléphone et on priverait le
// desktop de sa 3D), et une fenêtre se redimensionne. On relit donc à chaque
// fois, avec des replis quand la mesure est absurde.
// MIS EN CACHE, et pas par coquetterie : `isPhone()` est appelé sur le chemin
// chaud de la navigation (transitionKind, applyViewScroll, viewScroller…) et il
// lit `innerWidth`, ce qui FORCE le navigateur à terminer sa mise en page en
// cours. Mesuré : 23 ms sur un changement d'onglet, juste pour répondre à une
// question dont la réponse ne change qu'au redimensionnement.
let _isPhone = null;
function isPhone() {
  if (_isPhone !== null) return _isPhone;
  const w = innerWidth || screen.width || 1280;
  const h = innerHeight || screen.height || 800;
  // Téléphone en paysage : large mais court, et tactile sans survol.
  _isPhone = w <= 767
    || (matchMedia('(hover:none) and (pointer:coarse)').matches && Math.min(w, h) < 500);
  return _isPhone;
}
// La barre haute FLOTTE au-dessus des pages sur téléphone (c'est ce qui rend son
// verre visible : il faut que quelque chose passe derrière). Les pages ont donc
// besoin de sa hauteur exacte en rembourrage — et cette hauteur dépend de
// l'encoche, donc on la mesure au lieu de la deviner.
function syncTopbarHeight() {
  const h = document.querySelector('.app-header');
  if (h) {
    const px = Math.round(h.getBoundingClientRect().height);
    if (px > 20) document.documentElement.style.setProperty('--topbar-h', px + 'px');
  }
  // Même raison pour la barre du bas : sa hauteur dépend du dégagement du trait
  // d'accueil, qui n'est pas le même d'un iPhone à l'autre. Mesurée, les pages
  // s'arrêtent donc pile au-dessus — ni sous la barre, ni avec un trou.
  const t = document.querySelector('.tabbar');
  if (t && t.offsetWidth) {
    const px = Math.round(t.getBoundingClientRect().height);
    if (px > 20) document.documentElement.style.setProperty('--tabbar-h', px + 'px');
  }
}
function paintDeviceFlag() {
  _isPhone = null;   // la taille a changé : on remesure une fois, ici
  try { document.documentElement.dataset.mobile = isPhone() ? 'on' : 'off'; } catch {}
}
paintDeviceFlag();
addEventListener('resize', paintDeviceFlag);
let _modelDataPromise = null;
function ensureModelData() {
  if (_modelDataPromise) return _modelDataPromise;
  return (_modelDataPromise = (async () => {
    if (isPhone()) return false;
    if (window.MILOTIC_GLB_BASE64) return true;
    if (location.protocol !== 'file:') return false;   // les .glb se chargent très bien
    return await new Promise(res => {
      const sc = document.createElement('script');
      sc.src = 'model-data.js';
      sc.onload = () => res(true);
      sc.onerror = () => { sc.remove(); res(false); };
      document.head.appendChild(sc);
    });
  })());
}

// ── STOCKAGE FIABLE (IndexedDB) ────────────────────────────────────
// localStorage plafonne à ~5 Mo : une collection un peu fournie (classeurs,
// wishlists, portefeuille) suffit à faire ÉCHOUER toute l'écriture → plus rien
// ne se sauvegarde. IndexedDB gère des centaines de Mo → la collection tient
// sans souci. On garde localStorage en repli si IDB est
// indisponible, et on migre automatiquement l'ancienne sauvegarde localStorage.
const DB_NAME = 'irondex', DB_STORE = 'kv', DB_KEY = 'collection';
let _db = null;
function idbOpen() {
  return new Promise((resolve, reject) => {
    if (_db) return resolve(_db);
    if (typeof indexedDB === 'undefined') return reject(new Error('no idb'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE); };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}
function idbGet(key) {
  return idbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const r = tx.objectStore(DB_STORE).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}
function idbSet(key, val) {
  return idbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(val, key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}
function idbKeys() {
  return idbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const r = tx.objectStore(DB_STORE).getAllKeys();
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => reject(r.error);
  }));
}
function idbDel(key) {
  return idbOpen().then(db => new Promise((resolve) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(key);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  }));
}
// ── SAUVEGARDES AUTOMATIQUES ───────────────────────────────────────
// L'utilisateur ne clique plus aucun bouton : l'app garde donc elle-même des
// instantanés horodatés (1 par jour + 1 juste avant toute restauration, le
// moment le plus risqué). On conserve les BACKUP_KEEP plus récents.
const BACKUP_PREFIX = 'backup:', BACKUP_KEEP = 6;
function autoBackup(tag) {
  const key = BACKUP_PREFIX + tag;
  const snap = collectionSnapshot();
  // Un instantané vide n'a aucune valeur de secours et ne doit pas chasser un bon.
  if (!snap.wishlists.length && !snap.gradedCards.length && !snap.binders.length && !snap.sealed.length && !snap.investCards.length) return Promise.resolve(false);
  return idbSet(key, snap)
    .then(() => idbKeys())
    .then(keys => {
      const backups = keys.filter(k => typeof k === 'string' && k.startsWith(BACKUP_PREFIX)).sort();
      const extra = backups.slice(0, Math.max(0, backups.length - BACKUP_KEEP));
      return Promise.all(extra.map(idbDel));
    })
    .then(() => true)
    .catch(() => false);
}
function collectionSnapshot() {
  return { wishlists: state.wishlists, gradedCards: state.gradedCards, milobellus: state.milobellus, binders: state.binders, sealed: state.sealed, sealedPeriods: state.sealedPeriods, investCards: state.investCards, investMode: state.investMode, setDates: state.setDates, setBlocs: state.setBlocs, heroRef: state.heroRef, lastUpdated: new Date().toISOString() };
}

// Sauvegarde DÉBOUNCÉE (fusionne les écritures rapprochées) — écrit dans IDB.
let _saveTimer = null, _saveDirty = false, _lastSaveOk = true;
function save() {
  _saveDirty = true;
  markPagerStale();          // les pages du carrousel affichent peut-être l'ancien état

  if (_saveTimer) return;
  _saveTimer = setTimeout(() => { _saveTimer = null; if (_saveDirty) writeNow(); }, 400);
}
function flushSave() { if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; } if (_saveDirty) return writeNow(); return Promise.resolve(_lastSaveOk); }
// Écriture immédiate. Renvoie une promesse booléenne (succès).
/* ── « ENVOI EN ATTENTE » ─────────────────────────────────────────────────
   Une modification faite sur l'iPhone alors que le jeton ne marche plus ne
   doit pas se perdre en silence. Deux choses manquaient :
   · `_localUpdated` n'était mis à jour que par la RELECTURE du dépôt, jamais
     par une écriture locale. Au démarrage suivant, `ghPull` comparait donc les
     dates, les trouvait égales, et concluait qu'il n'y avait rien à envoyer :
     la modification restait sur l'appareil pour toujours.
   · la liste des envois ratés ne vivait qu'en mémoire — fermer l'app la
     perdait.
   Le drapeau est donc PERSISTÉ. Tant qu'il est là, chaque démarrage retente
   l'envoi ; le jour où le jeton redevient valide, tout part d'un coup. */
const PENDING_KEY = 'irondex_push_pending';
function markPushPending(on) {
  try { on ? localStorage.setItem(PENDING_KEY, '1') : localStorage.removeItem(PENDING_KEY); } catch {}
}
function pushPending() { try { return localStorage.getItem(PENDING_KEY) === '1'; } catch { return false; } }
function writeNow() {
  _saveDirty = false;
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null; }
  const snap = collectionSnapshot();
  // Le local vient de prendre de l'avance : c'est ce que `ghPull` doit voir au
  // prochain démarrage pour décider qu'il faut pousser.
  _localUpdated = Date.parse(snap.lastUpdated) || Date.now();
  markPushPending(true);
  return idbSet(DB_KEY, snap)
    .then(() => { _lastSaveOk = true; pulseSaveDot(); autoBackupDaily(); ghPushSoon('collection'); return true; })
    .catch(err => {
      // Repli localStorage (peut échouer sur quota si grosses photos)
      console.warn('IDB save échoué, repli localStorage', err);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snap)); _lastSaveOk = true; return true; }
      catch (e) { console.warn('Sauvegarde impossible', e); _lastSaveOk = false; return false; }
    });
}
// Un instantané par jour, au premier enregistrement réussi (silencieux).
let _dailyBackupDone = null;
function autoBackupDaily() {
  const day = new Date().toISOString().slice(0, 10);
  if (_dailyBackupDone === day) return;
  _dailyBackupDone = day;
  autoBackup(day);
}
// Enregistrement immédiat, sans bouton : la pastille de l'en-tête clignote
// brièvement pour confirmer, et seul un ÉCHEC parle (toast d'erreur).
function saveNow() {
  writeNow().then(ok => {
    if (ok) pulseSaveDot();
    else toast('Enregistrement impossible (stockage plein ?)', 'error');
  });
}
function pulseSaveDot() {
  const d = document.getElementById('save-dot'); if (!d) return;
  d.classList.remove('on'); void d.offsetWidth;   // relance l'animation
  d.classList.add('on');
  setTimeout(() => d.classList.remove('on'), 1200);
}
// Secours au clavier, volontairement non affiché : ⌘S / Ctrl+S télécharge une
// sauvegarde, ⇧⌘R / Ctrl+Shift+R ouvre la récupération.
// ── EN-TÊTE TÉLÉPHONE : les actions se dévoilent au tap sur la marque ──
// Quatre icônes en permanence sur 428 px, c'était une barre d'outils posée sur
// un coffre. Au repos on ne montre que la marque et le nom de la vue ; le tap
// sur le logo fait arriver les boutons en cascade. Le repli n'est appliqué que
// si CE code tourne (drapeau `data-actions`) : si le JS échoue, les boutons
// restent visibles plutôt qu'inatteignables.
let _actionsOn = false;
// L'ARC est posé en JS, pas en CSS : les positions sont CALCULÉES depuis le
// centre réel du logo (donc justes quel que soit le gabarit d'écran), et un
// style inline ne peut être écrasé par aucune règle du projet — la version CSS
// se faisait neutraliser par une autre feuille et les icônes restaient
// empilées sur le logo.
// L'arc des actions de l'en-tête, CALCULÉ et non tabulé. C'était une table de
// quatre angles écrite pour quatre boutons ; il n'y en a plus que trois depuis
// que les classeurs ont quitté le téléphone, et ils se retrouvaient tassés sur
// le début de l'arc en laissant le bas vide. Les angles sont donc répartis sur
// tout le balayage, quel que soit leur nombre.
// Le balayage part SOUS l'horizontale (6° et non -8°) : au-dessus, le premier
// bouton dépassait le haut de l'écran sur un appareil sans encoche, où le
// centre du logo n'est qu'à 26 px du bord.
const ARC_FROM = 6, ARC_TO = 96;    // degrés : 0° = à droite, 90° = en dessous
const ARC_R = 78;                   // rayon, en pixels
function arcAngle(i, n) {
  if (n <= 1) return (ARC_FROM + ARC_TO) / 2;
  return ARC_FROM + (i * (ARC_TO - ARC_FROM)) / (n - 1);
}
function setHeaderActions(on) {
  _actionsOn = !!on;
  const root = document.documentElement;
  root.dataset.actions = _actionsOn ? 'on' : 'off';
  const brand = document.getElementById('tb-brand');
  if (brand) brand.setAttribute('aria-expanded', _actionsOn ? 'true' : 'false');
  const btns = [...document.querySelectorAll('.header-actions > .btn')];
  btns.forEach((b, i) => {
    const rad = (arcAngle(i, btns.length) * Math.PI) / 180;
    if (_actionsOn) {
      b.style.transitionDelay = `${20 + i * 42}ms`;
      b.style.transform = `translate(${Math.round(Math.cos(rad) * ARC_R)}px,${Math.round(Math.sin(rad) * ARC_R)}px) scale(1)`;
      b.style.opacity = '1';
    } else {
      // Repli : tout retombe DANS le logo, dans l'ordre inverse.
      b.style.transitionDelay = `${(btns.length - 1 - i) * 24}ms`;
      b.style.transform = 'translate(0,0) scale(.34)';
      b.style.opacity = '0';
    }
  });
}
function bindBrandReveal() {
  const brand = document.getElementById('tb-brand');
  if (!brand) return;
  if (!isPhone()) { delete document.documentElement.dataset.actions; return; }
  brand.setAttribute('role', 'button');
  brand.setAttribute('tabindex', '0');
  brand.setAttribute('aria-controls', 'header-actions');
  brand.setAttribute('aria-label', 'Afficher les actions');
  setHeaderActions(false);
  const toggle = e => { e.preventDefault(); e.stopPropagation(); setHeaderActions(!_actionsOn); };
  brand.addEventListener('click', toggle);
  brand.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') toggle(e); });
  // Refermer : après une action, sur un tap ailleurs, ou en changeant de vue.
  // Pas de minuteur — un panneau qui se referme sous le doigt est pire que
  // deux taps.
  document.querySelector('.header-actions')?.addEventListener('click', () => {
    if (_actionsOn) setTimeout(() => setHeaderActions(false), 220);
  });
  document.addEventListener('click', e => {
    if (_actionsOn && !e.target.closest('.app-header')) setHeaderActions(false);
  }, true);
  // La largeur peut changer de camp (rotation, iPad) : on rend la main.
  addEventListener('resize', () => {
    if (!isPhone()) delete document.documentElement.dataset.actions;
    else if (!document.documentElement.dataset.actions) setHeaderActions(false);
  });
}
function bindBackupShortcuts() {
  document.addEventListener('keydown', e => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    const k = (e.key || '').toLowerCase();
    if (k === 's') { e.preventDefault(); exportData(); }
    else if (k === 'r' && e.shiftKey) { e.preventDefault(); openRecovery(); }
  });
}
window.addEventListener('beforeunload', () => { if (_saveDirty) writeNow(); flushPriceCache(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (_saveDirty) writeNow(); flushPriceCache(); } });
function applyLoaded(d) {
  if (!d) return;
  state.wishlists = d.wishlists || [];
  state.gradedCards = d.gradedCards || [];
  state.milobellus = d.milobellus || {};
  state.binders = d.binders || [];
  state.sealedPeriods = (d.sealedPeriods && d.sealedPeriods.length) ? d.sealedPeriods : DEFAULT_SEALED_PERIODS.slice();
  // Migration douce depuis l'ancien modèle (type/qty/cote) → { cat, values }.
  state.sealed = (d.sealed || []).map(p => {
    if (p && p.values && p.cat) return p; // déjà au nouveau format
    const cat = (p && (p.type === 'display' || p.type === 'etb')) ? p.type : sealedCatOf((p && (p.type || p.name)) || '');
    const values = (p && p.values) ? p.values : {};
    if (p && p.cote != null && !Object.keys(values).length) values[state.sealedPeriods[0]] = Number(p.cote);
    return { id: (p && p.id) || sealedUid(), cat, name: (p && p.name) || '', buyPrice: (p && p.buyPrice != null) ? p.buyPrice : null, values };
  });
  state.investCards = (d.investCards || []).map(p => ({ id: p.id || sealedUid(), cardId: p.cardId || null, name: p.name || '', setId: p.setId || '', setName: p.setName || 'Série inconnue', logo: p.logo || null, number: p.number || '', localId: p.localId || '', rarity: p.rarity || '', type: p.type || '', qty: Math.max(1, Number(p.qty) || 1), image: p.image || '', buyPrice: p.buyPrice != null ? p.buyPrice : null }));
  state.investMode = d.investMode === 'cards' ? 'cards' : 'sealed';
  state.setDates = d.setDates || {};
  state.setBlocs = d.setBlocs || {};
  state.investSeriesOpen = null;
  state.heroRef = (d.heroRef && d.heroRef.type === 'loose') ? d.heroRef : null;
}
async function load() {
  // 1) IndexedDB (copie de travail locale — le dépôt reste l'arbitre, voir ghPull)
  try {
    const d = await idbGet(DB_KEY);
    if (d) { applyLoaded(d); _localUpdated = Date.parse(d.lastUpdated || 0) || 0; return; }
  } catch (e) { console.warn('Lecture IDB échouée', e); }
  // 2) Migration depuis l'ancienne sauvegarde localStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      applyLoaded(d);
      idbSet(DB_KEY, collectionSnapshot()).catch(() => {});   // migre vers IDB
    }
  } catch (e) { console.warn('Lecture localStorage échouée', e); }
}
// Sauvegarde COMPLÈTE : on repart de collectionSnapshot() pour ne jamais
// oublier un pan de la collection (le scellé et les cartes suivies étaient
// silencieusement absents des anciennes sauvegardes).
function exportData() {
  const blob = new Blob([JSON.stringify(collectionSnapshot(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `milodex-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  toast('Sauvegarde téléchargée', 'success');
}
// Restauration : passe par applyLoaded (mêmes migrations que le chargement
// normal) puis écrit tout de suite, pour que la sauvegarde survive au refresh.
function importData(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = e => {
    let d;
    try { d = JSON.parse(e.target.result); } catch { toast('Fichier invalide', 'error'); return; }
    if (!d || typeof d !== 'object') { toast('Fichier invalide', 'error'); return; }
    // NON DESTRUCTIF : une section absente ou VIDE dans le fichier ne doit
    // jamais écraser une section déjà remplie (un backup partiel a effacé des
    // wishlists/classeurs). On repart donc de l'état courant et on ne
    // remplace que ce que le fichier apporte réellement.
    const merged = Object.assign(collectionSnapshot(), {});
    const preserved = [];
    const takeList = (key, label) => {
      const inc = d[key];
      if (Array.isArray(inc) && inc.length) merged[key] = inc;
      else if ((merged[key] || []).length) preserved.push(label);
      else merged[key] = inc || [];
    };
    takeList('wishlists', 'wishlists');
    takeList('binders', 'classeurs');
    // gradedCards : section retirée de l'app, mais on la recopie telle quelle
    // pour qu'une vieille sauvegarde ne perde jamais ses données.
    if (Array.isArray(d.gradedCards) && d.gradedCards.length) merged.gradedCards = d.gradedCards;
    takeList('sealed', 'scellé');
    takeList('investCards', 'cartes');
    if (d.milobellus && Object.keys(d.milobellus).length) merged.milobellus = d.milobellus;
    else if (Object.keys(merged.milobellus || {}).length) preserved.push('Milobellus');
    if (Array.isArray(d.sealedPeriods) && d.sealedPeriods.length) merged.sealedPeriods = d.sealedPeriods;
    if (d.investMode) merged.investMode = d.investMode;
    if (d.heroRef) merged.heroRef = d.heroRef;
    autoBackup('avant-restauration');   // filet : l'état d'AVANT reste récupérable
    applyLoaded(merged);
    window._vaultCounted = false; window._investCountedSealed = false; window._investCountedCards = false;
    writeNow().then(ok => {
      if (!ok) { toast('Restauration : écriture impossible', 'error'); return; }
      navigate('home');
      const n = state.sealed.length + state.investCards.length + state.wishlists.length;
      toast(`Collection restaurée (${n} entrées)`, 'success');
      if (preserved.length) toast(`Conservé depuis l'app : ${preserved.join(', ')}`, '');
      prefetchCardPrices();
    });
  };
  r.readAsText(file);
}
function pickRestoreFile(input) { const f = input.files && input.files[0]; input.value = ''; importData(f); }

// ══════════════════════════════════════════════════════════════════
//  COFFRE EN LIGNE — la collection vit dans le DÉPÔT GitHub
//  Le navigateur n'est PLUS la source de vérité : il en est une copie de
//  travail. Chaque enregistrement local est suivi d'un commit dans le dépôt
//  (data/collection.json), et chaque ouverture commence par relire le dépôt.
//  Conséquences directes : vider un navigateur ne perd plus rien, le Mac et
//  l'iPhone voient la MÊME collection, et git garde l'historique de chaque
//  état — donc une machine à remonter le temps gratuite.
//
//  Le jeton d'accès ne vit QUE dans le localStorage de l'appareil : il n'est
//  jamais écrit dans un fichier du dépôt (qui est public). Voir openCloud().
//
//  Les cotes suivent le même chemin (data/prices.json) : le pont Cardmarket
//  tourne sur le Mac, et l'iPhone lit simplement le résultat.
// ══════════════════════════════════════════════════════════════════
const GH_KEY = 'irondex-gh-v1';
const GH_PATHS = { collection: 'data/collection.json', prices: 'data/prices.json' };
let _ghCfg = null;
function ghCfg() {
  if (_ghCfg) return _ghCfg;
  let d = {};
  try { d = JSON.parse(localStorage.getItem(GH_KEY) || '{}') || {}; } catch {}
  // Sur GitHub Pages, le dépôt se DEVINE depuis l'URL
  // (theoteixeira.github.io/IronDex/ → owner « theoteixeira », repo « IronDex »)
  // : l'utilisateur n'a donc qu'un jeton à coller, pas trois champs à remplir.
  let owner = d.owner || '', repo = d.repo || '';
  const host = location.hostname, seg = location.pathname.split('/').filter(Boolean);
  if (!owner && /\.github\.io$/i.test(host)) owner = host.replace(/\.github\.io$/i, '');
  if (!repo && /\.github\.io$/i.test(host)) {
    const first = seg[0] || '';
    repo = (first && !/\.\w+$/.test(first)) ? first : `${owner}.github.io`;
  }
  return (_ghCfg = {
    token: d.token || '', owner, repo, branch: d.branch || 'main',
    on: !!(d.token && owner && repo),
  });
}
function ghSave(patch) {
  const cur = ghCfg();
  const next = { token: cur.token, owner: cur.owner, repo: cur.repo, branch: cur.branch };
  Object.assign(next, patch || {});
  try { localStorage.setItem(GH_KEY, JSON.stringify(next)); } catch {}
  _ghCfg = null;
  return ghCfg();
}
function ghOn() { return ghCfg().on; }
// Base64 d'un texte UTF-8 (btoa ne prend que du latin-1, et la collection
// contient des accents : « Poissirène » cassait l'encodage).
function ghB64(text) {
  const bytes = new TextEncoder().encode(text);
  let out = '';
  const CH = 0x8000;   // par tranches : String.fromCharCode explose au-delà
  for (let i = 0; i < bytes.length; i += CH) out += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  return btoa(out);
}
function ghApi(path, opts) {
  const c = ghCfg(), o = opts || {};
  const h = { 'Accept': o.accept || 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (c.token) h.Authorization = `Bearer ${c.token}`;
  if (o.body) h['Content-Type'] = 'application/json';
  return fetchTimeout(`https://api.github.com/repos/${c.owner}/${c.repo}${path}`, o.ms || 25000,
    { method: o.method || 'GET', headers: h, body: o.body });
}
// SHA du fichier à remplacer, SANS télécharger son contenu : on lit le
// listing du dossier (l'API /contents renvoie le contenu en base64 seulement
// sous 1 Mo — la collection en fait 5, elle ne passerait pas par là).
async function ghSha(path) {
  const c = ghCfg();
  const dir = path.split('/').slice(0, -1).join('/'), name = path.split('/').pop();
  const r = await ghApi(`/contents/${encodeURIComponent(dir).replace(/%2F/g, '/')}?ref=${encodeURIComponent(c.branch)}`);
  if (!r.ok) return null;                    // dossier absent au premier envoi
  const list = await r.json().catch(() => null);
  const hit = Array.isArray(list) ? list.find(e => e && e.name === name) : null;
  return hit ? hit.sha : null;
}
// Lecture : raw.githubusercontent d'abord (aucun quota d'API, aucun jeton
// nécessaire sur un dépôt public), avec anti-cache car le CDN garde ~5 min.
async function ghRead(path) {
  const c = ghCfg();
  if (!c.owner || !c.repo) return null;
  try {
    const r = await fetchTimeout(`https://raw.githubusercontent.com/${c.owner}/${c.repo}/${c.branch}/${path}?t=${Date.now()}`, 25000);
    if (r.ok) return await r.json();
    if (r.status === 404) return null;
  } catch {}
  try {   // dépôt privé, ou CDN en retard : on repasse par l'API avec le jeton
    const r = await ghApi(`/contents/${path}?ref=${encodeURIComponent(c.branch)}`, { accept: 'application/vnd.github.raw' });
    if (r.ok) return await r.json();
  } catch {}
  return null;
}
// `sha` du dernier état ÉCRIT par nous, renvoyé par le PUT. L'utiliser évite
// à la fois un appel de listing et la course qui provoquait le 409 :
// « data/collection.json does not match <sha> » — l'API GitHub sert parfois un
// listing d'il y a quelques secondes, et le sha était déjà périmé au moment du
// PUT.
const _ghSha = {};
async function ghWrite(path, obj, message, attempt = 0) {
  const c = ghCfg();
  if (!c.on) return { ok: false, reason: 'coffre en ligne non configuré' };
  let sha = _ghSha[path];
  if (!sha) sha = await ghSha(path).catch(() => null);
  const body = JSON.stringify(Object.assign(
    { message, content: ghB64(JSON.stringify(obj)), branch: c.branch }, sha ? { sha } : {}));
  let r;
  try { r = await ghApi(`/contents/${path}`, { method: 'PUT', body, ms: 90000 }); }
  catch (e) { return { ok: false, reason: 'réseau injoignable' }; }
  if (r.ok) {
    // On garde le sha renvoyé : le prochain envoi part avec la bonne référence.
    try { const d = await r.json(); if (d?.content?.sha) _ghSha[path] = d.content.sha; } catch {}
    return { ok: true };
  }
  let msg = '';
  try { msg = (await r.json()).message || ''; } catch {}
  // 409 (ou « does not match ») = le fichier a bougé depuis notre référence.
  // Ce n'est pas une erreur à afficher : c'est une référence à rafraîchir. On
  // relit le sha et on réessaie — jusqu'à 3 fois, avec un court répit.
  const stale = r.status === 409 || /does not match|sha/i.test(msg);
  if (stale) {
    delete _ghSha[path];
    if (attempt < 2) {
      await new Promise(res => setTimeout(res, 700 * (attempt + 1)));
      return ghWrite(path, obj, message, attempt + 1);
    }
    // Trois échecs : ce n'est plus une course, c'est un autre appareil qui a
    // vraiment écrit. On lui laisse la main s'il est plus récent (même règle
    // que partout : le plus récent gagne) au lieu de l'écraser.
    return { ok: false, status: r.status, conflict: true,
             reason: 'un autre appareil a écrit entre-temps' };
  }
  return { ok: false, status: r.status, reason: msg || `HTTP ${r.status}` };
}
// ── Envoi débouncé ────────────────────────────────────────────────
// Une modification déclenche un commit 4 s plus tard : assez pour fusionner
// une rafale de clics, assez court pour qu'un onglet fermé juste après ne
// perde rien (l'écriture locale, elle, est déjà faite).
let _ghTimer = null, _ghBusy = false, _ghPend = {}, _ghStatus = 'off', _ghErr = '';
function ghStatus() { return { state: _ghStatus, err: _ghErr, cfg: ghCfg() }; }
function ghPushSoon(what) {
  if (!ghOn()) return;
  _ghPend[what || 'collection'] = true;
  ghPaintStatus('pending');
  if (_ghTimer) return;
  _ghTimer = setTimeout(ghFlush, 4000);
}
async function ghFlush() {
  _ghTimer = null;
  if (_ghBusy || !ghOn()) return;
  const jobs = Object.keys(_ghPend);
  if (!jobs.length) return;
  _ghPend = {}; _ghBusy = true;
  ghPaintStatus('saving');
  let fail = null;
  for (const job of jobs) {
    const obj = job === 'prices'
      ? { syncedAt: priceSyncedAt(), prices: priceDiskSnapshot() }
      : collectionSnapshot();
    // GARDE-FOU : on n'envoie JAMAIS une collection vide. Sur un appareil qui
    // vient d'ouvrir le site (l'iPhone la première fois), une écriture locale
    // peut partir avant que ghPull ait fini de rapatrier le dépôt : sans ce
    // test, ce néant écraserait la vraie collection. Un instantané vide n'a de
    // toute façon aucune valeur de sauvegarde.
    if (job === 'collection' && ghLocalEmpty()) { console.warn('envoi ignoré : collection vide'); continue; }
    const label = job === 'prices' ? 'cotes' : 'collection';
    const res = await ghWrite(GH_PATHS[job], obj, `IronDex : ${label} mises à jour`);
    if (!res.ok) { fail = res; _ghPend[job] = true; }   // on retentera
  }
  _ghBusy = false;
  if (fail && fail.conflict) {
    // Conflit assumé : on relit le dépôt (le plus récent gagne) et on ne
    // réécrit pas par-dessus. Silencieux exprès — c'est le fonctionnement
    // normal de deux appareils, pas une panne à signaler à chaque fois.
    _ghErr = '';
    markPushPending(false);          // tout est parti : plus rien en attente
    await ghPull().catch(() => {});
    ghPaintStatus('ok');
  } else if (fail) {
    _ghErr = fail.reason || '';
    ghPaintStatus('error');
    // Un échec d'envoi n'est PAS silencieux : sinon l'utilisateur croit que
    // tout est en ligne alors que seul son navigateur a la donnée.
    toast(`Coffre en ligne : ${_ghErr}`, 'error');
    if (!_ghTimer) _ghTimer = setTimeout(ghFlush, 30000);   // nouvelle tentative
  } else {
    _ghErr = '';
    markPushPending(false);
    ghPaintStatus('ok');
  }
}
function ghPaintStatus(st) {
  _ghStatus = st;
  const el = document.getElementById('cloud-dot');
  if (el) {
    el.dataset.state = st;
    el.title = { off: 'Coffre en ligne non configuré', warn: 'Coffre en ligne NON configuré : rien n\u2019est envoyé depuis cet appareil',
      pending: 'Envoi au dépôt dans quelques secondes…',
      saving: 'Envoi au dépôt…', ok: 'Collection sauvegardée dans le dépôt',
      read: 'Lecture seule : la collection est bien relue du dépôt, mais rien n\u2019est envoyé depuis cet appareil (jeton absent ou expiré)',
      error: `Échec d'envoi : ${_ghErr}` }[st] || '';
  }
}
// ── Relecture au démarrage ────────────────────────────────────────
// Règle : le plus RÉCENT gagne, et l'appareil vierge se remplit tout seul
// (ouvrir le site sur l'iPhone suffit à y retrouver la collection).
let _localUpdated = 0, _ghLastPull = 0;
function ghLocalEmpty() {
  return !state.wishlists.length && !state.binders.length && !state.investCards.length
    && !state.sealed.length && !Object.keys(state.milobellus || {}).length;
}
async function ghPull() {
  const c = ghCfg();
  if (!c.owner || !c.repo) return;
  _ghLastPull = Date.now();
  delete _ghSha[GH_PATHS.collection];   // notre référence n'est plus fiable
  const remote = await ghRead(GH_PATHS.collection);
  if (!remote || typeof remote !== 'object') return;
  const rt = Date.parse(remote.lastUpdated || 0) || 0;
  const empty = ghLocalEmpty();
  if (!empty && rt <= _localUpdated) {
    // Le local est à jour (ou en avance) : on pousse s'il est en avance.
    if (rt < _localUpdated) ghPushSoon('collection');
    return;
  }
  // On garde l'état d'AVANT avant d'écraser : même ici, rien ne disparaît.
  if (!empty) await autoBackup('avant-coffre-en-ligne');
  applyLoaded(remote);
  _localUpdated = rt;
  await writeNow();
  window._vaultCounted = false; window._investCountedCards = false; window._investCountedSealed = false;
  renderViewContent(state.view);
  if (!empty) toast('Collection mise à jour depuis le dépôt', 'success');
  ghPaintStatus('ok');
}
// Les cotes voyagent aussi : le pont Cardmarket ne tourne que sur le Mac,
// l'iPhone se contente de lire le résultat de la dernière synchro.
// Renvoie le NOMBRE de cotes reprises (0 si le dépôt n'a rien de plus récent) :
// le bouton Sync s'en sert pour savoir s'il a pu rendre service.
async function ghPullPrices() {
  const c = ghCfg();
  if (!c.owner || !c.repo) return 0;
  const remote = await ghRead(GH_PATHS.prices);
  if (!remote || !remote.prices) return 0;
  const rt = Number(remote.syncedAt) || 0;
  if (rt <= priceSyncedAt()) return 0;
  let n = 0;
  for (const k in remote.prices) {
    const v = remote.prices[k];
    if (v && typeof v === 'object') { priceCache[k] = v; n++; }
  }
  _priceSyncedAt = rt;
  flushPriceCache();
  if (n) {
    window._vaultCounted = false; window._investCountedCards = false;
    renderViewContent(state.view);
  }
  return n;
}

// ── Réglages du coffre en ligne ───────────────────────────────────
// Un seul champ à remplir dans le cas normal : le jeton. Le dépôt est déduit
// de l'URL GitHub Pages. Le bouton « Vérifier » fait un VRAI aller-retour
// (lecture du dépôt + écriture d'un fichier témoin) et dit ce qui bloque —
// c'est la seule façon de savoir que la sauvegarde marche AVANT d'y confier
// sa collection.
// La version RÉELLEMENT chargée, lue sur la balise <script> : c'est la seule
// façon de savoir si un appareil sert encore du code périmé.
function appVersion() {
  try {
    const src = document.querySelector('script[src*="app.js"]')?.src || '';
    return new URL(src, location.href).searchParams.get('v') || '?';
  } catch { return '?'; }
}
function ensureCloudModal() {
  let m = document.getElementById('modal-cloud');
  if (m) return m;
  m = document.createElement('div');
  m.className = 'modal-overlay'; m.id = 'modal-cloud';
  m.innerHTML = `<div class="modal" style="max-width:580px">
      <div class="modal-header"><div class="modal-title">Coffre en ligne</div><button class="modal-close" onclick="closeModal('modal-cloud')" aria-label="Fermer">${ICO.close}</button></div>
      <div class="modal-body" id="cloud-body" style="min-height:120px"></div>
      <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal('modal-cloud')">Fermer</button></div>
    </div>`;
  document.body.appendChild(m);
  return m;
}
function openCloud() {
  ensureCloudModal();
  const c = ghCfg();
  const st = { off: 'non configuré', ok: 'à jour', pending: 'envoi imminent', saving: 'envoi en cours', error: 'échec du dernier envoi' }[_ghStatus] || '';
  document.getElementById('cloud-body').innerHTML = `
    <p class="sealed-imp-hint">Ta collection est enregistrée dans le dépôt <b>${esc(c.owner || '?')}/${esc(c.repo || '?')}</b> (branche ${esc(c.branch)}), fichier <code>data/collection.json</code>. Chaque modification fait un commit : l'historique du dépôt est ta machine à remonter le temps.</p>
    <div class="cloud-field">
      <label for="cloud-token">Jeton d'accès GitHub <span>(jeton <b>classique</b>, expiration « <b>No expiration</b> », case <b>repo</b> — c'est le seul type qui n'expire jamais, donc à coller une fois pour toutes)</span></label>
      <input id="cloud-token" type="password" autocomplete="off" spellcheck="false" placeholder="${c.token ? '•••••••• (déjà enregistré)' : 'github_pat_…'}" value="">
    </div>
    <div class="cloud-row">
      <div class="cloud-field"><label for="cloud-owner">Compte</label><input id="cloud-owner" value="${esc(c.owner)}" spellcheck="false"></div>
      <div class="cloud-field"><label for="cloud-repo">Dépôt</label><input id="cloud-repo" value="${esc(c.repo)}" spellcheck="false"></div>
      <div class="cloud-field"><label for="cloud-branch">Branche</label><input id="cloud-branch" value="${esc(c.branch)}" spellcheck="false"></div>
    </div>
    <p class="sealed-imp-note">Le jeton reste dans CE navigateur (localStorage) : il n'est jamais écrit dans le dépôt, qui est public. En cas de doute, révoque-le sur github.com et recolle-en un nouveau.</p>
    <div class="cloud-actions">
      <button class="btn btn-primary" onclick="cloudCheck()">Vérifier et enregistrer</button>
      <button class="btn btn-ghost" onclick="cloudPushNow()">Envoyer maintenant</button>
      <button class="btn btn-ghost" onclick="cloudPullNow()">Relire le dépôt</button>
    </div>
    <div id="cloud-report" class="cloud-report">État : ${esc(st)}${_ghErr ? ` — ${esc(_ghErr)}` : ''} · version ${esc(appVersion())}</div>`;
  openModal('modal-cloud');
  cloudShowRemote();
}
// Ce que contient le dépôt, LU depuis le dépôt (pas depuis ce que l'app croit
// avoir envoyé). C'est ce chiffre-là qui prouve que la sauvegarde existe.
async function cloudShowRemote() {
  const c = ghCfg();
  if (!c.owner || !c.repo) return;
  const el = document.getElementById('cloud-remote');
  const remote = await ghRead(GH_PATHS.collection);
  const box = document.getElementById('cloud-report');
  if (!box) return;
  const line = document.createElement('div');
  line.className = 'cloud-remote';
  if (!remote) {
    line.innerHTML = ghLocalEmpty()
      ? 'Dépôt : <b>aucune collection</b> — et cet appareil n’en a pas non plus (restaure d’abord un .json avec ⇧⌘R).'
      : 'Dépôt : <b>aucune collection pour l’instant</b> — clique « Vérifier et enregistrer » pour y envoyer celle de cet appareil.';
  } else {
    const d = String(remote.lastUpdated || '').replace('T', ' à ').slice(0, 16);
    line.innerHTML = `Dépôt : ${(remote.wishlists || []).length} wishlists · ${(remote.investCards || []).length} cartes · ${(remote.sealed || []).length} produits scellés <span>(${esc(d)})</span>`;
  }
  box.after(line);
}
function cloudReport(html, kind) {
  const el = document.getElementById('cloud-report');
  if (el) { el.className = `cloud-report ${kind || ''}`; el.innerHTML = html; }
}
function cloudFormSave() {
  const g = id => (document.getElementById(id)?.value || '').trim();
  const patch = { owner: g('cloud-owner'), repo: g('cloud-repo'), branch: g('cloud-branch') || 'main' };
  const tok = g('cloud-token');
  if (tok) patch.token = tok;          // vide = on garde le jeton déjà enregistré
  return ghSave(patch);
}
async function cloudCheck() {
  const c = cloudFormSave();
  if (!c.owner || !c.repo) return cloudReport('Il manque le compte ou le dépôt.', 'bad');
  if (!c.token) return cloudReport('Il manque le jeton d’accès.', 'bad');
  cloudReport('<span class="spinner spinner-sm"></span> Vérification…');
  // 1) le dépôt existe et le jeton peut ÉCRIRE (permissions.push)
  let r;
  try { r = await ghApi(''); } catch { return cloudReport('Réseau injoignable.', 'bad'); }
  if (r.status === 401) {
    // Cas le plus fréquent, et de loin : les jetons « fine-grained » de GitHub
    // ont une DATE D'EXPIRATION (90 jours par défaut). Le message doit dire ça,
    // et rappeler que la lecture, elle, continue de marcher : le dépôt est
    // public, la collection est relue sans aucun jeton.
    ghPaintStatus('read');
    return cloudReport('Jeton refusé (401) — il a expiré ou été révoqué.<br><br>'
      + '<b>Pour ne plus jamais avoir à le refaire</b>, prends un jeton <b>classique</b> et non « fine-grained » : '
      + '<a href="https://github.com/settings/tokens/new?scopes=repo&description=IronDex" target="_blank" rel="noopener">ouvre cette page</a>, '
      + 'choisis <b>Expiration : No expiration</b>, vérifie que la case <b>repo</b> est cochée, puis colle le jeton ici. '
      + 'Les jetons fine-grained, eux, expirent au bout d\u2019un an au maximum — c\u2019est pour ça qu\u2019on retombe là-dessus.<br><br>'
      + 'En attendant, rien n\u2019est perdu : la lecture continue (ta collection est relue du dépôt à chaque ouverture), et les modifications faites ici '
      + 'sont GARDÉES puis envoyées automatiquement dès que le jeton remarche.', 'bad');
  }
  if (r.status === 404) return cloudReport(`Dépôt <b>${esc(c.owner)}/${esc(c.repo)}</b> introuvable — vérifie le nom, ou que le jeton donne accès à CE dépôt.`, 'bad');
  if (!r.ok) return cloudReport(`GitHub répond HTTP ${r.status}.`, 'bad');
  const repo = await r.json().catch(() => ({}));
  if (repo.permissions && !repo.permissions.push)
    return cloudReport('Le jeton lit le dépôt mais ne peut pas y écrire : il lui manque « Contents : Read and write ».', 'bad');
  // 2) écriture RÉELLE d'un fichier témoin : seul test qui prouve la chaîne complète
  const w = await ghWrite('data/.irondex-ping.json', { at: new Date().toISOString(), from: navigator.platform || 'appareil' }, 'IronDex : test de connexion');
  if (!w.ok) return cloudReport(`Lecture OK, mais l’écriture échoue : ${esc(w.reason)}`, 'bad');
  ghPaintStatus('ok');
  // 3) et on ENVOIE tout de suite si c'est ce qu'il faut faire. Sans ça,
  //    quelqu'un qui restaure sa collection PUIS colle son jeton se retrouve
  //    avec un dépôt vide et un écran tout vert : l'envoi automatique ne se
  //    déclenche qu'à la modification SUIVANTE. « Enregistrer » doit vouloir
  //    dire « ma collection est en ligne », pas « le jeton est valide ».
  if (!ghLocalEmpty()) {
    const remote = await ghRead(GH_PATHS.collection);
    const rt = remote ? (Date.parse(remote.lastUpdated || 0) || 0) : 0;
    const lt = Date.parse(collectionSnapshot().lastUpdated) || Date.now();
    // Garde-fou du moment le plus risqué : brancher un appareil dont la copie
    // locale est plus PAUVRE que le dépôt (une vieille session, un import
    // partiel) écraserait la bonne collection. On demande alors confirmation.
    const nLocal = state.investCards.length + state.wishlists.length + state.sealed.length;
    const nRemote = remote ? ((remote.investCards || []).length + (remote.wishlists || []).length + (remote.sealed || []).length) : 0;
    if (remote && nRemote > nLocal * 1.1 + 5 && !window._cloudForcePush) {
      window._cloudForcePush = true;
      return cloudReport(`Attention : le dépôt contient <b>${nRemote}</b> entrées, cet appareil seulement <b>${nLocal}</b>. Envoyer écraserait la version en ligne. Clique « Relire le dépôt » pour récupérer la bonne, ou « Vérifier » à nouveau pour envoyer quand même.`, 'bad');
    }
    if (!remote || rt < lt) {
      cloudReport('<span class="spinner spinner-sm"></span> Jeton validé — envoi de la collection…');
      const a = await ghWrite(GH_PATHS.collection, collectionSnapshot(), 'IronDex : collection mise à jour');
      if (!a.ok) return cloudReport(`Jeton valide, mais l’envoi de la collection échoue : ${esc(a.reason)}`, 'bad');
      await ghWrite(GH_PATHS.prices, { syncedAt: priceSyncedAt(), prices: priceDiskSnapshot() }, 'IronDex : cotes mises à jour');
      return cloudReport(`Tout est en place, et ta collection est <b>en ligne</b> : ${state.wishlists.length} wishlists · ${state.investCards.length} cartes · ${state.sealed.length} produits scellés. Les prochaines modifications partiront toutes seules.`, 'good');
    }
  }
  cloudReport(`Tout est en place. Branche <b>${esc(repo.default_branch || c.branch)}</b>${repo.private ? ' · dépôt privé' : ' · dépôt public'}. Tes prochaines modifications partiront automatiquement.`, 'good');
}
async function cloudPushNow() {
  if (!ghOn()) return cloudReport('Configure d’abord le jeton et le dépôt.', 'bad');
  if (ghLocalEmpty()) return cloudReport('Cet appareil n’a aucune collection à envoyer : il écraserait celle du dépôt. Utilise « Relire le dépôt » pour la récupérer ici.', 'bad');
  cloudReport('<span class="spinner spinner-sm"></span> Envoi de la collection…');
  const a = await ghWrite(GH_PATHS.collection, collectionSnapshot(), 'IronDex : collection mise à jour');
  if (!a.ok) { ghPaintStatus('error'); return cloudReport(`Échec : ${esc(a.reason)}`, 'bad'); }
  const b = await ghWrite(GH_PATHS.prices, { syncedAt: priceSyncedAt(), prices: priceDiskSnapshot() }, 'IronDex : cotes mises à jour');
  ghPaintStatus('ok');
  const n = state.wishlists.length + state.investCards.length + state.sealed.length;
  cloudReport(`Envoyé : ${n} entrées${b.ok ? ' + les cotes' : ' (cotes : ' + esc(b.reason) + ')'}.`, 'good');
}
async function cloudPullNow() {
  const c = ghCfg();
  if (!c.owner || !c.repo) return cloudReport('Configure d’abord le dépôt.', 'bad');
  cloudReport('<span class="spinner spinner-sm"></span> Lecture du dépôt…');
  const remote = await ghRead(GH_PATHS.collection);
  if (!remote) return cloudReport('Aucun <code>data/collection.json</code> dans le dépôt pour l’instant — envoie d’abord ta collection.', 'bad');
  await autoBackup('avant-relecture-depot');
  applyLoaded(remote);
  _localUpdated = Date.parse(remote.lastUpdated || 0) || 0;
  await writeNow();
  await ghPullPrices();
  window._vaultCounted = false; window._investCountedCards = false; window._investCountedSealed = false;
  renderViewContent(state.view);
  cloudReport(`Relu : ${state.wishlists.length} wishlists · ${state.investCards.length} cartes · ${state.sealed.length} produits scellés (état du ${esc(String(remote.lastUpdated || '').slice(0, 10))}).`, 'good');
}

// ══════════════════════════════════════════════════════════════════
//  RÉCUPÉRATION — retrouve un ancien instantané de la collection
//  load() lit IndexedDB et sort AVANT de toucher localStorage : l'ancienne
//  sauvegarde localStorage (d'avant la migration IDB) n'est jamais supprimée.
//  C'est la seule copie de secours quand IDB a été écrasé.
// ══════════════════════════════════════════════════════════════════
function _recoveryEntry(key, d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const w = Array.isArray(d.wishlists) ? d.wishlists.length : 0;
  const b = Array.isArray(d.binders) ? d.binders.length : 0;
  const m = d.milobellus && typeof d.milobellus === 'object' ? Object.keys(d.milobellus).length : 0;
  const c = Array.isArray(d.investCards) ? d.investCards.length : 0;
  if (w + b + m + c === 0) return null;   // rien d'exploitable pour une récupération
  return { key, wishlists: w, binders: b, milo: m, cards: c, date: d.lastUpdated || null, data: d };
}
// Instantanés localStorage (copie d'avant la migration IndexedDB, jamais supprimée)
function scanRecovery() {
  const out = [];
  let keys = [];
  try { keys = Object.keys(localStorage); } catch { return out; }
  for (const k of keys) {
    let d;
    try { d = JSON.parse(localStorage.getItem(k)); } catch { continue; }
    const e = _recoveryEntry(k, d);
    if (e) out.push(e);
  }
  out.sort((a, b2) => (b2.wishlists + b2.binders + b2.milo + b2.cards) - (a.wishlists + a.binders + a.milo + a.cards));
  return out;
}
// localStorage + sauvegardes automatiques (IndexedDB) — les plus récentes d'abord
async function scanRecoveryAll() {
  const out = scanRecovery();
  try {
    const keys = await idbKeys();
    const backups = keys.filter(k => typeof k === 'string' && k.startsWith(BACKUP_PREFIX)).sort().reverse();
    for (const k of backups) {
      const d = await idbGet(k).catch(() => null);
      const e = _recoveryEntry(k.slice(BACKUP_PREFIX.length), d);
      if (e) { e.auto = true; out.unshift(e); }
    }
  } catch {}
  return out;
}
function ensureRecoverModal() {
  let m = document.getElementById('modal-recover');
  if (m) return m;
  m = document.createElement('div');
  m.className = 'modal-overlay'; m.id = 'modal-recover';
  m.innerHTML = `<div class="modal" style="max-width:560px">
      <div class="modal-header"><div class="modal-title">Récupérer une collection</div><button class="modal-close" onclick="closeModal('modal-recover')" aria-label="Fermer">${ICO.close}</button></div>
      <div class="modal-body" id="recover-body" style="min-height:120px"></div>
      <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal('modal-recover')">Fermer</button></div>
    </div>`;
  document.body.appendChild(m);
  return m;
}
async function openRecovery() {
  ensureRecoverModal();
  const body0 = document.getElementById('recover-body');
  body0.innerHTML = `<div class="loading-state"><div class="spinner"></div> Recherche des sauvegardes…</div>`;
  openModal('modal-recover');
  const found = await scanRecoveryAll();
  window._recoverFound = found;
  const body = document.getElementById('recover-body');
  // Restauration depuis un FICHIER : c'est le seul recours quand le navigateur
  // a été vidé (les instantanés de secours vivent dans le navigateur, ils
  // partent avec lui). Longtemps `pickRestoreFile` n'était branché sur AUCUN
  // bouton : la seule voie annoncée était « ⇧⌘R »… qui ouvre ce panneau. Il
  // faut donc un vrai sélecteur de fichier ici, toujours visible.
  const fileBtn = `<div class="recover-file">
      <label class="btn btn-primary btn-import">
        <span>Restaurer un fichier .json</span>
        <input type="file" accept=".json,application/json" hidden onchange="pickRestoreFile(this)">
      </label>
      <span class="sealed-imp-note">Une section vide dans le fichier n'écrase jamais une section déjà remplie.</span>
    </div>`;
  if (!found.length) {
    body.innerHTML = `<p class="sealed-imp-hint">Aucun instantané de secours trouvé dans ce navigateur.</p>
      <p class="sealed-imp-note">Les instantanés automatiques vivent DANS le navigateur : un nettoyage des données de navigation les emporte aussi. Si tu as un fichier de sauvegarde sur ton disque, charge-le ici.</p>
      ${fileBtn}`;
  } else {
    body.innerHTML = `<p class="sealed-imp-hint">${found.length} instantané${found.length > 1 ? 's' : ''} de secours trouvé${found.length > 1 ? 's' : ''} dans ce navigateur. La restauration <b>ajoute</b> les sections manquantes sans toucher à ton scellé ni à tes cartes.</p>
      ${found.map((f, i) => `<div class="recover-item">
        <div class="recover-meta">
          <b>${f.auto ? 'Sauvegarde auto · ' : ''}${esc(f.key)}</b>
          <span>${f.wishlists} wishlist${f.wishlists > 1 ? 's' : ''} · ${f.binders} classeur${f.binders > 1 ? 's' : ''}${f.cards ? ` · ${f.cards} carte${f.cards > 1 ? 's' : ''} suivie${f.cards > 1 ? 's' : ''}` : ''}${f.milo ? ` · ${f.milo} Milobellus` : ''}</span>
          ${f.date ? `<span class="recover-date">${esc(String(f.date).slice(0, 10))}</span>` : ''}
        </div>
        <button class="btn btn-primary btn-sm" onclick="applyRecovery(${i})">Restaurer</button>
      </div>`).join('')}
      ${fileBtn}`;
  }
  openModal('modal-recover');
}
// Fusion NON destructive : ne remplit que les sections actuellement vides.
function applyRecovery(i) {
  const f = (window._recoverFound || [])[i]; if (!f) return;
  const d = f.data, added = [];
  if (!state.wishlists.length && Array.isArray(d.wishlists) && d.wishlists.length) { state.wishlists = d.wishlists; added.push(`${d.wishlists.length} wishlists`); }
  // gradedCards : plus aucune UI, mais on récupère la donnée sans l'annoncer.
  if (!state.gradedCards.length && Array.isArray(d.gradedCards) && d.gradedCards.length) state.gradedCards = d.gradedCards;
  if (!state.binders.length && Array.isArray(d.binders) && d.binders.length) { state.binders = d.binders; added.push(`${d.binders.length} classeurs`); }
  if (!Object.keys(state.milobellus || {}).length && d.milobellus && Object.keys(d.milobellus).length) { state.milobellus = d.milobellus; added.push('Milobellus'); }
  if (d.heroRef && !state.heroRef) state.heroRef = d.heroRef;
  if (!added.length) { toast('Rien à restaurer : ces sections sont déjà remplies', 'error'); return; }
  window._vaultCounted = false;
  writeNow().then(ok => {
    closeModal('modal-recover');
    if (!ok) { toast('Écriture impossible', 'error'); return; }
    navigate('home');
    toast(`Restauré : ${added.join(', ')}`, 'success');
  });
}
// Proposition automatique au démarrage : sections vides + instantané dispo.
async function offerRecoveryIfNeeded() {
  const empty = !state.wishlists.length && !state.binders.length && !state.investCards.length;
  if (!empty) return;
  const found = await scanRecoveryAll();
  if (!found.length) return;
  const c = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="toast-dot"></span>Une collection de secours a été trouvée. <button class="toast-action" onclick="this.closest('.toast').remove();openRecovery()">Récupérer</button>`;
  c.appendChild(el);
}

function toast(msg, type = '') {
  const c = document.getElementById('toast-container');
  const el = document.createElement('div'); el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-dot"></span>${esc(msg)}`;
  c.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 250); }, 2600);
}

// ── Petit écran de chargement (feedback d'action) ──────────────────
// Overlay verre dépoli centré, bref, montré autour d'une action pour
// confirmer visuellement qu'elle est prise en compte. Pensé pour rester
// fluide : ~280 ms mini, jamais plus que le temps réel de l'opération.
let _busyEl = null;
function ensureBusyEl() {
  if (_busyEl) return _busyEl;
  _busyEl = document.createElement('div');
  _busyEl.id = 'busy-overlay';
  _busyEl.innerHTML = `<div class="busy-card"><div class="spinner"></div><div class="busy-label"></div></div>`;
  document.body.appendChild(_busyEl);
  return _busyEl;
}
function flashBusy(label, work) {
  const el = ensureBusyEl();
  el.querySelector('.busy-label').textContent = label || 'Un instant…';
  el.classList.add('open');
  // Deux rAF → l'overlay est PEINT avant que le travail (souvent synchrone) ne
  // bloque le thread ; sinon l'utilisateur ne le verrait jamais.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const t0 = performance.now();
    Promise.resolve().then(work).catch(e => console.warn(e)).finally(() => {
      const wait = Math.max(0, 280 - (performance.now() - t0));
      setTimeout(() => el.classList.remove('open'), wait);
    });
  }));
}

const cache = {};
const apiPromises = {};   // dédoublonnage des requêtes en vol (même path)
async function apiFetch(path) {
  if (cache[path]) return cache[path];
  if (path in apiPromises) return apiPromises[path];
  const p = (async () => {
    try {
      // Timeout dur : une requête TCGdex qui ne répond jamais gelait toute la
      // chaîne aval (fiches, cotes… → « chargement infini » sur les détails).
      // Retry automatique : TCGdex renvoie ponctuellement des 5xx / coupe la
      // connexion. Deux tentatives supplémentaires (back-off court) évitent
      // qu'un simple hoquet réseau ne bloque l'ajout de cartes (« erreur de
      // chargement »).
      let d, lastErr;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const r = await fetchTimeout(`${API}${path}`, 12000);
          if (!r.ok) throw new Error(r.status);
          d = await r.json();
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          if (attempt < 2) await new Promise(res => setTimeout(res, 700 * (attempt + 1)));
        }
      }
      if (lastErr) {
        // Repli sur une copie PERSISTÉE (même périmée) avant d'abandonner :
        // un set/série déjà consulté reste navigable même réseau coupé.
        const stale = _apiStore.map[path]?.d;
        if (stale) { cache[path] = stale; return stale; }
        throw lastErr;
      }
      cache[path] = d;
      rememberApi(path, d);   // persiste les données STRUCTURELLES (séries/sets)
      return d;
    } finally { delete apiPromises[path]; }
  })();
  apiPromises[path] = p;
  return p;
}
function prefetchApi(path) { apiFetch(path).catch(() => {}); }
function prefetchSeries(id) { prefetchApi(`/series/${id}`); }
function prefetchSet(id) { prefetchApi(`/sets/${id}`); }

// ── Cache persistant (localStorage) des données structurelles ──────
// Les séries et sets ne changent quasi jamais : on les garde d'une session à
// l'autre → « parcourir les séries » devient instantané dès la 2e visite. Les
// cotes (/cards/*) NE sont PAS persistées (elles évoluent) : elles restent en
// cache mémoire, rechargées au boot comme avant. Bornage LRU par taille.
const APICACHE_KEY = 'irondex-apicache-v1';
const APICACHE_MAX_BYTES = 1_600_000, APICACHE_MAX_ENTRY = 60_000;
let _apiStore = { total: 0, order: [], map: {} };
function loadApiCache() {
  try {
    const raw = localStorage.getItem(APICACHE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && d.map) { _apiStore = d; for (const p in d.map) cache[p] = d.map[p].d; }
    }
  } catch {}
}
let _apiPersistTimer = null;
function persistApiSoon() {
  if (_apiPersistTimer) return;
  _apiPersistTimer = setTimeout(() => {
    _apiPersistTimer = null;
    try { localStorage.setItem(APICACHE_KEY, JSON.stringify(_apiStore)); }
    catch {
      // Quota atteint : purge la moitié la plus ancienne puis réessaie.
      _apiStore.order.splice(0, Math.ceil(_apiStore.order.length / 2)).forEach(p => {
        if (_apiStore.map[p]) { _apiStore.total -= _apiStore.map[p].n; delete _apiStore.map[p]; }
      });
      try { localStorage.setItem(APICACHE_KEY, JSON.stringify(_apiStore)); } catch {}
    }
  }, 900);
}
function rememberApi(path, data) {
  if (!/^\/(series|sets)/.test(path)) return;   // structurel uniquement
  let s; try { s = JSON.stringify(data); } catch { return; }
  const n = s.length;
  if (n > APICACHE_MAX_ENTRY) return;
  if (_apiStore.map[path]) _apiStore.total -= _apiStore.map[path].n;
  else _apiStore.order.push(path);
  _apiStore.map[path] = { d: data, n };
  _apiStore.total += n;
  while (_apiStore.total > APICACHE_MAX_BYTES && _apiStore.order.length > 1) {
    const old = _apiStore.order.shift();
    if (old === path) { _apiStore.order.push(path); continue; }
    if (_apiStore.map[old]) { _apiStore.total -= _apiStore.map[old].n; delete _apiStore.map[old]; }
  }
  persistApiSoon();
}

// ── Repli de visuel pour les sets sans image en FR ────────────────
// Certains sets Soleil et Lune (ex. Destinées Occultes, son Coffre Étincelant
// « SV », Légendes Brillantes...) n'ont aucun visuel côté API FR. TCGdex
// héberge pourtant ces mêmes visuels sous d'autres locales (chemin différent,
// même CDN) : on les tente dans l'ordre avant d'abandonner. Une cinquantaine
// de sets n'ont de visuel dans AUCUNE locale TCGdex (Majesté des Dragons,
// la Collection Classique de Célébrations, les galeries TG/GG, les coffres
// étincelants, kits dresseur, McDo...) : on les mappe vers pokemontcg.io.
// L'API api.pokemontcg.io étant très instable (timeouts fréquents de 60 s+),
// on lit son MIROIR GitHub officiel (raw.githubusercontent.com, rapide et
// CORS ouvert) qui pointe vers le CDN images.pokemontcg.io — lui, fiable.
// Le texte de la carte reste toujours celui de l'API FR — seule l'image
// change de source.
const IMG_FALLBACK_LOCALES = ['en', 'de', 'es', 'it', 'pt', 'ja'];
// tcgdex setId → sets candidats sur pokemontcg.io, dans l'ordre d'essai.
// Plusieurs candidats quand pokemontcg.io scinde un set TCGdex en deux
// (Célébrations + sa Collection Classique, Destinées Occultes + son coffre).
const PTCG_SET_CANDIDATES = {
  'sm3.5': ['sm35'], 'sm7.5': ['sm75'],
  'sm115': ['sm115', 'sma'], 'sma': ['sma'],
  'cel25': ['cel25', 'cel25c'],
  'swsh4.5': ['swsh45', 'swsh45sv'], 'swsh4.5sv': ['swsh45sv'],
  'swsh9.5tg': ['swsh9tg'], 'swsh10.5tg': ['swsh10tg'],
  'swsh11.5tg': ['swsh11tg'], 'swsh12.5tg': ['swsh12tg'],
  'swsh12.5': ['swsh12pt5', 'swsh12pt5gg'], 'swsh12.5gg': ['swsh12pt5gg'],
  'hgssp': ['hsp'],
  '2011bw': ['mcd11'], '2012bw': ['mcd12'], '2014xy': ['mcd14'], '2015xy': ['mcd15'],
  '2016xy': ['mcd16'], '2017sm': ['mcd17'], '2018sm-fr': ['mcd18'], '2019sm-fr': ['mcd19'],
  '2021swsh': ['mcd21'], '2022swsh': ['mcd22'],
  'tk-ex-latia': ['tk1a'], 'tk-ex-latio': ['tk1b'], 'tk-ex-p': ['tk2a'], 'tk-ex-m': ['tk2b'],
  'exu': ['ex10'],
};
function ptcgSetCandidates(setId) {
  if (PTCG_SET_CANDIDATES[setId]) return PTCG_SET_CANDIDATES[setId];
  // Transformations génériques entre les deux nomenclatures :
  // zéro de tête (« sv01 » → « sv1 », « me02 » → « me2 ») et séparateur
  // décimal (« sv03.5 » → « sv3pt5 », « swsh12.5 » → « swsh12pt5 »).
  const bases = [setId];
  const stripped = setId.replace(/^([a-z]+)0+(\d)/i, '$1$2');
  if (stripped !== setId) bases.push(stripped);
  const out = [];
  for (const b of bases) {
    out.push(b);
    if (b.includes('.')) out.push(b.replace('.', 'pt'), b.replace('.', ''));
  }
  return [...new Set(out)];
}
// Index des sets pokemontcg.io (miroir GitHub) : nom normalisé → sets, pour
// résoudre les correspondances que les ids ne couvrent pas (« Journey
// Together », « Black Bolt »...). Une seule requête, mémoïsée.
let _ghSetsIndexPromise = null;
function fetchGhSetsIndex() {
  if (!_ghSetsIndexPromise) {
    _ghSetsIndexPromise = (async () => {
      const byName = new Map(), byId = new Map();
      try {
        const r = await fetch('https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/sets/en.json');
        if (r.ok) {
          const d = await r.json();
          (Array.isArray(d) ? d : []).forEach(s => {
            byId.set(s.id, s);
            const k = String(s.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (k) { if (!byName.has(k)) byName.set(k, []); byName.get(k).push(s); }
          });
        }
      } catch {}
      return { byName, byId };
    })();
  }
  return _ghSetsIndexPromise;
}
// Normalise un numéro de carte pour tolérer les écarts de format entre sources
// (« SM01 » TCGdex vs « SM1 » pokemontcg.io, zéros de tête, casse, séparateurs).
function normNum(x) {
  let s = String(x == null ? '' : x).toLowerCase().replace(/[^a-z0-9]/g, '');
  return s.replace(/^([a-z]*)0*(\d.*)$/, '$1$2');
}
const fallbackSetCache = {};
const fallbackCache = {};
// Un set peut avoir des dizaines/centaines de cartes affichées en même temps
// (picker, wishlist...) : on mémoïse la PROMESSE (pas seulement son résultat)
// pour qu'un set donné ne déclenche jamais qu'une seule requête réseau, même
// si des dizaines de cartes la demandent au même instant.
function fetchLocaleSetImages(locale, setId) {
  const key = `${locale}#${setId}`;
  if (!fallbackSetCache[key]) {
    fallbackSetCache[key] = (async () => {
      const map = new Map();
      try {
        const r = await fetch(`https://api.tcgdex.net/v2/${locale}/sets/${setId}`);
        if (r.ok) { const d = await r.json(); (d.cards || []).forEach(c => { if (c.image) { map.set(String(c.localId), c.image); map.set(normNum(c.localId), c.image); } }); }
      } catch {}
      return map;
    })();
  }
  return fallbackSetCache[key];
}
// Miroir GitHub officiel de pokemontcg.io : un JSON statique par set, servi
// par raw.githubusercontent.com (rapide, CORS ouvert, jamais de bot-wall).
// Indexé par numéro brut, numéro normalisé ET suffixe d'id pokemontcg.io
// (« cel25c-15_A1 » → « 15a1 » = le localId TCGdex « 15A1 » normalisé).
const GH_CARDS_BASE = 'https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/cards/en/';
const ghSetJsonCache = {};
function fetchGhSetJson(extSetId) {
  if (!ghSetJsonCache[extSetId]) {
    ghSetJsonCache[extSetId] = (async () => {
      try {
        const r = await fetch(`${GH_CARDS_BASE}${encodeURIComponent(extSetId)}.json`);
        if (r.ok) { const d = await r.json(); if (Array.isArray(d)) return d; }
      } catch {}
      return [];
    })();
  }
  return ghSetJsonCache[extSetId];
}
const ghSetCache = {};
function fetchGhSetImages(extSetId) {
  if (!ghSetCache[extSetId]) {
    ghSetCache[extSetId] = fetchGhSetJson(extSetId).then(d => {
      const map = new Map();
      d.forEach(c => {
        const url = c.images?.large || c.images?.small;
        if (!url) return;
        const v = 'DIRECT::' + url;
        map.set(String(c.number), v);
        if (!map.has(normNum(c.number))) map.set(normNum(c.number), v);
        const suf = String(c.id || '').split('-')[1];
        if (suf && !map.has(normNum(suf))) map.set(normNum(suf), v);
      });
      return map;
    });
  }
  return ghSetCache[extSetId];
}
// numéro (brut/normalisé) → id pokemontcg.io exact (« cel25c-15_A1 »...) —
// sert à retrouver la fiche Cardmarket officielle de la carte.
const ghIdCache = {};
function fetchGhSetIds(extSetId) {
  if (!ghIdCache[extSetId]) {
    ghIdCache[extSetId] = fetchGhSetJson(extSetId).then(d => {
      const map = new Map();
      d.forEach(c => {
        if (!c.id) return;
        map.set(String(c.number), c.id);
        if (!map.has(normNum(c.number))) map.set(normNum(c.number), c.id);
        const suf = String(c.id).split('-')[1];
        if (suf && !map.has(normNum(suf))) map.set(normNum(suf), c.id);
      });
      return map;
    });
  }
  return ghIdCache[extSetId];
}
// ── pokemontcg.io : fiche carte directe (source de repli unifiée) ───────
// Fournit visuel + cote Cardmarket + nom anglais pour les cartes que TCGdex
// FR ne couvre pas (surtout les promos SM alternatives SM211→SM250, absentes
// de TCGdex mais présentes ici). L'id TCGdex correspond à l'id pokemontcg.io
// pour la plupart des sets SM ; on mappe les rares exceptions.
const PTCG_SET_MAP = { 'sm7.5': 'sm75', 'sm3.5': 'sm35' };
const ptcgCardCache = {};
// Découpe « sm12-1 » → ['sm12','1'], « smp-SM241 » → ['smp','SM241'] (les setId
// TCGdex ne contiennent jamais de tiret, on coupe donc au premier).
function splitCardId(cardId) {
  const s = String(cardId || ''); const i = s.indexOf('-');
  return i < 0 ? [s, ''] : [s.slice(0, i), s.slice(i + 1)];
}
// fetch avec délai maximum — l'API pokemontcg.io peut rester muette 60 s+ :
// sans garde-fou, une seule requête gèle toute la chaîne de repli.
function fetchTimeout(url, ms = 8000, opts = {}) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), ms) : null;
  return fetch(url, ctrl ? Object.assign({ signal: ctrl.signal }, opts) : opts)
    .finally(() => { if (timer) clearTimeout(timer); });
}
function fetchPtcgCard(setId, localId) {
  if (!setId || localId == null || localId === '') return Promise.resolve(null);
  const ext = PTCG_SET_MAP[setId] || setId;
  const id = `${ext}-${localId}`;
  if (id in ptcgCardCache) return Promise.resolve(ptcgCardCache[id]);
  return (ptcgCardCache[id] = (async () => {
    let res = null;
    try {
      const r = await fetchTimeout(`https://api.pokemontcg.io/v2/cards/${encodeURIComponent(id)}`, 8000);
      if (r.ok) { const d = await r.json(); res = d.data || null; }
    } catch {}
    ptcgCardCache[id] = res;
    return res;
  })());
}
async function fetchExternalImage(setId, localId) {
  // 1) miroir GitHub de pokemontcg.io : couvre TOUS les sets candidats
  //    (galeries, coffres, kits, McDo, Collection Classique...) sans dépendre
  //    de l'API instable.
  for (const ext of ptcgSetCandidates(setId)) {
    const map = await fetchGhSetImages(ext);
    const hit = map.get(String(localId)) || map.get(normNum(localId));
    if (hit) return hit;
  }
  // 2) fiche directe api.pokemontcg.io en tout dernier recours (timeout court)
  const p = await fetchPtcgCard(setId, localId);
  const url = p?.images?.large || p?.images?.small;
  if (url) return 'DIRECT::' + url;
  return null;
}
// ── Cache PERSISTANT des visuels retrouvés ─────────────────────────
// Une fois un visuel de repli localisé (autre locale ou pokemontcg.io), on le
// mémorise dans localStorage : les sessions suivantes l'affichent immédiatement,
// même si les sources de repli sont momentanément injoignables.
const IMGFB_KEY = 'irondex-imgfb-v1';
let _imgfbTimer = null;
function loadImgFallbackCache() {
  try {
    const d = JSON.parse(localStorage.getItem(IMGFB_KEY) || '{}');
    for (const k in d) if (d[k]) fallbackCache[k] = d[k];
  } catch {}
}
function persistImgFallbackSoon() {
  if (_imgfbTimer) return;
  _imgfbTimer = setTimeout(() => {
    _imgfbTimer = null;
    try {
      const out = {};
      for (const k in fallbackCache) if (fallbackCache[k]) out[k] = fallbackCache[k];
      localStorage.setItem(IMGFB_KEY, JSON.stringify(out));
    } catch {}
  }, 1200);
}
loadImgFallbackCache();
async function resolveMissingImage(setId, localId) {
  if (!setId || !localId) return null;
  const key = `${setId}#${localId}`;
  if (key in fallbackCache) return fallbackCache[key];
  let found = null;
  for (const loc of IMG_FALLBACK_LOCALES) {
    const map = await fetchLocaleSetImages(loc, setId);
    if (map.has(String(localId))) { found = map.get(String(localId)); break; }
    if (map.has(normNum(localId))) { found = map.get(normNum(localId)); break; }
  }
  if (!found) found = await fetchExternalImage(setId, localId);
  // DERNIER RECOURS : le recto sur la fiche Cardmarket. TCGdex n'a aucun visuel
  // pour certains sets entiers (toutes les Galeries de Dresseurs : swsh12tg &
  // co, 30 cartes sans image en FR comme en EN), et l'app affichait des trous.
  // Demande le pont local ; sans lui, on reste sur le placeholder.
  if (!found) found = await cmCardImage(setId, localId);
  fallbackCache[key] = found;
  if (found) persistImgFallbackSoon();
  return found;
}
// Recto de la carte tel que Cardmarket l'affiche (og:image de la fiche), via
// le pont local. L'URL est absolue et s'affiche telle quelle ; elle est
// enregistrée comme les autres visuels de repli, et pour les cartes du
// portefeuille elle rejoint la collection — donc le dépôt, donc l'iPhone.
async function cmCardImage(setId, localId) {
  if (!cmBridgeUp()) return null;
  const cardId = `${setId}-${localId}`;
  let url = null;
  try { url = await resolveCmUrl(cardId, true); } catch {}
  if (!url || !CM_PRODUCT_RE.test(url)) return null;
  try {
    const r = await fetchTimeout(`${cmBridgeBase()}/price?url=${encodeURIComponent(url)}`, 45000);
    if (!r.ok) return null;
    const d = await r.json();
    // Convention de l'app : une URL absolue se déclare avec `DIRECT::`, sinon
    // IMG() lui accolerait « /low.webp » et l'image serait cassée.
    return (d && typeof d.img === 'string' && /^https?:\/\//.test(d.img)) ? 'DIRECT::' + d.img : null;
  } catch { return null; }
}
// Cherche les placeholders "visuel indisponible" dans root et les remplace en
// douceur si un visuel de repli est trouvé (voir resolveMissingImage). N'est
// jamais bloquant pour le rendu : les vues s'affichent normalement, les
// visuels retrouvés apparaissent quelques centaines de ms après (même logique
// de progressive enhancement que les autres squelettes de l'app).
function hydrateFallbackImages(root = document, onFound) {
  root.querySelectorAll('[data-fb-local]').forEach(ph => {
    const setId = ph.dataset.fbSet, localId = ph.dataset.fbLocal;
    if (!setId || !localId) return;
    resolveMissingImage(setId, localId).then(found => {
      if (!found || !ph.isConnected) return;
      const img = swapPlaceholder(ph, found, localId);
      if (img && onFound) onFound(setId, localId, found, img);
    });
  });
}
// Meilleure cote Cardmarket, ROBUSTE aux données aberrantes : Cardmarket
// renvoie parfois un « trend » manifestement faux (ex. Pingoléon NIV.X dp1-120 :
// trend 0,02 € alors que avg 49 € / avg30 68 €). On calcule la médiane des
// indicateurs disponibles et on écarte toute valeur à plus de 4× d'écart —
// la première valeur SAINE dans l'ordre de priorité l'emporte.
function bestCM(cm) {
  if (!cm) return null;
  const pick = keys => {
    const vals = keys.map(k => cm[k]).filter(v => typeof v === 'number' && v > 0);
    if (!vals.length) return null;
    const med = vals.slice().sort((a, b) => a - b)[Math.floor(vals.length / 2)];
    for (const k of keys) {
      const v = cm[k];
      if (typeof v === 'number' && v > 0 && v <= med * 4 && v >= med / 4) return v;
    }
    return med;
  };
  // avg30 en tête : moyenne des VENTES réelles sur 30 jours, l'indicateur le
  // plus proche du prix de marché constaté ; trend en secours (guardé).
  return pick(['avg30', 'trend', 'avg7', 'avg', 'avg1'])
      ?? pick(['avg30-holo', 'trend-holo', 'avg7-holo', 'avg-holo', 'avg1-holo']);
}

/* ══════════════════════════════════════════════════════════════════
   APPARIEMENT DOUTEUX — le vrai piège des cotes
   `bestCM` ne protège que des valeurs ABERRANTES dans un jeu d'indicateurs.
   Le problème plus grave est ailleurs : le mapping Cardmarket de TCGdex
   désigne parfois un AUTRE PRODUIT que la carte demandée. Tous les
   indicateurs sont alors cohérents entre eux… et tous faux. Deux cas
   mesurés dans le portefeuille :

   · `sm115-9` Dracaufeu-GX (Destinées Occultes) → Cardmarket idProduct
     381243 : avg 862 € / trend 752 € / avg30 666 €. La MÊME carte chez
     TCGplayer, dans la même réponse : marketPrice 10,83 $. C'est la cote de
     la version SHINY (Shiny Vault) qui a été rattachée à la carte normale.
   · `xyp-XY20` Amphinobi EX (Promo XY) → 542,50 €, avec `low: null` (aucune
     offre en vente) et trend = avg = avg1 = 850 € exactement. Le même
     Cardmarket vu par pokemontcg.io : averageSellPrice 7,18 €, trend 6,92 €.

   D'où deux détecteurs, tous deux GRATUITS (aucune requête de plus) :
   ══════════════════════════════════════════════════════════════════ */

// Cote TCGplayer (USD) de la même carte. Deux formes de payload à couvrir :
// TCGdex écrit `marketPrice/midPrice`, pokemontcg.io écrit `market/mid`.
function bestTCG(tp) {
  if (!tp) return null;
  for (const k of ['holofoil', 'normal', 'reverseHolofoil', '1stEditionHolofoil', 'unlimitedHolofoil']) {
    const v = tp[k];
    if (!v || typeof v !== 'object') continue;
    const m = v.marketPrice ?? v.market ?? v.midPrice ?? v.mid;
    if (typeof m === 'number' && m > 0) return m;
  }
  return null;
}

// Une cote Cardmarket est DOUTEUSE si :
//  (a) elle ne correspond à aucune offre en vente (`low` absent ou nul) alors
//      qu'elle annonce un montant élevé — une moyenne sans marché ne décrit
//      aucun produit achetable ; ou
//  (b) elle est en désaccord EXTRÊME avec TCGplayer sur la même carte. Les
//      écarts Europe/US légitimes vont rarement au-delà de 2-3× ; à partir de
//      4× (et 20 € d'écart absolu, pour ne pas s'exciter sur les cartes à 2 €)
//      c'est un produit différent, pas un marché différent.
function cmMappingSuspect(cm, cmVal, tcgEur) {
  if (cm == null || cmVal == null) return null;
  const noOffer = !(typeof cm.low === 'number' && cm.low > 0);
  if (noOffer && cmVal > 20) return 'aucune offre en vente';
  if (tcgEur != null && cmVal > tcgEur * 4 && cmVal - tcgEur > 20) return 'désaccord TCGplayer';
  return null;
}
// Les cotes Cardmarket telles que les publie pokemontcg.io (clés différentes
// de TCGdex) — c'est notre SECOND AVIS sur le même marché.
function bestPtcgCM(pr) {
  if (!pr) return null;
  const cm = {
    avg30: pr.avg30, avg7: pr.avg7, avg1: pr.avg1,
    trend: pr.trendPrice, avg: pr.averageSellPrice,
  };
  return bestCM(cm);
}
// Au-delà de ce montant, une cote qui ne repose QUE sur PriceCharting est
// refusée. Son appariement se fait par nom + set et tombe parfois sur un
// autre produit : mesuré, « Maraiste » (Collection McDonald's 2024, ~1 €)
// ressortait à 1 198 €. Une carte que NI Cardmarket NI TCGplayer ne cotent est
// par définition obscure ; à ce niveau de prix, « inconnu » vaut mieux qu'un
// chiffre faux qui gonfle le total du portefeuille.
const EBAY_TRUST_MAX = 120;
// ══════════════════════════════════════════════════════════════════
//  VENTES eBAY RÉELLES — via PriceCharting (agrégateur des ventes eBay
//  réussies, carte par carte, NUMÉRO par numéro : Ungraded / Grade 9 / PSA 10).
//  eBay bloque tout scraping direct ; PriceCharting compile exactement ces
//  ventes et reste accessible au travers de proxys CORS publics. Les montants
//  sont en USD → convertis en EUR avec un taux rafraîchi quotidiennement.
// ══════════════════════════════════════════════════════════════════
const CORS_PROXIES = [
  u => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
];
async function fetchViaProxy(url, ms = 12000) {
  for (const mk of CORS_PROXIES) {
    try {
      const r = await fetchTimeout(mk(url), ms);
      if (r.ok) { const t = await r.text(); if (t && t.length > 500) return t; }
    } catch {}
  }
  return null;
}
// Taux USD→EUR (cache 24 h, repli sur le dernier taux connu puis 0.9)
const FX_KEY = 'irondex-fx-v1';
let _fxPromise = null;
function usdToEur() {
  if (_fxPromise) return _fxPromise;
  return (_fxPromise = (async () => {
    try {
      const d = JSON.parse(localStorage.getItem(FX_KEY) || 'null');
      if (d && d.v > 0 && Date.now() - d.t < 24 * 3600 * 1000) return d.v;
    } catch {}
    let v = null;
    try {
      const r = await fetchTimeout('https://open.er-api.com/v6/latest/USD', 8000);
      if (r.ok) { const d = await r.json(); if (d?.rates?.EUR > 0) v = d.rates.EUR; }
    } catch {}
    if (v) { try { localStorage.setItem(FX_KEY, JSON.stringify({ t: Date.now(), v })); } catch {} }
    else { try { v = JSON.parse(localStorage.getItem(FX_KEY) || 'null')?.v || null; } catch {} }
    return v || 0.9;
  })());
}
// Fiche ANGLAISE de la carte (même id TCGdex) : nom + set en anglais, la
// langue des annonces indexées par PriceCharting.
const enCardCache = {};
function fetchEnCard(cardId) {
  if (cardId in enCardCache) return Promise.resolve(enCardCache[cardId]);
  return (enCardCache[cardId] = (async () => {
    let res = null;
    try {
      const r = await fetchTimeout(`https://api.tcgdex.net/v2/en/cards/${encodeURIComponent(cardId)}`, 9000);
      if (r.ok) {
        const d = await r.json();
        // La fiche EN porte parfois une cote Cardmarket absente de la fiche FR
        // (mapping produit incomplet côté TCGdex) : on la capture au passage.
        res = {
          name: d.name, setName: d.set?.name || '', localId: d.localId,
          official: d.set?.cardCount?.official || null,
          cm: bestCM(d.pricing?.cardmarket), cmId: d.pricing?.cardmarket?.idProduct || null,
        };
      }
    } catch {}
    enCardCache[cardId] = res;
    return res;
  })());
}
// Cache persistant des ventes eBay (7 jours : les cotes de ventes bougent peu)
const SOLD_KEY = 'irondex-sold-v2', SOLD_TTL_MS = 7 * 24 * 3600 * 1000; // v2 : matching strict par numéro
let _soldStore = {}, _soldTimer = null;
try { _soldStore = JSON.parse(localStorage.getItem(SOLD_KEY) || '{}') || {}; } catch {}
function persistSoldSoon() {
  if (_soldTimer) return;
  _soldTimer = setTimeout(() => {
    _soldTimer = null;
    try { localStorage.setItem(SOLD_KEY, JSON.stringify(_soldStore)); }
    catch { _soldStore = {}; }
  }, 1500);
}
function parseUsd(s) {
  const m = String(s || '').replace(/,/g, '').match(/\$?\s*([\d]+(?:\.\d+)?)/);
  const v = m ? parseFloat(m[1]) : NaN;
  return v > 0 ? v : null;
}
// Suffixe « collection classique » etc. : « 15A1 » → base « 15 » pour le
// matching de second rang quand PriceCharting numérote sans le suffixe.
function baseNum(localId) {
  const m = String(localId || '').match(/^\d+/);
  return m ? m[0] : String(localId || '');
}
const soldPromises = {};
function fetchSoldPrices(cardId) {
  const hit = _soldStore[cardId];
  if (hit && Date.now() - hit.t < SOLD_TTL_MS) return Promise.resolve(hit.v);
  if (cardId in soldPromises) return soldPromises[cardId];
  return (soldPromises[cardId] = (async () => {
    let out = null;
    try {
      const en = await fetchEnCard(cardId);
      if (en && en.name) {
        const [, localId] = splitCardId(cardId);
        const q = `${en.name} ${en.setName} ${baseNum(localId)}`.trim();
        let html = await fetchViaProxy(`https://www.pricecharting.com/search-products?q=${encodeURIComponent(q)}&type=prices`);
        if (html) {
          // Correspondance unique : PriceCharting redirige DIRECTEMENT sur la
          // fiche produit (grille complète Ungraded → PSA 10).
          if (html.includes('id="used_price"')) {
            out = parsePcProductPage(html);
          } else {
            // Page de résultats : on suit le lien de la ligne au bon numéro —
            // ses colonnes (Ungraded/G7/G8) sont incomplètes, la fiche a tout.
            const href = pickSoldRowLink(html, localId, en.setName);
            if (href) {
              html = await fetchViaProxy(href);
              if (html) out = parsePcProductPage(html);
            }
          }
        }
      }
      if (out) {
        const fx = await usdToEur();
        for (const k in out) out[k] = out[k] != null ? out[k] * fx : null;
        _soldStore[cardId] = { t: Date.now(), v: out };
        persistSoldSoon();
      }
    } catch {}
    delete soldPromises[cardId];
    // échec réseau/parse : on ne persiste PAS le null (nouvel essai plus tard)
    return out;
  })());
}
// Grille de prix d'une fiche produit PriceCharting (cartes Pokémon) :
// used=Ungraded, complete=Grade 7, new=Grade 8, graded=Grade 9,
// box_only=Grade 9.5, manual_only=PSA 10. Montants en USD.
function parsePcProductPage(html) {
  const grab = id => {
    const m = html.match(new RegExp(`id="${id}"[\\s\\S]{0,300}?class="price js-price"[^>]*>\\s*([^<]*)`));
    return m ? parseUsd(m[1]) : null;
  };
  const v = {
    loose: grab('used_price'), g7: grab('complete_price'), g8: grab('new_price'),
    g9: grab('graded_price'), g95: grab('box_only_price'), g10: grab('manual_only_price'),
  };
  return (v.loose != null || v.g9 != null || v.g10 != null) ? v : null;
}
// Sélectionne dans la page de résultats PriceCharting la ligne dont le NUMÉRO
// correspond EXACTEMENT au localId TCGdex ; une correspondance sur le numéro
// de base (sans suffixe) n'est acceptée QUE si le set correspond aussi —
// jamais de « à peu près » qui collerait la cote d'une autre carte.
// Renvoie l'URL de la fiche produit de la meilleure ligne.
function pickSoldRowLink(html, localId, enSetName) {
  const rows = html.match(/<tr[^>]*id="product-\d+"[\s\S]*?<\/tr>/g) || [];
  const wantExact = normNum(localId), wantBase = normNum(baseNum(localId));
  const setWords = String(enSetName || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2);
  let best = null, bestScore = -1;
  for (const row of rows) {
    const t = row.match(/<td class="title">[\s\S]*?<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!t) continue;
    const href = t[1], title = t[2].replace(/\s+/g, ' ').trim();
    const numM = title.match(/#\s*([A-Za-z0-9_.\-]+)\s*$/);
    const num = numM ? normNum(numM[1]) : '';
    let score = num === wantExact ? 4 : (num === wantBase ? 0 : -1);
    if (score < 0) continue;
    const consoleM = row.match(/<td class="console[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/);
    const consoleTxt = ((consoleM ? consoleM[1] : '') + ' ' + title).toLowerCase();
    const setOk = setWords.length > 0 && setWords.every(w => consoleTxt.includes(w));
    if (score === 0 && !setOk) continue;
    if (setOk) score += 3;
    if (score > bestScore) { best = href; bestScore = score; }
  }
  return best && best.startsWith('http') ? best : (best ? `https://www.pricecharting.com${best}` : null);
}
// Nom anglais déjà résolu (sans requête) — pour les liens Cardmarket, dont
// l'index matche mieux les noms anglais.
function cachedEnName(cardId) { return enCardCache[cardId]?.name || null; }
// Recherche Cardmarket (repli quand la fiche directe est introuvable).
function cmSearchLink(name) { return `https://www.cardmarket.com/fr/Pokemon/Products/Search?searchString=${encodeURIComponent(String(name || '').trim())}`; }
// ── Lien Cardmarket DIRECT, à la pokecardex ────────────────────────
// On atterrit sur LA fiche produit de la carte (bon set, bonne carte),
// interface FR + offres filtrées cartes françaises (language=2) en état
// Near Mint minimum (minCondition=2) — le combo exact de pokecardex.
// Résolution du slug : id pokemontcg.io exact (via le miroir GitHub) →
// redirection officielle prices.pokemontcg.io/cardmarket/{id} → l'en-tête
// Location est lu par un résolveur CORS (voir resolveFinalUrl). Cache
// persistant : chaque fiche n'est résolue qu'UNE fois, à vie.
const CM_FILTERS = 'language=2&minCondition=2';
const CMURL_KEY = 'irondex-cmurl-v1';
let _cmUrlStore = {}, _cmUrlTimer = null;
try { _cmUrlStore = JSON.parse(localStorage.getItem(CMURL_KEY) || '{}') || {}; } catch {}
// Migration : les fiches résolues avant l'ajout du filtre d'état (Near Mint)
// reçoivent minCondition=2 sans re-résolution (le slug, lui, n'a pas changé).
for (const [k, v] of Object.entries(_cmUrlStore)) {
  if (typeof v === 'string' && v.includes('/Products/Singles/') && !v.includes('minCondition='))
    _cmUrlStore[k] = v + (v.includes('?') ? '&' : '?') + 'minCondition=2';
}
function persistCmUrlSoon() {
  if (_cmUrlTimer) return;
  _cmUrlTimer = setTimeout(() => {
    _cmUrlTimer = null;
    try { localStorage.setItem(CMURL_KEY, JSON.stringify(_cmUrlStore)); } catch { _cmUrlStore = {}; }
  }, 1200);
}
// Fiches Cardmarket SANS redirection pokemontcg.io (leur base ignore la
// Collection Classique de Célébrations) : slugs relevés à la main sur la page
// du set Cardmarket — 25 cartes fixes, jamais amenées à changer.
const CM_DIRECT_SLUGS = {
  'cel25#2A': 'Celebrations/Blastoise',
  'cel25#4A': 'Celebrations/Charizard-V1-CELBS-4',
  'cel25#8A': 'Celebrations/Dark-Gyarados',
  'cel25#9A': 'Celebrations/Team-Magmas-Groudon',
  'cel25#15A1': 'Celebrations/Venusaur',
  'cel25#15A2': 'Celebrations/Here-Comes-Team-Rocket',
  'cel25#15A3': 'Celebrations/Rockets-Zapdos',
  'cel25#15A4': 'Celebrations/Claydol-Lv45',
  'cel25#17A': 'Celebrations/Umbreon-Gold-Star-CELPOP5-17',
  'cel25#20A': 'Celebrations/Cleffa',
  'cel25#24A': 'Celebrations/s-Pikachu',
  'cel25#54A': 'Celebrations/Mewtwo-EX',
  'cel25#60A': 'Celebrations/Tapu-Lele-GX',
  'cel25#66A': 'Celebrations/Shining-Magikarp',
  'cel25#73A': 'Celebrations/Imposter-Professor-Oak',
  'cel25#76A': 'Celebrations/MRayquaza-EX',
  'cel25#86A': 'Celebrations/Rockets-Admin',
  'cel25#88A': 'Celebrations/Mew-ex',
  'cel25#93A': 'Celebrations/Gardevoir-ex-Delta-Species',
  'cel25#97A': 'Celebrations/Xerneas-EX',
  'cel25#107A': 'Celebrations/Donphan-CELHS-107',
  'cel25#109A': 'Celebrations/Luxray-GL-LVX-CELRR-109',
  'cel25#113A': 'Celebrations/Reshiram-V2',
  'cel25#114A': 'Celebrations/Zekrom-V2',
  'cel25#145A': 'Celebrations/Garchomp-C-LVX-CELSV-145',
};
async function resolvePtcgId(setId, localId) {
  for (const ext of ptcgSetCandidates(setId)) {
    const ids = await fetchGhSetIds(ext);
    const hit = ids.get(String(localId)) || ids.get(normNum(localId));
    if (hit) return hit;
  }
  return null;
}
// URL finale d'une chaîne de redirections, SANS exécuter la page (Cardmarket
// est sous Cloudflare : seul l'en-tête nous intéresse). Trois résolveurs, du
// moins cher au plus précieux :
//  1. corsproxy (x-final-url) — exige une clé depuis 2024, gardé au cas où ;
//  2. allorigins /get (status.url) — gratuit illimité mais souvent en panne ;
//  3. hackertarget httpheaders — renvoie l'en-tête Location BRUT du 302 (sans
//     suivre vers Cardmarket, donc insensible à Cloudflare), CORS ouvert,
//     mais quota ~50 req/jour/IP : on cesse d'y toucher dès qu'il le signale.
//     Limite : son parseur refuse les cibles avec query string (les URLs
//     prices.pokemontcg.io n'en ont pas).
let _htQuotaDead = false;
async function resolveFinalUrl(target) {
  try {
    const r = await fetchTimeout(`https://corsproxy.io/?url=${encodeURIComponent(target)}`, 7000);
    const fin = r.headers && r.headers.get('x-final-url');
    if (fin) return fin;
  } catch {}
  try {
    const r = await fetchTimeout(`https://api.allorigins.win/get?url=${encodeURIComponent(target)}`, 7000);
    if (r.ok) {
      const d = await r.json();
      const fin = d?.status?.url;
      if (fin && fin !== target) return fin;
    }
  } catch {}
  if (!_htQuotaDead && !target.includes('?')) {
    try {
      const r = await fetchTimeout(`https://api.hackertarget.com/httpheaders/?q=${encodeURIComponent(target)}`, 9000);
      if (r.ok) {
        const txt = await r.text();
        if (/count exceeded|API count|error/i.test(txt) && !/^HTTP\//.test(txt.trim())) {
          if (/count exceeded/i.test(txt)) _htQuotaDead = true;
          return null;
        }
        const m = txt.match(/^Location:\s*(\S+)/im);
        if (m) return m[1];
      }
    } catch {}
  }
  return null;
}
// Second essai par NOM de set anglais (via la fiche EN TCGdex) : couvre tous
// les sets dont l'id diverge sans règle (« sv10.5b » → « zsv10pt5 »...).
async function resolvePtcgIdByName(cardId, localId) {
  const en = await fetchEnCard(cardId);
  if (!en || !en.setName) return null;
  const idx = await fetchGhSetsIndex();
  const sets = idx.byName.get(String(en.setName).toLowerCase().replace(/[^a-z0-9]/g, '')) || [];
  for (const s of sets) {
    const ids = await fetchGhSetIds(s.id);
    const hit = ids.get(String(localId)) || ids.get(normNum(localId));
    if (hit) return hit;
  }
  return null;
}
// Recherche Cardmarket la plus discriminante possible (repli quand la fiche
// directe est irrésoluble) : nom anglais + code d'extension officiel + numéro
// imprimé — Cardmarket redirige d'office vers la fiche quand la recherche ne
// laisse qu'un seul produit.
// Préfixe affiché par Cardmarket pour les promos à numéro NU (sans lettres) :
// « Charizard ex (SVP 056) », « Méganium (MEP 001) » — codes relevés sur les
// pages d'extension Cardmarket.
const CM_PROMO_PREFIX = { svp: 'SVP', mep: 'MEP' };
// Les promos à numéro codé (SWSH108, SM241...) s'affichent « code + numéro »
// (« (SWSH 108) », « (HGSS 01) »...) SAUF l'ère DP où Cardmarket renomme le
// code en « DPPR » (« Pingoléon LV.X (DPPR 11) » pour le numéro DP11).
const CM_PROMO_CODE = { dpp: 'DPPR' };
async function cmBestSearchLink(cardId, name, localId) {
  try {
    const en = await fetchEnCard(cardId);
    const pid = en ? await resolvePtcgIdByName(cardId, localId) : null;
    const idx = await fetchGhSetsIndex();
    const ext = pid ? idx.byId.get(pid.split('-')[0]) : null;
    const nm = en?.name || name;
    if (nm) {
      const [setId] = splitCardId(cardId);
      const num = String(localId || '');
      let q;
      if (/^[a-z]/i.test(num)) {
        // promo dont le numéro contient déjà le code (« SWSH108 », « SM241 ») :
        // on requête « code + chiffres » séparés, dans la graphie Cardmarket
        const letters = (num.match(/^[A-Za-z]+/) || [''])[0];
        const digits = num.slice(letters.length);
        q = `${nm} ${CM_PROMO_CODE[setId] || letters} ${digits}`.trim();
      } else if (CM_PROMO_PREFIX[setId]) {
        q = `${nm} ${CM_PROMO_PREFIX[setId]} ${num}`;
      } else if (/promo/i.test(en?.setName || '')) {
        // vieux sets promo à numéros nus (Wizards, Nintendo...) : le numéro
        // seul serait trop ambigu, le nom de set cadre la recherche
        q = `${nm} ${en.setName}`;
      } else {
        const code = ext?.ptcgoCode || en?.setName || '';
        // les codes imprimés modernes sont sur 3 chiffres (« JTG 098 »)
        const padded = (/^\d+$/.test(num) && (ext?.printedTotal || 0) >= 100) ? num.padStart(3, '0') : num;
        q = `${nm} ${code} ${padded}`;
      }
      return cmSearchLink(q.replace(/\s+/g, ' ').trim());
    }
  } catch {}
  return cmSearchLink(name || '');
}
// ── Base locale idProduct → slug Cardmarket (cm-slugs.json) ────────
// Fichier livré avec l'app (~35 000 fiches, toutes les séries
// internationales, construit par scripts/build_cm_slugs.py depuis les pages
// séries publiques de pokecardex). Deux index :
//   byId  : idProduct Cardmarket (fourni par TCGdex) → slug exact ;
//   byNum : « CODE#numéro » (code d'extension + numéro sans zéros) → slug.
// Zéro requête externe, zéro quota : c'est la voie PRIMAIRE de résolution ;
// les résolveurs réseau ne servent plus que pour les sets trop récents.
let _cmSlugsPromise = null;
function fetchCmSlugs() {
  if (!_cmSlugsPromise) {
    _cmSlugsPromise = (async () => {
      if (window.CM_SLUGS) return window.CM_SLUGS;
      // 1) <script src="cm-slugs.js"> : fonctionne dans TOUS les contextes,
      //    y compris l'app ouverte en file:// (où fetch de fichiers locaux
      //    est interdit par le navigateur).
      const viaScript = await new Promise(res => {
        try {
          const s = document.createElement('script');
          s.src = 'cm-slugs.js';
          s.onload = () => res(window.CM_SLUGS || null);
          s.onerror = () => { s.remove(); res(null); };
          document.head.appendChild(s);
        } catch { res(null); }
      });
      if (viaScript) return viaScript;
      // 2) repli fetch du JSON (contexte http classique)
      try {
        const r = await fetch('cm-slugs.json');
        if (r.ok) return await r.json();
      } catch {}
      return null;
    })();
  }
  return _cmSlugsPromise;
}
// Numéro imprimé normalisé pour byNum : majuscules, zéros de tête retirés
// de la partie chiffrée (« 056 » → « 56 », « TG12 » → « TG12 »).
function cmNumKey(x) { return String(x || '').toUpperCase().replace(/^([A-Z]*)0*(\d+)$/, '$1$2'); }
// idProduct Cardmarket d'une carte : cote déjà en cache → fiche FR TCGdex →
// fiche EN (certaines cartes n'ont le mapping Cardmarket que côté anglais).
async function cardCmId(cardId) {
  const p = getCachedRawPrice(cardId);
  if (p?.cmId) return p.cmId;
  try {
    const card = await apiFetch(`/cards/${cardId}`);
    const id = card?.pricing?.cardmarket?.idProduct;
    if (id) return id;
  } catch {}
  try {
    const en = await fetchEnCard(cardId);
    if (en?.cmId) return en.cmId;
  } catch {}
  return null;
}
const cmUrlPromises = {};
// `localOnly` : on s'arrête à la base locale de slugs (étapes 1 à 3, gratuites)
// et on renvoie null au lieu d'attaquer les résolveurs réseau. C'est le mode de
// la SYNCHRO DES COTES : ces résolveurs coûtent ~7 s par carte et passent par
// des proxys sous quota — pour 900 cartes, la synchro n'en finirait pas et se
// ferait rate-limiter. Le clic de l'utilisateur sur un lien CM, lui, garde la
// résolution complète (une carte à la fois, l'attente est justifiée).
function resolveCmUrl(cardId, localOnly) {
  if (_cmUrlStore[cardId]) return Promise.resolve(_cmUrlStore[cardId]);
  const key = localOnly ? cardId + '|local' : cardId;
  if (key in cmUrlPromises) return cmUrlPromises[key];
  return (cmUrlPromises[key] = (async () => {
    let url = null;
    try {
      const [setId, localId] = splitCardId(cardId);
      // 1) slug connu en dur (Collection Classique de Célébrations...)
      const direct = CM_DIRECT_SLUGS[`${setId}#${localId}`];
      if (direct) {
        url = `https://www.cardmarket.com/fr/Pokemon/Products/Singles/${direct}?${CM_FILTERS}`;
        _cmUrlStore[cardId] = url;
        persistCmUrlSoon();
        delete cmUrlPromises[key];
        return url;
      }
      // 2) base locale par code d'extension officiel + numéro imprimé — la
      //    clé la plus PRÉCISE : chaque variante (normale, full art, secrète)
      //    a son propre numéro. L'id pokemontcg.io sert à connaître le code
      //    officiel du set (« SSP », « BLW »...).
      const slugs = await fetchCmSlugs();
      let pid = await resolvePtcgId(setId, localId);
      if (!pid) pid = await resolvePtcgIdByName(cardId, localId);
      if (pid && slugs?.byNum) {
        const idx0 = await fetchGhSetsIndex();
        const ext0 = idx0.byId.get(pid.split('-')[0]);
        const key = ext0?.ptcgoCode ? `${ext0.ptcgoCode}#${cmNumKey(localId)}` : null;
        const slug = key ? slugs.byNum[key] : null;
        if (slug) {
          url = `https://www.cardmarket.com/fr/Pokemon/Products/Singles/${slug}?${CM_FILTERS}`;
          _cmUrlStore[cardId] = url;
          persistCmUrlSoon();
          delete cmUrlPromises[key];
          return url;
        }
      }
      // 3) base locale par idProduct Cardmarket (TCGdex) : couvre les sets
      //    absents du miroir pokemontcg.io et les numéros non mappés.
      //    APRÈS le numéro imprimé, car TCGdex donne parfois le MÊME
      //    idProduct à la version normale et à la secrète (ères BW/XY).
      if (slugs?.byId) {
        const cmId = await cardCmId(cardId);
        const slug = cmId != null ? slugs.byId[String(cmId)] : null;
        if (slug) {
          url = `https://www.cardmarket.com/fr/Pokemon/Products/Singles/${slug}?${CM_FILTERS}`;
          _cmUrlStore[cardId] = url;
          persistCmUrlSoon();
          delete cmUrlPromises[key];
          return url;
        }
      }
      // Fin des voies gratuites : en mode `localOnly` on s'arrête ici.
      if (localOnly) { delete cmUrlPromises[key]; return null; }
      // 4) redirection officielle prices.pokemontcg.io, lue via un résolveur
      //    CORS (dernier recours réseau : sets trop récents pour la base)
      if (pid) {
        const target = `https://prices.pokemontcg.io/cardmarket/${encodeURIComponent(pid)}`;
        const fin = await resolveFinalUrl(target);
        const m = fin && fin.match(/cardmarket\.com\/[a-z]{2}\/(Pokemon\/Products\/Singles\/[^?#]+)/);
        if (m) {
          url = `https://www.cardmarket.com/fr/${m[1]}?${CM_FILTERS}`;
          _cmUrlStore[cardId] = url;
          persistCmUrlSoon();
        } else if (!fin) {
          // Proxys muets (rate-limit...) : impossible de lire la redirection
          // MAINTENANT, mais le lien de redirection officiel reste un accès
          // DIRECT à la fiche quand l'utilisateur clique (302 suivie par SON
          // navigateur, aucun proxy en jeu). On ne le donne que là où la base
          // de redirection est fiable : sets non-promo sortis avant fin 2024
          // (au-delà et sur les promos, elle est trouée → risque de 404).
          // Non persisté : les prochaines sessions retenteront la version
          // /fr/?language=2.
          const idx = await fetchGhSetsIndex();
          const ext = idx.byId.get(pid.split('-')[0]);
          if (ext && !/promo/i.test(ext.name || '') && (ext.releaseDate || '9999') < '2024/12') url = target;
        }
        // fin résolue mais sans fiche CM (404 de la base) → recherche ci-dessous.
      }
      // 5) sets absents de la base de redirection : recherche la plus
      //    discriminante possible (un seul résultat → Cardmarket redirige
      //    lui-même vers la fiche). Non persistée : on retentera la fiche
      //    directe aux prochaines sessions.
      if (!url) url = await cmBestSearchLink(cardId, '', localId);
    } catch {}
    delete cmUrlPromises[key];
    return url;
  })());
}

// ══════════════════════════════════════════════════════════════════
//  PREMIER PRIX CARDMARKET (français · Near Mint) — via le pont local
//  Les cotes des API (TCGdex, pokemontcg.io) sont des MOYENNES toutes
//  langues confondues : en pratique le marché anglais, beaucoup plus gros.
//  D'où l'écart constaté en cliquant le lien CM d'une carte, où la première
//  offre française en Near Mint est parfois très au-dessus (ou en dessous).
//  La seule source de ce prix-là, c'est la liste d'offres de la fiche — et
//  elle est illisible depuis l'app : Cloudflare refuse curl, les empreintes
//  TLS imitées et les proxys CORS publics, et le navigateur interdit de lire
//  une page d'un autre domaine. Un vrai navigateur, lui, passe : c'est le rôle
//  de scripts/cm_price_bridge.py (une fenêtre Brave sur cardmarket.com + un
//  petit serveur local qui répond « premier prix de cette fiche »).
//  Le pont est FACULTATIF : éteint, tout retombe sur la chaîne historique.
// ══════════════════════════════════════════════════════════════════
// Deux écritures du MÊME pont : selon le navigateur et la façon d'ouvrir
// l'app (file://, localhost…), l'une passe là où l'autre est refusée. On
// retient celle qui a répondu. `irondex-cm-bridge` en localStorage force une
// adresse précise (port changé, machine distante).
const CM_BRIDGE_HOSTS = ['http://127.0.0.1:4610', 'http://localhost:4610'];
let _cmBridgeBase = null;
function cmBridgeHosts() {
  let forced = null;
  try { forced = localStorage.getItem('irondex-cm-bridge'); } catch {}
  if (forced) return [forced.replace(/\/+$/, '')];
  return _cmBridgeBase ? [_cmBridgeBase] : CM_BRIDGE_HOSTS;
}
function cmBridgeBase() { return cmBridgeHosts()[0]; }
// État du pont, revalidé au plus toutes les 20 s : une carte cotée en 400 ms
// ne doit pas payer un ping à chaque fois.
let _cmBridge = { at: 0, up: false, ready: false }, _cmBridgePing = null;
const CM_BRIDGE_TTL = 20000;
function cmBridgeUp() { return _cmBridge.up && _cmBridge.ready; }
function pingCmBridge(force) {
  if (!force && Date.now() - _cmBridge.at < CM_BRIDGE_TTL) return Promise.resolve(_cmBridge);
  if (_cmBridgePing) return _cmBridgePing;
  return (_cmBridgePing = (async () => {
    let st = { at: Date.now(), up: false, ready: false };
    for (const base of cmBridgeHosts()) {
      try {
        const r = await fetchTimeout(`${base}/health`, 4000);
        if (!r.ok) continue;
        const d = await r.json();
        _cmBridgeBase = base;
        st = { at: Date.now(), up: true, ready: !!d.ready, needsLogin: !!d.needsLogin, base };
        break;
      } catch {}
    }
    if (!st.up) _cmBridgeBase = null;
    _cmBridge = st; _cmBridgePing = null;
    return st;
  })());
}
// Seules les FICHES produit sont lisibles : une URL de recherche ne désigne
// aucune carte précise, et la redirection prices.pokemontcg.io est sur un
// autre domaine (donc illisible depuis la page cardmarket.com du pont).
const CM_PRODUCT_RE = /cardmarket\.com\/[a-z]{2}\/Pokemon\/Products\/Singles\//;
// Le premier prix de la fiche, ou null : pont éteint, slug non résolu, fiche
// inexistante, ou aucune offre française en Near Mint. Ne lève jamais —
// l'appelant enchaîne sur les moyennes.
async function cmFirstPrice(cardId) {
  if (!cmBridgeUp()) return null;
  let url = null;
  try { url = await resolveCmUrl(cardId, true); } catch {}
  if (!url || !CM_PRODUCT_RE.test(url)) return null;
  try {
    const r = await fetchTimeout(`${cmBridgeBase()}/price?url=${encodeURIComponent(url)}`, 45000);
    if (!r.ok) return null;
    const d = await r.json();
    if (d && typeof d.price === 'number' && d.price > 0) return Object.assign({ cmUrl: url }, d);
  } catch {
    // Pont coupé en pleine synchro : on l'éteint tout de suite, sinon les
    // centaines de cartes suivantes attendraient chacune leur timeout.
    _cmBridge = { at: Date.now(), up: false, ready: false };
  }
  return null;
}

const priceCache = {};      // résultat résolu : { raw, currency, src, cmId? } | null
const pricePromises = {};   // requêtes en cours (dédoublonnage)
// ── Cotes ENREGISTRÉES (une seule source de vérité, hors ligne) ────
// Les cotes ne sont plus rechargées « toutes seules » : elles sont
// ENREGISTRÉES sur le disque et relues au démarrage, donc la valeur du coffre,
// des wishlists et du portefeuille s'affiche INSTANTANÉMENT à l'ouverture,
// même hors ligne. Elles ne changent que sur demande explicite : le bouton de
// la carte elle-même (voir syncCardPrice) — une carte, une seconde.
// Les cartes qui n'ont AUCUNE valeur (tout juste ajoutées, ou première
// ouverture) sont cotées à la volée en arrière-plan (ensurePrices) : jamais de
// trou dans les totaux, et jamais de recalcul de ce qui est déjà là.
// v7 : la cote de référence n'est plus une moyenne d'API mais le PREMIER PRIX
// de la fiche Cardmarket en français / Near Mint (voir cmFirstPrice). Nouvelle
// clé, mais l'ancienne est REPRISE : le coffre garde une valeur à l'ouverture,
// et le premier « Sync » (pont allumé) remplace chaque cote par le vrai prix FR.
const PRICE_CACHE_KEY = 'pkm_prices_v7';       // { syncedAt, prices }
const LEGACY_PRICE_KEYS = ['pkm_prices_v6', 'pkm_price_cache_v4'];
let _priceSyncedAt = 0, _priceSaveTimer = null;
function loadPriceCache() {
  const read = key => { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; } };
  let d = read(PRICE_CACHE_KEY);
  // Reprise des anciennes clés : l'utilisateur ne repart jamais de zéro.
  if (!d) for (const k of LEGACY_PRICE_KEYS) { const o = read(k); if (o && o.prices) { d = o; break; } }
  if (!d) return;
  const prices = d.prices || {};
  for (const k in prices) if (prices[k] && typeof prices[k] === 'object') priceCache[k] = prices[k];
  _priceSyncedAt = Number(d.syncedAt || d.ts) || 0;
}
// Cotes à écrire sur le disque. Les échecs (null) ne sont JAMAIS persistés :
// un « non coté » dû à une panne réseau retentera sa chance au lieu de rester
// figé. Pendant une synchro, les cartes pas encore recotées gardent leur
// ANCIENNE valeur sur le disque (_priceWriteHold) : la synchro est donc
// atomique — fermer l'onglet en plein milieu ne perd rien.
let _priceWriteHold = null;
function priceDiskSnapshot() {
  const out = {};
  for (const k in priceCache) if (priceCache[k]) out[k] = priceCache[k];
  if (_priceWriteHold) for (const k in _priceWriteHold) if (!out[k]) out[k] = _priceWriteHold[k];
  return out;
}
let _priceWriteWarned = false;
function writePriceCache() {
  markPagerStale();          // une cote a bougé : les totaux des pages voisines aussi
  try {
    localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify({ syncedAt: _priceSyncedAt, prices: priceDiskSnapshot() }));
    return true;
  } catch (e) {
    // Quota plein : les cotes resteraient valables pour la session mais
    // repartiraient de zéro au prochain lancement. On le DIT une seule fois,
    // plutôt que d'échouer en silence.
    console.warn('cotes non enregistrées', e);
    if (!_priceWriteWarned) { _priceWriteWarned = true; try { toast('Cotes non enregistrées (stockage plein)', 'error'); } catch {} }
    return false;
  }
}
// Écriture débouncée (fusionne les rafales de cotes qui arrivent).
function savePriceCache() {
  if (_priceSaveTimer) return;
  _priceSaveTimer = setTimeout(() => { _priceSaveTimer = null; writePriceCache(); }, 1200);
}
// Écriture IMMÉDIATE (fin de synchro, fermeture de l'onglet) — pas de debounce.
function flushPriceCache() {
  if (_priceSaveTimer) { clearTimeout(_priceSaveTimer); _priceSaveTimer = null; }
  return writePriceCache();
}
function priceSyncedAt() { return _priceSyncedAt; }
// « il y a 2 h », « à l'instant »… pour l'étiquette de dernière synchro.
function agoLabel(ts) {
  if (!ts) return 'jamais synchronisées';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 90) return 'à l\u2019instant';
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  return j <= 1 ? 'hier' : `il y a ${j} jours`;
}
const _priceNullAt = {};   // heure du dernier échec → nouvel essai après 2 min
function getRawPrice(cardId) {
  if (cardId in priceCache) {
    const v = priceCache[cardId];
    if (v || Date.now() - (_priceNullAt[cardId] || 0) < 120000) return Promise.resolve(v);
    delete priceCache[cardId];   // échec datant : on retente
  }
  if (cardId in pricePromises) return pricePromises[cardId];
  const promise = (async () => {
    let res = null;
    let tcgEur = null;      // cote TCGplayer de la même carte, convertie (arbitre)
    const finish = r => {
      priceCache[cardId] = r;
      if (!r) _priceNullAt[cardId] = Date.now();
      delete pricePromises[cardId];
      savePriceCache();
      return r;
    };
    // 0) PREMIER PRIX CARDMARKET, en français et en Near Mint — la cote de
    //    référence : c'est le montant qu'affiche la fiche quand on clique le
    //    lien CM de la carte, donc ce que coûte VRAIMENT l'exemplaire français.
    //    Elle passe devant tout le reste, y compris les moyennes cohérentes :
    //    une moyenne toutes langues n'est pas une erreur, c'est juste un AUTRE
    //    marché (l'anglais). Demande le pont local ; sans lui, on enchaîne sur
    //    la chaîne historique (moyennes + garde-fous d'appariement).
    //    GARDE-FOU : le slug d'une fiche désigne parfois un AUTRE produit que
    //    la carte demandée (mesuré : « Dracaufeu-GX » de Destinées Occultes
    //    renvoie sur la version Shiny Vault, 420 € au lieu de ~9 €). On ne
    //    compare PAS au marché anglais — s'en écarter est justement le but —
    //    mais un premier prix français 6 fois au-dessus de TCGplayer avec plus
    //    de 40 € d'écart ne décrit plus la même carte : on laisse alors la
    //    chaîne historique et ses arbitrages décider.
    const [first, cardT] = await Promise.all([
      cmFirstPrice(cardId),
      apiFetch(`/cards/${cardId}`).catch(() => null),   // mis en cache : l'étape 1 ne le repaie pas
    ]);
    if (first) {
      const tcgUsd0 = bestTCG(cardT?.pricing?.tcgplayer);
      const tcgEur0 = tcgUsd0 != null ? tcgUsd0 * await usdToEur() : null;
      const wrongProduct = tcgEur0 != null && first.price > tcgEur0 * 6 && first.price - tcgEur0 > 40;
      if (!wrongProduct) return finish({
        raw: first.price, currency: 'EUR', src: 'cm-first',
        cond: first.cond || null, lang: first.lang || null,
        offers: first.offers || null, cmUrl: first.cmUrl || null,
      });
      console.warn('premier prix CM écarté (fiche douteuse)', cardId, first.price, '€ vs TCGplayer', Math.round(tcgEur0), '€ —', first.cmUrl);
    }
    // 1) Cardmarket via TCGdex — la référence du marché européen (cote robuste,
    //    voir bestCM). idProduct permet le lien direct vers la fiche Cardmarket.
    try {
      const card = await apiFetch(`/cards/${cardId}`);
      const cm = card.pricing?.cardmarket;
      const raw = bestCM(cm);
      const tcgUsd = bestTCG(card.pricing?.tcgplayer);
      if (tcgUsd != null) tcgEur = tcgUsd * await usdToEur();
      const doubt = cmMappingSuspect(cm, raw, tcgEur);
      if (raw != null && !doubt) {
        res = { raw, currency: 'EUR', src: 'cardmarket', cmId: cm?.idProduct || null };
      } else if (raw != null) {
        // APPARIEMENT DOUTEUX : on demande un SECOND AVIS sur le même marché
        // (pokemontcg.io a son propre mapping Cardmarket, souvent le bon), et
        // à défaut on prend TCGplayer. On ne garde la valeur suspecte que si
        // rien d'autre n'existe — mais on la marque, elle reste discutable.
        const [setId, localId] = splitCardId(cardId);
        const p = await fetchPtcgCard(setId, localId).catch(() => null);
        const second = bestPtcgCM(p?.cardmarket?.prices);
        if (second != null) res = { raw: second, currency: 'EUR', src: 'ptcg', doubtCM: doubt };
        else if (tcgEur != null) res = { raw: tcgEur, currency: 'EUR', src: 'tcgplayer', doubtCM: doubt };
        else res = { raw, currency: 'EUR', src: 'cardmarket', cmId: cm?.idProduct || null, doubtCM: doubt };
      }
    } catch {}
    // 2) Fiche ANGLAISE TCGdex : certaines cartes n'ont de mapping Cardmarket
    //    que côté EN — même produit, même cote en euros.
    if (!res) {
      const en = await fetchEnCard(cardId).catch(() => null);
      if (en?.cm != null) res = { raw: en.cm, currency: 'EUR', src: 'cardmarket', cmId: en.cmId || null };
    }
    // 3) Repli pokemontcg.io : cartes sans cote TCGdex (promos SM & spéciales)
    if (!res) {
      const [setId, localId] = splitCardId(cardId);
      const p = await fetchPtcgCard(setId, localId);
      const raw = bestPtcgCM(p?.cardmarket?.prices);
      if (raw != null) res = { raw, currency: 'EUR', src: 'ptcg' };
    }
    // 4) Dernier recours : ventes eBay réelles (PriceCharting, USD→EUR) —
    //    couvre les cartes que Cardmarket ne cote pas du tout. Plafonné :
    //    voir EBAY_TRUST_MAX, son appariement peut désigner un autre produit.
    if (!res) {
      const sold = await fetchSoldPrices(cardId).catch(() => null);
      if (sold?.loose != null && sold.loose <= EBAY_TRUST_MAX) {
        res = { raw: sold.loose, currency: 'EUR', src: 'ebay' };
      }
    }
    return finish(res);
  })();
  pricePromises[cardId] = promise;
  return promise;
}
// Cote déjà en cache (préchargée) : { raw, ... } | null si non coté | undefined si pas encore chargée
function getCachedRawPrice(cardId) { return (cardId in priceCache) ? priceCache[cardId] : undefined; }

// Pool de concurrence pour ne pas ouvrir des centaines de requêtes d'un coup
async function runPool(items, worker, concurrency = 8) {
  let i = 0;
  const next = async () => { while (i < items.length) { const idx = i++; try { await worker(items[idx]); } catch {} } };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length || 1) }, next));
}

// ══════════════════════════════════════════════════════════════════
//  CARTES SUIVIES — l'inventaire complet des cartes « sélectionnées »
//  dans l'app : wishlists, classeurs, cases Milobellus cochées, cartes
//  du portefeuille, et la pièce maîtresse choisie à la main. C'est cette
//  liste que la synchro des cotes parcourt, et celle qui alimente la
//  valeur affichée sur l'accueil.
// ══════════════════════════════════════════════════════════════════
// Tous les identifiants de carte présents dans l'app (dédoublonnés).
function trackedCardIds() {
  const ids = new Set();
  const add = id => { if (id) ids.add(String(id)); };
  (state.wishlists || []).forEach(w => (w.cards || []).forEach(c => c && add(c.id)));
  (state.binders || []).forEach(b => (b.cards || []).forEach(c => c && add(c.id)));
  (state.investCards || []).forEach(p => add(p.cardId));
  // Milobellus : la clé d'une case est « cardId » ou « cardId::reverse ».
  Object.keys(state.milobellus || {}).forEach(k => { if (state.milobellus[k]) add(String(k).split('::')[0]); });
  if (state.heroRef && state.heroRef.type === 'loose') add(state.heroRef.cardId || state.heroRef.id);
  return [...ids];
}
// Cartes POSSÉDÉES, avec leur quantité et de quoi les afficher.
// Dédoublonnage : une même carte présente dans un classeur ET dans le
// portefeuille n'est comptée qu'une fois (quantité = le maximum des deux
// sources, jamais leur somme → aucun double comptage de valeur).
function ownedCardEntries() {
  const meta = new Map();      // cardId → { id, name, image, setId, setName, localId }
  const perSource = new Map(); // cardId → { collec, invest }
  const bump = (src, id, n) => {
    if (!id) return;
    const cur = perSource.get(id) || { collec: 0, invest: 0 };
    cur[src] += n;
    perSource.set(id, cur);
  };
  const remember = (id, o) => {
    if (!id || !o) return;
    const cur = meta.get(id) || { id };
    for (const k of ['name', 'image', 'setId', 'setName', 'localId']) if (!cur[k] && o[k]) cur[k] = o[k];
    meta.set(id, cur);
  };
  (state.binders || []).forEach(b => (b.cards || []).forEach(c => { if (c && c.id) { bump('collec', c.id, 1); remember(c.id, c); } }));
  (state.wishlists || []).forEach(w => (w.cards || []).forEach(c => { if (c && c.id && c.owned) { bump('collec', c.id, 1); remember(c.id, c); } }));
  // Milobellus : chaque case cochée = un exemplaire (normale et reverse sont
  // deux cases distinctes de la même carte, donc deux exemplaires).
  const slotByKey = new Map((_miloSlots || []).map(sl => [sl.key, sl]));
  Object.keys(state.milobellus || {}).forEach(k => {
    if (!state.milobellus[k]) return;
    const id = String(k).split('::')[0];
    bump('collec', id, 1);
    const sl = slotByKey.get(k);
    if (sl) remember(id, { name: sl.name, image: sl.image, setId: sl.setId, setName: sl.setName, localId: sl.localId });
  });
  (state.investCards || []).forEach(p => {
    if (!p.cardId) return;
    bump('invest', p.cardId, Math.max(1, Number(p.qty) || 1));
    remember(p.cardId, { name: p.name, image: p.image, setId: p.setId, setName: p.setName, localId: p.localId });
  });
  const out = [];
  for (const [id, q] of perSource) {
    const qty = Math.max(q.collec, q.invest, 1);
    const m = meta.get(id) || { id };
    const r = getCachedRawPrice(id);
    const unit = (r && r.raw != null) ? r.raw : null;
    out.push({ id, name: m.name || id, image: m.image || '', setId: m.setId || '', setName: m.setName || '', localId: m.localId || '', qty, unit, value: unit == null ? 0 : unit * qty });
  }
  out.sort((a, b) => b.value - a.value || String(a.name).localeCompare(String(b.name)));
  return out;
}
// Cote les cartes dont on n'a AUCUNE valeur enregistrée (nouvelles cartes
// ajoutées depuis la dernière synchro, ou toute la collection à la première
// ouverture), en arrière-plan et sans jamais bloquer l'UI.
// onDone(nbCotées, terminé) est rappelé PAR PALIERS pendant les gros
// chargements : la valeur affichée monte au fil de l'eau au lieu de sauter
// d'un coup à la fin. Il doit donc rester idempotent (simple repeinture).
function ensurePrices(ids, onDone) {
  const missing = [...new Set(ids)].filter(id => id && !(id in priceCache));
  if (!missing.length) { if (onDone) onDone(0, true); return; }
  let done = 0, tick = 0;
  runPool(missing, async id => {
    await getRawPrice(id).catch(() => {});
    done++;
    if (done - tick >= 25) { tick = done; if (onDone) onDone(done, false); }
  }, 5).then(() => {
    savePriceCache();
    if (onDone) onDone(done, true);
  });
}

// ══════════════════════════════════════════════════════════════════
//  RÉPARATION DES IDENTIFIANTS DE CARTE
//  Symptôme : des cartes sans AUCUNE cote, quoi qu'on synchronise. Mesuré sur
//  les 66 cartes « Galerie de Dresseurs » de Tempête Argentée : elles portaient
//  `cardId: swsh12.5tg-TG02` (la galerie de Zénith Suprême) alors que leur set
//  est `swsh12`. Or `swsh12.5tg` est un set FANTÔME : l'API répond, mais il
//  contient zéro carte. La cote cherchait donc dans le vide — et aucun nombre
//  de synchros n'y changeait quoi que ce soit.
//  Ces identifiants viennent de l'import script d'août (cartes en `k000xx`), pas
//  du code actuel : c'est la DONNÉE qu'il faut réparer, une fois.
//  Méthode : pour chaque carte dont le `cardId` ne colle ni à son set ni à une
//  de ses sous-séries (tg/gg/sv), on recharge le set et ses sous-séries et on
//  retrouve la carte par son NUMÉRO IMPRIMÉ — la seule donnée fiable ici.
// ══════════════════════════════════════════════════════════════════
const CARD_SUBSETS = ['', 'tg', 'gg', 'sv'];
function cardIdLooksWrong(p) {
  if (!p || !p.setId || !p.localId || String(p.setId).startsWith('?')) return false;
  if (!p.cardId) return true;
  const id = String(p.cardId), cut = id.lastIndexOf('-');
  if (cut < 1) return true;
  const setPart = id.slice(0, cut);           // « swsh12.5tg » et non « swsh12 »
  return !CARD_SUBSETS.some(suf => setPart === p.setId + suf);
}
async function repairInvestCardIds() {
  const suspects = (state.investCards || []).filter(cardIdLooksWrong);
  if (!suspects.length) return 0;
  const bySet = {};
  for (const p of suspects) (bySet[p.setId] = bySet[p.setId] || []).push(p);
  let fixed = 0;
  for (const setId of Object.keys(bySet)) {
    const byLocal = new Map();
    for (const suf of CARD_SUBSETS) {
      const sid = setId + suf;
      const set = await apiFetch(`/sets/${sid}`).catch(() => null);
      for (const c of (set?.cards || [])) {
        const k = cardLocalKey(c.localId);
        // Le set de base d'abord : en cas de numéro identique, la carte
        // « normale » gagne sur celle d'une sous-série.
        if (!byLocal.has(k)) byLocal.set(k, { id: c.id, setId: sid, setName: set.name || '', image: c.image || '' });
      }
    }
    for (const p of bySet[setId]) {
      const hit = byLocal.get(cardLocalKey(p.localId));
      if (!hit || hit.id === p.cardId) continue;
      p.cardId = hit.id;
      p.setId = hit.setId;
      if (hit.setName) p.setName = hit.setName;
      if (!p.image && hit.image) p.image = hit.image;
      fixed++;
    }
  }
  if (fixed) { save(); investBadge(); }
  return fixed;
}

// ══════════════════════════════════════════════════════════════════
//  LA COTE SE REFAIT CARTE PAR CARTE
//
//  Il y avait un bouton « Sync » global (en-tête + accueil) qui recotait les
//  1 400 cartes de l'app d'un seul clic. Deux problèmes, et c'est pour ça
//  qu'il n'existe plus :
//   · il REFAISAIT tout un travail déjà juste. La plupart des cotes sont
//     bonnes ; les repayer coûtait ~20 minutes de fiches Cardmarket, une par
//     seconde, pour arriver au même montant.
//   · il ne réglait pas le seul cas qui compte : LA carte dont la cote est
//     fausse (fiche mal appariée, offre disparue). On relançait tout et elle
//     restait fausse.
//  Chaque tuile de carte porte donc son propre bouton : une carte, une
//  seconde, et on VOIT d'où vient le montant obtenu.
//
//  Ce qui reste global — et qui n'est pas un recalcul mais un TRANSFERT :
//  récupérer les cotes que le dépôt contient déjà. C'est le geste utile sur
//  l'iPhone, qui n'a pas de pont Cardmarket : les cotes sont calculées sur la
//  machine qui l'a, et voyagent par le dépôt.
// ══════════════════════════════════════════════════════════════════
async function pullPricesFromRepo() {
  if (!ghCfg().owner) { toast('Coffre en ligne non configuré sur cet appareil', 'error'); return; }
  const got = await ghPullPrices().catch(() => 0);
  if (!got) { toast('Le dépôt n’a pas de cotes plus récentes', 'error'); return; }
  refreshSyncMeta();
  window._vaultCounted = false;
  window._investCountedCards = false;
  renderViewContent(state.view);
  toast(`${got.toLocaleString('fr-FR')} cotes récupérées depuis le dépôt`, 'success');
}

// Recote UNE carte. Tout ce qui la concerne est purgé — la cote, l'échec
// mémorisé, la requête en vol ET le lien Cardmarket : une cote cassée vient
// presque toujours d'une fiche mal appariée, et garder l'ancien slug aurait
// redonné le même mauvais montant.
// Renvoie la cote obtenue, ou null. Dans ce cas la valeur d'avant est REMISE :
// une recote qui échoue ne détruit jamais une valeur acquise (sinon un simple
// hoquet réseau ferait tomber la carte à « — »).
async function recoteCard(cardId) {
  const before = priceCache[cardId] || null;
  // Le pont décide de la source : premier prix FR / Near Mint s'il tourne,
  // moyennes sinon. On le DIT ensuite — jamais de montant dont on ne sait pas
  // d'où il vient.
  await pingCmBridge(true).catch(() => {});
  delete priceCache[cardId];
  delete _priceNullAt[cardId];
  delete pricePromises[cardId];
  delete _cmUrlStore[cardId];
  let r = null;
  try { r = await getRawPrice(cardId); } catch (e) { console.warn('recote', cardId, e); }
  if (r && r.raw != null) {
    _priceSyncedAt = Date.now();
    flushPriceCache();      // écriture immédiate : la cote survit à un refresh
    ghPushSoon('prices');   // …et les autres appareils la verront
    return r;
  }
  if (before) priceCache[cardId] = before;
  delete _priceNullAt[cardId];
  return null;
}
// D'où vient ce montant, en trois mots.
function coteSourceLabel(r) {
  if (!r) return '';
  switch (r.src) {
    case 'cm-first': return `premier prix FR${r.cond ? ' · ' + r.cond : ''}`;
    case 'cardmarket': case 'ptcg': return 'moyenne Cardmarket';
    case 'tcgplayer': return 'TCGplayer converti';
    case 'ebay': return 'ventes eBay';
    default: return 'cote';
  }
}
// Le bouton de la tuile du portefeuille.
const _cardSyncing = new Set();
async function syncCardPrice(id, ev) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  const p = (state.investCards || []).find(x => x.id === id);
  if (!p || _cardSyncing.has(id)) return;
  if (!p.cardId) { toast('Carte sans identifiant : retire-la et rajoute-la depuis le catalogue', 'error'); return; }
  _cardSyncing.add(id);
  const tile = document.querySelector(`.cardtile[data-id="${id}"]`);
  const btn = tile ? tile.querySelector('.cardtile-sync') : null;
  if (btn) { btn.classList.add('spinning'); btn.disabled = true; }
  const coteEl = document.getElementById('cote-' + id);
  const had = !!priceCache[p.cardId];
  if (coteEl) coteEl.innerHTML = '<span class="cote-wait">cote…</span>';
  try {
    const r = await recoteCard(p.cardId);
    if (r) toast(`${p.name} · ${fmt(r.raw)} (${coteSourceLabel(r)})`, 'success');
    else toast(cmBridgeUp()
      ? `Aucune offre trouvée pour ${p.name}${had ? ' — valeur précédente conservée' : ''}`
      : `Cote introuvable pour ${p.name}. Sans le pont Cardmarket (cm_price_bridge.py) on ne lit que des moyennes.`, 'error');
    // Le lien Cardmarket de la tuile suit la fiche qu'on vient de retrouver.
    const href = (r && r.cmUrl) || await resolveCmUrl(p.cardId).catch(() => null);
    const a = document.getElementById('cm-' + id);
    if (a && href) a.href = href;
  } finally {
    _cardSyncing.delete(id);
    if (btn) { btn.classList.remove('spinning'); btn.disabled = false; }
    // Mise à jour EN PLACE : cote, total de la ligne, plus-value, compteurs.
    // Aucune tuile reconstruite → pas de saut de défilement, pas d'animation
    // rejouée, et la carte reste sous le doigt.
    refreshCardTile(p);
    refreshInvestTotals();
  }
}
// Le même geste depuis la FICHE d'une carte — c'est le seul endroit où passent
// TOUTES les cartes de l'app (wishlists, classeurs, Milobellus, accueil), et
// donc le seul moyen de recoter celles qui ne sont pas au portefeuille.
async function syncDetailPrice(cardId, ev) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  if (_cardSyncing.has(cardId)) return;
  _cardSyncing.add(cardId);
  const btn = document.getElementById('cd-sync');
  const val = document.getElementById('cd-raw');
  const note = document.getElementById('cd-note');
  if (btn) { btn.classList.add('spinning'); btn.disabled = true; }
  if (val) val.innerHTML = '<span class="cv-skeleton" style="display:inline-block;width:74px;height:1em"></span>';
  try {
    const r = await recoteCard(cardId);
    if (val && val.isConnected) val.textContent = fmt(r ? r.raw : (getCachedRawPrice(cardId)?.raw ?? null));
    if (note && note.isConnected) note.textContent = r ? coteSourceLabel(r) : 'Aucune cote disponible';
    const href = (r && r.cmUrl) || await resolveCmUrl(cardId).catch(() => null);
    const a = document.getElementById('cd-cm');
    if (a && href && a.isConnected) a.href = href;
    if (r) toast(`Cote refaite · ${fmt(r.raw)} (${coteSourceLabel(r)})`, 'success');
    else toast('Aucune cote trouvée pour cette carte', 'error');
    // La valeur du coffre et les tuiles visibles suivent.
    window._vaultCounted = false;
    if (state.view === 'invest') { refreshInvestTotals(); const p = (state.investCards || []).find(x => x.cardId === cardId); if (p) refreshCardTile(p); }
  } finally {
    _cardSyncing.delete(cardId);
    if (btn) { btn.classList.remove('spinning'); btn.disabled = false; }
  }
}
// Compteurs du portefeuille (valeur des cartes, en-tête de la série ouverte)
// remis à jour sans reconstruire la vue.
function refreshInvestTotals() {
  const v = document.getElementById('inv-kpi-value'); if (v) v.textContent = fmt(cardsTotalValue());
  const head = document.querySelector('.cardser-detail-meta');
  const bar = document.querySelector('.cardser-bar-meta');
  if (!state.investSeriesOpen || (!head && !bar)) return;
  const g = cardsGrouped().find(x => String(x.setId) === String(state.investSeriesOpen));
  if (!g) return;
  if (head) head.textContent = `${g.count} carte${g.count > 1 ? 's' : ''} · ${fmt(g.value)}`;
  if (bar) bar.textContent = `${g.count} · ${fmt(g.value)}`;
}

// Précharge TOUT ce dont l'app a besoin (modèles 3D, puis les cotes encore
// inconnues) et rapporte la progression réelle (0→1). Chaque tâche a un délai
// de sécurité pour ne jamais bloquer le loader.
function preloadEverything(onProgress) {
  // Sur téléphone il n'y a AUCUN modèle à attendre : la barre part directement
  // à 100 % au lieu de faire patienter sur 9 Mo qui ne seront pas affichés.
  const phone = isPhone();
  const total = phone ? 1 : 2;
  let done = 0;
  const bump = () => { done++; if (onProgress) onProgress(done / total); };
  const withTimeout = (p, ms) => Promise.race([Promise.resolve(p).catch(() => {}), new Promise(r => setTimeout(r, ms))]);
  const modelJobs = phone ? [Promise.resolve().then(bump)] : [
    withTimeout(loadModelSource('milotic', window.MILOTIC_GLB_BASE64, 'milotic.glb'), 15000).then(bump),
    withTimeout(loadModelSource('giratina', window.GIRATINA_GLB_BASE64, 'giratina.glb'), 15000).then(bump),
  ];
  // Les cotes ENREGISTRÉES s'affichent déjà : on ne demande au réseau que
  // celles qu'on n'a jamais eues, en arrière-plan, puis on met à jour EN
  // PLACE (aucun re-render, donc aucune animation rejouée).
  const ids = trackedCardIds();
  ensurePrices(ids, (n, finished) => {
    if (!n) return;
    // La toute première ouverture vaut une synchro : on horodate à la fin du
    // chargement complet, pas au premier palier.
    if (finished && !_priceSyncedAt) { _priceSyncedAt = Date.now(); flushPriceCache(); }
    if (state.view === 'home') { computeCollectionValue(); fillWishlistRemaining(state.wishlists); refreshSyncMeta(); }
  });
  return Promise.all(modelJobs);
}
function fmt(v) {
  if (v == null) return '—';
  if (v >= 1000) return Math.round(v).toLocaleString('fr-FR') + ' €';
  if (v >= 100) return Math.round(v) + ' €';
  return v.toFixed(2).replace('.', ',') + ' €';
}
// Compteur animé (count-up ease-out-quart) — le moment premium sur les grandes
// valeurs (coffre, portefeuille). Respecte prefers-reduced-motion.
function animateCount(el, to, dur = 1000) {
  if (!el) return;
  const done = () => { el.textContent = to > 0 ? fmt(to) : '0 €'; };
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Valeur finale immédiate si mouvement réduit, valeur nulle, ou onglet caché
  // (rAF gelé en arrière-plan / rendu headless : on ne laisse jamais « 0 € »).
  if (reduce || !(to > 0) || document.hidden) { done(); return; }
  const fmtInt = v => Math.round(v).toLocaleString('fr-FR') + ' €';
  const start = performance.now();
  const ease = t => 1 - Math.pow(1 - t, 4);
  const safety = setTimeout(done, dur + 150); // garantit la valeur finale même si rAF ne progresse pas
  (function tick(now) {
    const p = Math.min(1, (now - start) / dur);
    el.textContent = fmtInt(to * ease(p));
    if (p < 1) requestAnimationFrame(tick);
    else { clearTimeout(safety); done(); }
  })(start);
}
function ebaySoldLink(q) { return `https://www.ebay.fr/sch/i.html?_nkw=${encodeURIComponent(q)}&LH_Sold=1&LH_Complete=1`; }
// « 4/102 », « 025/193 », ou juste « SM241 » pour les promos sans total officiel
// — le format que les vendeurs mettent dans leurs titres d'annonce.
function cardNumStr(localId, official) {
  if (!localId) return '';
  return official ? `${localId}/${official}` : String(localId);
}


/* ════════════════════════════════════════════════════════════════
   MOTION — les moteurs partagés de l'interface « Vault »
   Trois briques, chacune déléguée au document (aucun écouteur à
   rebrancher à chaque rendu) et chacune neutralisée sous
   prefers-reduced-motion.
   ════════════════════════════════════════════════════════════════ */
function motionReduced() {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

// ── 1. SPOTLIGHT ────────────────────────────────────────────────
// La lumière suit le curseur sur les surfaces sombres. Port vanilla du
// composant framer-motion `<Spotlight>` : même modèle de ressort AMORTI
// (bounce 0 → aucun dépassement, cohérent avec la charte « pas de rebond »),
// mais sans React et sans dépendance.
//   x' = x + (cible - x) * k   → intégré une fois par frame, en rAF partagé.
// Une seule boucle pour TOUS les spotlights de la page, et elle s'arrête
// dès que plus rien ne bouge (aucun rAF qui tourne dans le vide).
/* ── SPOTLIGHT AU CURSEUR : RETIRÉ (2026-08-24) ─────────────────────────
   Une nappe lumineuse suivait le pointeur sur chaque surface. Ce que ça
   coûtait : un écouteur `pointermove` par surface, une boucle rAF amortie qui
   tournait tant que la nappe rattrapait le curseur, et un calque composé
   (`.spot-light`) sur CHAQUE `.spot` — donc des dizaines de calques, plus un
   `overflow:hidden` imposé partout pour les contenir. Ce que ça apportait :
   un reflet que l'œil ne remarque pas. Retiré sur demande : le survol se lit
   déjà au relief des boutons et à la bordure des cartes.
   La classe `.spot` reste dans le markup (elle porte `position:relative` et
   `z-index:0`, dont dépendent les calques décoratifs et le liquid glass) mais
   plus rien ne s'y accroche.
   `attachSpotlights` est conservée comme fonction NEUTRE : elle est appelée
   depuis six endroits, y compris des chemins de rendu partiels. */
function attachSpotlights() { /* volontairement vide — voir la note ci-dessus */ }

// ── 2. RÉVÉLATION AU SCROLL ─────────────────────────────────────
// Les sections montent en entrant dans le champ. Un seul observer pour
// toute la page ; chaque élément n'est révélé QU'UNE FOIS (pas de
// va-et-vient au scroll, qui donne le tournis).
let _revealObs = null;
function attachReveals(root = document) {
  const els = root.querySelectorAll('.reveal:not([data-rv])');
  if (!els.length) return;
  // TÉLÉPHONE : révélation IMMÉDIATE, pas au défilement. Les pages du carrousel
  // sont garnies alors qu'elles sont HORS de l'écran : leurs `.reveal`
  // n'intersectaient donc jamais rien et restaient à opacity 0 — on glissait
  // vers une page vide qui se remplissait après coup. Un observateur par page
  // masquée, c'est aussi du travail pour un effet qu'on ne voit pas.
  if (motionReduced() || isPhone()) { els.forEach(el => { el.dataset.rv = '1'; el.classList.add('in'); }); return; }
  if (!_revealObs) {
    _revealObs = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('in');
        _revealObs.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
  }
  els.forEach(el => { el.dataset.rv = '1'; _revealObs.observe(el); });
  // FILET DE SÉCURITÉ : dans un contexte où l'observer ne peut pas se
  // déclencher (viewport dégénéré, onglet d'arrière-plan, rendu headless),
  // du contenu resterait invisible pour toujours. On le révèle donc d'office
  // au bout d'un délai — l'information passe avant l'effet.
  setTimeout(() => els.forEach(el => {
    if (el.isConnected && !el.classList.contains('in')) el.classList.add('in');
  }), 1400);
}

// ── 3. SCÈNE SPLINE (optionnelle) ───────────────────────────────
// Équivalent vanilla du composant <SplineScene> : le runtime Spline est
// chargé À LA DEMANDE (import ESM dynamique) et seulement si une scène est
// configurée. Par défaut MiloDex n'en utilise pas — sa 3D est locale
// (Three.js + les vrais scans de cartes), donc disponible hors ligne et
// sans dépendre d'un CDN tiers. Renseigner window.MILO_SPLINE_SCENE avec
// une URL .splinecode suffit à l'activer.
const SPLINE_RUNTIME = 'https://unpkg.com/@splinetool/runtime@1.9.28/build/runtime.js';
let _splineApp = null;
async function mountSplineScene(canvas, sceneUrl) {
  if (!canvas || !sceneUrl) return null;
  try {
    const { Application } = await import(/* @vite-ignore */ SPLINE_RUNTIME);
    _splineApp = new Application(canvas);
    await _splineApp.load(sceneUrl);
    canvas.dataset.spline = 'ready';
    return _splineApp;
  } catch (e) {
    // Hors ligne / CDN bloqué : on n'affiche pas de canvas mort, la 3D
    // locale reste la scène par défaut.
    console.warn('Spline indisponible, on garde la scène locale', e);
    canvas.remove();
    return null;
  }
}

/* ════════════════════════════════════════════════════════════════
   PALETTE DE COMMANDES (⌘K)
   L'accélérateur du site : sauter à une vue, retrouver N'IMPORTE QUELLE
   carte de la collection (wishlists, classeurs, portefeuille) et l'ouvrir,
   ou lancer une action globale. Entièrement pilotable au clavier.
   ════════════════════════════════════════════════════════════════ */
let _palIdx = 0, _palRows = [], _palPrevFocus = null;

// Normalise pour une recherche tolérante (accents, casse, ponctuation).
function palNorm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
// Actions globales toujours proposées.
function palCommands() {
  return [
    { kind: 'nav', name: 'Le Coffre', sub: 'Valeur, pièce maîtresse', ico: ICO.vault, run: () => navigate('home') },
    { kind: 'nav', name: 'Wishlists', sub: `${state.wishlists.length} liste${state.wishlists.length > 1 ? 's' : ''}`, ico: ICO.heart, run: () => navigate('wishlists') },
    { kind: 'nav', name: 'Portefeuille', sub: `${state.sealed.length} scellés · ${state.investCards.length} cartes`, ico: ICO.chart, run: () => navigate('invest') },
    // Les classeurs ne sont pas atteignables sur téléphone : la commande non plus.
    ...(isPhone() ? [] : [{ kind: 'nav', name: 'Classeurs', sub: 'Binders feuilletables en 3D', ico: ICO.book, run: () => navigate('binders') }]),
    { kind: 'act', name: 'Récupérer les cotes du dépôt', sub: `Dernière cote ${agoLabel(priceSyncedAt())} · une carte se recote depuis sa tuile`, ico: ICO.sync, run: () => pullPricesFromRepo() },
    { kind: 'act', name: 'Chercher de nouvelles séries', sub: 'Actualiser le catalogue', ico: ICO.refresh, run: () => refreshSeries() },
    // TEMPORAIRE (2026-08-26) : relève ce que l'appareil dit VRAIMENT de son
    // écran. La bande noire du bas résiste à trois corrections faites « à
    // l'aveugle » ; ces chiffres disent lequel des deux cas c'est — le cadre ne
    // couvre pas l'écran, ou il le couvre et c'est la barre qui s'arrête trop
    // haut. À retirer dès que la question est tranchée.
    { kind: 'act', name: 'Diagnostic écran', sub: 'Mesures à envoyer en cas de bande noire', ico: ICO.refresh, run: () => showScreenDiag() },
    { kind: 'act', name: 'Nouvelle wishlist', sub: 'Créer une liste de recherche', ico: ICO.plus, run: () => openCreateWishlist() },
    { kind: 'act', name: 'Nouveau classeur', sub: 'Créer un binder', ico: ICO.plus, run: () => openCreateBinder() },
  ];
}
/* ── DIAGNOSTIC ÉCRAN (temporaire) ────────────────────────────────────────
   Affiche, en gros et sur place, ce que l'appareil rapporte de sa propre
   géométrie. Un iPhone n'a pas de console : c'est le seul moyen d'obtenir des
   NOMBRES au lieu de continuer à deviner. Se referme au toucher. */
function showScreenDiag() {
  closePalette();
  const cs = getComputedStyle(document.documentElement);
  const px = v => Math.round(parseFloat(v) || 0);
  const r = el => { const b = el && el.getBoundingClientRect(); return b ? `${px(b.top)} → ${px(b.bottom)}` : 'absent'; };
  const app = document.querySelector('.app'), bar = document.querySelector('.tabbar');
  const barBottom = bar ? Math.round(bar.getBoundingClientRect().bottom) : 0;
  const lignes = [
    ['fenêtre (innerW × innerH)', `${innerWidth} × ${innerHeight}`],
    ['écran (screen)', `${screen.width} × ${screen.height}`],
    ['zone visuelle', visualViewport ? `${Math.round(visualViewport.width)} × ${Math.round(visualViewport.height)}` : 'inconnue'],
    ['installée (standalone)', (navigator.standalone === true ? 'OUI' : navigator.standalone === false ? 'non' : '?')
      + (matchMedia('(display-mode: standalone)').matches ? ' · display-mode ok' : ' · display-mode NON')],
    ['encoche haut / bas', `${px(cs.getPropertyValue('--sa-top'))} / ${px(cs.getPropertyValue('--sa-bottom'))}`],
    ['cadre .app', r(app)],
    ['barre d\u2019onglets', r(bar)],
    ['SOUS la barre', `${innerHeight - barBottom} px`],
    ['100dvh / 100svh / 100lvh', `${px(cs.getPropertyValue('--h-dvh'))} / ${px(cs.getPropertyValue('--h-svh'))} / ${px(cs.getPropertyValue('--h-lvh'))}`],
  ];
  const box = document.createElement('div');
  box.id = 'screen-diag';
  box.innerHTML = `<div class="sd-card"><h3>Diagnostic écran</h3><dl>${
    lignes.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(String(v))}</dd>`).join('')
  }</dl><p>Fais une capture et envoie-la. Touche pour fermer.</p></div>`;
  box.onclick = () => box.remove();
  document.body.appendChild(box);
}
// Toutes les cartes atteignables, dédoublonnées, avec leur provenance.
function palCards() {
  const seen = new Map();
  const push = (c, from) => {
    if (!c || !c.id) return;
    if (seen.has(c.id)) { const o = seen.get(c.id); if (!o.from.includes(from)) o.from.push(from); return; }
    seen.set(c.id, { id: c.id, name: c.name || c.id, image: c.image || '', setName: c.setName || '', localId: c.localId || '', setId: c.setId || '', from: [from] });
  };
  (state.wishlists || []).forEach(w => (w.cards || []).forEach(c => push(c, w.name)));
  (state.binders || []).forEach(b => (b.cards || []).forEach(c => push(c, b.name)));
  (state.investCards || []).forEach(p => p.cardId && push({ id: p.cardId, name: p.name, image: p.image, setName: p.setName, localId: p.localId, setId: p.setId }, 'Portefeuille'));
  (_miloSlots || []).forEach(s => { if (miloIsOwned(s.key)) push({ id: s.cardId, name: s.name, image: s.image, setName: s.setName, localId: s.localId, setId: s.setId }, 'Milobellus'); });
  return [...seen.values()];
}
function openPalette() {
  const box = document.getElementById('palette');
  const inp = document.getElementById('palette-input');
  if (!box || !inp) return;
  _palPrevFocus = document.activeElement;
  box.classList.add('open');
  inp.value = '';
  renderPalette('');
  // Focus après la frame d'ouverture : le clavier mobile ne s'ouvre pas
  // avant que la boîte soit visible (sinon il pousse un layout à moitié peint).
  requestAnimationFrame(() => inp.focus());
}
function closePalette() {
  const box = document.getElementById('palette');
  if (!box || !box.classList.contains('open')) return;
  box.classList.remove('open');
  // Le focus RETOURNE d'où il venait (règle d'accessibilité des dialogues).
  if (_palPrevFocus && _palPrevFocus.isConnected) _palPrevFocus.focus();
  _palPrevFocus = null;
}
function paletteOpen() { return !!document.getElementById('palette')?.classList.contains('open'); }
function renderPalette(q) {
  const list = document.getElementById('palette-list');
  if (!list) return;
  const nq = palNorm(q);
  const rows = [];
  const cmds = palCommands().filter(c => !nq || palNorm(c.name + ' ' + c.sub).includes(nq));
  if (cmds.length) {
    rows.push({ group: 'Aller à / Actions' });
    cmds.forEach(c => rows.push(c));
  }
  if (nq) {
    // Score simple : un nom qui COMMENCE par la requête passe devant.
    const cards = palCards()
      .map(c => {
        const n = palNorm(c.name), hay = palNorm(`${c.name} ${c.setName} ${c.localId} ${c.from.join(' ')}`);
        if (!hay.includes(nq)) return null;
        return { c, score: n.startsWith(nq) ? 0 : n.includes(nq) ? 1 : 2 };
      })
      .filter(Boolean)
      .sort((a, b) => a.score - b.score || String(a.c.name).localeCompare(String(b.c.name)))
      .slice(0, 40);
    if (cards.length) {
      rows.push({ group: `Cartes (${cards.length})` });
      cards.forEach(({ c }) => {
        const p = getCachedRawPrice(c.id);
        rows.push({
          kind: 'card', name: c.name, sub: [c.setName, c.localId ? '#' + c.localId : '', c.from.join(' · ')].filter(Boolean).join(' · '),
          img: c.image ? IMG(c.image, 'low') : '', meta: (p && p.raw != null) ? fmt(p.raw) : '',
          run: () => openCardDetail(c.id),
        });
      });
    }
  }
  _palRows = rows.filter(r => !r.group);
  _palIdx = 0;
  if (!_palRows.length) {
    list.innerHTML = `<div class="pal-empty">Rien pour « ${esc(q)} ».<br>Essaie un nom de carte, de série ou de wishlist.</div>`;
    return;
  }
  let i = -1;
  list.innerHTML = rows.map(r => {
    if (r.group) return `<div class="pal-group">${esc(r.group)}</div>`;
    i++;
    const ico = r.img
      ? `<span class="pal-ico"><img src="${r.img}" alt="" loading="lazy"></span>`
      : `<span class="pal-ico" aria-hidden="true">${r.ico || ICO.card}</span>`;
    return `<button class="pal-item ${i === 0 ? 'sel' : ''}" role="option" aria-selected="${i === 0}" data-pal="${i}" onclick="runPalette(${i})">
      ${ico}
      <span class="pal-body"><span class="pal-name">${esc(r.name)}</span>${r.sub ? `<span class="pal-sub">${esc(r.sub)}</span>` : ''}</span>
      ${r.meta ? `<span class="pal-meta">${esc(r.meta)}</span>` : ''}
    </button>`;
  }).join('');
}
function movePalette(d) {
  if (!_palRows.length) return;
  _palIdx = (_palIdx + d + _palRows.length) % _palRows.length;
  const items = document.querySelectorAll('.pal-item');
  items.forEach((el, i) => {
    const on = i === _palIdx;
    el.classList.toggle('sel', on);
    el.setAttribute('aria-selected', on);
    if (on) el.scrollIntoView({ block: 'nearest' });
  });
}
function runPalette(i) {
  const r = _palRows[i == null ? _palIdx : i];
  if (!r) return;
  closePalette();
  try { r.run(); } catch (e) { console.warn(e); }
}
function bindPalette() {
  const inp = document.getElementById('palette-input');
  if (inp) {
    inp.addEventListener('input', () => renderPalette(inp.value));
    inp.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); movePalette(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); movePalette(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); runPalette(); }
    });
  }
  document.addEventListener('keydown', e => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && (e.key || '').toLowerCase() === 'k') { e.preventDefault(); paletteOpen() ? closePalette() : openPalette(); }
    // « / » ouvre aussi la recherche, sauf pendant une saisie.
    else if (e.key === '/' && !paletteOpen() && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) {
      e.preventDefault(); openPalette();
    }
  });
}

// ══════════════════════════════════════════════════════════════════
//  PRISME — couleur vivante pilotée par la carte
//  La couleur dominante = type Pokémon (fiable, fourni par l'API et déjà
//  préchargé), déclinée en accent global (flood) et accent par-carte (--tc).
// ══════════════════════════════════════════════════════════════════
const TYPE_COLOR = {
  Feu:'#F0592B', Fire:'#F0592B',
  Eau:'#2E8BD6', Water:'#2E8BD6',
  Plante:'#43A64C', Grass:'#43A64C',
  Psy:'#C24FD0', Psychic:'#C24FD0',
  'Électrique':'#F2C337', Electric:'#F2C337', Lightning:'#F2C337',
  Combat:'#E0642E', Fighting:'#E0642E',
  'Obscurité':'#6B7A88', Darkness:'#6B7A88', Dark:'#6B7A88',
  'Métal':'#8DA0B0', Metal:'#8DA0B0',
  'Fée':'#EE7BB0', Fairy:'#EE7BB0',
  Dragon:'#CBA23A',
  Incolore:'#C9C3B8', Colorless:'#C9C3B8', Normal:'#C9C3B8',
};
const DEFAULT_ACC = '#E8B24B';
function hexToRgbArr(h){ h = h.replace('#',''); const n = parseInt(h,16); return [(n>>16)&255,(n>>8)&255,n&255]; }
function darkenHex(h,f){ const a = hexToRgbArr(h); return `rgb(${Math.round(a[0]*f)},${Math.round(a[1]*f)},${Math.round(a[2]*f)})`; }
const _colorCache = {};
// Résout la couleur d'une carte via son type (cache API → sinon requête légère).
async function cardColor(card){
  const id = card && (card.cardId || card.id);
  if (!id) return DEFAULT_ACC;
  if (id in _colorCache) return _colorCache[id];
  let col = DEFAULT_ACC;
  try {
    let c = cache[`/cards/${id}`];
    if (!c) c = await apiFetch(`/cards/${id}`).catch(() => null);
    const ty = c && c.types && c.types[0];
    if (ty && TYPE_COLOR[ty]) col = TYPE_COLOR[ty];
  } catch {}
  _colorCache[id] = col;
  return col;
}
// Inonde toute l'interface (transition CSS « coulée » d'1s via @property).
// ── Vivacité minimale de l'accent ──
// Certaines couleurs de type sont volontairement ternes (Obscurité #6B7A88,
// Métal #8DA0B0, Incolore #C9C3B8). Elles font de mauvais accents d'INTERFACE :
// sur l'acier sombre, et plus encore sous le verre teinté de blanc, elles
// tombent en gris-bleu illisible et le bouton primaire frôle le seuil AA.
// On garantit donc un plancher de saturation et une plage de luminosité — la
// TEINTE, elle, n'est jamais touchée : PRISME garde son principe (la couleur
// vient du type de la carte regardée).
const ACC_MIN_SAT = 0.46, ACC_MIN_LUM = 0.52, ACC_MAX_LUM = 0.68;
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (mx === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  const l = (mx + mn) / 2;
  const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  return [h, s, l];
}
function hslToRgbStr(h, s, l) {
  const f = n => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return `rgb(${f(0)},${f(8)},${f(4)})`;
}
function vividAccent(hex) {
  const [r, g, b] = hexToRgbArr(hex);
  let [h, s, l] = rgbToHsl(r, g, b);
  // Teinte quasi nulle (gris pur) : on ne peut pas la saturer sans inventer
  // une couleur → on garde la teinte d'origine telle quelle.
  if (s < 0.04) return hex;
  s = Math.max(s, ACC_MIN_SAT);
  l = Math.min(Math.max(l, ACC_MIN_LUM), ACC_MAX_LUM);
  return hslToRgbStr(h, s, l);
}
function setRootAccent(hex){
  if (!hex) return;
  const acc = vividAccent(hex);
  document.documentElement.style.setProperty('--acc', acc);
  // --acc2 (nappe profonde de l'aurora) part de la teinte VIVE, sinon la
  // deuxième nappe s'éteignait complètement sur les types ternes.
  const [r, g, b] = acc.startsWith('#') ? hexToRgbArr(acc) : acc.match(/\d+/g).map(Number);
  document.documentElement.style.setProperty('--acc2', `rgb(${Math.round(r*.3)},${Math.round(g*.3)},${Math.round(b*.34)})`);
}
// Teinte chaque carte [data-cc] de la couleur de son type (halo/accent local).
// EN FILE D'ATTENTE, et une seule fois par élément : `cardColor` demande la
// fiche à l'API quand le type n'est pas déjà en cache, et un `forEach` lançait
// autant de requêtes simultanées qu'il y a de tuiles à l'écran (48 mesurées sur
// une série, 250 dans le sélecteur) — un orage réseau qui bloquait tout le
// reste, pour une nuance de halo. Les couleurs déjà connues, elles, sont
// posées TOUT DE SUITE, sans attendre le moindre tour de boucle.
function paintCards(root){
  const todo = [];
  (root || document).querySelectorAll('[data-cc]:not([data-cc-done])').forEach(el => {
    const id = el.getAttribute('data-cc'); if (!id) return;
    el.dataset.ccDone = '1';
    if (id in _colorCache) { el.style.setProperty('--tc', _colorCache[id]); return; }
    todo.push([el, id]);
  });
  if (todo.length) runPool(todo, async ([el, id]) => {
    const hex = await cardColor({ id }).catch(() => null);
    if (hex) el.style.setProperty('--tc', hex);
  }, 3);
}
// Relief 3D + reflet de la carte mise en scène (showpiece).
/* ── EFFETS QUI SUIVAIENT LE POINTEUR : RETIRÉS (2026-08-24) ────────────
   Demande explicite : « retire l'effet holo qui suit la souris, ça fait perdre
   des performances pour rien ». Ce qui a sauté, et ce que ça coûtait :

   · Le reflet holo global — UN écouteur `pointermove` sur le `document`
     entier, qui à chaque mouvement remontait le DOM (`closest`) puis écrivait
     deux propriétés personnalisées sur la tuile survolée. Écrire `--px/--py`
     repeint le dégradé de la carte : sur une grille de 91 cartes, c'était un
     repaint par frame pendant tout déplacement de souris sur la page.
   · L'inclinaison 3D de la carte du héro (`attachHeroCardTilt`) et celle de
     l'emblème Milobellus (`attachHomeMiloTilt`) — un `transform` recalculé à
     chaque mouvement, sans rAF pour la première.
   · La parallaxe de la carte de détail (`attachCardParallax`).

   Ce qui RESTE volontairement : les `pointermove` du classeur 3D. Eux ne sont
   pas décoratifs — c'est le hit-testing qui détermine la page à tourner.
   Règle retenue : le pointeur pilote l'interaction, il ne pilote plus la
   décoration. */

function navigate(view, extra = {}) {
  // Les classeurs n'existent pas sur téléphone : la palette, un lien profond ou
  // un écran redimensionné ne doivent pas pouvoir y échouer.
  if (isPhone() && PHONE_HIDDEN.includes(view)) view = 'home';
  const from = state.view;
  const kind = transitionKind(from, view);
  state.view = view; Object.assign(state, extra);
  // La pastille de nav réagit tout de suite, indépendamment du temps que prend
  // la transition de contenu (comportement Apple : la sélection est instantanée).
  // wishlist-detail garde l'onglet Wishlists actif.
  const navKey = view === 'wishlist-detail' ? 'wishlists' : view;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === navKey));
  // La pastille est placée APRÈS le rendu, et une seule fois : la mesurer
  // avant puis re-mesurer forçait deux mises en page synchrones par onglet —
  // 6 ms chacune — pour un glissement que son propre `transition` anime de
  // toute façon. L'état actif du bouton est déjà posé juste au-dessus : la
  // sélection, elle, reste instantanée.
  renderWithTransition(from, view, kind);
}
// Fait GLISSER l'indicateur derrière l'onglet actif : verticalement dans le
// rail (desktop), horizontalement dans la tab bar (téléphone). Seul le
// déplacement est animé — la boîte est posée sans transition → aucun recalcul
// de layout, aucun jank.
// La tab bar marquait l'onglet actif avec un trait par bouton (scaleX 0→1) :
// deux traits qui se croisent en fondu, ce n'est pas un déplacement — d'où
// l'impression de bug. Elle a maintenant UNE pastille, comme le rail.
// `snap` : premier placement (boot, rotation, tab bar qui réapparaît) — on se
// pose d'un coup au lieu de glisser depuis l'origine.
function positionNavIndicator(snap) {
  positionRailIndicator(snap);
  positionTabIndicator(snap);
}
// Mesure COALESCÉE : une seule par frame, quel que soit le nombre d'appels.
// Chaque mesure lit des `offset*`, donc force une mise en page synchrone — et
// la navigation en déclenchait trois d'affilée.
let _navIndRaf = 0;
function repositionNavSoon(snap) {
  if (_navIndRaf) return;
  _navIndRaf = requestAnimationFrame(() => { _navIndRaf = 0; positionNavIndicator(snap); });
}
function positionRailIndicator(snap) {
  const ind = document.getElementById('nav-indicator');
  if (!ind) return;
  const nav = ind.parentElement;
  const active = nav && nav.querySelector('.nav-btn.active');
  if (!active) { ind.classList.remove('on'); return; }
  const h = active.offsetHeight;
  if (!h) return;                       // pas encore de layout : on réessaiera
  const first = snap || !ind.classList.contains('on');
  if (first) ind.classList.add('snap');
  ind.style.setProperty('--ind-h', h + 'px');
  ind.style.transform = `translateY(${active.offsetTop}px)`;
  ind.classList.add('on');
  if (first) { void ind.offsetWidth; ind.classList.remove('snap'); }
}
function positionTabIndicator(snap) {
  const ind = document.getElementById('tab-indicator');
  if (!ind) return;
  const bar = ind.parentElement;
  const active = bar && bar.querySelector('.nav-btn.active');
  // Tab bar masquée (desktop, classeur en paysage) : rien à mesurer, et surtout
  // rien à figer — au retour, `snap` la replacera d'un coup.
  if (!active || !active.offsetWidth) { ind.classList.remove('on'); return; }
  const first = snap || !ind.classList.contains('on');
  if (first) ind.classList.add('snap');
  ind.style.setProperty('--tab-w', active.offsetWidth + 'px');
  ind.style.setProperty('--tab-h', active.offsetHeight + 'px');
  ind.style.setProperty('--tab-x', active.offsetLeft + 'px');
  ind.style.setProperty('--tab-t', active.offsetTop + 'px');
  ind.classList.add('on');
  if (first) { void ind.offsetWidth; ind.classList.remove('snap'); }
}
// ── Assets du composant SoftButton ──
// Idéalement une balise statique dans index.html :
//   <link rel="stylesheet" href="components/rareui/soft-button.css">
// Ce chargeur la pose si elle manque : dans un projet sans build, un
// composant qui embarque sa feuille de style reste autonome et déplaçable.
// Pas de JS à charger : tout le matériau tient dans une ombre.
function ensureSoftButtonAssets() {
  if (document.querySelector('link[data-sb-css]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'components/rareui/soft-button.css?v=ui7';
  l.dataset.sbCss = '1';
  document.head.appendChild(l);
}

/* ════════════════════════════════════════════════════════════════
   SOFT BUTTON — application du matériau à TOUS les boutons
   Le matériau lui-même est le composant RareUI porté en vanilla :
   components/rareui/soft-button.css. Ici on ne fait que POSER les classes
   sur les boutons de l'app, à un seul endroit.

   Pourquoi mapper en JS plutôt qu'en CSS : CSS n'a pas d'`@extend`. Sans ce
   mapping il faudrait recopier la recette (ombre à quatre couches, filets,
   pression, lueur) dans une trentaine de familles de sélecteurs.
   ════════════════════════════════════════════════════════════════ */

// Rôles, du plus spécifique au plus général : un bouton n'en reçoit qu'UN
// (le premier qui matche gagne). Un rôle ne règle que l'intensité du modelé
// et la couleur de la lueur — jamais une couleur de fond ou de texte.
const SOFT_ROLES = [
  // Danger : toujours visuellement séparé des actions normales.
  ['.btn-danger,.inv-del,.per-x,.cardtile-del,.milo-cell-remove,.remove-btn,.binder-act-danger', 'sb-danger'],
  // Primaire : un seul par écran (cf. principes produit).
  ['.btn-primary,.btn-grade,.btn-wish,.btn-milo,.btn-save', 'sb-primary'],
  // Onglets de nav : nus au repos (voir .sb-nav).
  ['.nav-btn', 'sb-nav'],
  // Tout le reste : le modelé neutre.
  ['.btn,.btn-ghost,.btn-cm,.btn-quiet,.btn-import,.back-btn,.picker-back,.strip-btn,' +
   '.hg-change,.rail-cmd,.inv-add,.seg-btn,.inv-switch-btn,.qty-btn,.cm-link,.buy-chip,' +
   '.cardtile-sync,' +
   '.modal-close,.title-edit-btn,.binder-act,.toast-action,.zoom-btn,.owned-toggle,' +
   '.milo-nav-btn,.binder-add-page,.wishlist-add-card,.binder-tile-new,.fp-auto', 'sb-steel'],
];
// CALIBRE DENSE — les micro-contrôles se comptent par centaines sur une vue.
// Quatre ombres floutées à 26 px de haut, c'est du temps de peinture pour un
// relief invisible : ils passent à deux couches (voir .sb-micro).
const SOFT_MICRO = '.qty-btn,.cm-link,.buy-chip,.zoom-btn,.owned-toggle,.remove-btn,.cardtile-sync,' +
                   '.inv-del,.per-x,.cardtile-del,.strip-btn,.milo-cell-remove,' +
                   '.title-edit-btn,.binder-act,.fp-auto,.chip-x';
// EXCLUSIONS — ce ne sont pas des « boutons » mais du CONTENU cliquable :
// des cartes Pokémon. Leur donner un relief de bouton enterrerait le principe
// produit « la carte est la vedette ». Elles gardent leur verre et leur halo.
const SOFT_SKIP = '.milo-cell,.card-picker-item,.fp-item,.featured-slab,.home-wl,' +
                  '.wishlist-card,.cardser-bubble,.binder-tile,.cardtile-art,.pal-item';

// Idempotent et bon marché : marqueur data-soft, une passe de querySelectorAll
// par groupe.
function applySoft(root) {
  const scope = (root && root.querySelectorAll) ? root : document;
  for (const [sel, role] of SOFT_ROLES) {
    // La racine elle-même compte : l'observateur peut recevoir un bouton
    // inséré seul (un toast, une ligne de tableau…).
    const list = [...scope.querySelectorAll(sel)];
    if (scope !== document && scope.matches && scope.matches(sel)) list.push(scope);
    list.forEach(el => {
      if (el.dataset.soft) return;
      // On saute uniquement si l'élément EST LUI-MÊME une tuile de contenu.
      // Un contrôle POSÉ SUR une tuile (crayon de renommage, loupe, actions de
      // classeur, retrait d'une carte) reste un bouton et reçoit le modelé —
      // un test `closest()` les excluait à tort.
      if (el.matches(SOFT_SKIP)) return;
      el.dataset.soft = role;
      el.classList.add('sb', role);
      if (el.matches(SOFT_MICRO)) el.classList.add('sb-micro');
    });
  }
}

// L'app re-rend des FRAGMENTS hors de renderViewContent (renderInvestBody,
// le détail d'une série, le picker, les fiches, refreshSpreadPages…). Un
// simple appel après chaque changement de vue laissait donc des centaines de
// boutons sans matériau (mesuré : 42 habillés au lieu de 501 sur une série).
// Un observateur couvre TOUS les chemins de rendu, présents et futurs.
// On n'observe que childList : applySoft ne modifie que des classes/attributs,
// donc aucune boucle de rétroaction possible.
let _softObs = null, _softQueued = false;
const _softPending = new Set();
function watchSoft() {
  if (_softObs || typeof MutationObserver === 'undefined') return;
  _softObs = new MutationObserver(muts => {
    // Ne réagit qu'à l'ajout d'un ÉLÉMENT (on ignore le texte, les cotes…).
    let worth = false;
    for (const m of muts) {
      for (const n of m.addedNodes) { if (n.nodeType === 1) { worth = true; break; } }
      if (worth) break;
    }
    if (!worth) return;
    // On ne rescanne QUE les sous-arbres ajoutés : une passe sur tout le
    // document coûtait ~9 ms sur la vue à 501 boutons, pour rien quand une
    // seule tuile a été rafraîchie.
    for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) _softPending.add(n);
    if (_softQueued) return;
    _softQueued = true;
    // setTimeout et NON requestAnimationFrame : le rAF est gelé quand l'onglet
    // passe en arrière-plan (convention déjà en place ailleurs dans ce fichier),
    // et les boutons resteraient alors sans matériau.
    setTimeout(() => {
      _softQueued = false;
      const batch = [..._softPending];
      _softPending.clear();
      for (const n of batch) if (n.isConnected) applySoft(n);
    }, 0);
  });
  _softObs.observe(document.body, { childList: true, subtree: true });
}

// Titre contextuel de la barre haute : dire OÙ l'on est, à tout moment.
const VIEW_META = {
  home:              { eyebrow: 'MiloDex',      name: 'Accueil' },
  wishlists:         { eyebrow: 'Recherche',    name: 'Wishlists' },
  'wishlist-detail': { eyebrow: 'Wishlists',    name: 'Détail de la liste' },
  invest:            { eyebrow: 'Suivi',        name: 'Portefeuille' },
  binders:           { eyebrow: 'Collection',   name: 'Classeurs' },
  'binder-detail':   { eyebrow: 'Classeurs',    name: 'Feuilletage 3D' },
};
const VIEW_RENDERERS = {
  home: renderHome, wishlists: renderWishlists, 'wishlist-detail': renderWishlistDetail,
  invest: renderInvest, binders: renderBinders, 'binder-detail': renderBinderDetail,
};
// Peuple le CORPS d'une vue, sans rien dire sur celle qu'on regarde. Séparé du
// châssis (titre de la barre haute, badges) parce que le carrousel du téléphone
// garnit les pages voisines À L'AVANCE : elles doivent avoir leur contenu sans
// pour autant renommer la barre haute.
function renderViewBody(view) {
  (VIEW_RENDERERS[view] || renderHome)();
  // Le matériau est posé sur ce qui vient d'être rendu, ET SEULEMENT ÇA.
  applySoft(document.getElementById('view-' + view) || document);
  // Seul endroit où une page du carrousel devient « à jour » : ici, quand son
  // corps vient d'être construit. Tous les chemins de rendu passent par cette
  // fonction, donc la comptabilité ne peut pas se désynchroniser.
  if (PHONE_PAGES.includes(view)) { _pagerMounted.add(view); _pagerStale.delete(view); }
}
// Dit LAQUELLE on regarde : compteurs de nav et titre de la barre haute. Rien
// à voir avec le contenu de la vue — c'est pour ça que c'est séparé.
function renderViewChrome(view) {
  // Badges : le rail ET la tab bar mobile portent les mêmes compteurs.
  // Un compteur à zéro est MASQUÉ (data-zero) plutôt qu'affiché à « 0 ».
  // Une pastille de nav à quatre chiffres (1327) ne tient pas dans le rail et
  // pousse le libellé à l'ellipse. Convention iOS : on plafonne à 999+.
  const setBadge = (ids, n) => ids.forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    el.textContent = n > 999 ? '999+' : String(n);
    el.title = n > 999 ? n.toLocaleString('fr-FR') : '';
    el.dataset.zero = n ? '0' : '1';
  });
  setBadge(['badge-wishlists', 'badge-wishlists-m'], state.wishlists.length);
  setBadge(['badge-invest', 'badge-invest-m'], state.sealed.length + state.investCards.length);
  if (_actionsOn) setHeaderActions(false);   // changer de vue referme les actions
  const m = VIEW_META[view] || VIEW_META.home;
  const eb = document.getElementById('tb-eyebrow'); if (eb) eb.textContent = m.eyebrow;
  const nm = document.getElementById('tb-name'); if (nm) nm.textContent = m.name;
}
// Peuple le DOM d'une vue ET dit qu'on la regarde, sans toucher à sa
// visibilité — permet de la remplir pendant qu'elle est encore masquée
// (voir renderWithTransition).
function renderViewContent(view) {
  renderViewBody(view);
  renderViewChrome(view);
}
// Rendu initial (boot) : pas de transition, la vue "home" est déjà active dans le HTML.
function render() {
  // Les classeurs n'existent pas sur téléphone : on n'y démarre jamais.
  if (isPhone() && PHONE_HIDDEN.includes(state.view)) state.view = 'home';
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${state.view}`)?.classList.add('active');
  renderViewContent(state.view);
  setPagerColumn(state.view, true);   // en place d'un coup : on ne glisse pas au démarrage
  bindPagerSwipe();
  syncTopbarHeight();
  repositionNavSoon(true);
  // Les deux autres colonnes se garnissent au repos, après la première image.
  warmPagerPagesSoon();
}
/* ══════════════════════════════════════════════════════════════════════
   NAVIGATION — deux modèles, un par forme d'écran

   DESKTOP : rail vertical, fondu croisé entre les vues. Un glissement
   horizontal n'y voudrait rien dire.

   TÉLÉPHONE : CARROUSEL. Les trois pages sont posées côte à côte dans une
   seule bande (grille de 3 colonnes de 100 %) et c'est la BANDE qui glisse —
   un seul `transform` composité, jamais deux vues qui se croisent. Le modèle
   d'avant faisait, à CHAQUE changement d'onglet : peupler la vue cible,
   épingler la sortante, jouer deux animations, désépingler. Ça marchait, mais
   ça restait une chorégraphie recalculée à chaque fois. Là, tout est déjà en
   place : on déplace la fenêtre.

   Conséquence importante : chaque page est SON PROPRE défileur vertical, donc
   sa position est gardée par le navigateur — gratuitement, sans mémoriser ni
   rétablir quoi que ce soit en JS.

   LES CLASSEURS N'EXISTENT PAS SUR TÉLÉPHONE (demande du 2026-08-26). Trois
   destinations, trois colonnes. Le feuilletage 3D reste sur Mac, et les cartes
   cochées comptent toujours dans la valeur du coffre.
   ══════════════════════════════════════════════════════════════════════ */
const TAB_ORDER = ['home', 'wishlists', 'invest', 'binders'];
const PHONE_PAGES = ['home', 'wishlists', 'invest'];
const PHONE_HIDDEN = ['binders', 'binder-detail'];
// La colonne du carrousel qui héberge une vue. Le détail d'une wishlist vit
// DANS la colonne « Wishlists » : y entrer ne fait donc pas glisser la bande.
function pagerColumnOf(view) {
  const v = view === 'wishlist-detail' ? 'wishlists' : view;
  return PHONE_PAGES.includes(v) ? v : null;
}
function transitionKind(fromView, toView) {
  if (fromView === toView) return 'none';
  if (isPhone()) {
    const a = pagerColumnOf(fromView), b = pagerColumnOf(toView);
    if (a && b && a !== b) return 'slide';
    // Même colonne : push/pop iOS entre la liste et son détail.
    if (toView === 'wishlist-detail') return 'forward';
    if (fromView === 'wishlist-detail') return 'backward';
    return 'none';
  }
  if (toView === 'wishlist-detail' && fromView !== 'wishlist-detail') return 'forward';
  if (fromView === 'wishlist-detail' && toView !== 'wishlist-detail') return 'backward';
  if (toView === 'binder-detail' && fromView === 'binders') return 'forward';
  if (fromView === 'binder-detail' && toView === 'binders') return 'backward';
  return 'crossfade';
}
function pagerEl() { return document.getElementById('pager'); }

/* La bande est-elle EN MOUVEMENT ? Le drapeau couvre le geste ET l'animation qui
   le prolonge, parce que le verre dépoli coûte exactement aussi cher dans les
   deux cas (voir la note « POURQUOI LE GESTE SACCADAIT » dans style.css). Le
   couper seulement pendant le doigt laissait donc saccader précisément la partie
   qu'on regarde : le rangement après le lâcher. Il couvre aussi les sauts
   déclenchés depuis la barre d'onglets, qui déplacent la bande tout autant. */
let _pagerMoveTimer = 0;
function markPagerMoving(ms) {
  document.documentElement.dataset.pagerMove = '1';
  if (_pagerMoveTimer) { clearTimeout(_pagerMoveTimer); _pagerMoveTimer = 0; }
  // ms = 0 : indéfini (le doigt est posé, on ne sait pas quand il partira).
  if (ms) _pagerMoveTimer = setTimeout(clearPagerMoving, ms);
}
function clearPagerMoving() {
  if (_pagerMoveTimer) { clearTimeout(_pagerMoveTimer); _pagerMoveTimer = 0; }
  delete document.documentElement.dataset.pagerMove;
}

/* ── POSITION DE LA BANDE ────────────────────────────────────────────────
   Le `transform` est écrit DIRECTEMENT, et non via une variable CSS
   (`translate3d(calc(var(--pg) * -100%),0,0)`). C'était un piège : changer une
   propriété personnalisée NON ENREGISTRÉE ne déclenche aucune transition sur la
   propriété qui l'utilise — la valeur calculée du `transform` reste le même flot
   de jetons `calc(var(--pg)…)` avant et après. Vérifié avec
   `getAnimations()` : zéro animation, et la page était déjà arrivée à la frame
   suivante. La bande SAUTAIT au lieu de glisser.
   En écrivant le pourcentage en dur, la valeur calculée change vraiment : la
   transition démarre, et elle est portée par le compositeur.

   `_pagerPos` est la source de vérité (en pages, fractionnaire pendant un
   glissement au doigt) : plus fiable que relire le style. */
let _pagerPos = 0;
function setPagerTransform(pos) {
  const wrap = pagerEl();
  if (wrap) wrap.style.transform = `translate3d(${(-pos * 100).toFixed(4)}%,0,0)`;
  _pagerPos = pos;
}
// La DURÉE suit la DISTANCE : sauter deux pages d'un coup doit se VOIR passer
// par celle du milieu (c'est ce qu'on demande à un carrousel), pas y arriver
// dans le même temps qu'un pas d'une seule page.
function setPagerColumn(view, instant) {
  const wrap = pagerEl();
  if (!wrap) return;
  // Sur Mac il n'y a pas de bande : on efface toute trace (utile après une
  // rotation ou un passage d'une largeur à l'autre).
  if (!isPhone()) { wrap.style.transform = ''; wrap.style.transitionDuration = ''; _pagerPos = 0; return; }
  const col = pagerColumnOf(view);
  if (col == null) return;
  const target = PHONE_PAGES.indexOf(col);
  // La durée suit ce qui RESTE à parcourir : un rangement de fin de geste (il
  // reste un quart de page) doit être bref, un saut de deux pages depuis la
  // barre d'onglets doit se voir passer par celle du milieu. Plancher à 180 ms
  // pour que même un tout petit rattrapage soit une animation, pas un saut.
  const dist = Math.min(2, Math.abs(target - _pagerPos));
  const dur = Math.max(180, Math.round(200 + 200 * dist));
  wrap.style.transitionDuration = dur + 'ms';
  if (instant) wrap.classList.add('no-anim');
  else if (dist > 0.001) markPagerMoving(dur + 90);   // le verre reste coupé jusqu'à l'arrivée
  setPagerTransform(target);
  if (instant) { void wrap.offsetWidth; wrap.classList.remove('no-anim'); clearPagerMoving(); }
}

/* ── GLISSEMENT AU DOIGT ────────────────────────────────────────────────
   La bande suit le doigt au pixel, puis se range sur la page la plus probable
   (distance parcourue OU vitesse au lâcher). Trois précautions :

   · L'AXE est décidé aux premiers pixels et ne change plus. Sans ça, un geste
     de défilement vertical un peu oblique faisait partir le carrousel de
     travers — c'est le bug classique de ce genre de composant.
   · Les défileurs HORIZONTAUX internes (le film des pièces maîtresses, le
     tableau du scellé) gardent leur geste : on ne prend pas la main dedans.
   · Aux extrémités, la bande ne suit qu'au tiers : le geste répond, mais on
     sent qu'il n'y a rien après.
   Le partage avec le navigateur passe par `touch-action` (voir style.css) :
   `pan-y` sur la bande lui laisse le défilement vertical et nous donne
   l'horizontal, ce qui est la seule méthode fiable sur iOS. */
const SWIPE_KEEP_OUT = '.strip-track,.inv-table-scroll,.hscroll,.scroller,input,textarea,select';
const SWIPE_START = 8;          // px de franchise avant de décider qu'il y a un geste
const SWIPE_PROJECT_MS = 200;   // durée de « lancer » projetée après le lâcher
const SWIPE_EAGER = 0.12;       // penche vers la page visée (seuil effectif ≈ 38 %)

/* ── GLISSEMENT AU DOIGT ────────────────────────────────────────────────
   La bande suit le doigt, et RIEN ne change de page tant que le doigt est posé.
   Au lâcher, on calcule la position PROJETÉE — là où le geste pointe compte tenu
   de son élan — et on va se ranger sur la page la plus proche de ce point.

   Pourquoi une projection plutôt que des seuils : avec un seuil de distance, un
   petit geste vif ne passait pas et un grand geste lent passait, ce qui ne
   correspond à l'intention de personne. Là, le geste lent doit dépasser ~38 %
   de l'écran, le geste vif suffit à lui seul, et les deux se combinent — c'est
   ce que font les pages d'un écran d'accueil iOS.

   Les écouteurs sont posés sur le DOCUMENT en phase de CAPTURE, et non sur la
   bande : le geste ne peut donc plus être avalé en route par un enfant qui
   arrête la propagation ou qui a son propre glisser-déposer (les cartes de
   wishlist sont `draggable`, ce qui suffisait à tuer le geste sur toute la
   page). C'est aussi ce qui le rend identique dans les deux sens et depuis
   n'importe quelle page. */
function bindPagerSwipe() {
  if (document.documentElement.dataset.swipe) return;
  document.documentElement.dataset.swipe = '1';
  let id = null, x0 = 0, y0 = 0, base = 0, w = 1, axis = null;
  let dx = 0, lastX = 0, lastT = 0, vel = 0, raf = 0, tabX = null;
  const maxCol = () => PHONE_PAGES.length - 1;

  // La PASTILLE de la barre du bas suit le doigt elle aussi : sans ça, la bande
  // glissait mais la sélection restait plantée sur la page de départ jusqu'au
  // lâcher, et les deux moitiés du mouvement n'avaient pas l'air liées.
  // Les abscisses des onglets sont relevées UNE fois, au début du geste.
  const readTabs = () => {
    const bar = document.querySelector('.tabbar');
    if (!bar) return null;
    const xs = PHONE_PAGES.map(v => {
      const b = bar.querySelector(`.nav-btn[data-view="${v}"]`);
      return b && b.offsetWidth ? b.offsetLeft : null;
    });
    return xs.every(x => x != null) ? xs : null;
  };
  const paintTab = pos => {
    const ind = document.getElementById('tab-indicator');
    if (!ind || !tabX) return;
    const c = Math.max(0, Math.min(maxCol(), pos));
    const i = Math.min(maxCol() - 1, Math.floor(c));
    const f = c - i;
    ind.style.setProperty('--tab-x', (tabX[i] + (tabX[i + 1] - tabX[i]) * f).toFixed(1) + 'px');
  };

  const clampPos = pos => {                     // élastique : au tiers dans le vide
    if (pos < 0) return pos / 3;
    if (pos > maxCol()) return maxCol() + (pos - maxCol()) / 3;
    return pos;
  };
  // UNE SEULE écriture par frame : iOS livre les pointermove à 120 Hz, soit deux
  // fois plus que l'écran n'affiche, et la bande bavait derrière le doigt.
  const paint = () => {
    raf = 0;
    const pos = clampPos(base - dx / w);
    setPagerTransform(pos);
    paintTab(pos);
  };
  const stopRaf = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };
  const end = () => {
    stopRaf(); id = null; axis = null; tabX = null;
    const wrap = pagerEl(); if (wrap) wrap.classList.remove('dragging');
    // On ne LÈVE PAS le drapeau ici : le rangement qui suit est encore un
    // mouvement de la bande. C'est setPagerColumn qui l'éteindra à l'arrivée.
    // Seul l'abandon d'un geste vertical l'éteint tout de suite (voir plus bas).
    // La pastille reprend sa propre transition : elle rejoindra son onglet en
    // glissant, dans la continuité du geste.
    document.getElementById('tab-indicator')?.classList.remove('snap');
  };

  document.addEventListener('pointerdown', e => {
    if (!isPhone() || id !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const wrap = pagerEl();
    if (!wrap || !e.target || !wrap.contains(e.target)) return;
    if (e.target.closest && e.target.closest(SWIPE_KEEP_OUT)) return;
    const col = pagerColumnOf(state.view);
    if (col == null) return;
    id = e.pointerId; x0 = lastX = e.clientX; y0 = e.clientY; lastT = e.timeStamp;
    base = PHONE_PAGES.indexOf(col);
    w = wrap.clientWidth || innerWidth || 1;   // mesuré UNE fois : aucune lecture de layout pendant le geste
    axis = null; dx = 0; vel = 0;
  }, true);

  document.addEventListener('pointermove', e => {
    if (e.pointerId !== id) return;
    const mx = e.clientX - x0, my = e.clientY - y0;
    if (axis === null) {
      if (Math.abs(mx) < SWIPE_START && Math.abs(my) < SWIPE_START) return;
      if (Math.abs(my) >= Math.abs(mx)) { end(); clearPagerMoving(); return; }   // vertical : on rend la main
      axis = 'x';
      const wrap = pagerEl();
      wrap?.classList.add('dragging');
      // Le drapeau est posé sur la RACINE : la barre haute, la barre d'onglets et
      // l'aurora sont hors de la bande, et c'est leur verre qui coûte le plus
      // cher — le contenu défile derrière elles sur toute la largeur.
      markPagerMoving(0);
      tabX = readTabs();
      // `snap` coupe la transition de la pastille : le temps du geste, elle est
      // pilotée au pixel comme la bande.
      document.getElementById('tab-indicator')?.classList.add('snap');
      // Les événements suivants nous restent adressés même si le doigt quitte
      // l'élément de départ (une carte, un bouton, un bord de page).
      try { wrap?.setPointerCapture(e.pointerId); } catch {}
    }
    // Vitesse INSTANTANÉE (deux derniers événements) : un geste qui traîne puis
    // se termine par une détente doit compter comme une détente.
    const dt = e.timeStamp - lastT;
    if (dt > 0) vel = (e.clientX - lastX) / dt;
    lastX = e.clientX; lastT = e.timeStamp;
    dx = mx;
    if (!raf) raf = requestAnimationFrame(paint);
  }, true);

  const release = e => {
    if (e.pointerId !== id) return;
    const dragged = axis === 'x';
    const moved = dx, from = base, width = w, v = vel;   // relevé AVANT end(), qui remet à zéro
    end();
    if (!dragged) return;
    /* POURQUOI LE LÂCHER ÉTAIT INSTANTANÉ.
       Pendant le geste, `.dragging` pose `transition:none` (la bande doit coller
       au doigt). Au lâcher, on retirait la classe ET on écrivait la position
       finale DANS LE MÊME CALCUL DE STYLE — et une transition ne démarre que si
       l'état de DÉPART avait déjà une durée non nulle pour cette propriété. Elle
       ne démarrait donc jamais : la bande sautait à sa page.
       Cette lecture de `offsetWidth` force le navigateur à adopter l'état
       « transition rallumée » comme point de départ. Ensuite, et ensuite
       seulement, le changement de transform s'anime. */
    const wrap = pagerEl();
    if (wrap) void wrap.offsetWidth;
    // Où en est la bande, en pages, puis où elle POINTE avec son élan.
    const pos = from - moved / width;
    const proj = pos - (v * SWIPE_PROJECT_MS) / width;
    // Un cheveu de penchant vers la page visée : sans lui il faut dépasser la
    // moitié pile de l'écran, et l'utilisateur trouve ça avare.
    const bias = proj > from ? SWIPE_EAGER : proj < from ? -SWIPE_EAGER : 0;
    let target = Math.round(proj + bias);
    target = Math.max(from - 1, Math.min(from + 1, target));   // une page par geste
    target = Math.max(0, Math.min(maxCol(), target));
    // Un geste ne doit pas déclencher le clic de ce qu'il y avait sous le doigt.
    if (Math.abs(moved) > SWIPE_START) swallowNextClick();
    if (target === from) {
      setPagerColumn(state.view);                              // retour élastique
      repositionNavSoon();                                     // …et la pastille revient avec
    } else navigate(PHONE_PAGES[target]);
  };
  document.addEventListener('pointerup', release, true);
  // ANNULATION (iOS reprend le pointeur, deuxième doigt, appel entrant) : on la
  // traite comme un lâcher. Ramener la bande en arrière au milieu du geste,
  // c'était le défaut le plus visible.
  document.addEventListener('pointercancel', release, true);
}
// Avale le prochain clic (celui qu'un glissement aurait déclenché malgré lui).
function swallowNextClick() {
  const eat = e => { e.stopPropagation(); e.preventDefault(); };
  document.addEventListener('click', eat, { capture: true, once: true });
  setTimeout(() => document.removeEventListener('click', eat, true), 400);
}
// Les pages VOISINES sont garnies une fois, au repos, pour que le premier
// glissement vers elles n'ait rien à construire. Le contenu de la page CIBLE
// est de toute façon refait à chaque navigation (voir renderWithTransition) :
// ce pré-remplissage ne sert qu'à supprimer la première image vide.
const _pagerMounted = new Set();
// Une page est PÉRIMÉE dès que la donnée qu'elle affiche a pu changer. Marqué
// aux deux seuls endroits par où passe toute écriture : la sauvegarde de la
// collection et celle des cotes. Tant qu'une page n'est pas périmée, y glisser
// ne reconstruit RIEN — le changement d'onglet coûte alors zéro milliseconde de
// fil principal, et le glissement démarre sur la frame du tap.
const _pagerStale = new Set();
const _pagerWarmedAt = {};
let _pagerWarmIdle = 0;
function markPagerStale() {
  for (const v of PHONE_PAGES) _pagerStale.add(v);
  warmPagerPagesSoon();   // …et on les remet à jour AVANT que l'utilisateur y glisse
}
// Garde les pages voisines PRÊTES, au repos. C'est ce qui rend le changement
// d'onglet gratuit : quand on glisse, il n'y a plus rien à construire. Sans ça,
// la moindre cote qui arrive périmait les trois pages et le prochain onglet
// repayait son rendu (50 ms mesurées) au moment précis du geste.
// La page REGARDÉE est exclue : elle se met à jour en place, et la reconstruire
// sous le doigt remettrait son défilement à zéro.
function warmPagerPages() {
  if (!isPhone()) return;
  const now = performance.now();
  for (const v of PHONE_PAGES) {
    if (v === state.view) continue;
    if (_pagerMounted.has(v) && !_pagerStale.has(v)) continue;
    // Plafond : une reconstruction par page et par seconde. Les cotes arrivent
    // par paquets au démarrage, et chaque écriture périme tout — sans ce garde-
    // fou on rendrait en boucle pendant la minute de chargement.
    if (now - (_pagerWarmedAt[v] || 0) < 1000) continue;
    _pagerWarmedAt[v] = now;
    try { renderViewBody(v); } catch (e) { console.warn('page du carrousel', v, e); }
  }
}
function warmPagerPagesSoon() {
  if (!isPhone() || _pagerWarmIdle) return;
  const run = () => { _pagerWarmIdle = 0; warmPagerPages(); };
  _pagerWarmIdle = window.requestIdleCallback ? requestIdleCallback(run, { timeout: 1500 }) : setTimeout(run, 500);
}
let _viewTransitionTimer = null;
// Durée après laquelle la vue sortante est désépinglée : celle de sa SORTIE
// (--dur-exit = 170 ms) plus une marge. Les deux vues se croisant maintenant,
// ce n'est plus le temps qu'on attend avant de montrer la nouvelle.
const VIEW_TRANSITION_MS = { forward: 210, backward: 210, crossfade: 200 };
const ENTER_CLASSES = ['entering', 'enter-forward', 'enter-backward'];
const EXIT_CLASSES = ['exiting', 'exit-fade', 'exit-forward', 'exit-backward'];
const VIEW_TRANSITION_CLASSES = [...EXIT_CLASSES, ...ENTER_CLASSES];

/* ── DÉFILEMENT PAR VUE ─────────────────────────────────────────────────
   Un onglet retrouve sa position (comportement iOS : on revient là où on en
   était) ; une vue de DÉTAIL s'ouvre toujours en haut. Le rétablissement est
   instantané et se fait pendant que la vue sortante est ÉPINGLÉE à l'écran :
   rien ne saute, rien ne rebondit. Avant, aucun défilement n'était touché —
   quitter le bas de l'accueil pour une vue courte faisait « tomber » la page
   d'un coup (le navigateur ramène le défilement dans les bornes). */
const _viewScroll = {};
const DEEP_VIEWS = ['wishlist-detail', 'binder-detail'];
function scrollYNow() { return window.scrollY || document.documentElement.scrollTop || 0; }
// Sur téléphone, le document ne défile plus : c'est CHAQUE page du carrousel
// qui a sa barre de défilement. Le navigateur garde donc leurs positions tout
// seul, et il n'y a plus rien à mémoriser ni à rétablir.
function viewScroller(view) { return isPhone() ? document.getElementById('view-' + view) : null; }
function scrollViewToTop(view) {
  const el = viewScroller(view);
  if (el) el.scrollTop = 0;
  else window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
}
function applyViewScroll(view, fresh) {
  if (isPhone()) { if (fresh) scrollViewToTop(view); return; }
  const y = fresh ? 0 : (_viewScroll[view] || 0);
  if (Math.abs(scrollYNow() - y) < 1) return;
  window.scrollTo({ top: y, left: 0, behavior: 'instant' });
}
/* ── ÉPINGLAGE DE LA VUE SORTANTE ───────────────────────────────────────
   `.view.exiting` passe en `position:fixed` (style.css) : on lui écrit sa
   boîte ACTUELLE en coordonnées d'écran, puis on la retire du flux. Deux
   problèmes disparaissent d'un coup :
   · la hauteur du document ne vaut plus la SOMME des deux vues pendant la
     transition (c'était ça, le grand « resizing » à chaque page) ;
   · le défilement peut être rétabli sous elle sans qu'elle bouge d'un pixel.
   Retour : `unpin()` efface les styles inline. */
function pinView(el) {
  const r = el.getBoundingClientRect();
  const st = el.style;
  st.top = Math.round(r.top) + 'px';
  st.left = Math.round(r.left) + 'px';
  st.width = Math.round(r.width) + 'px';
  // La HAUTEUR aussi : une page du carrousel est un défileur, et sans hauteur
  // explicite elle s'étalerait sur tout son contenu une fois sortie du flux.
  // Sur Mac, la vue a déjà cette hauteur — l'écrire ne change rien.
  st.height = Math.round(r.height) + 'px';
  return () => { st.top = st.left = st.width = st.height = ''; };
}
// Chorégraphie manuelle de la transition entre deux vues (voir style.css pour
// les keyframes). On peuple toujours la cible AVANT de la révéler pour éviter
// un flash de contenu vide/périmé, et les deux vues se croisent EN MÊME TEMPS
// (l'ancienne s'efface pendant que la nouvelle arrive) : la sortie puis
// l'entrée en série ajoutaient 170 ms de page vide au milieu. Si une transition
// précédente est encore en cours (clics rapides), on l'interrompt proprement
// plutôt que de la laisser bloquée à mi-chemin.
let _unpinView = null;
function renderWithTransition(from, to, kind) {
  if (_viewTransitionTimer) { clearTimeout(_viewTransitionTimer); _viewTransitionTimer = null; }
  if (_unpinView) { _unpinView(); _unpinView = null; }
  const toEl = document.getElementById(`view-${to}`);
  if (!toEl) return;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const fromEl = from !== to ? document.getElementById(`view-${from}`) : null;
  const fromIsActive = fromEl && fromEl.classList.contains('active');
  const animated = kind !== 'none' && kind !== 'slide' && !reduce && fromIsActive;
  if (fromEl && fromIsActive && !isPhone()) _viewScroll[from] = scrollYNow();

  // Les scènes 3D de la vue quittée ne sont libérées qu'une fois la sortie
  // TERMINÉE : couper le contexte WebGL pendant que la vue s'efface laissait un
  // canvas noir dans le fondu.
  // Quitter l'accueil ne DÉTRUIT pas la scène : on la met en pause (raf stoppé),
  // la scène et les mesh restent en mémoire → y revenir ne recharge rien.
  const settle = () => {
    if (from === 'home' && from !== to) pauseHero();
    if (from === 'binder-detail' && from !== to) { stopMiloScene(); stopMiloFlipGL(); }   // libère les contextes WebGL (fond + flip)
  };

  // La sortante est épinglée AVANT tout changement de hauteur ou de défilement.
  // SAUF sur téléphone : la bande du carrousel porte un `transform`, ce qui en
  // fait un bloc conteneur pour ses descendants `position:fixed` — les
  // coordonnées d'écran de pinView() y seraient interprétées par rapport à la
  // bande, donc décalées de la hauteur de la barre haute. Et l'épinglage n'y
  // sert à rien : la liste et son détail partagent la même case de la grille,
  // ils se superposent déjà tout seuls, et le document ne défile pas.
  if (animated) {
    const unpin = isPhone() ? () => {} : pinView(fromEl);
    // Ses classes d'ENTRÉE sautent d'abord : une vue qui garde `enter-forward`
    // (elle vient d'arriver) ne jouerait jamais sa sortie.
    fromEl.classList.remove(...ENTER_CLASSES);
    fromEl.classList.add('exiting');
    _unpinView = () => { unpin(); fromEl.classList.remove('active', ...VIEW_TRANSITION_CLASSES); settle(); };
  }

  // Le corps de la cible n'est REFAIT que s'il a pu changer. Une page du
  // carrousel déjà garnie et non périmée est réutilisée telle quelle : on ne
  // met à jour que le titre de la barre haute.
  const pagerCol = (isPhone() && kind === 'slide') ? pagerColumnOf(to) : null;
  const reusable = pagerCol && PHONE_PAGES.includes(to) && _pagerMounted.has(to) && !_pagerStale.has(to);
  if (reusable) renderViewChrome(to);
  else renderViewContent(to);

  if (!animated) {
    document.querySelectorAll('.view.active').forEach(v => { if (v !== toEl) v.classList.remove('active', ...VIEW_TRANSITION_CLASSES); });
    toEl.classList.remove(...VIEW_TRANSITION_CLASSES);
    toEl.classList.add('active');
    // CARROUSEL : rien à animer sur les vues elles-mêmes, on déplace la bande.
    // Le contenu vient d'être refait juste au-dessus, donc la page qui arrive
    // est à jour AVANT que le glissement commence : une seule frame de travail,
    // puis un translate pur sur le compositeur.
    if (kind === 'slide') setPagerColumn(to);
    // `from === to` = on re-rend la vue courante (palette, retour d'une modale) :
    // on ne touche PAS au défilement, sinon la page saute à une position
    // mémorisée périmée alors que l'utilisateur n'a pas changé d'écran.
    if (from !== to) applyViewScroll(to, DEEP_VIEWS.includes(to));
    settle();
    warmPagerPagesSoon();
    repositionNavSoon();
    return;
  }

  const exitClass = kind === 'forward' ? 'exit-forward' : kind === 'backward' ? 'exit-backward' : 'exit-fade';
  const enterClass = kind === 'forward' ? 'enter-forward' : kind === 'backward' ? 'enter-backward' : 'entering';
  fromEl.classList.add(exitClass);
  // Les autres vues (une transition avortée a pu en laisser une active) sortent
  // du flux immédiatement : seules la sortante épinglée et la cible restent.
  document.querySelectorAll('.view.active').forEach(v => { if (v !== toEl && v !== fromEl) v.classList.remove('active', ...VIEW_TRANSITION_CLASSES); });
  toEl.classList.remove(...VIEW_TRANSITION_CLASSES);
  toEl.classList.add(enterClass, 'active');
  // La cible est en place : c'est MAINTENANT que le document a sa bonne hauteur,
  // donc que le défilement peut être rétabli sans être ramené dans les bornes.
  applyViewScroll(to, DEEP_VIEWS.includes(to));
  repositionNavSoon();

  // On ne désépingle qu'à la fin de la SORTIE. La classe d'entrée, elle, reste
  // posée jusqu'à la transition suivante (qui la retire) : la retirer ici
  // rebranchait l'animation par défaut et la vue se refondait une seconde fois
  // — le clignotement qu'on voyait après chaque changement d'onglet.
  const duration = VIEW_TRANSITION_MS[kind] || 320;
  _viewTransitionTimer = setTimeout(() => {
    _viewTransitionTimer = null;
    if (_unpinView) { _unpinView(); _unpinView = null; }
  }, duration);
}

// Résout la « pièce maîtresse du coffre » (hero) : la carte désignée à la main
// si l'utilisateur en a choisi une, sinon — automatiquement — la carte la plus
// chère de la collection (classeurs, cases Milobellus cochées, wishlists
// obtenues, portefeuille) d'après les cotes ENREGISTRÉES.
function resolveHero() {
  const ref = state.heroRef;
  if (ref && ref.type === 'loose' && (ref.cardId || ref.id)) return { obj: ref, type: 'loose' };
  const top = ownedCardEntries()[0];
  if (top && top.value > 0) return { obj: top, type: 'auto' };
  return null;
}
// Étiquette « cotes synchronisées … » + bouton Sync (accueil).
function syncMetaText(n) {
  if (!n) return 'Aucune carte suivie pour l’instant';
  // « Cotes mises à jour il y a 2 h » sous-entendait un LOT recoté d'un coup.
  // Il n'y en a plus : chaque carte se recote seule, donc ce qu'on peut dire
  // honnêtement, c'est quand la DERNIÈRE l'a été.
  return `${n.toLocaleString('fr-FR')} carte${n > 1 ? 's' : ''} suivie${n > 1 ? 's' : ''} · dernière cote ${esc(agoLabel(priceSyncedAt()))}`;
}
// Rafraîchit l'étiquette EN PLACE (sans re-render, donc sans animation rejouée).
function refreshSyncMeta() {
  const el = document.getElementById('sync-meta-txt');
  if (el) el.innerHTML = syncMetaText(trackedCardIds().length);
}

/* ── L'ACCUEIL ──────────────────────────────────────────────────────────
   Refondu le 2026-08-24 (« c'est moche et les infos dessus incompréhensible »).

   CE QUI N'ALLAIT PAS, précisément :
   · La MÊME information était donnée DEUX FOIS. Le héro affichait « Valeur
     estimée du coffre » avec une barre de répartition Cartes/Scellé, et un
     panneau plus bas répétait Cartes / Scellé / Total du coffre en chiffres.
     Le lecteur cherchait la différence entre les deux — il n'y en avait pas.
   · Le héro portait DEUX sujets concurrents : la pièce maîtresse (un nom de
     carte en très grand) et la valeur du coffre (un montant en très grand).
     Deux titres de même poids sur la même bande, donc aucun n'est le titre.
   · Une barre empilée à deux segments avec légende colorée demande plus de
     décodage que deux nombres écrits côte à côte. Elle est remplacée par des
     cellules libellées : le libellé, le montant, la précision.
   · « 1264 cartes suivies · cotes il y a 2 h » : deux faits sans rapport
     agglutinés par un point médian. Séparés.

   LA STRUCTURE EST MAINTENANT : une idée par bande, dans l'ordre où on la
   veut — combien je possède, ma plus belle carte, mes plus belles cartes,
   le classeur signature, mes wishlists.
   ─────────────────────────────────────────────────────────────────────── */
function renderHome() {
  const entries = ownedCardEntries();
  const strip = entries.filter(e => e.value > 0).slice(0, 10);
  const copies = entries.reduce((a, e) => a + e.qty, 0);
  const sealedN = (state.sealed || []).length;
  const tracked = trackedCardIds().length;

  const heroF = resolveHero();
  const featured = heroF ? heroF.obj : null;
  let heroName = '', heroSet = '', heroPhoto = '', heroId = '', heroCote = '';
  if (heroF) {
    const o = heroF.obj;
    heroId = String(o.cardId || o.id || '');
    heroName = o.name || '';
    heroSet = `${o.setName || '—'}${o.localId ? ' · N° ' + String(o.localId) : ''}`;
    heroPhoto = o.image ? IMG(o.image) : '';
    const r = getCachedRawPrice(heroId);
    heroCote = (r && r.raw != null) ? fmt(r.raw) : null;
  }
  const open = heroId ? `openCardDetail('${esc(heroId)}')` : '';

  const el = document.getElementById('view-home');
  el.innerHTML = `
    <!-- ── 1. COMBIEN JE POSSÈDE ─────────────────────────────────────
         Un seul grand nombre sur la page, et il est ici. Le reste de la
         bande ne fait que le décomposer. -->
    <section class="vault reveal" style="--i:0">
      <div class="vault-top">
        <span class="vault-k">Valeur du coffre</span>
      </div>
      <div class="vault-total" id="hero-value"><span class="hero-skeleton" id="hero-skel"></span></div>
      <div class="vault-sub" id="sync-meta-txt">${syncMetaText(tracked)}</div>

      <div class="vault-stats">
        <div class="vstat">
          <span class="vstat-ico">${ICO.card}</span>
          <span class="vstat-v" id="hero-cards-val">—</span>
          <span class="vstat-k">Cartes</span>
          <span class="vstat-sub">${copies ? copies.toLocaleString('fr-FR') + ' exemplaire' + (copies > 1 ? 's' : '') : 'aucune'}</span>
        </div>
        <div class="vstat">
          <span class="vstat-ico">${ICO.box}</span>
          <span class="vstat-v" id="hero-sealed-val">—</span>
          <span class="vstat-k">Scellé</span>
          <span class="vstat-sub">${sealedN ? sealedN + ' produit' + (sealedN > 1 ? 's' : '') : 'aucun'}</span>
        </div>
        <div class="vstat">
          <span class="vstat-ico">${ICO.spark}</span>
          <span class="vstat-v">${state.wishlists.length}</span>
          <span class="vstat-k">Wishlists</span>
          <span class="vstat-sub" id="vault-wish-sub">—</span>
        </div>
      </div>
      <div class="vault-note" id="vault-note"></div>
    </section>

    ${heroF ? `
    <!-- ── 2. MA PLUS BELLE CARTE ───────────────────────────────────
         Elle a sa propre bande : c'est le moment d'émotion, il ne partage
         pas l'affiche avec un tableau de chiffres. -->
    <section class="showpiece reveal" style="--i:1">
      <div class="showpiece-art" role="button" tabindex="0"
        aria-label="Voir la fiche de ${esc(heroName)}" onclick="${open}"
        onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${open}}">
        ${heroPhoto
          ? `<img crossorigin="anonymous" src="${heroPhoto}" alt="${esc(heroName)}" onerror="this.parentNode.innerHTML=''">`
          : noImgHTML(featured.localId, heroName, featured.setId)}
      </div>
      <div class="showpiece-copy">
        <span class="showpiece-k">Pièce maîtresse</span>
        <h1 class="showpiece-name">${esc(heroName)}</h1>
        <p class="showpiece-set">${esc(heroSet)}</p>
        ${heroCote ? `<p class="showpiece-cote"><b>${heroCote}</b><span>cote estimée</span></p>` : ''}
        <div class="showpiece-act">
          <button class="btn btn-grade" onclick="${open}">${ICO.zoom}<span>Voir la fiche</span></button>
          <button class="btn btn-ghost btn-icon" onclick="openFeaturePicker('hero')"
            title="Choisir une autre pièce maîtresse" aria-label="Choisir une autre pièce maîtresse">${ICO.refresh}</button>
        </div>
      </div>
    </section>` : `
    <section class="vault-empty reveal" style="--i:1">
      <span class="empty-state-icon">${ICO.spark}</span>
      <span class="empty-state-title">Choisis ta pièce maîtresse</span>
      <span class="empty-state-sub">La carte que tu veux voir en grand chaque fois que tu ouvres le coffre.</span>
      <button class="btn btn-grade" onclick="openFeaturePicker('hero')">${ICO.spark}<span>Choisir une carte</span></button>
    </section>`}

    ${strip.length ? `
    <section class="reveal" style="--i:2">
      <div class="ed-head">
        <div>
          <h2 class="ed-title">Tes cartes les mieux cotées</h2>
          <div class="ed-sub">${strip.length} carte${strip.length > 1 ? 's' : ''} · la plus chère en premier</div>
        </div>
        <div class="strip-nav">
          <button class="strip-btn" aria-label="Cartes précédentes" onclick="railScroll('featured-rail',-1)">${ICO.left}</button>
          <button class="strip-btn" aria-label="Cartes suivantes" onclick="railScroll('featured-rail',1)">${ICO.right}</button>
        </div>
      </div>
      <div class="strip"><div class="strip-track" id="featured-rail">${strip.map((e, i) => renderTopCardTile(e, i)).join('')}</div></div>
    </section>` : ''}

    <!-- Le teaser Milobellus a été retiré de l'accueil : les classeurs ont
         leur onglet, et l'accueil n'a pas à dupliquer une porte d'entrée. -->

    <section class="panel reveal" style="--i:3">
      <div class="ed-head" style="margin-bottom:var(--s4)">
        <div>
          <h2 class="ed-title">Wishlists</h2>
          <div class="ed-sub">Ce qu'il te reste à trouver</div>
        </div>
        ${state.wishlists.length ? `<button class="btn btn-ghost btn-sm" onclick="navigate('wishlists')">
          <span>Tout voir</span>${ICO.right}</button>` : ''}
      </div>
      ${state.wishlists.length
        ? state.wishlists.slice(-6).reverse().map((w, i) => {
            const owned = w.cards.filter(c => c.owned).length;
            const pct = w.cards.length ? Math.round(owned / w.cards.length * 100) : 0;
            return `<button class="home-wl stagger" style="--i:${i}" onclick="navigate('wishlist-detail',{activeWishlistId:'${w.id}'})">
              <span class="home-wl-top"><span class="home-wl-name">${esc(w.name)}</span><span class="home-wl-pct">${owned}/${w.cards.length} · ${pct}%</span></span>
              <span class="wl-bar"><span class="wl-bar-fill" style="width:${pct}%"></span></span>
              <span class="home-wl-foot"><span>Reste à acquérir</span><span class="wl-remaining-val loading" data-remaining="${w.id}">…</span></span>
            </button>`;
          }).join('')
        : `<div class="empty-state" style="padding:32px 20px">
             <span class="empty-state-icon">${ICO.heart}</span>
             <span class="empty-state-title" style="font-size:19px">Aucune wishlist</span>
             <span class="empty-state-sub">Crée une liste et remplis-la depuis le catalogue complet.</span>
             <button class="btn btn-wish btn-sm" onclick="openCreateWishlist()">${PLUS}<span>Nouvelle wishlist</span></button>
           </div>`}
    </section>`;

  computeCollectionValue();
  fillWishlistRemaining(state.wishlists);
  hydrateFallbackImages(el);
  // Prisme : la pièce maîtresse inonde l'écran de sa couleur.
  if (featured) cardColor({ id: heroId }).then(setRootAccent);
  else setRootAccent(DEFAULT_ACC);
  paintCards(el);
  attachReveals(el);
  // Le catalogue Milobellus arrive en asynchrone : dès qu'il est là, les cases
  // cochées entrent dans la valeur du coffre (et dans le filmstrip).
  if (!_miloSlots && Object.keys(state.milobellus || {}).length) {
    ensureMiloData().then(() => {
      if (state.view !== 'home' || !_miloSlots) return;
      ensurePrices(trackedCardIds(), n => { if (n && state.view === 'home') { computeCollectionValue(); refreshSyncMeta(); } });
      renderHome();   // _miloSlots est posé → pas de récursion possible ici
    }).catch(() => {});
  }
}

// Tuile du filmstrip « Pièces maîtresses » : une carte de la collection + sa cote.
function renderTopCardTile(e, i) {
  const img = e.image ? IMG(e.image) : '';
  const sub = e.qty > 1 ? `×${e.qty} exemplaires` : esc(e.setName || '');
  return `
    <button class="featured-slab foil" data-cc="${esc(e.id)}" style="--i:${i}"
      aria-label="Voir la fiche de ${esc(e.name)}" onclick="openCardDetail('${esc(e.id)}')">
      <span class="featured-slab-img">${img
        ? `<img crossorigin="anonymous" src="${img}" onerror="imgFail(this,'${esc(String(e.localId || ''))}','${esc(e.setId || '')}','${jss(e.name)}')" alt="${esc(e.name)}" loading="lazy">`
        : noImgHTML(e.localId, e.name, e.setId)}</span>
      <span class="featured-slab-name">${esc(e.name)}</span>
      <span class="featured-slab-foot"><span class="top-card-qty">${sub}</span><span class="featured-slab-val">${fmt(e.value)}</span></span>
    </button>`;
}

// Défilement du filmstrip par pas d'une carte.
function railScroll(id, dir) {
  const track = document.getElementById(id);
  if (!track) return;
  const card = track.querySelector('.featured-slab');
  const step = card ? card.offsetWidth + 18 : 240;
  track.scrollBy({ left: dir * step, behavior: 'smooth' });
}

// Le teaser Milobellus (porte d'entrée du classeur 3D depuis l'accueil) et son
// rafraîchisseur ont été retirés le 2026-08-26 : le teaser avait déjà quitté
// l'accueil, mais `refreshMiloTeaser()` continuait d'être appelé à chaque rendu
// — il ne trouvait plus aucun élément à mettre à jour et forçait pourtant le
// chargement complet du catalogue Milobellus (≈40 requêtes API) au démarrage,
// même pour qui n'a coché aucune case. Ce catalogue est désormais chargé par le
// bloc conditionnel de renderHome, c'est-à-dire uniquement quand il sert.

// Relief 3D au survol de l'emblème du teaser (transform GPU, rAF throttlé).
// Canvas WebGL unique, conservé entre les rendus/navigations (jamais recréé) →
// le contexte GL, la scène et les mesh survivent, donc aucun rechargement 3D.
let _heroCanvas = null;
function getHeroCanvas() {
  if (!_heroCanvas) { _heroCanvas = document.createElement('canvas'); _heroCanvas.id = 'hero-canvas'; }
  return _heroCanvas;
}

// ── Sélecteur de la pièce maîtresse ───────────────────────────────
// Deux options : la carte la plus chère de la collection (automatique) ou
// n'importe quelle carte, choisie dans la collection ou le catalogue complet.
function openFeaturePicker(target = 'hero') {
  const body = document.getElementById('feature-picker-body');
  const titleEl = document.getElementById('feature-picker-title');
  if (titleEl) titleEl.textContent = 'Pièce maîtresse du coffre';
  const cur = state.heroRef && state.heroRef.type === 'loose' ? state.heroRef : null;
  const mine = ownedCardEntries().slice(0, 60);
  const thumb = e => {
    const photo = e.image ? IMG(e.image, 'low') : '';
    const sel = cur && String(cur.cardId || cur.id) === String(e.id);
    return `<button class="fp-item ${sel ? 'sel' : ''}" onclick="setHeroCard('${esc(e.id)}')"
        aria-pressed="${sel}" aria-label="Choisir ${esc(e.name)}">
      <span class="fp-thumb">${photo ? `<img src="${photo}" alt="" loading="lazy">` : noImgHTML(e.localId, e.name, e.setId)}<span class="fp-check">${ICO.check}</span></span>
      <span class="fp-name">${esc(e.name)}</span><span class="fp-val">${e.unit == null ? '—' : fmt(e.unit)}</span></button>`;
  };
  body.innerHTML = `
    <button class="fp-auto ${!cur ? 'sel' : ''}" onclick="clearFeatured('hero')" aria-pressed="${!cur}">
      <span class="fp-auto-mark">${ICO.spark}</span>
      <span><b>Automatique</b>La carte la plus chère de ta collection, mise à jour toute seule</span>
      <span class="fp-check">${ICO.check}</span>
    </button>
    <button class="fp-auto fp-loose ${cur ? 'sel' : ''}" onclick="closeModal('modal-feature-picker');openCardPicker('hero')" aria-pressed="${!!cur}">
      <span class="fp-auto-mark">${ICO.search}</span>
      <span><b>Chercher dans le catalogue</b>${cur ? esc(cur.name || '') : 'N’importe quelle carte, même hors collection'}</span>
      <span class="fp-check">${ICO.check}</span>
    </button>
    ${mine.length ? `<div class="fp-group-title">Mes cartes</div><div class="fp-grid">${mine.map(thumb).join('')}</div>` : ''}`;
  hydrateFallbackImages(body);
  openModal('modal-feature-picker');
}
// Désigne une carte DE LA COLLECTION comme pièce maîtresse.
function setHeroCard(cardId) {
  const e = ownedCardEntries().find(x => String(x.id) === String(cardId));
  if (!e) return;
  state.heroRef = { type: 'loose', id: e.id, cardId: e.id, name: e.name, image: e.image, setName: e.setName, setId: e.setId, localId: e.localId };
  save(); closeModal('modal-feature-picker');
  if (state.view === 'home') renderHome();
  toast('Pièce maîtresse mise à jour', 'success');
}
function clearFeatured(target) {
  state.heroRef = null;
  save(); closeModal('modal-feature-picker');
  if (state.view === 'home') renderHome();
}

// SYNCHRONE : lit uniquement les cotes ENREGISTRÉES (relues au boot par
// loadPriceCache). Aucun `await` → la valeur du coffre s'affiche dès la
// première frame, même hors ligne, sans skeleton clignotant ni « recharge » à
// chaque retour sur l'accueil. Une carte encore sans cote vaut 0 (et la
// synchro la renseignera) : jamais de NaN, jamais de total qui disparaît.
function computeCollectionValue() {
  const entries = ownedCardEntries();
  // Cartes : cote enregistrée × nombre d'exemplaires (dédoublonné, cf. ownedCardEntries).
  let cardsV = 0;
  for (const e of entries) cardsV += e.value;
  // Scellé : valeur courante (dernier semestre renseigné, report en avant).
  let sealedV = 0;
  for (const p of (state.sealed || [])) sealedV += sealedCurrent(p);
  const total = cardsV + sealedV;
  const skel = document.getElementById('hero-skel'); if (skel) skel.style.display = 'none';
  // Le count-up ne joue qu'une fois par session : ensuite la valeur s'affiche
  // telle quelle (fini l'effet « le prix recharge » à chaque retour à l'accueil).
  const val = document.getElementById('hero-value');
  if (val) {
    val.style.display = 'block';
    if (window._vaultCounted) { val.textContent = total > 0 ? fmt(total) : '0 €'; }
    else { window._vaultCounted = true; animateCount(val, total); }
  }
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = fmt(v); };
  set('hero-cards-val', cardsV); set('hero-sealed-val', sealedV);
  // Le « reste à acquérir » toutes wishlists confondues : la seule autre
  // valeur que l'accueil a besoin de dire.
  const wishLeft = (state.wishlists || []).reduce((a, w) => a + wishlistRemainingValue(w), 0);
  const ws = document.getElementById('vault-wish-sub');
  if (ws) ws.textContent = wishLeft > 0 ? fmt(wishLeft) + ' à trouver' : (state.wishlists.length ? 'tout est trouvé' : 'aucune liste');
  // Une seule note, et seulement si elle a quelque chose à dire.
  const note = document.getElementById('vault-note');
  if (note) {
    const noPrice = entries.filter(e => e.unit == null).length;
    note.innerHTML = noPrice
      ? `${ICO.info}<span>${noPrice} carte${noPrice > 1 ? 's' : ''} sans cote — leur valeur arrive en tâche de fond. Le bouton ⟳ d’une carte refait la sienne tout de suite.</span>`
      : '';
    note.hidden = !noPrice;
  }
  return total;
}

// Valeur totale (cote loose) des cartes NON obtenues d'une wishlist =
// « reste à acquérir ». Lecture SYNCHRONE des cotes enregistrées.
function wishlistRemainingValue(w) {
  let total = 0;
  for (const c of (w.cards || [])) {
    if (!c || c.owned) continue;
    const p = getCachedRawPrice(c.id);
    if (p && p.raw != null) total += p.raw;
  }
  return total;
}
// Renseigne tous les montants « reste à acquérir » présents dans le DOM, tout
// de suite depuis les cotes enregistrées, puis à nouveau si des cartes encore
// jamais cotées viennent d'être récupérées en arrière-plan.
function fillWishlistRemaining(wishlists) {
  const list = wishlists || [];
  const paint = () => list.forEach(w => {
    const v = wishlistRemainingValue(w);
    document.querySelectorAll(`[data-remaining="${w.id}"]`).forEach(e => {
      e.textContent = v > 0 ? fmt(v) : '—';
      e.classList.remove('loading');
    });
  });
  paint();
  const ids = [];
  list.forEach(w => (w.cards || []).forEach(c => { if (c && !c.owned) ids.push(c.id); }));
  ensurePrices(ids, n => { if (n) paint(); });
}

function renderWishlists() {
  const el = document.getElementById('view-wishlists');
  const nCards = state.wishlists.reduce((a, w) => a + w.cards.length, 0);
  const nOwned = state.wishlists.reduce((a, w) => a + w.cards.filter(c => c.owned).length, 0);
  el.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Wishlists</h1>
        <p class="ed-sub">${state.wishlists.length
          ? `${state.wishlists.length} liste${state.wishlists.length > 1 ? 's' : ''} · ${nOwned}/${nCards} carte${nCards > 1 ? 's' : ''} obtenue${nOwned > 1 ? 's' : ''}`
          : 'Traque les cartes qui te manquent, série par série.'}</p>
      </div>
      ${state.wishlists.length ? `<button class="btn btn-wish" onclick="openCreateWishlist()">${PLUS}<span>Nouvelle wishlist</span></button>` : ''}
    </div>
    ${state.wishlists.length
      ? `<div class="wishlists-grid">
          ${state.wishlists.map(renderWishlistCard).join('')}
          <button class="wishlist-add-card" onclick="openCreateWishlist()"><span class="plus" aria-hidden="true">${ICO.plus}</span>Nouvelle wishlist</button>
        </div>`
      : `<div class="empty-state">
          <span class="empty-state-icon">${ICO.heart}</span>
          <span class="empty-state-title">Aucune wishlist</span>
          <span class="empty-state-sub">Crée ta première liste, puis remplis-la depuis le catalogue complet (toutes les séries, tous les blocs).</span>
          <button class="btn btn-wish" onclick="openCreateWishlist()">${PLUS}<span>Créer une wishlist</span></button>
        </div>`}`;
  hydrateFallbackImages(el);
  setupWishlistDnD(el);
  fillWishlistRemaining(state.wishlists);
  paintCards(el);
  attachSpotlights(el);
}
// Réordonnancement des wishlists par glisser-déposer
let _dragWid = null;
function setupWishlistDnD(root) {
  root.querySelectorAll('.wishlist-card').forEach(card => {
    card.addEventListener('dragstart', e => {
      _dragWid = card.dataset.id; card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', _dragWid); } catch {}
    });
    card.addEventListener('dragend', () => {
      _dragWid = null;
      root.querySelectorAll('.dragging, .drag-over').forEach(c => c.classList.remove('dragging', 'drag-over'));
    });
    card.addEventListener('dragover', e => {
      if (!_dragWid || card.dataset.id === _dragWid) return;
      e.preventDefault(); e.dataTransfer.dropEffect = 'move'; card.classList.add('drag-over');
    });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', e => {
      e.preventDefault(); card.classList.remove('drag-over');
      const targetId = card.dataset.id;
      if (!_dragWid || _dragWid === targetId) return;
      const from = state.wishlists.findIndex(w => w.id === _dragWid);
      const origTo = state.wishlists.findIndex(w => w.id === targetId);
      if (from < 0 || origTo < 0) return;
      const [moved] = state.wishlists.splice(from, 1);
      const tIdx = state.wishlists.findIndex(w => w.id === targetId);
      state.wishlists.splice(from < origTo ? tIdx + 1 : tIdx, 0, moved);
      save(); renderWishlists();
    });
  });
}
function renderWishlistCard(w) {
  const preview = w.cards.slice(0, 5);
  const extra = w.cards.length - preview.length;
  const owned = w.cards.filter(c => c.owned).length;
  const pct = w.cards.length ? Math.round(owned/w.cards.length*100) : 0;
  return `
    <!-- Déplaçable SEULEMENT hors téléphone. Sur iOS, un glissement qui part
         d'un élément déplaçable déclenche le glisser-déposer NATIF, et le
         système ANNULE alors le pointeur : le geste de carrousel mourait donc
         sur toute la page Wishlists, dont les cartes couvrent l'essentiel. Le
         réordonnancement à la souris reste sur Mac, où il sert. -->
    <div class="wishlist-card spot" draggable="${isPhone() ? 'false' : 'true'}" data-id="${w.id}" data-cc="${esc(w.cards[0]?.id||'')}" role="button" tabindex="0"
      aria-label="Ouvrir la wishlist ${esc(w.name)}"
      onclick="navigate('wishlist-detail',{activeWishlistId:'${w.id}'})"
      onkeydown="if(event.key==='Enter'){navigate('wishlist-detail',{activeWishlistId:'${w.id}'})}">
      <div class="wishlist-card-header">
        <span class="wl-drag-handle" aria-hidden="true" title="Glisser pour réordonner">${ICO.drag}</span>
        <div class="wishlist-card-name">${esc(w.name)}</div>
        <button class="title-edit-btn wl-card-rename" title="Renommer" aria-label="Renommer ${esc(w.name)}" onclick="event.stopPropagation();openRenameWishlist('${w.id}')">${ICO.edit}</button>
        <button class="title-edit-btn wl-card-del" title="Supprimer la wishlist" aria-label="Supprimer ${esc(w.name)}" onclick="event.stopPropagation();confirmDeleteWishlist('${w.id}')">${ICO.trash}</button>
        <div class="wishlist-card-count">${w.cards.length}</div></div>
      <div class="wishlist-preview">
        ${preview.map((c, k) => c.image
          ? `<img style="--k:${preview.length - 1 - k}" src="${IMG(c.image,'low')}" onerror="this.style.visibility='hidden'" alt="" loading="lazy">`
          : `<span class="wl-prev-ph" style="--k:${preview.length - 1 - k}">${noImgHTML(c.localId, c.name, c.setId)}</span>`).join('')}
        ${extra > 0 ? `<div class="wishlist-preview-more">+${extra}</div>` : ''}
        ${w.cards.length === 0 ? '<span class="dim" style="font-size:12.5px;align-self:center">Wishlist vide</span>' : ''}
      </div>
      <div class="wl-progress"><div class="wl-progress-top"><span class="wl-progress-label">Avancée</span><span class="wl-progress-pct">${pct}%</span></div>
        <div class="wl-bar"><div class="wl-bar-fill" style="width:${pct}%"></div></div></div>
      <div class="wl-remaining"><span class="wl-remaining-label">Reste à acquérir</span><span class="wl-remaining-val loading" data-remaining="${w.id}">…</span></div>
    </div>`;
}

function getCachedSetInfo(setId) { return setId ? cache[`/sets/${setId}`] : null; }
// Trie les cartes d'une wishlist par série/bloc (ordre de sortie du set),
// puis par numéro dans le set. Les infos de set déjà connues (picker,
// session précédente) sont utilisées immédiatement ; celles manquantes sont
// chargées en arrière-plan puis déclenchent un nouveau rendu.
function sortCardsBySeries(cards) {
  return cards.slice().sort((a, b) => {
    const ra = getCachedSetInfo(a.setId)?.releaseDate || '';
    const rb = getCachedSetInfo(b.setId)?.releaseDate || '';
    if (ra !== rb) return ra < rb ? -1 : 1;
    if ((a.setId || '') !== (b.setId || '')) return (a.setId || '') < (b.setId || '') ? -1 : 1;
    return (parseInt(a.localId) || 0) - (parseInt(b.localId) || 0);
  });
}
function ensureSetInfoLoaded(cards, onReady) {
  const ids = [...new Set(cards.map(c => c.setId).filter(id => id && !cache[`/sets/${id}`]))];
  if (!ids.length) return;
  Promise.all(ids.map(id => apiFetch(`/sets/${id}`).catch(() => null))).then(onReady);
}

function renderWishlistDetail() {
  const w = state.wishlists.find(x => x.id === state.activeWishlistId);
  if (!w) { navigate('wishlists'); return; }
  const owned = w.cards.filter(c => c.owned).length;
  const pct = w.cards.length ? Math.round(owned/w.cards.length*100) : 0;
  const sorted = sortCardsBySeries(w.cards);
  const el = document.getElementById('view-wishlist-detail');
  el.innerHTML = `
    <div class="wl-head">
      <button class="cardser-back" onclick="navigate('wishlists')" title="Toutes les wishlists" aria-label="Retour aux wishlists">${ICO.left}</button>
      <h1 class="wl-head-name">${esc(w.name)}</h1>
      <button class="title-edit-btn wl-head-rename" title="Renommer la wishlist" onclick="openRenameWishlist('${w.id}')" aria-label="Renommer la wishlist">${ICO.edit}</button>
      <button class="cardser-add" onclick="openCardPicker('wish')" title="Ajouter une carte" aria-label="Ajouter une carte">${ICO.plus}</button>
    </div>
    ${w.cards.length ? `<div class="wl-head-progress"><div class="progress-wrap"><span class="progress-label">${owned}/${w.cards.length} · ${pct}% · reste <span class="wl-remaining-val loading" data-remaining="${w.id}">…</span></span><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div></div></div>` : ''}
    </div>
    ${w.cards.length === 0
      ? `<div class="empty-state"><div class="empty-state-icon">${ICO.heart}</div><div class="empty-state-title">Wishlist vide</div><div class="empty-state-sub">Parcours les séries et ajoute les cartes que tu recherches.</div><button class="btn btn-wish" onclick="openCardPicker('wish')">${PLUS}<span>Ajouter des cartes</span></button></div>`
      : `<div class="cards-grid">${sorted.map((c, i) => renderWishCardThumb(c, w.id, i)).join('')}</div>`}`;
  paintCardValues(w.cards.map(c => c.id));
  // Pré-résout les fiches Cardmarket de toute la wishlist en arrière-plan :
  // au clic sur une carte, son lien direct est déjà en cache (instantané).
  // Concurrence 1 : corsproxy rate-limite vite, et un 429 pendant la
  // pré-résolution dégradait les liens de TOUTE la wishlist en recherches.
  runPool(w.cards.filter(c => !_cmUrlStore[c.id]).map(c => c.id), id => resolveCmUrl(id).catch(() => {}), 1);
  fillWishlistRemaining([w]);
  hydrateFallbackImages(el);
  paintCards(el);
  if (w.cards[0]) cardColor({ id: w.cards[0].id }).then(setRootAccent);
  ensureSetInfoLoaded(w.cards, () => {
    if (state.view === 'wishlist-detail' && state.activeWishlistId === w.id) renderWishlistDetail();
  });
}
function renderWishCardThumb(c, wid, i) {
  return `
    <div class="card-thumb ${c.owned ? 'owned' : ''}" style="animation-delay:${Math.min(i * 26, 340)}ms" data-card="${c.id}" data-cc="${c.id}">
      <div class="card-thumb-imgwrap">
        <button class="owned-toggle" onclick="event.stopPropagation();toggleOwned('${wid}','${c.id}')" title="${c.owned ? 'Marquer comme non obtenue' : 'Marquer comme obtenue'}" aria-pressed="${!!c.owned}" aria-label="Obtenue">${ICO.check}</button>
        <span class="owned-pill">Obtenue</span>
        ${c.image ? `<img src="${IMG(c.image)}" onerror="imgFail(this,'${esc(String(c.localId||''))}','${esc(c.setId||'')}','${jss(c.name)}')" alt="${esc(c.name)}" loading="lazy" style="cursor:pointer" onclick="openCardDetail('${c.id}')">` : `<div style="cursor:pointer" onclick="openCardDetail('${c.id}')">${noImgHTML(c.localId, c.name, c.setId)}</div>`}
        <button class="remove-btn" onclick="event.stopPropagation();removeFromWishlist('${wid}','${c.id}')" title="Retirer de la wishlist" aria-label="Retirer">${ICO.close}</button>
      </div>
      <div class="card-thumb-info" style="cursor:pointer" onclick="openCardDetail('${c.id}')">
        <div class="card-thumb-name">${esc(c.name)}</div>
        <div class="card-thumb-sub">#${c.localId || '—'}</div>
        <div class="cv-skeleton" data-value="${c.id}"></div>
      </div>
    </div>`;
}
// Peint les cotes ENREGISTRÉES tout de suite (aucune requête, donc aucune
// attente ni squelette qui clignote), puis complète en arrière-plan — via un
// pool borné — les cartes jamais cotées. Fini les N requêtes simultanées à
// l'ouverture d'une grosse wishlist (source de rate-limit et de « non coté »
// à tort).
function paintCardValues(ids) {
  const list = [...new Set((ids || []).filter(Boolean))];
  const paint = id => {
    const p = getCachedRawPrice(id);
    if (p === undefined) return;   // jamais cotée : on garde le squelette
    document.querySelectorAll(`[data-value="${id}"]`).forEach(el => {
      if (p && p.raw != null) { el.className = 'card-value'; el.innerHTML = `<span class="cv-label">loose</span> ${fmt(p.raw)}`; }
      else { el.className = 'card-value muted'; el.innerHTML = `<span class="cv-label">loose</span> non coté`; }
    });
  };
  list.forEach(paint);
  ensurePrices(list, n => { if (n) list.forEach(paint); });
}
function toggleOwned(wid, cardId) {
  const w = state.wishlists.find(x => x.id === wid);
  const c = w?.cards.find(x => x.id === cardId);
  if (!c) return;
  c.owned = !c.owned; save();
  document.querySelector(`.card-thumb[data-card="${cardId}"]`)?.classList.toggle('owned', c.owned);
  const owned = w.cards.filter(x => x.owned).length;
  const pct = w.cards.length ? Math.round(owned/w.cards.length*100) : 0;
  document.querySelector('.progress-fill')?.style.setProperty('width', pct + '%');
  const lbl = document.querySelector('.progress-label'); if (lbl) lbl.textContent = `${owned}/${w.cards.length} · ${pct}%`;
  fillWishlistRemaining([w]);
}
function removeFromWishlist(wid, cardId) {
  const w = state.wishlists.find(x => x.id === wid);
  if (!w) return;
  w.cards = w.cards.filter(c => c.id !== cardId); save();
  const thumb = document.querySelector(`.card-thumb[data-card="${cardId}"]`);
  if (thumb) { thumb.style.transition = 'opacity .2s, transform .2s'; thumb.style.opacity = '0'; thumb.style.transform = 'scale(.9)'; }
  setTimeout(renderWishlistDetail, 200);
  toast('Carte retirée');
}

// Course bornée : résout au plus tard après `ms`, ne rejette jamais — les
// fiches de détail s'affichent TOUJOURS, les données lentes arrivent après.
function boundedTask(p, ms) {
  return Promise.race([Promise.resolve(p).catch(() => null), new Promise(r => setTimeout(() => r(null), ms))]);
}
// Infos minimales d'une carte depuis les données LOCALES (wishlists,
// classeurs, Milobellus, portefeuille, sets déjà parcourus) — pour afficher la
// fiche même quand TCGdex est injoignable ou rate-limite.
function localCardInfo(cardId) {
  for (const w of state.wishlists) { const c = (w.cards || []).find(x => x.id === cardId); if (c) return c; }
  for (const b of state.binders) { const c = (b.cards || []).find(x => x.id === cardId); if (c) return c; }
  const sl = (_miloSlots || []).find(x => x.cardId === cardId);
  if (sl) return { id: cardId, name: sl.name, image: sl.image, localId: sl.localId, setId: sl.setId };
  const iv = (state.investCards || []).find(x => x.cardId === cardId);
  if (iv) return { id: cardId, name: iv.name, image: iv.image, localId: iv.localId, setId: iv.setId };
  const [setId] = splitCardId(cardId);
  const c = cache[`/sets/${setId}`]?.cards?.find(x => x.id === cardId);
  if (c) return { id: c.id, name: c.name, image: c.image, localId: c.localId, setId };
  return null;
}
let _detailCardId = null;
async function openCardDetail(cardId) {
  const body = document.getElementById('detail-body');
  body.innerHTML = `<div class="loading-state"><div class="spinner"></div> Chargement…</div>`;
  openModal('modal-card-detail');
  _detailCardId = cardId;
  let card;
  try { card = await apiFetch(`/cards/${cardId}`); } catch {}
  if (!card) {
    // TCGdex muet (panne, rate-limit, hors-ligne) : MODE DÉGRADÉ avec les
    // données locales — visuel + liens marché restent utilisables au lieu
    // d'une impasse. Re-tentative silencieuse en arrière-plan : si la fiche
    // complète arrive et que le modal montre toujours cette carte, on
    // ré-affiche en entier.
    const loc = localCardInfo(cardId);
    if (!loc) { body.innerHTML = errBox(); return; }
    card = { id: cardId, name: loc.name, image: loc.image, localId: loc.localId, set: { id: loc.setId } };
    setTimeout(() => {
      apiFetch(`/cards/${cardId}`).then(() => {
        if (_detailCardId === cardId && document.getElementById('cd-cm')) openCardDetail(cardId);
      }).catch(() => {});
    }, 4000);
  }
  const rows = [
    ['Rareté', card.rarity], ['PV', card.hp], ['Type', (card.types||[]).join(', ')],
    ['Catégorie', card.category], ['Stade', card.stage], ['Illustrateur', card.illustrator],
    ['Numéro', card.localId != null ? `${card.localId} / ${card.set?.cardCount?.official || '?'}` : null],
  ].filter(r => r[1]);
  // Rendu IMMÉDIAT : la cote et le lien Cardmarket direct arrivent en asynchrone.
  body.innerHTML = `
    <div class="detail-grid">
      <div class="detail-card-stage spot" id="detail-stage">
        <div class="detail-img-wrap" id="detail-img-wrap">
          ${card.image ? `<img class="detail-img" src="${IMG(card.image)}" onerror="imgFail(this,'${esc(String(card.localId||''))}','${esc(card.set?.id||'')}','${jss(card.name)}')" alt="${esc(card.name)}">` : noImgHTML(card.localId, card.name, card.set?.id, 'detail-img')}
          ${card.image ? `<button class="zoom-btn" title="Voir en grand" aria-label="Agrandir" onclick="event.stopPropagation();openPhotoLightbox('${IMG(card.image)}','${jss(card.name)}')"><svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.8"/><path d="m20 20-3.2-3.2M11 8v6M8 11h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>` : ''}
        </div>
      </div>
      <div class="detail-info">
        <div class="detail-name">${esc(card.name)}</div>
        <div class="detail-set">${esc(card.set?.name || '')}</div>
        <div class="detail-price-box">
          <div class="detail-price-label">Prix loose</div>
          <!-- Refaire la cote de CETTE carte. C'est ici que passent les cartes
               qui ne sont pas au portefeuille (wishlists, classeurs,
               Milobellus) : sans ce bouton, plus aucun moyen de les recoter
               depuis que le « Sync » global n'existe plus. -->
          <button class="cardtile-sync detail-price-sync" id="cd-sync" onclick="syncDetailPrice('${esc(cardId)}',event)"
            title="Refaire la cote de cette carte" aria-label="Refaire la cote de cette carte">
            <svg class="ico-sync" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20.5 12a8.5 8.5 0 0 1-13.9 6.6M3.5 12a8.5 8.5 0 0 1 13.9-6.6" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/><path d="M17.4 2.2v3.6h-3.6M6.6 21.8v-3.6h3.6" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <div class="detail-price-val" id="cd-raw"><span class="cv-skeleton" style="display:inline-block;width:74px;height:1em"></span></div>
          <div class="detail-price-note" id="cd-note">Cote Cardmarket…</div>
        </div>
        <div class="detail-rows">${rows.map((r, i) => `<div class="detail-row stagger" style="--i:${i}"><span class="detail-row-key">${esc(r[0])}</span><span class="detail-row-val">${esc(String(r[1]))}</span></div>`).join('')}</div>
        <div class="detail-actions">
          <a class="btn btn-cm" href="${ebaySoldLink((card.name + ' ' + cardNumStr(card.localId, card.set?.cardCount?.official)).trim())}" target="_blank" rel="noopener">Voir les ventes eBay</a>
          <a class="btn btn-cm" id="cd-cm" href="${_cmUrlStore[cardId] || cmSearchLink(cachedEnName(cardId) || card.name)}" target="_blank" rel="noopener">Voir sur Cardmarket</a>
        </div>
      </div>
    </div>`;
  hydrateFallbackImages(body);
  attachSpotlights(body);
  boundedTask(getRawPrice(cardId), 20000).then(p => {
    const el = document.getElementById('cd-raw'), note = document.getElementById('cd-note');
    if (!el || !el.isConnected) return;
    el.textContent = fmt(p?.raw ?? null);
    if (note) note.textContent = p?.raw != null ? coteSourceLabel(p) : 'Aucune cote disponible';
  });
  boundedTask(resolveCmUrl(cardId), 15000).then(u => {
    const a = document.getElementById('cd-cm');
    if (u && a && a.isConnected) a.href = u;
  });
}
function openCreateWishlist() {
  document.getElementById('wishlist-name-input').value = '';
  openModal('modal-create-wishlist');
  setTimeout(() => document.getElementById('wishlist-name-input').focus(), 100);
}
function createWishlist() {
  const name = document.getElementById('wishlist-name-input').value.trim();
  if (!name) { toast('Donne un nom à ta wishlist', 'error'); return; }
  const w = { id: uid(), name, cards: [] };
  closeModal('modal-create-wishlist');
  flashBusy('Création de la wishlist…', () => {
    state.wishlists.push(w); save();
    navigate('wishlist-detail', { activeWishlistId: w.id });
    toast(`Wishlist « ${name} » créée`, 'success');
  });
}
function confirmDeleteWishlist(id) {
  if (confirm('Supprimer cette wishlist ?')) { state.wishlists = state.wishlists.filter(w => w.id !== id); save(); navigate('wishlists'); toast('Wishlist supprimée'); }
}
function openRenameWishlist(id) {
  const w = state.wishlists.find(x => x.id === id);
  if (!w) return;
  document.getElementById('rename-wishlist-id').value = id;
  const input = document.getElementById('rename-wishlist-input');
  input.value = w.name;
  openModal('modal-rename-wishlist');
  setTimeout(() => { input.focus(); input.select(); }, 100);
}
function confirmRenameWishlist() {
  const id = document.getElementById('rename-wishlist-id').value;
  const name = document.getElementById('rename-wishlist-input').value.trim();
  const w = state.wishlists.find(x => x.id === id);
  if (!w) { closeModal('modal-rename-wishlist'); return; }
  if (!name) { toast('Donne un nom à ta wishlist', 'error'); return; }
  if (name === w.name) { closeModal('modal-rename-wishlist'); return; }
  w.name = name; save();
  closeModal('modal-rename-wishlist');
  // Re-rend la vue courante (détail ou liste) pour refléter le nouveau nom
  if (state.view === 'wishlist-detail') renderWishlistDetail();
  else if (state.view === 'wishlists') renderWishlists();
  else renderViewContent(state.view);
  toast('Wishlist renommée', 'success');
}

async function openCardPicker(mode, slot) {
  Object.assign(state, { pickerMode: mode, pickerSeries: null, pickerSet: null, pickerCards: [], pickerSearch: '', pickerSetIds: null, pickerSubsets: [], sessionAdded: 0, pickerBinderSlot: (slot == null ? null : slot) });
  const title = mode === 'wish' || mode === 'binder' ? 'Ajouter des cartes' : mode === 'hero' ? 'Choisir la pièce maîtresse' : 'Choisir une carte';
  document.getElementById('picker-title').textContent = title;
  document.getElementById('picker-footer').style.display = (mode === 'wish' || mode === 'binder') ? 'flex' : 'none';
  updatePickerFooter();
  openModal('modal-card-picker');
  bindPickerDelegation();
  await renderPickerSeries();
}
// Navigation du picker par DÉLÉGATION d'événements (au lieu d'onclick inline
// interpolant nom/image). Robuste à TOUS les caractères des noms de cartes :
// « Taupiqueur d'Alola », « Amulette de l'Espoir »... dont l'apostrophe cassait
// la chaîne JS de l'ancien onclick et empêchait l'ajout. Les données sont
// lues via data-* / state.pickerCards, jamais évaluées comme du code.
function bindPickerDelegation() {
  const body = document.getElementById('picker-body');
  if (!body || body._pickerDelegated) return;
  body._pickerDelegated = true;
  body.addEventListener('click', e => {
    const back = e.target.closest('[data-back]');
    if (back) { back.getAttribute('data-back') === 'series' ? renderPickerSeries() : pickSeries(state.pickerSeries, state.pickerSeriesName); return; }
    const serie = e.target.closest('[data-serie]');
    if (serie) { pickSeries(serie.getAttribute('data-serie'), serie.getAttribute('data-serie-name') || ''); return; }
    const set = e.target.closest('[data-set]');
    if (set) { pickSet(set.getAttribute('data-set')); return; }
    const pick = e.target.closest('[data-pick]');
    if (pick) { pickCardFromCatalog(pick.getAttribute('data-pick')); return; }
  });
}
// Ajoute/retire une carte du catalogue depuis son id (lookup dans pickerCards) —
// aucune donnée n'est injectée dans du code, d'où la robustesse.
function pickCardFromCatalog(id) {
  const c = state.pickerCards.find(x => String(x.id) === String(id));
  if (!c) return;
  // `__set` quand la carte vient d'une sous-série (Galerie de Dresseurs…) :
  // elle doit garder son vrai set, pas celui du parent affiché.
  pickCard(c.id, c.name, c.image || '', c.__setName || state.pickerSetName, c.__set || state.pickerSet, c.localId);
}
function updatePickerFooter() {
  const el = document.getElementById('picker-added-count');
  if (el) el.textContent = state.sessionAdded > 0 ? `${state.sessionAdded} ajoutée${state.sessionAdded>1?'s':''}` : 'Clique les cartes à ajouter';
}
// Indicateur d'étape du parcours d'ajout : Série › Bloc › Carte.
function pickerSteps(active) {
  const s = ['Série', 'Bloc', 'Carte'];
  return `<div class="picker-steps">${s.map((l, i) =>
    `<span class="pstep ${i < active ? 'done' : ''} ${i === active ? 'on' : ''}"><b>${i < active ? ICO.check : i + 1}</b><span>${l}</span></span>`
  ).join('<span class="pstep-sep"></span>')}</div>`;
}
async function renderPickerSeries() {
  const body = document.getElementById('picker-body');
  body.innerHTML = `<div class="loading-state"><div class="spinner"></div> Chargement des séries…</div>`;
  try {
    // L'API renvoie les séries dans l'ordre chronologique (Base → … → Écarlate
    // et Violet). On retire le TCG Pocket et on inverse : les blocs récents d'abord.
    const series = (await apiFetch('/series'))
      .filter(s => s.id !== 'tcgp' && !/pocket/i.test(s.name || '') && !/pocket/i.test(s.id || ''))
      .slice().reverse();
    body.innerHTML = `
      ${pickerSteps(0)}
      <div class="picker-lead"><span class="picker-eyebrow">Catalogue complet</span><h3 class="picker-heading">Choisis une série</h3></div>
      <div class="search-bar"><div class="search-input-wrap"><span class="search-icon">🔍</span>
        <input class="input" placeholder="Rechercher une série…" oninput="filterSeries(this.value)" autofocus></div></div>
      <div class="series-grid" id="series-grid">
        ${series.map((s, i) => `<div class="series-item stagger" style="--i:${Math.min(i,14)}" onmouseenter="prefetchSeries('${s.id}')" data-serie="${esc(s.id)}" data-serie-name="${esc(s.name)}">
          <div class="series-logo-wrap">
            ${s.logo
              ? `<img class="series-logo" src="${s.logo}.png" alt="${esc(s.name)}" onerror="this.parentElement.innerHTML='<div class=\\'series-fallback\\'>◆</div>'">`
              : `<div class="series-fallback">◆</div>`}
          </div>
          <div class="series-name">${esc(s.name)}</div></div>`).join('')}
      </div>`;
  } catch (e) { console.error('[picker] séries', e); body.innerHTML = errBox('retryPicker()', e); }
}
function filterSeries(q) {
  document.querySelectorAll('#series-grid .series-item').forEach(el => { el.style.display = el.textContent.toLowerCase().includes(q.toLowerCase()) ? '' : 'none'; });
}
async function pickSeries(serieId, serieName) {
  state.pickerSeries = serieId; state.pickerSeriesName = serieName;
  const body = document.getElementById('picker-body');
  body.innerHTML = `<div class="loading-state"><div class="spinner"></div> Chargement des sets…</div>`;
  try {
    const serie = await apiFetch(`/series/${serieId}`);
    // Blocs les plus récents en premier (l'API les classe du plus ancien au plus récent).
    const all = (serie.sets || []).slice().reverse();
    state.pickerSetIds = all.map(x => x.id);   // sert à trouver les sous-séries (voir pickSet)
    // Les galeries (TG/GG/SV) ne sont pas des blocs à part pour un
    // collectionneur : leur tuile DOUBLONNAIT celle du set parent, alors que
    // pickSet fusionne déjà les deux jeux de cartes. On les replie donc dans le
    // parent, dont le compteur reprend leurs cartes.
    const ids = new Set(all.map(x => String(x.id)));
    const subCount = {};
    const sets = all.filter(x => {
      const parent = subsetParentId(x.id);
      if (!parent || !ids.has(parent)) return true;
      subCount[parent] = (subCount[parent] || 0) + (x.cardCount?.official || x.cardCount?.total || 0);
      return false;
    });
    body.innerHTML = `
      ${pickerSteps(1)}
      <div class="picker-nav">
        <button class="picker-back" data-back="series">${ICO.left}<span>Séries</span></button>
        <span class="picker-crumb"><b>${esc(serie.name)}</b> · ${sets.length} bloc${sets.length>1?'s':''}</span>
      </div>
      <div class="series-grid">
        ${sets.map((s, i) => `<div class="series-item stagger" style="--i:${Math.min(i,14)}" onmouseenter="prefetchSet('${s.id}')" data-set="${esc(s.id)}">
          <div class="series-logo-wrap">
            ${s.logo
              ? `<img class="series-logo" src="${s.logo}.png" alt="${esc(s.name)}" onerror="this.parentElement.innerHTML='<div class=\\'series-fallback\\'>◆</div>'">`
              : `<div class="series-fallback">◆</div>`}
          </div>
          <div class="series-name">${esc(s.name)}</div><div class="series-count">${s.cardCount?.official ? s.cardCount.official + (subCount[s.id] || 0) : '?'} cartes</div></div>`).join('')}
      </div>`;
  } catch (e) { console.error('[picker] sets', e); body.innerHTML = errBox('retryPicker()', e); }
}
// Sous-séries : chez TCGdex, la « Galerie de Dresseurs » (TG), la « Galerie
// Galaroise » (GG) et le « Shiny Vault » (SV) sont des SETS À PART
// (`swsh12tg`…), alors que pour le collectionneur ce sont les mêmes boosters.
// Ouvrir « Tempête Argentée » ne montrait donc pas ses 30 cartes TG, et il n'y
// avait aucun moyen d'y arriver depuis là — surtout depuis le « + » d'une
// série, qui entre directement dans le set.
const SUBSET_SUFFIXES = ['tg', 'gg', 'sv'];
async function pickSet(setId) {
  state.pickerSet = setId; state.pickerSearch = ''; state.pickerSubsets = [];
  const body = document.getElementById('picker-body');
  body.innerHTML = `<div class="loading-state"><div class="spinner"></div> Chargement des cartes…</div>`;
  try {
    const set = await apiFetch(`/sets/${setId}`);
    state.pickerSetName = set.name;
    // Chaque carte garde SON set d'origine (`__set`) : une carte TG doit être
    // enregistrée sous `swsh12tg`, sinon sa cote et son lien Cardmarket
    // pointeraient sur la mauvaise fiche.
    let cards = (set.cards || []).map(c => Object.assign({}, c, { __set: setId, __setName: set.name }));
    // On ne devine pas les sets : on regarde ceux qui existent VRAIMENT dans la
    // série (un /sets/inexistant coûterait 3 tentatives et ~3 s chacun).
    let known = state.pickerSetIds;
    if (!known && set.serie?.id) {
      const serie = await apiFetch(`/series/${set.serie.id}`).catch(() => null);
      known = (serie?.sets || []).map(x => x.id);
    }
    for (const suf of SUBSET_SUFFIXES) {
      const subId = setId + suf;
      if (setId.endsWith(suf) || !known || !known.includes(subId)) continue;
      const sub = await apiFetch(`/sets/${subId}`).catch(() => null);
      if (sub?.cards?.length) {
        cards = cards.concat(sub.cards.map(c => Object.assign({}, c, { __set: sub.id, __setName: sub.name })));
        state.pickerSubsets = (state.pickerSubsets || []).concat(sub.name);
      }
    }
    state.pickerCards = cards;
    renderPickerCards();
  } catch (e) { console.error('[picker] cartes', e); body.innerHTML = errBox('retryPicker()', e); }
}
function renderPickerCards() {
  const body = document.getElementById('picker-body');
  const q = state.pickerSearch.toLowerCase();
  const filtered = state.pickerCards.filter(c => c.name?.toLowerCase().includes(q) || String(c.localId).includes(q));
  const w = state.wishlists.find(x => x.id === state.activeWishlistId);
  const bndr = state.pickerMode === 'binder' ? binderById(state.currentBinder) : null;
  // NB : les cartes d'un binder peuvent être null (pochettes vides) → on GARDE
  // le `c &&`, sans quoi .some lève un TypeError qui remontait en « Erreur de
  // chargement » sur TOUT le picker dès qu'un binder avait une pochette vide.
  // Cartes DÉJÀ possédées, par identifiant : en mode portefeuille, l'info
  // n'existait qu'APRÈS le clic (un toast, et le sélecteur se fermait). On la
  // montre maintenant sur la vignette, avec la quantité quand il y en a
  // plusieurs — c'est ce qu'on veut savoir en parcourant un set de 200 cartes.
  const invQty = {};
  if (state.pickerMode === 'investCard') {
    for (const p of state.investCards) {
      if (p && p.cardId) invQty[p.cardId] = (invQty[p.cardId] || 0) + (Number(p.qty) || 1);
    }
  }
  const inList = id => (state.pickerMode === 'wish' && w?.cards.some(c => c && c.id === id))
    || (state.pickerMode === 'binder' && bndr?.cards.some(c => c && c.id === id))
    || (state.pickerMode === 'investCard' && !!invQty[id]);
  body.innerHTML = `
    ${pickerSteps(2)}
    <div class="picker-nav">
      <button class="picker-back" data-back="sets">${ICO.left}<span>${esc(state.pickerSeriesName)}</span></button>
      <span class="picker-crumb"><b>${esc(state.pickerSetName)}</b></span>
    </div>
    <div class="search-bar"><div class="search-input-wrap"><span class="search-icon">🔍</span>
      <input class="input" placeholder="Rechercher dans ce set…" value="${esc(state.pickerSearch)}" oninput="searchPicker(this.value)"></div></div>
    <div class="picker-toolbar"><span class="picker-count">${filtered.length} carte${filtered.length>1?'s':''}${state.pickerMode==='investCard' ? ` · ${filtered.filter(x=>invQty[x.id]).length} déjà à toi` : ''}${(state.pickerMode==='wish'||state.pickerMode==='binder')?' · clique pour ajouter':''}</span></div>
    <div class="card-picker-grid">
      ${filtered.map((c, i) => {
        const u = IMG(c.image, 'low');
        const have = inList(c.id), q = invQty[c.id] || 0;
        return `<div class="card-picker-item ${have?'added':''} stagger" style="--i:${Math.min(i,18)}" data-pick="${esc(String(c.id))}"${have?' title="Déjà dans ton portefeuille"':''}>
          <span class="card-picker-check" aria-hidden="true">${q > 1 ? '×' + q : ICO.check}</span>
          ${have && state.pickerMode === 'investCard' ? '<span class="card-picker-have">Déjà à toi</span>' : ''}
          ${u ? `<img src="${u}" onerror="imgFail(this,'${esc(String(c.localId||''))}','${esc(state.pickerSet||'')}','${jss(c.name)}')" alt="" loading="lazy">` : noImgHTML(c.localId, c.name, state.pickerSet)}
          <div class="card-picker-name">${esc(c.name)}</div></div>`;
      }).join('')}
    </div>`;
  // Répare la DONNÉE une fois un visuel de repli trouvé : le clic (délégué,
  // lookup dans pickerCards) prendra automatiquement le bon visuel — plus
  // besoin de réécrire un onclick.
  hydrateFallbackImages(body, (setId, localId, found) => {
    const c = state.pickerCards.find(x => String(x.localId) === String(localId));
    if (c) c.image = found;
  });
}
function searchPicker(q) { state.pickerSearch = q; renderPickerCards(); }
function pickCard(id, name, image, setName, setId, localId) {
  if (state.pickerMode === 'hero') {
    state.heroRef = { type: 'loose', id, cardId: id, name, image, setName, setId, localId };
    save(); closeModal('modal-card-picker');
    // Cote la carte choisie si on ne l'a jamais vue, puis rafraîchit la puce.
    ensurePrices([id], n => { if (n && state.view === 'home') renderHome(); });
    if (state.view === 'home') renderHome();
    toast('Pièce maîtresse mise à jour', 'success');
    return;
  }
  if (state.pickerMode === 'investCard') {
    // Cible existante → on la rattache ; sinon on CRÉE la carte maintenant
    // (annuler le sélecteur n'aura donc rien ajouté).
    let p = state._investCardTarget ? state.investCards.find(x => x.id === state._investCardTarget) : null;
    const isNew = !p;
    if (isNew) {
      if (state.investCards.some(x => x.cardId === id)) {
        // On NE ferme plus le sélecteur : fermer toute la fenêtre parce qu'on a
        // touché une carte déjà possédée, au milieu d'un set de 200, était une
        // punition. La vignette est de toute façon marquée « Déjà à toi ».
        toast('Cette carte est déjà dans ton portefeuille', 'error');
        return;
      }
      p = { id: sealedUid(), cardId: null, name: '', setId: '', setName: '', logo: null, number: '', localId: '', rarity: '', type: '', qty: 1, image: '', buyPrice: null };
      state.investCards.push(p);
    }
    p.cardId = id; p.image = image || p.image; p.setName = setName || p.setName; p.setId = setId || p.setId; p.localId = localId || p.localId;
    if (!p.name) p.name = name;
    if (!p.number && localId) p.number = String(localId);
    const info = getCachedSetInfo(setId);
    if (info) { if (info.logo) p.logo = info.logo; if (!p.rarity) { const c = (info.cards || []).find(x => x.id === id); if (c && c.rarity) p.rarity = c.rarity; } }
    state._investCardTarget = null;
    save(); investBadge();
    closeModal('modal-card-picker');
    if (state.view === 'invest') { state.investMode = 'cards'; renderInvestBody(); }
    // La cote arrive en tâche de fond (elle alimente la valeur affichée).
    getRawPrice(id).then(() => {
      if (state.view === 'invest' && state.investMode === 'cards') {
        const v = document.getElementById('inv-kpi-value'); if (v) v.textContent = fmt(cardsTotalValue());
        if (state.investSeriesOpen) refreshSeriesCotes(state.investSeriesOpen);
      }
    }).catch(() => {});
    ensureSetDates(() => { if (state.view === 'invest' && state.investMode === 'cards' && !state.investSeriesOpen) renderInvestBody(); });
    toast(isNew ? `${name} ajoutée` : 'Carte rattachée', 'success');
    return;
  }
  if (state.pickerMode === 'binder') {
    const b = binderById(state.currentBinder);
    if (!b) return;
    const node = document.querySelector(`.card-picker-item[data-pick="${id}"]`);
    const at = b.cards.findIndex(c => c && c.id === id);
    if (at >= 0) {
      b.cards[at] = null; trimBinderTail(b); node?.classList.remove('added');
      if (state.sessionAdded > 0) state.sessionAdded--;
    } else {
      const card = { id, name, image, setName, setId, localId };
      // Cible = la pochette « + » cliquée (state.pickerBinderSlot) pour que la
      // carte apparaisse LÀ où on l'ajoute (page 2, 3…), pas dans le premier
      // trou de la page 1. Pochette déjà prise → première vide À PARTIR d'elle,
      // sinon la fin. Les cartes suivantes de la session vont aux pochettes qui
      // suivent (état avancé après chaque ajout).
      let target = state.pickerBinderSlot;
      if (target == null || target < 0) {
        target = b.cards.findIndex(c => !c);
        if (target < 0) target = b.cards.length;
      } else if (b.cards[target]) {
        let nxt = -1;
        for (let k = target; k < b.cards.length; k++) { if (!b.cards[k]) { nxt = k; break; } }
        target = nxt >= 0 ? nxt : b.cards.length;
      }
      while (b.cards.length < target) b.cards.push(null);
      b.cards[target] = card;
      state.pickerBinderSlot = target + 1;
      node?.classList.add('added', 'just-added'); setTimeout(() => node?.classList.remove('just-added'), 340);
      state.sessionAdded++;
      ensurePrices([id]);   // cote la nouvelle carte en tâche de fond
    }
    save(); updatePickerFooter();
    // Feedback immédiat : la carte apparaît dans sa pochette derrière le modal.
    if (state.view === 'binder-detail') refreshSpreadPages();
    return;
  }
  const w = state.wishlists.find(x => x.id === state.activeWishlistId);
  if (!w) return;
  const node = document.querySelector(`.card-picker-item[data-pick="${id}"]`);
  if (w.cards.some(c => c.id === id)) {
    w.cards = w.cards.filter(c => c.id !== id); node?.classList.remove('added');
    if (state.sessionAdded > 0) state.sessionAdded--;
  } else {
    w.cards.push({ id, name, image, setName, setId, localId, owned: false });
    node?.classList.add('added', 'just-added'); setTimeout(() => node?.classList.remove('just-added'), 340);
    state.sessionAdded++;
    ensurePrices([id]);   // cote la nouvelle carte en tâche de fond
  }
  save(); updatePickerFooter();
}
function finishPicker() {
  closeModal('modal-card-picker');
  if (state.pickerMode === 'binder') refreshSpreadPages();   // en place, sans réouvrir la couverture
  else renderWishlistDetail();
  if (state.sessionAdded > 0) toast(`${state.sessionAdded} carte${state.sessionAdded>1?'s':''} ajoutée${state.sessionAdded>1?'s':''}`, 'success');
}
// retry : nom d'un appel global (sans donnée utilisateur → onclick sûr) à
// rejouer au clic sur « Réessayer ». Fini les impasses sur un hoquet réseau.
function errBox(retry, err) {
  const detail = err ? esc(String(err && err.message ? err.message : err)).slice(0, 200) : '';
  return `<div class="empty-state"><div class="empty-state-icon">${ICO.info}</div><div class="empty-state-title">Erreur de chargement</div><div class="empty-state-sub">Vérifie ta connexion internet</div>${detail ? `<div class="empty-state-sub" style="opacity:.6;font-size:12px;margin-top:6px">détail : ${detail}</div>` : ''}${retry ? `<button class="btn btn-wish" style="margin-top:16px" onclick="${retry}">Réessayer</button>` : ''}</div>`;
}
// Rejoue la dernière étape du picker selon l'endroit où l'on était.
function retryPicker() {
  if (state.pickerSet) pickSet(state.pickerSet);
  else if (state.pickerSeries) pickSeries(state.pickerSeries, state.pickerSeriesName);
  else renderPickerSeries();
}

/* ═══════════════════════════════════════════════════════════════════
   MILOBELLUS — le classeur 3D (binder) de la collection signature
   Toutes les cartes Milobellus du catalogue tcgdex, reverses comprises,
   des origines à aujourd'hui. 4 cartes par page (2×2), pages qui se
   tournent en 3D. Chaque case se coche « possédée / non ».
   ═══════════════════════════════════════════════════════════════════ */
const MILO_NAME = 'Milobellus';
const MILO_ACCENT = '#2E8BD6';        // type Eau — signature « Prisme »
const MILO_PER_PAGE = 4;              // grille 2×2
const MILO_NUM_OVERRIDE = {
  'ex9-96': 7,     // inverse les 2 Milobellus d'EX Émeraude (le ex #96 passe avant le #8)
  'pl3-SH7': 35.5, // la secrète shiny prend la pochette laissée par la reverse du #35 (haut-droite de la page 3)
};
// Une version reverse existe pour les communes / peu communes / rares (y compris
// holo rare), mais PAS pour les ex, V / VMAX / VSTAR / GX, les cartes Trainer
// Gallery, ni la secrète de Vainqueurs Suprêmes (pl3-SH7).
const MILO_SKIP_REVERSE = new Set([
  'pl3-SH7',   // secrète de Vainqueurs Suprêmes
  'pl3-35',    // reverse de Vainqueurs Suprêmes retirée (remplacée par la secrète SH7)
  'ex5-12',    // 1ère reverse (EX Légendes Oubliées) — jamais achetée
]);
function miloHasReverse(c) {
  if (!c) return false;
  const id = c.id || '';
  if (MILO_SKIP_REVERSE.has(id)) return false;
  if (/tg-/i.test(id)) return false;                  // Trainer Gallery
  const name = (c.name || '').toLowerCase();
  if (/(^|[\s-])(ex|v|vmax|vstar|gx)($|[\s-])/.test(name)) return false; // ex / V / VMAX / VSTAR / GX
  const r = (c.rarity || '').toLowerCase();
  if (/double|ultra|illustration|hyper|secr|rainbow|prisme|chromatique/.test(r)) return false; // raretés « ultra » et +
  return true;                                        // commune / peu commune / rare / holo rare
}
let _miloSlots = null;                // cache session : liste triée des cases
let _miloPromise = null;
let _miloState = { spread: 0, opened: false, flipping: false };
let _miloFlipGuard = 0;   // chien de garde du flip WebGL (voir miloTurn)

function miloReduce() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
function miloOwnedCount() { return Object.values(state.milobellus || {}).filter(Boolean).length; }
function miloIsOwned(key) { return !!(state.milobellus && state.milobellus[key]); }
function miloYear(date) { return date ? String(date).slice(0, 4) : ''; }
// Nombre de pages du classeur OUVERT. Un classeur custom garde toujours au
// moins une pochette vide (c'est l'affordance « ajouter une carte »).
function miloTotalPages() {
  const ctx = binderCtx();
  const n = ctx.owned ? ctx.slots.length : ctx.slots.length + 1;
  let pages = Math.max(2, Math.ceil(n / ctx.perPage));
  // Classeur custom : des pages vides ajoutées à la main (« + page ») peuvent
  // dépasser le strict nécessaire — on honore ce minimum choisi.
  if (!ctx.owned && ctx.binder && ctx.binder.pages) pages = Math.max(pages, ctx.binder.pages);
  return pages;
}
// Répartition « vrai livre » : la page 1 est seule à DROITE du premier spread
// (à gauche, l'intérieur de couverture). Ensuite gauche = paire, droite = impaire.
function miloLeftIdx(S) { return S === 0 ? -1 : S * 2 - 1; }
function miloRightIdx(S) { return S * 2; }
function miloTotalSpreads() { return Math.max(1, Math.ceil((miloTotalPages() + 1) / 2)); }

// Emblème « écaille d'eau » (SVG vectoriel, aucune émoji) — utilisé sur la
// couverture du classeur et le teaser d'accueil.
function miloEmblemSVG() {
  return `<svg class="milo-emblem-svg" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="miloG1" x1="20" y1="6" x2="100" y2="114" gradientUnits="userSpaceOnUse">
        <stop stop-color="#aef0ff"/><stop offset=".5" stop-color="#3aa0e6"/><stop offset="1" stop-color="#12579b"/>
      </linearGradient>
      <radialGradient id="miloG2" cx="0" cy="0" r="1" gradientTransform="translate(52 44) scale(48)" gradientUnits="userSpaceOnUse">
        <stop stop-color="#f4ffff"/><stop offset=".55" stop-color="#5cc7f5"/><stop offset="1" stop-color="#1b6fb8" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <path d="M60 6 108 60 60 114 12 60Z" fill="url(#miloG1)" stroke="#cdefff" stroke-opacity=".55" stroke-width="1.5"/>
    <path d="M60 20 94 60 60 100 26 60Z" fill="#08131f" fill-opacity=".36"/>
    <circle cx="54" cy="46" r="34" fill="url(#miloG2)" opacity=".9"/>
    <path d="M60 30 84 60 60 90 36 60Z" fill="url(#miloG1)" opacity=".85"/>
    <path d="M60 6 108 60 60 34 12 60Z" fill="#ffffff" opacity=".14"/>
  </svg>`;
}

// Charge (une seule fois par session) toutes les cartes Milobellus + leurs
// variantes reverse, triées de la plus ancienne à la plus récente. Le réseau
// est tolérant : toute requête qui échoue est simplement ignorée.
function ensureMiloData() {
  if (_miloSlots) return Promise.resolve(_miloSlots);
  if (_miloPromise) return _miloPromise;
  _miloPromise = (async () => {
    const brief = await apiFetch(`/cards?name=${encodeURIComponent(MILO_NAME)}`).catch(() => []);
    const list = Array.isArray(brief) ? brief : [];
    // Fiche complète (variantes + set) pour chaque carte, en parallèle borné.
    const full = new Array(list.length);
    await runPool(list.map((c, i) => ({ c, i })), async ({ c, i }) => {
      full[i] = await apiFetch(`/cards/${c.id}`).catch(() => null);
    }, 6);
    // Sets uniques → date de sortie + série (pour trier et exclure TCG Pocket).
    const setIds = [...new Set(full.filter(Boolean).map(c => c.set && c.set.id).filter(Boolean))];
    const setMeta = {};
    await runPool(setIds, async (sid) => {
      const s = await apiFetch(`/sets/${sid}`).catch(() => null);
      if (s) setMeta[sid] = { date: s.releaseDate || '', serie: (s.serie && s.serie.id) || '', name: s.name || sid };
    }, 6);
    const slots = [];
    full.forEach((c, i) => {
      const b = list[i];
      if (!c || !b) return;
      const sid = c.set && c.set.id;
      const meta = sid ? setMeta[sid] : null;
      if (meta && meta.serie === 'tcgp') return;                    // exclut le TCG Pocket
      const base = {
        cardId: c.id,
        name: (c.name || b.name || MILO_NAME).trim(),
        image: b.image || c.image || '',
        setId: sid || '',
        setName: (c.set && c.set.name) || (meta && meta.name) || '',
        localId: b.localId || c.localId || '',
        date: (meta && meta.date) || '',
      };
      slots.push({ ...base, key: c.id, variant: 'normal' });        // version standard
      // Reverse uniquement pour C / PC / R (pas ex, V, TG, ni secrète).
      if (miloHasReverse(c)) slots.push({ ...base, key: c.id + '::reverse', variant: 'reverse' });
    });
    // Numéro de tri : override manuel possible (ex. inverser 2 cartes d'un même set).
    const miloNum = s => (MILO_NUM_OVERRIDE[s.cardId] != null ? MILO_NUM_OVERRIDE[s.cardId] : parseInt(s.localId, 10));
    // Tri chronologique : date du set → numéro dans le set → normale avant reverse.
    slots.sort((a, b) => {
      const da = a.date || '9999-99-99', db = b.date || '9999-99-99';
      if (da !== db) return da < db ? -1 : 1;
      const na = miloNum(a), nb = miloNum(b);
      if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
      if (a.cardId !== b.cardId) return a.cardId < b.cardId ? -1 : 1;
      return (a.variant === 'reverse' ? 1 : 0) - (b.variant === 'reverse' ? 1 : 0);
    });
    _miloSlots = slots;
    // Migration : la reverse pl3-35 a été retirée du catalogue — un éventuel
    // coche « possédée » orphelin fausserait le compteur de progression.
    if (state.milobellus && state.milobellus['pl3-35::reverse']) {
      delete state.milobellus['pl3-35::reverse'];
      save();
    }
    return slots;
  })();
  return _miloPromise;
}

/* ══════════════════════════════════════════════════════════════════
   BINDER — hub des classeurs. Milobellus est le classeur signature
   (catalogue auto + progression) ; les autres sont créés à la main :
   nom, cartes par page (4 ou 9), ajout de cartes via le catalogue.
   ══════════════════════════════════════════════════════════════════ */
function binderById(id) { return state.binders.find(b => b.id === id) || null; }
// Contexte du classeur ouvert : alimente le moteur de livre (pages, textures).
function binderCtx() {
  if (state.currentBinder === 'milobellus') {
    return { id: 'milobellus', slots: _miloSlots || [], perPage: MILO_PER_PAGE, cols: 2, owned: true };
  }
  const b = binderById(state.currentBinder);
  const per = (b && b.perPage) === 9 ? 9 : 4;
  return { id: b ? b.id : '?', slots: (b && b.cards) || [], perPage: per, cols: per === 9 ? 3 : 2, owned: false, binder: b };
}
function openBinder(id) {
  state.currentBinder = id;
  navigate('binder-detail');
}

// ── Hub : l'étagère des classeurs ──────────────────────────────────
function renderBinders() {
  const el = document.getElementById('view-binders');
  setRootAccent(MILO_ACCENT);
  const total = (_miloSlots || []).length;
  const owned = miloOwnedCount();
  const pct = total ? Math.round(owned / total * 100) : 0;
  const customs = state.binders.map((b, i) => {
    const pages = Math.max(2, Math.ceil(((b.cards || []).length + 1) / (b.perPage === 9 ? 9 : 4)), b.pages || 0);
    return `
    <article class="binder-tile spot" style="--i:${i + 1}" role="button" tabindex="0"
      aria-label="Ouvrir le classeur ${esc(b.name)}"
      onclick="openBinder('${b.id}')" onkeydown="if(event.key==='Enter'){openBinder('${b.id}')}">
      <div class="binder-tile-cover">
        <span class="binder-tile-spine" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="binder-tile-stitch" aria-hidden="true"></span>
        <div class="binder-tile-name">${esc(b.name)}</div>
        <div class="binder-tile-meta">${(b.cards || []).length} carte${(b.cards || []).length > 1 ? 's' : ''} · ${pages} pages · ${b.perPage === 9 ? '3×3' : '2×2'}</div>
      </div>
      <div class="binder-tile-actions">
        <button class="binder-act" title="Renommer" onclick="event.stopPropagation();openRenameBinder('${b.id}')"><svg viewBox="0 0 24 24" fill="none"><path d="m14.5 5.5 4 4L8 20H4v-4z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m12.5 7.5 4 4" stroke="currentColor" stroke-width="1.8"/></svg></button>
        <button class="binder-act binder-act-danger" title="Supprimer" onclick="event.stopPropagation();deleteBinder('${b.id}')"><svg viewBox="0 0 24 24" fill="none"><path d="M5 7h14M9 7V5h6v2m-8 0 .7 12.3A1.5 1.5 0 0 0 9.2 20.7h5.6a1.5 1.5 0 0 0 1.5-1.4L17 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </div>
    </article>`;
  }).join('');
  el.innerHTML = `
    <section class="binders-view">
      <header class="binders-head">
        <h1 class="milo-word binders-word" data-text="Binder">Binder</h1>
        <p class="binders-sub">Tes classeurs, feuilletables en 3D — page par page, comme un vrai.</p>
      </header>
      <div class="binder-shelf">
        <article class="binder-tile binder-tile-milo spot" style="--i:0" role="button" tabindex="0"
          aria-label="Ouvrir le classeur Milobellus"
          onclick="openBinder('milobellus')" onkeydown="if(event.key==='Enter'){openBinder('milobellus')}">
          <div class="binder-tile-cover">
            <span class="binder-tile-spine" aria-hidden="true"><i></i><i></i><i></i></span>
            <span class="binder-tile-stitch" aria-hidden="true"></span>
            <span class="binder-tile-emblem" aria-hidden="true"><img src="milobellus-logo.png?v=2" alt=""></span>
            <div class="binder-tile-name">Milobellus</div>
            <div class="binder-tile-meta">${total ? `${owned} / ${total} obtenues` : 'Collection signature'}</div>
            <div class="binder-tile-bar" aria-hidden="true"><i style="width:${pct}%"></i></div>
          </div>
          <span class="binder-tile-tag">Signature</span>
        </article>
        ${customs}
        <button class="binder-tile-new" style="--i:${state.binders.length + 1}" onclick="openCreateBinder()">
          <span class="binder-new-plus" aria-hidden="true">${ICO.plus}</span>
          <span>Nouveau classeur</span>
        </button>
      </div>
    </section>`;
  attachSpotlights(el);
  attachReveals(el);
  // Rafraîchit la tuile Milobellus quand le catalogue arrive.
  if (!_miloSlots) ensureMiloData().then(() => { if (state.view === 'binders') renderBinders(); });
}

// ── CRUD des classeurs ─────────────────────────────────────────────
function openCreateBinder() {
  const inp = document.getElementById('binder-name-input');
  if (inp) inp.value = '';
  window._binderPerPage = 4;
  document.querySelectorAll('#binder-pp-seg .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.pp === '4'));
  openModal('modal-create-binder');
  setTimeout(() => inp && inp.focus(), 60);
}
function setBinderPerPage(pp, btn) {
  window._binderPerPage = pp;
  document.querySelectorAll('#binder-pp-seg .seg-btn').forEach(b => b.classList.toggle('active', b === btn));
}
function createBinder() {
  const inp = document.getElementById('binder-name-input');
  const name = (inp && inp.value || '').trim();
  if (!name) { toast('Donne un nom à ton classeur', 'error'); return; }
  const b = { id: 'b' + Date.now().toString(36), name, perPage: window._binderPerPage === 9 ? 9 : 4, cards: [] };
  state.binders.push(b);
  save();
  closeModal('modal-create-binder');
  toast('Classeur créé', 'success');
  openBinder(b.id);
}
function openRenameBinder(id) {
  const b = binderById(id);
  if (!b) return;
  window._renameBinderId = id;
  const inp = document.getElementById('binder-rename-input');
  if (inp) inp.value = b.name;
  openModal('modal-rename-binder');
  setTimeout(() => { if (inp) { inp.focus(); inp.select(); } }, 60);
}
function renameBinder() {
  const b = binderById(window._renameBinderId);
  const inp = document.getElementById('binder-rename-input');
  const name = (inp && inp.value || '').trim();
  if (!b || !name) return;
  b.name = name;
  save();
  closeModal('modal-rename-binder');
  if (state.view === 'binders') renderBinders();
  else if (state.view === 'binder-detail') renderBinderDetail();
  toast('Classeur renommé', 'success');
}
function deleteBinder(id) {
  const b = binderById(id);
  if (!b) return;
  if (!confirm(`Supprimer le classeur « ${b.name} » ?`)) return;
  state.binders = state.binders.filter(x => x.id !== id);
  save();
  if (state.view === 'binders') renderBinders();
  toast('Classeur supprimé', 'success');
}
// Retire une carte : laisse une pochette vide à sa place (comme un vrai
// classeur), puis compacte les pochettes vides en fin de classeur.
function trimBinderTail(b) { while (b.cards.length && !b.cards[b.cards.length - 1]) b.cards.pop(); }
function removeBinderCard(idx) {
  const b = binderById(state.currentBinder);
  if (!b || !b.cards[idx]) return;
  const name = b.cards[idx].name;
  b.cards[idx] = null;
  trimBinderTail(b);
  save();
  refreshSpreadPages();
  toast(`${name} retirée du classeur`, '');
}
// Ajoute une page vierge au classeur custom ouvert (pochettes « + » prêtes à
// recevoir des cartes), puis feuillette jusqu'à elle.
function addBinderPage() {
  const b = binderById(state.currentBinder);
  if (!b) return;
  b.pages = miloTotalPages() + 1;
  save();
  updateMiloControls();
  const target = miloTotalSpreads() - 1;
  if (_miloState.spread < target && !_miloState.flipping) miloTurn(1);
  toast('Page ajoutée au classeur', 'success');
}
// Re-rend la double-page courante EN PLACE (pas de réouverture de couverture).
function refreshSpreadPages() {
  const left = document.getElementById('milo-page-left');
  const right = document.getElementById('milo-page-right');
  if (!left || !right) return;
  const spreads = miloTotalSpreads();
  if (_miloState.spread > spreads - 1) _miloState.spread = spreads - 1;
  const S = _miloState.spread;
  left.innerHTML = miloPageHTML(miloLeftIdx(S));
  right.innerHTML = miloPageHTML(miloRightIdx(S));
  hydrateFallbackImages(document.getElementById('milo-binder-wrap'));
  updateMiloControls();
  // Compteur du hero custom.
  const meta = document.querySelector('.binder-hero-meta span');
  const ctx = binderCtx();
  if (meta && !ctx.owned) meta.innerHTML = `${ctx.slots.filter(Boolean).length} carte${ctx.slots.filter(Boolean).length > 1 ? 's' : ''} · ${ctx.perPage === 9 ? '3×3' : '2×2'} par page · ajoute avec les pochettes <b>+</b> · glisse une carte pour la déplacer`;
  mfgWarm();
}

// ── Détail : le classeur 3D ────────────────────────────────────────
function renderBinderDetail() {
  const el = document.getElementById('view-binder-detail');
  const ctx = binderCtx();
  const isMilo = ctx.id === 'milobellus';
  if (isMilo) setRootAccent(MILO_ACCENT);
  const backBtn = `<button class="back-btn milo-back" onclick="navigate('binders')">${ICO.left}<span>Classeurs</span></button>`;
  const hero = isMilo ? `
      <header class="milo-hero">
        <div class="milo-hero-row">
          <img class="milo-hero-logo" src="milobellus-logo.png?v=2" alt="">
          <h1 class="milo-word" data-text="Milobellus">Milobellus</h1>
        </div>
        <div class="milo-progress-wrap">
          <div class="milo-progress"><div class="milo-progress-fill" id="milo-owned-fill" style="width:0%"></div></div>
          <div class="milo-progress-legend"><b id="milo-owned">${miloOwnedCount()}</b> <span>/</span> <span id="milo-total">—</span> <span>obtenues</span></div>
        </div>
      </header>` : `
      <header class="milo-hero binder-hero">
        <h1 class="milo-word binder-word-custom" data-text="${esc(ctx.binder ? ctx.binder.name : '')}">${esc(ctx.binder ? ctx.binder.name : '')}</h1>
        <div class="binder-hero-meta">
          <span>${ctx.slots.filter(Boolean).length} carte${ctx.slots.filter(Boolean).length > 1 ? 's' : ''} · ${ctx.perPage === 9 ? '3×3' : '2×2'} par page · ajoute avec les pochettes <b>+</b> · glisse une carte pour la déplacer</span>
          <button class="btn btn-ghost btn-sm binder-add-page" onclick="addBinderPage()" title="Ajouter une page vierge">${PLUS}Ajouter une page</button>
        </div>
      </header>`;
  el.innerHTML = `
    <section class="milo-view">
      ${isMilo ? `<canvas class="milo-bg-canvas" id="milo-bg-canvas" aria-hidden="true"></canvas>
      <div class="milo-bg-veil" aria-hidden="true"></div>` : `<div class="milo-bg-veil" aria-hidden="true"></div>`}
      ${backBtn}
      ${hero}
      <div class="milo-binder-wrap" id="milo-binder-wrap">
        <div class="milo-loading"><div class="spinner"></div><span>Ouverture du classeur…</span></div>
      </div>
    </section>`;
  syncMiloHeadroom();
  if (isMilo) {
    initMiloScene();
    ensureMiloData().then(slots => {
      if (state.view !== 'binder-detail' || state.currentBinder !== 'milobellus') return;
      if (!slots.length) { const w = document.getElementById('milo-binder-wrap'); if (w) w.innerHTML = errBox(); return; }
      buildBinder(slots);
    }).catch(() => {
      const w = document.getElementById('milo-binder-wrap');
      if (w) w.innerHTML = errBox();
    });
  } else {
    buildBinder(ctx.slots);
  }
}
// Mesure la hauteur réelle du header (elle varie selon que la nav passe ou non
// sous le logo) et l'expose en variable CSS pour que la vue Milobellus tienne
// pile dans un écran, sans scroll. Réévaluée au resize.
function syncMiloHeadroom() {
  // Espace réellement occupé AU-DESSUS de la vue = bas du header sticky (inclut
  // son éventuel décalage). Mesuré en rAF pour laisser le layout se stabiliser.
  const measure = () => {
    const h = document.querySelector('.app-header');
    if (!h) return;
    const top = Math.round(h.getBoundingClientRect().bottom + window.scrollY);
    if (top > 20) document.documentElement.style.setProperty('--milo-headroom', top + 'px');
  };
  measure();
  requestAnimationFrame(measure);
  if (!window._miloHeadroomBound) {
    window._miloHeadroomBound = true;
    window.addEventListener('resize', () => { if (state.view === 'binder-detail') syncMiloHeadroom(); });
  }
}
// Progression (compteur + jauge) dans le hero — Milobellus uniquement.
function updateMiloProgress() {
  if (state.currentBinder !== 'milobellus') return;
  const total = (_miloSlots || []).length;
  const owned = miloOwnedCount();
  const o = document.getElementById('milo-owned'); if (o) o.textContent = owned;
  const t = document.getElementById('milo-total'); if (t) t.textContent = total || '—';
  const f = document.getElementById('milo-owned-fill'); if (f) f.style.width = (total ? Math.round(owned / total * 100) : 0) + '%';
}

// Grille d'une page (2×2 ou 3×3 selon le classeur). Les cases au-delà de la
// liste deviennent des pochettes vides — cliquables dans un classeur custom.
function miloPageHTML(pageIndex) {
  const ctx = binderCtx();
  // Intérieur de couverture (page -1) : face vierge, comme un vrai classeur.
  if (pageIndex < 0) return `<div class="milo-page-inner milo-inner-cover" aria-hidden="true"></div>`;
  const start = pageIndex * ctx.perPage;
  let cells = '';
  for (let i = 0; i < ctx.perPage; i++) {
    const s = ctx.slots[start + i];
    if (s) cells += miloCellHTML(s, ctx, start + i);
    else if (!ctx.owned) cells += `<button class="milo-cell is-empty is-add" data-slot="${start + i}" title="Ajouter une carte" onclick="openCardPicker('binder', ${start + i})"><span class="milo-add-plus" aria-hidden="true">${PLUS}</span></button>`;
    else cells += `<div class="milo-cell is-empty" aria-hidden="true"></div>`;
  }
  return `<div class="milo-page-inner"><div class="milo-grid ${ctx.cols === 3 ? 'cols-3' : ''}">${cells}</div><div class="milo-page-no">${pageIndex + 1}</div></div>`;
}
function miloCellHTML(s, ctx, slotIdx) {
  ctx = ctx || binderCtx();
  const img = s.image ? IMG(s.image, 'low') : '';
  const yr = miloYear(s.date);
  const rev = s.variant === 'reverse';
  if (!ctx.owned) {
    // Classeur custom : la carte est simplement rangée là (toujours éclatante).
    return `<div class="milo-cell owned is-custom" data-key="${esc(s.id || s.cardId || '')}" data-slot="${slotIdx}" title="${esc(s.name)} · ${esc(s.setName || '')}">
      <div class="milo-cell-card">
        ${img ? `<img src="${img}" alt="${esc(s.name)}" onerror="imgFail(this,'${esc(String(s.localId || ''))}','${esc(s.setId||'')}','${jss(s.name)}')">` : noImgHTML(s.localId, s.name, s.setId)}
        <span class="milo-cell-sheen" aria-hidden="true"></span>
        <button class="milo-cell-remove" title="Retirer du classeur" aria-label="Retirer du classeur" onpointerdown="event.stopPropagation()" onclick="event.stopPropagation();removeBinderCard(${slotIdx})">${ICO.close}</button>
      </div>
      ${ctx.cols === 2 ? `<div class="milo-cell-meta"><span class="milo-cell-set">${esc(s.setName || '')}</span>${yr ? `<span class="milo-cell-year">${yr}</span>` : ''}</div>` : ''}
    </div>`;
  }
  const owned = miloIsOwned(s.key);
  return `<button class="milo-cell ${owned ? 'owned' : ''} ${rev ? 'is-reverse' : ''}" data-key="${esc(s.key)}" aria-pressed="${owned}" title="${esc(s.name)} · ${esc(s.setName || '')}${rev ? ' · Reverse' : ''}" onclick="toggleMiloOwned('${esc(s.key)}',this)">
      <div class="milo-cell-card">
        ${img ? `<img src="${img}" loading="lazy" alt="${esc(s.name)}" onerror="imgFail(this,'${esc(String(s.localId || ''))}','${esc(s.setId||'')}','${jss(s.name)}')">` : noImgHTML(s.localId, s.name, s.setId)}
        <span class="milo-cell-sheen" aria-hidden="true"></span>
        ${rev ? `<span class="milo-rev-badge">Reverse</span>` : ''}
        <span class="milo-check" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5 10 17.5 19 7.5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      </div>
      <div class="milo-cell-meta"><span class="milo-cell-set">${esc(s.setName || '')}</span>${yr ? `<span class="milo-cell-year">${yr}</span>` : ''}</div>
    </button>`;
}

// Résout À L'AVANCE le visuel des cartes sans image TCGdex (promos SM, galeries
// Galar / Trainer Gallery…) pour TOUT le classeur, puis précharge chaque image
// dans LES DEUX variantes utilisées à l'écran : <img> classique (feuille de
// flip « legacy » CSS) ET crossOrigin (texture WebGL). Sans ça, la première
// fois qu'on tourne vers une page jamais vue, l'image n'est pas encore résolue
// → la carte reste vide pendant l'animation. Robuste quel que soit le moteur
// de flip (WebGL ou repli CSS).
let _preresolveRun = 0;
async function preresolveBinderImages() {
  const run = ++_preresolveRun;
  // Source des cartes : le catalogue Milobellus (`_miloSlots`, cache de session)
  // OU les cartes d'un classeur custom (`b.cards`, persistées dans state). Le
  // catalogue Milobellus héberge les galeries Galar/Trainer dépourvues d'image
  // TCGdex FR — il DOIT être couvert ici, sinon leurs pochettes restent grises
  // pendant le flip (résolution jamais faite à l'avance).
  const isMilo = state.currentBinder === 'milobellus';
  let cards;
  if (isMilo) {
    try { await ensureMiloData(); } catch { return; }
    if (run !== _preresolveRun) return;             // classeur changé entre-temps
    cards = _miloSlots;
  } else {
    const b = binderById(state.currentBinder);
    if (!b || !b.cards) return;
    cards = b.cards;
  }
  if (!cards) return;
  const preload = url => {
    if (!url) return;
    try { const i = new Image(); i.src = url; } catch {}          // cache navigateur (legacy <img>)
    try { if (typeof mfgLoadImg === 'function') mfgLoadImg(url); } catch {} // cache crossOrigin (WebGL)
  };
  let changed = false;
  await Promise.all(cards.map(async c => {
    if (!c) return;
    if (!c.image) {
      try {
        const [sid] = splitCardId(c.cardId || c.id || '');
        const src = await resolveMissingImage(c.setId || sid, c.localId);
        if (src) { c.image = src; changed = true; }
      } catch {}
    }
    if (c.image) { preload(IMG(c.image, 'high')); preload(IMG(c.image, 'low')); }
  }));
  if (run !== _preresolveRun) return;               // classeur changé entre-temps
  if (changed) {
    if (!isMilo) save();                            // les slots Milobellus ne sont pas persistés (cache de session)
    if (typeof _mfgTex !== 'undefined' && _mfgTex.clear) _mfgTex.clear();  // recompose avec les images
    if (state.view === 'binder-detail') { try { refreshSpreadPages(); } catch {} mfgWarm(); }
  }
}

function buildBinder(slots) {
  const wrap = document.getElementById('milo-binder-wrap');
  if (!wrap) return;
  updateMiloProgress();
  _miloState = { spread: 0, opened: false, flipping: false };
  const reduce = miloReduce();
  const bctx = binderCtx();
  const coverTitle = bctx.owned ? 'Milobellus' : esc(bctx.binder ? bctx.binder.name : 'Classeur');
  wrap.innerHTML = `
    <button class="milo-nav-btn milo-nav-side milo-nav-prev milo-nav-hidden" id="milo-prev" onclick="miloTurn(-1)" aria-label="Pages précédentes" disabled>
      <svg viewBox="0 0 24 24" fill="none"><path d="M15 5 8 12l7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <div class="milo-binder ${reduce ? '' : 'closed'}" id="milo-binder">
      <div class="milo-book" id="milo-book">
        <div class="book-leather" aria-hidden="true"><span class="book-stitch"></span></div>
        <div class="book-stack book-stack-l" id="book-stack-l" aria-hidden="true"></div>
        <div class="book-stack book-stack-r" id="book-stack-r" aria-hidden="true"></div>
        <div class="book-board book-board-left" aria-hidden="true"></div>
        <div class="book-board book-board-right" aria-hidden="true"></div>
        <div class="milo-page milo-page-left" id="milo-page-left">${miloPageHTML(miloLeftIdx(0))}</div>
        <div class="milo-page milo-page-right" id="milo-page-right">${miloPageHTML(miloRightIdx(0))}</div>
        <div class="book-rail" aria-hidden="true"></div>
        <div class="book-rings" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
        <div class="milo-leaf-layer" id="milo-leaf-layer"></div>
        <div class="book-cover" id="milo-cover" aria-hidden="true">
          <div class="book-cover-face">
            <span class="cover-stitch" aria-hidden="true"></span>
            <span class="cover-corner tl"></span><span class="cover-corner tr"></span>
            <span class="cover-corner bl"></span><span class="cover-corner br"></span>
            <div class="cover-emblem">${bctx.owned ? `<img src="milobellus-logo.png?v=2" alt="" class="cover-logo">` : miloEmblemSVG()}</div>
            <div class="cover-title">${coverTitle}</div>
            <div class="cover-sub">Le classeur</div>
            <span class="cover-shine" aria-hidden="true"></span>
          </div>
        </div>
      </div>
    </div>
    <button class="milo-nav-btn milo-nav-side milo-nav-next milo-nav-hidden" id="milo-next" onclick="miloTurn(1)" aria-label="Pages suivantes">
      <svg viewBox="0 0 24 24" fill="none"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <span class="milo-spread-ind" id="milo-spread-ind"></span>`;
  updateMiloControls();
  hydrateFallbackImages(wrap);
  attachBinderParallax();
  // Flip WebGL : ombres balayantes + bandes de préhension + contexte GL.
  const bookEl = document.getElementById('milo-book');
  if (bookEl) {
    bookEl.insertAdjacentHTML('beforeend',
      '<div class="milo-shade milo-shade-l" id="milo-shade-l" aria-hidden="true"></div>' +
      '<div class="milo-shade milo-shade-r" id="milo-shade-r" aria-hidden="true"></div>' +
      '<div class="milo-grab milo-grab-l" aria-hidden="true"></div>' +
      '<div class="milo-grab milo-grab-r" aria-hidden="true"></div>');
  }
  initMiloFlipGL();
  attachCardDnD();
  preresolveBinderImages();   // résout + précharge les visuels manquants (promos SM, galeries…)
  if (bctx.owned) ensureMiloData().then(() => mfgWarm());
  else mfgWarm();
  // Ouverture « méga stylée » : la couverture pivote et révèle la double-page.
  if (reduce) { _miloState.opened = true; return; }
  const binder = document.getElementById('milo-binder');
  const open = () => {
    if (binder && binder.classList.contains('closed')) {
      binder.classList.remove('closed');
      binder.classList.add('just-opened');          // dip du livre + cascade des pochettes
      setTimeout(() => { binder.classList.remove('just-opened'); _miloState.opened = true; }, 1500);
    }
  };
  // rAF pour laisser l'état fermé peindre une frame ; setTimeout de secours si
  // rAF est gelé (onglet en arrière-plan à l'arrivée sur la vue).
  requestAnimationFrame(() => requestAnimationFrame(open));
  setTimeout(open, 480);
}

function updateMiloControls() {
  const spreads = miloTotalSpreads();
  const S = _miloState.spread;
  const prev = document.getElementById('milo-prev'), next = document.getElementById('milo-next');
  if (prev) prev.disabled = S <= 0;
  if (next) next.disabled = S >= spreads - 1;
  const ind = document.getElementById('milo-spread-ind');
  const pages = miloTotalPages();
  if (ind) {
    const li = miloLeftIdx(S), ri = miloRightIdx(S);
    const lp = li >= 0 ? li + 1 : null, rp = ri < pages ? ri + 1 : null;
    ind.textContent = (lp && rp) ? `Pages ${lp}–${rp} · ${pages}` : `Page ${lp || rp || 1} · ${pages}`;
  }
  // Épaisseur physique : la tranche de pages restantes de chaque côté.
  const sl = document.getElementById('book-stack-l'), sr = document.getElementById('book-stack-r');
  const th = n => Math.min(16, Math.max(0, n) * 2.2).toFixed(1) + 'px';
  if (sl) sl.style.width = th(S);
  if (sr) sr.style.width = th(spreads - 1 - S);
}

// Fabrique la feuille qui tourne (deux faces : recto + verso).
function miloBuildLeaf(frontIdx, backIdx, dir) {
  const leaf = document.createElement('div');
  leaf.className = 'milo-leaf ' + (dir > 0 ? 'flip-fwd' : 'flip-bwd');
  leaf.innerHTML = `
    <div class="milo-leaf-face front">${miloPageHTML(frontIdx)}<span class="leaf-gloss" aria-hidden="true"></span></div>
    <div class="milo-leaf-face back">${miloPageHTML(backIdx)}<span class="leaf-gloss" aria-hidden="true"></span></div>`;
  return leaf;
}
function miloOnLeafEnd(leaf, cb) {
  let done = false;
  const fin = () => { if (done) return; done = true; cb(); };
  leaf.addEventListener('animationend', fin, { once: true });
  setTimeout(fin, 1100);   // filet de sécurité si animationend ne se déclenche pas
}

// Tourne d'un cran : dir = +1 (page suivante) / -1 (précédente).
// Chemin royal : flip WebGL (feuille courbée, éclairée). Repli : feuille CSS.
function miloTurn(dir) {
  if (_miloState.flipping) return;
  const spreads = miloTotalSpreads();
  const S = _miloState.spread;
  if (dir > 0 && S >= spreads - 1) return;
  if (dir < 0 && S <= 0) return;
  if (!miloReduce() && _mfg && _mfg.ok && !_mfg.busy && !_mfg.drag) {
    _miloState.flipping = true;
    // CHIEN DE GARDE : le flip WebGL se termine dans mfgFinalize, appelé par
    // la boucle rAF. Si cette boucle est gelée (onglet passé en arrière-plan
    // pendant l'animation, contexte GL perdu, rendu headless), `flipping`
    // resterait à true et le classeur serait bloqué POUR DE BON. On borne donc
    // l'attente : passé le délai, on remet l'état à plat et on rend la main.
    const guardSpread = _miloState.spread;
    clearTimeout(_miloFlipGuard);
    _miloFlipGuard = setTimeout(() => {
      if (!_miloState.flipping || _miloState.spread !== guardSpread) return;  // fini normalement
      console.warn('flip non terminé (rAF gelé ?) — on débloque le classeur');
      _miloState.flipping = false;
      if (_mfg) { _mfg.busy = false; _mfg.anim = null; }
      try { mfgShow(false); mfgGhostRings(false); } catch {}
      refreshSpreadPages(); updateMiloControls();
    }, 2600);
    mfgFlip(dir).then(ok => {
      if (!ok) { clearTimeout(_miloFlipGuard); _miloState.flipping = false; miloTurnLegacy(dir); }
    }).catch(() => { clearTimeout(_miloFlipGuard); _miloState.flipping = false; miloTurnLegacy(dir); });
    return;
  }
  miloTurnLegacy(dir);
}
function miloTurnLegacy(dir) {
  if (_miloState.flipping) return;
  const spreads = miloTotalSpreads();
  const S = _miloState.spread;
  if (dir > 0 && S >= spreads - 1) return;
  if (dir < 0 && S <= 0) return;
  const left = document.getElementById('milo-page-left');
  const right = document.getElementById('milo-page-right');
  const layer = document.getElementById('milo-leaf-layer');
  const wrap = document.getElementById('milo-binder-wrap');
  if (!left || !right || !layer) return;

  if (miloReduce()) {
    const nS = S + dir;
    left.innerHTML = miloPageHTML(miloLeftIdx(nS));
    right.innerHTML = miloPageHTML(miloRightIdx(nS));
    _miloState.spread = nS;
    updateMiloControls();
    hydrateFallbackImages(wrap);
    return;
  }

  _miloState.flipping = true;
  if (dir > 0) {
    const frontIdx = miloRightIdx(S);       // page droite courante (recto de la feuille)
    const backIdx = miloLeftIdx(S + 1);     // page gauche du prochain spread (verso)
    right.innerHTML = miloPageHTML(miloRightIdx(S + 1));   // nouvelle page droite, révélée dessous
    const leaf = miloBuildLeaf(frontIdx, backIdx, 1);
    layer.appendChild(leaf);
    hydrateFallbackImages(leaf);
    miloOnLeafEnd(leaf, () => {
      left.innerHTML = miloPageHTML(backIdx);
      layer.innerHTML = '';
      _miloState.spread = S + 1;
      updateMiloControls();
      hydrateFallbackImages(wrap);
      _miloState.flipping = false;
    });
  } else {
    const frontIdx = miloRightIdx(S - 1);   // page droite du spread précédent (recto)
    const backIdx = miloLeftIdx(S);         // page gauche courante (verso)
    left.innerHTML = miloPageHTML(miloLeftIdx(S - 1));   // nouvelle page gauche, révélée dessous
    const leaf = miloBuildLeaf(frontIdx, backIdx, -1);
    layer.appendChild(leaf);
    hydrateFallbackImages(leaf);
    miloOnLeafEnd(leaf, () => {
      right.innerHTML = miloPageHTML(frontIdx);
      layer.innerHTML = '';
      _miloState.spread = S - 1;
      updateMiloControls();
      hydrateFallbackImages(wrap);
      _miloState.flipping = false;
    });
  }
}

// Coche / décoche une carte comme « possédée » (sauvegarde instantanée).
function toggleMiloOwned(key, btn) {
  if (!state.milobellus) state.milobellus = {};
  const now = !state.milobellus[key];
  if (now) state.milobellus[key] = true; else delete state.milobellus[key];
  save();
  // Met à jour toutes les cases de cette clé (page statique + feuille en vol).
  document.querySelectorAll(`.milo-cell[data-key="${key}"]`).forEach(el => {
    el.classList.toggle('owned', now);
    el.setAttribute('aria-pressed', String(now));
  });
  if (btn && now) { btn.classList.add('just'); setTimeout(() => btn.classList.remove('just'), 460); }
  updateMiloProgress();
}

// Parallaxe du classeur RETIRÉ : le livre bougeait sous la souris, ce qui
// créait des micro-mouvements permanents (et des décalages avec la feuille
// WebGL pendant un flip). Le classeur reste désormais parfaitement immobile
// une fois ouvert — seules les pages bougent, quand on les manipule.
function attachBinderParallax() {
  const book = document.getElementById('milo-book');
  if (!book) return;
  book.style.setProperty('--bx', '0deg');
  book.style.setProperty('--by', '0deg');
}

/* ══════════════════════════════════════════════════════════════════
   FLIP WEBGL « HYBRIDE CINÉMA »
   Au repos : pages DOM (nettes, cliquables). Pendant le tournage : la
   feuille est un plan WebGL subdivisé, courbé par un shader (le papier
   se bombe selon la vélocité, la pointe fouette et flotte à
   l'atterrissage), éclairé, avec reflet de pochette plastique. La
   caméra réplique exactement la perspective CSS (frustum asymétrique
   + décomposition de la matrice du livre) → superposition au pixel.
   Interaction : on attrape la page n'importe où et on la tourne.
   Fallback : la feuille CSS historique si WebGL indisponible.
   ══════════════════════════════════════════════════════════════════ */
let _mfg = null;                       // contexte GL du flip (null = pas dispo)
const _mfgTex = new Map();             // pageIndex → {hash, promise, tex}
const _mfgImgs = new Map();            // url → Promise<Image|null> (CORS)
const MFG_PERSP = 2300;                // = perspective CSS du binder-wrap
const MFG_ORIGIN_Y = .38;              // = perspective-origin 50% 38%

function mfgCss(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

function mfgLoadImg(url) {
  if (!url) return Promise.resolve(null);
  if (_mfgImgs.has(url)) return _mfgImgs.get(url);
  // La texture WebGL exige un chargement crossOrigin (sinon canvas teinté). Or
  // un <img> DOM classique (SANS crossOrigin) met souvent CETTE url en cache
  // navigateur AVANT nous — et le CDN pokemontcg.io (visuels de repli des
  // galeries Galar/Trainer, promos SM) ressert alors cette entrée « no-CORS »
  // à notre requête crossOrigin, qui ÉCHOUE en boucle (onerror → placeholder
  // gris pendant le flip, alors que la carte s'affiche au repos via le <img>).
  // Parade : forcer une entrée de cache DISTINCTE, réellement validée CORS, via
  // un paramètre sentinelle — UNIQUEMENT pour pokemontcg.io (le CDN TCGdex, lui,
  // rejette les query params et n'a pas ce défaut de cache : on ne l'y touche pas).
  const req = /images\.pokemontcg\.io/.test(url)
    ? url + (url.includes('?') ? '&' : '?') + 'milocors=1'
    : url;
  const p = new Promise(res => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = req;
  });
  _mfgImgs.set(url, p);
  return p;
}

// Empreinte du contenu d'une page (cartes + état possédé) → invalide la
// texture en cache dès qu'une carte est cochée/décochée.
function mfgPageHash(idx) {
  const ctx = binderCtx();
  if (idx < 0) return ctx.id + ':cover-inner';   // intérieur de couverture : contenu fixe
  let h = ctx.id + ':' + ctx.perPage + ':p' + idx;
  for (let i = 0; i < ctx.perPage; i++) {
    const s = ctx.slots[idx * ctx.perPage + i];
    h += s ? '|' + (s.key || s.id || s.cardId) + (ctx.owned ? (miloIsOwned(s.key) ? '1' : '0') : '1') : '|-';
  }
  return h;
}

// Tracé arrondi (rayons par coin : [tl,tr,br,bl]).
function mfgRR(ctx, x, y, w, h, r) {
  const q = Array.isArray(r) ? r : [r, r, r, r];
  ctx.beginPath();
  ctx.moveTo(x + q[0], y);
  ctx.lineTo(x + w - q[1], y); ctx.arcTo(x + w, y, x + w, y + q[1], q[1]);
  ctx.lineTo(x + w, y + h - q[2]); ctx.arcTo(x + w, y + h, x + w - q[2], y + h, q[2]);
  ctx.lineTo(x + q[3], y + h); ctx.arcTo(x, y + h, x, y + h - q[3], q[3]);
  ctx.lineTo(x, y + q[0]); ctx.arcTo(x, y, x + q[0], y, q[0]);
  ctx.closePath();
}
function mfgEllipsize(ctx, txt, maxW) {
  if (ctx.measureText(txt).width <= maxW) return txt;
  let t = txt;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

// Compose la texture d'une page (réplique fidèle du rendu DOM : fond verre,
// pochettes 2×2, cartes grisées/éclatantes, foil reverse, badges, méta).
async function mfgComposePage(idx) {
  const g = _mfg;
  if (!g || !g.ok) return null;
  const bctx = binderCtx();
  const slots = bctx.slots;
  const W = g.pageW, H = g.pageH;
  // Sécurité : jamais composer (ni cacher) une texture de taille nulle — elle
  // donnerait une page entièrement vide pendant le flip.
  if (W <= 0 || H <= 0) return null;
  const k = Math.min(2, (window.devicePixelRatio || 1) * 1.3, 1500 / W);
  const cv = document.createElement('canvas');
  cv.width = Math.round(W * k); cv.height = Math.round(H * k);
  const ctx = cv.getContext('2d');
  ctx.scale(k, k);
  // Répartition « vrai livre » : pages paires à DROITE (la 1 ouvre le livre),
  // impaires à gauche ; -1 = intérieur de couverture (face vierge, à gauche).
  const left = idx < 0 || idx % 2 === 1;
  if (idx < 0) {
    const rad2 = [8, 3, 3, 8];
    mfgRR(ctx, 0, 0, W, H, rad2);
    ctx.save(); ctx.clip();
    const gcov = ctx.createLinearGradient(0, 0, W, H);
    gcov.addColorStop(0, 'rgb(16,24,36)'); gcov.addColorStop(1, 'rgb(8,13,21)');
    ctx.fillStyle = gcov; ctx.fillRect(0, 0, W, H);
    const swc = Math.min(34, W * .09);
    const sgc = ctx.createLinearGradient(W, 0, W - swc, 0);
    sgc.addColorStop(0, 'rgba(0,0,0,.45)'); sgc.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sgc; ctx.fillRect(W - swc, 0, swc, H);
    ctx.restore();
    return cv;
  }
  const acc = mfgCss('--acc') || MILO_ACCENT;
  const t2 = mfgCss('--t2') || 'rgba(255,255,255,.72)';
  const t3 = mfgCss('--t3') || 'rgba(255,255,255,.45)';
  const mono = mfgCss('--mono') || 'ui-monospace,monospace';

  // Fond de page (dégradé 155° du CSS) découpé aux coins arrondis.
  const rad = left ? [8, 3, 3, 8] : [3, 8, 8, 3];
  mfgRR(ctx, 0, 0, W, H, rad);
  ctx.save(); ctx.clip();
  const a = (155 - 90) * Math.PI / 180;
  const L2 = (Math.abs(W * Math.cos(a)) + Math.abs(H * Math.sin(a))) / 2;
  const cxm = W / 2, cym = H / 2;
  const gr = ctx.createLinearGradient(cxm - Math.cos(a) * L2, cym - Math.sin(a) * L2, cxm + Math.cos(a) * L2, cym + Math.sin(a) * L2);
  gr.addColorStop(0, 'rgb(30,44,62)'); gr.addColorStop(1, 'rgb(13,21,33)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  // Ombre intérieure côté reliure.
  const sw = Math.min(34, W * .09);
  const sg = left
    ? ctx.createLinearGradient(W, 0, W - sw, 0)
    : ctx.createLinearGradient(0, 0, sw, 0);
  sg.addColorStop(0, 'rgba(0,0,0,.4)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sg; ctx.fillRect(left ? W - sw : 0, 0, sw, H);

  // Métriques du layout (répliquent padding/grid du CSS, % de la largeur).
  const cols = bctx.cols, rows = cols;
  const padX = .03 * W, padY = .034 * W;
  const inX = padX, inY = padY, inW = W - 2 * padX, inH = H - 2 * padY;
  const pnH = 12 + .024 * inW;                       // bandeau numéro de page
  const gridW = inW, gridH = inH - pnH;
  const colGap = (cols === 3 ? .05 : .07) * gridW, rowGap = (cols === 3 ? .04 : .06) * gridH;
  const cellW = (gridW - colGap * (cols - 1)) / cols, cellH = (gridH - rowGap * (rows - 1)) / rows;
  const hasFilter = (() => { try { ctx.filter = 'grayscale(50%)'; const ok = ctx.filter !== 'none'; ctx.filter = 'none'; return ok; } catch { return false; } })();

  // Précharge les visuels de la page en parallèle (high, sinon low : certains
  // vieux sets TCGdex n'ont pas le rendu haute définition).
  const cells = [];
  for (let i = 0; i < bctx.perPage; i++) cells.push(slots[idx * bctx.perPage + i] || null);
  const imgs = await Promise.all(cells.map(async s => {
    if (!s) return null;
    // Certaines cartes n'ont PAS d'image côté TCGdex FR (promos SM, galeries
    // Galar/Trainer Gallery...). La page statique les récupère via le même
    // repli — on le fait AUSSI ici, sinon leur pochette reste vide pendant le
    // flip. On mémorise l'URL trouvée sur la carte pour les prochaines passes.
    let src = s.image;
    if (!src) {
      try {
        const [sid] = splitCardId(s.id || '');
        src = await resolveMissingImage(s.setId || sid, s.localId);
        if (src) s.image = src;
      } catch {}
    }
    if (!src) return null;
    return (await mfgLoadImg(IMG(src, 'high'))) || (await mfgLoadImg(IMG(src, 'low')));
  }));

  for (let i = 0; i < bctx.perPage; i++) {
    const s = cells[i];
    const cx = inX + (i % cols) * (cellW + colGap);
    const cy = inY + Math.floor(i / cols) * (cellH + rowGap);
    const metaH = cols === 3 ? 0 : 11, gapC = cols === 3 ? 0 : 7;
    const cardW = cellW, cardH = cellH - gapC - metaH;
    if (!s) {                                        // pochette vide
      mfgRR(ctx, cx, cy, cardW, cardH, 8);
      ctx.fillStyle = 'rgba(255,255,255,.015)'; ctx.fill();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(255,255,255,.11)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.setLineDash([]);
      if (!bctx.owned) {                             // affordance « + » (custom)
        ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
        const mx = cx + cardW / 2, my = cy + cardH / 2, pl = Math.min(11, cardW * .09);
        ctx.beginPath(); ctx.moveTo(mx - pl, my); ctx.lineTo(mx + pl, my);
        ctx.moveTo(mx, my - pl); ctx.lineTo(mx, my + pl); ctx.stroke();
      }
      continue;
    }
    const owned = bctx.owned ? miloIsOwned(s.key) : true;
    const rev = s.variant === 'reverse';
    ctx.save();
    ctx.globalAlpha = owned ? 1 : .92;
    // Ombre portée de la pochette.
    ctx.save();
    mfgRR(ctx, cx, cy, cardW, cardH, 8);
    ctx.shadowColor = owned ? 'rgba(20,90,150,.4)' : 'rgba(0,0,0,.42)';
    ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
    ctx.fillStyle = 'rgba(255,255,255,.045)'; ctx.fill();
    ctx.restore();
    // Visuel de la carte (object-fit: contain) dans la pochette.
    mfgRR(ctx, cx, cy, cardW, cardH, 8);
    ctx.save(); ctx.clip();
    const im = imgs[i];
    if (im) {
      const s2 = Math.min(cardW / im.width, cardH / im.height);
      const dw = im.width * s2, dh = im.height * s2;
      const dx = cx + (cardW - dw) / 2, dy = cy + (cardH - dh) / 2;
      if (!owned && hasFilter) {
        ctx.filter = 'grayscale(70%) brightness(60%)';
        ctx.drawImage(im, dx, dy, dw, dh);
        ctx.filter = 'none';
      } else {
        ctx.drawImage(im, dx, dy, dw, dh);
        if (!owned) {                                // repli sans ctx.filter
          ctx.globalCompositeOperation = 'saturation';
          ctx.fillStyle = 'rgba(128,128,128,.7)'; ctx.fillRect(dx, dy, dw, dh);
          ctx.globalCompositeOperation = 'multiply';
          ctx.fillStyle = 'rgba(97,97,97,1)'; ctx.fillRect(dx, dy, dw, dh);
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    } else {                                         // placeholder « pas de visuel »
      ctx.fillStyle = 'rgba(255,255,255,.03)'; ctx.fillRect(cx, cy, cardW, cardH);
      ctx.fillStyle = t3; ctx.textAlign = 'center';
      ctx.font = `700 ${Math.max(12, cardW * .14)}px ${mono}`;
      ctx.fillText('N°' + (s.localId || '?'), cx + cardW / 2, cy + cardH / 2);
      ctx.textAlign = 'left';
    }
    // Foil reverse simulé (voile arc-en-ciel en screen).
    if (rev && im) {
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = (owned ? .5 : .3) * (owned ? 1 : .92);
      const fg = ctx.createLinearGradient(cx, cy, cx + cardW, cy + cardH);
      fg.addColorStop(.18, 'rgba(0,0,0,0)');
      fg.addColorStop(.38, 'rgba(96,180,255,.55)');
      fg.addColorStop(.55, 'rgba(170,120,255,.5)');
      fg.addColorStop(.72, 'rgba(90,255,210,.55)');
      fg.addColorStop(.85, 'rgba(0,0,0,0)');
      ctx.fillStyle = fg; ctx.fillRect(cx, cy, cardW, cardH);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = owned ? 1 : .92;
    }
    // Gloss de pochette plastique (reflet diagonal + lèvre d'ouverture en haut).
    const gg = ctx.createLinearGradient(cx, cy, cx + cardW * .5, cy + cardH * .42);
    gg.addColorStop(0, 'rgba(255,255,255,.11)'); gg.addColorStop(.55, 'rgba(255,255,255,.03)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gg; ctx.fillRect(cx, cy, cardW, cardH);
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(cx + 2, cy + 1, cardW - 4, 1.2);
    ctx.restore();                                   // fin clip pochette
    // Liseré (accent si possédée / rangée).
    mfgRR(ctx, cx + .5, cy + .5, cardW - 1, cardH - 1, 8);
    ctx.strokeStyle = owned ? (bctx.owned ? acc : 'rgba(255,255,255,.16)') : 'rgba(255,255,255,.09)';
    ctx.globalAlpha = (owned ? .8 : 1) * (owned ? 1 : .92);
    ctx.lineWidth = owned ? 1.4 : 1; ctx.stroke();
    ctx.globalAlpha = owned ? 1 : .92;
    // Badge Reverse.
    if (rev) {
      const bt = 'REVERSE';
      ctx.font = `700 8px ${mono}`;
      const bw = ctx.measureText(bt).width + 12, bh = 15;
      mfgRR(ctx, cx + 6, cy + cardH - 6 - bh, bw, bh, 5);
      ctx.fillStyle = 'rgba(6,18,30,.72)'; ctx.fill();
      ctx.strokeStyle = acc; ctx.globalAlpha *= .55; ctx.lineWidth = 1; ctx.stroke();
      ctx.globalAlpha = owned ? 1 : .92;
      ctx.fillStyle = '#eaf6ff';
      ctx.fillText(bt, cx + 12, cy + cardH - 6 - 4.5);
    }
    // Coche « possédée » (Milobellus uniquement).
    if (owned && bctx.owned) {
      ctx.beginPath();
      ctx.arc(cx + cardW - 17, cy + 17, 11, 0, Math.PI * 2);
      ctx.fillStyle = acc; ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 8; ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#04121e'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + cardW - 21.5, cy + 17.3);
      ctx.lineTo(cx + cardW - 18.2, cy + 20.5);
      ctx.lineTo(cx + cardW - 12.4, cy + 13.6);
      ctx.stroke();
    }
    // Méta : nom du set + année (grille 2×2 uniquement, comme le DOM).
    if (metaH) {
      ctx.font = `9px ${mono}`;
      const yTxt = miloYear(s.date);
      const yW = yTxt ? ctx.measureText(yTxt).width : 0;
      ctx.fillStyle = t3;
      ctx.fillText(mfgEllipsize(ctx, s.setName || '', cardW - yW - 8), cx, cy + cellH - 2.5);
      if (yTxt) { ctx.fillStyle = t2; ctx.fillText(yTxt, cx + cardW - yW, cy + cellH - 2.5); }
    }
    ctx.restore();
  }
  // Trous perforés côté reliure, PAR-DESSUS les pochettes (z-index 3 en DOM),
  // alignés sur les anneaux : zone 8 % → 92 %.
  const holeX = left ? W - 13 : 13;
  for (let i = 0; i < 5; i++) {
    const hy = H * .08 + (H * .84) * (i / 4);
    ctx.beginPath(); ctx.arc(holeX, hy, 4.6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(4,8,14,.92)'; ctx.fill();
    ctx.beginPath(); ctx.arc(holeX, hy + .8, 4.6, Math.PI * 1.15, Math.PI * 1.85, true);
    ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1.1; ctx.stroke();
  }
  // Numéro de page.
  ctx.font = `10px ${mono}`;
  try { ctx.letterSpacing = '1.4px'; } catch {}
  ctx.fillStyle = t3; ctx.textAlign = 'center';
  ctx.fillText(String(idx + 1), W / 2, inY + inH - 2);
  ctx.restore();                                     // fin clip page
  return cv;
}

// Texture (avec cache + invalidation par empreinte) pour une page donnée.
function mfgGetTex(idx) {
  const g = _mfg;
  if (!g || !g.ok) return Promise.resolve(null);
  // Auto-réparation : le premier mfgLayout() tourne parfois quand le livre a
  // encore une largeur nulle (ouverture/animation en cours) et le
  // ResizeObserver ne se redéclenche pas (transform CSS ≠ resize de layout).
  // Sans ça, pageW/pageH restent à 0 → toutes les textures se composent en
  // 0×0 = pages VIDES pendant le flip. Dès que le livre a une taille réelle,
  // on recadre (mfgLayout vide aussi le cache de textures périmées).
  if ((g.pageW <= 0 || g.pageH <= 0) && g.book && g.book.offsetWidth > 0) mfgLayout();
  const hash = mfgPageHash(idx);
  const hit = _mfgTex.get(idx);
  if (hit && hit.hash === hash) return hit.promise;
  const entry = { hash, tex: null };
  entry.promise = mfgComposePage(idx).then(cv => {
    if (!cv || !_mfg || !_mfg.ok) return null;
    if (hit && hit.tex) { try { hit.tex.dispose(); } catch {} }
    const THREE = window.THREE;
    const tex = new THREE.CanvasTexture(cv);
    if (_mfg.renderer.capabilities.isWebGL2) {
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.anisotropy = Math.min(8, _mfg.renderer.capabilities.getMaxAnisotropy());
    } else {
      tex.generateMipmaps = false;
      tex.minFilter = THREE.LinearFilter;
    }
    entry.tex = tex;
    return tex;
  });
  _mfgTex.set(idx, entry);
  return entry.promise;
}
// Pré-compose les pages voisines du spread courant (flip instantané ensuite).
function mfgWarm() {
  if (!_mfg || !_mfg.ok) return;
  if (state.currentBinder === 'milobellus' && !_miloSlots) return;
  const S = _miloState.spread, pages = miloTotalPages();
  for (let i = Math.max(-1, miloLeftIdx(S) - 2); i <= Math.min(pages - 1, miloRightIdx(S) + 2); i++) mfgGetTex(i);
  // Précharge TOUS les visuels du classeur (dédupliqués via _mfgImgs) : une
  // page pas encore vue se compose alors instantanément → fini les cartes qui
  // n'apparaissent pas pendant l'animation de flip (texture composée avant que
  // ses images soient chargées, ou repli legacy sur des <img> encore vides).
  const slots = binderCtx().slots;
  for (const s of slots) { if (s && s.image) mfgLoadImg(IMG(s.image, 'high')); }
}

function stopMiloFlipGL() {
  if (!_mfg) return;
  cancelAnimationFrame(_mfg.raf);
  if (_mfg.ro) try { _mfg.ro.disconnect(); } catch {}
  _mfgTex.forEach(e => { if (e.tex) try { e.tex.dispose(); } catch {} });
  _mfgTex.clear();
  if (_mfg.renderer) try { _mfg.renderer.dispose(); } catch {}
  if (_mfg.canvas) _mfg.canvas.remove();
  if (_mfg.ghost) _mfg.ghost.remove();
  _mfg = null;
}

// Décompose la matrice CSS réelle du livre (rotateX·rotateY, même en cours
// de transition) → angles appliqués au groupe GL à chaque frame.
function mfgBookRot() {
  const t = getComputedStyle(_mfg.book).transform;
  if (!t || t === 'none') return { a: 0, b: 0 };
  try {
    const m = new DOMMatrix(t);
    const b = Math.asin(Math.max(-1, Math.min(1, m.m31)));
    const a = Math.atan2(m.m23, m.m33);
    return { a, b };
  } catch { return { a: 0, b: 0 }; }
}

// Géométrie de l'overlay : canvas plus large que le wrap (la feuille dépasse
// en se courbant vers la caméra), frustum asymétrique = perspective CSS.
function mfgLayout() {
  const g = _mfg;
  const M = { l: 60, t: 90, r: 60, b: 30 };          // marges de débord du canvas
  const ww = g.wrap.clientWidth, wh = g.wrap.clientHeight;
  const cw = ww + M.l + M.r, ch = wh + M.t + M.b;
  g.renderer.setSize(cw, ch, false);
  // Canvas positionné dans .milo-view pour couvrir le wrap + les marges.
  g.canvas.style.left = (g.wrap.offsetLeft - M.l) + 'px';
  g.canvas.style.top = (g.wrap.offsetTop - M.t) + 'px';
  g.canvas.style.width = cw + 'px';
  g.canvas.style.height = ch + 'px';
  g.pageW = g.book.offsetWidth / 2;
  g.pageH = g.book.offsetHeight;
  // Centre du livre et origine de perspective, en coordonnées canvas.
  const bx = M.l + g.binder.offsetLeft + g.book.offsetWidth / 2;
  const by = M.t + g.binder.offsetTop + g.book.offsetHeight / 2;
  const ox = M.l + ww * .5, oy = M.t + wh * MFG_ORIGIN_Y;
  // Frustum : le plan z=0 couvre exactement le canvas, axe optique sur l'origine CSS.
  const n = 100, s = n / MFG_PERSP;
  g.camera.position.set(0, 0, MFG_PERSP);
  g.camera.projectionMatrix.makePerspective((0 - ox) * s, (cw - ox) * s, oy * s, (oy - ch) * s, n, 8000);
  g.camera.projectionMatrixInverse.copy(g.camera.projectionMatrix).invert();
  g.group.position.set(bx - ox, oy - by, 0);
  g.mat.uniforms.uPW.value = g.pageW;
  g.mat.uniforms.uPH.value = g.pageH;
  // Les textures dépendent de la taille de page → invalide le cache.
  _mfgTex.forEach(e => { if (e.tex) try { e.tex.dispose(); } catch {} });
  _mfgTex.clear();
}

const MFG_VERT = `
uniform float uTheta, uBend, uPW, uPH;
varying vec2 vUv; varying vec3 vN; varying vec3 vWP;
vec3 leafPos(float u, float y){
  float x = u * uPW;
  float phi = uTheta + uBend * u * u;
  return vec3(cos(phi) * x, y, -sin(phi) * x);
}
void main(){
  vUv = uv;
  float y = (uv.y - .5) * uPH;
  vec3 p  = leafPos(uv.x, y);
  vec3 p2 = leafPos(uv.x + .002, y);
  vec3 tx = normalize(p2 - p);
  vec3 n  = normalize(cross(tx, vec3(0., 1., 0.)));
  vN = mat3(modelMatrix) * n;
  vec4 wp = modelMatrix * vec4(p, 1.);
  vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const MFG_FRAG = `
precision highp float;
uniform sampler2D uFront, uBack; uniform vec3 uCam;
varying vec2 vUv; varying vec3 vN; varying vec3 vWP;
void main(){
  vec4 tex = gl_FrontFacing ? texture2D(uFront, vUv) : texture2D(uBack, vec2(1. - vUv.x, vUv.y));
  if (tex.a < .03) discard;
  vec3 n = normalize(vN) * (gl_FrontFacing ? 1. : -1.);
  vec3 L = normalize(vec3(-.42, .55, .78));
  float diff = clamp(dot(n, L), 0., 1.);
  vec3 col = tex.rgb * (.76 + .3 * diff);
  vec3 V = normalize(uCam - vWP);
  vec3 Hv = normalize(L + V);
  float spec = pow(clamp(dot(n, Hv), 0., 1.), 46.) * .3;   /* reflet pochette */
  col += spec * vec3(.9, .97, 1.);
  col *= .86 + .14 * smoothstep(0., .16, vUv.x);           /* AO reliure */
  gl_FragColor = vec4(col, tex.a);
}`;

function initMiloFlipGL() {
  stopMiloFlipGL();
  if (miloReduce() || !window.THREE) return;
  const wrap = document.getElementById('milo-binder-wrap');
  const book = document.getElementById('milo-book');
  const binder = document.getElementById('milo-binder');
  if (!wrap || !book || !binder) return;
  try {
    const THREE = window.THREE;
    const canvas = document.createElement('canvas');
    canvas.id = 'milo-flip-canvas';
    // Parent = .milo-view : hors du contexte 3D créé par perspective sur le wrap.
    (wrap.closest('.milo-view') || wrap.parentElement).appendChild(canvas);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    camera.matrixAutoUpdate = true;
    const group = new THREE.Group();
    scene.add(group);
    const geo = new THREE.PlaneGeometry(1, 1, 120, 1);
    const mat = new THREE.ShaderMaterial({
      vertexShader: MFG_VERT, fragmentShader: MFG_FRAG,
      side: THREE.DoubleSide, transparent: true,
      uniforms: {
        uTheta: { value: 0 }, uBend: { value: 0 },
        uPW: { value: 1 }, uPH: { value: 1 },
        uFront: { value: null }, uBack: { value: null },
        uCam: { value: new THREE.Vector3(0, 0, MFG_PERSP) },
      },
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    group.add(mesh);
    _mfg = {
      ok: true, wrap, book, binder, canvas, renderer, scene, camera, group, mesh, mat,
      theta: 0, bend: 0, bendV: 0, vel: 0, lastTheta: 0,
      anim: null, drag: null, peek: 0, busy: false, raf: 0, lastT: 0,
      pageW: 0, pageH: 0, ghost: null, ro: null, suppressClick: false,
    };
    mfgLayout();
    _mfg.ro = new ResizeObserver(() => { if (_mfg && !_mfg.busy) mfgLayout(); });
    _mfg.ro.observe(book);
    mfgAttachDrag();
  } catch (e) {
    if (_mfg) { try { _mfg.canvas.remove(); } catch {} }
    _mfg = { ok: false };
  }
}

// Anneaux fantômes au-dessus du canvas : la feuille GL semble sortir
// d'entre les anneaux plutôt que de glisser par-dessus.
function mfgGhostRings(on) {
  const g = _mfg;
  if (!on) { if (g.ghost) g.ghost.remove(); g.ghost = null; return; }
  const rings = g.book.querySelector('.book-rings');
  const view = g.wrap.closest('.milo-view') || g.wrap.parentElement;
  if (!rings || !view) return;
  const r = rings.getBoundingClientRect(), v = view.getBoundingClientRect();
  const gh = document.createElement('div');
  gh.className = 'book-rings-ghost';
  gh.innerHTML = '<i></i><i></i><i></i><i></i><i></i>';
  gh.style.cssText = `left:${r.left - v.left}px;top:${r.top - v.top}px;width:${r.width}px;height:${r.height}px`;
  view.appendChild(gh);
  g.ghost = gh;
}

function mfgShow(on) {
  _mfg.canvas.classList.toggle('on', on);
  if (!on) {
    const l = document.getElementById('milo-shade-l'), r = document.getElementById('milo-shade-r');
    if (l) l.style.opacity = 0;
    if (r) r.style.opacity = 0;
  }
}

// Voiles d'ombre balayant les pages fixes sous la feuille en vol.
function mfgShades() {
  const th = Math.abs(_mfg.theta);
  const l = document.getElementById('milo-shade-l'), r = document.getElementById('milo-shade-r');
  if (!l || !r) return;
  const w = Math.max(.14, Math.abs(Math.cos(th)));
  const oR = th < 1.5708 ? Math.pow(Math.sin(th), .8) * .75 : Math.max(0, .75 - (th - 1.5708) * 1.8);
  const oL = th > 1.5708 ? Math.pow(Math.sin(th), .8) * .75 : Math.max(0, .75 - (1.5708 - th) * 1.8);
  r.style.opacity = oR.toFixed(3); r.style.transform = `translateZ(2px) scaleX(${w.toFixed(3)})`;
  l.style.opacity = oL.toFixed(3); l.style.transform = `translateZ(2px) scaleX(${w.toFixed(3)})`;
}

function mfgRender() {
  const g = _mfg;
  const rot = mfgBookRot();
  g.group.rotation.set(-rot.a, rot.b, 0);
  g.mat.uniforms.uTheta.value = g.theta;
  g.mat.uniforms.uBend.value = g.bend;
  g.renderer.render(g.scene, g.camera);
  mfgShades();
}

// Boucle : intègre l'animation/le drag + le ressort de cambrure (le papier
// se bombe selon la vélocité, fouette et flotte à l'atterrissage).
function mfgLoop(ts) {
  const g = _mfg;
  if (!g || !g.ok) return;
  g.raf = requestAnimationFrame(mfgLoop);
  const dt = Math.min(.05, g.lastT ? (ts - g.lastT) / 1000 : .016);
  g.lastT = ts;
  const before = g.theta;
  if (g.anim) {
    const A = g.anim;
    const p = Math.min(1, (ts - A.t0) / A.dur);
    const e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;   // easeInOutCubic
    g.theta = A.from + (A.to - A.from) * e;
    if (p >= 1) { g.theta = A.to; g.anim = null; if (A.cb) A.cb(); }
  } else if (g.drag) {
    g.theta += (g.drag.target - g.theta) * Math.min(1, dt * 26);
  }
  g.vel = dt > 0 ? (g.theta - before) / dt : 0;
  // Ressort sous-amorti de la cambrure → fouetté + flottement naturels.
  const bt = Math.max(-.52, Math.min(.52, -g.vel * .1));
  const w0 = 16, zeta = .38;
  const acc = w0 * w0 * (bt - g.bend) - 2 * zeta * w0 * g.bendV;
  g.bendV += acc * dt;
  g.bend += g.bendV * dt;
  mfgRender();
  // Plus rien ne bouge (la pointe a fini de flotter) → masque + repos.
  if (!g.anim && !g.drag && !g.busy && !g.peek && Math.abs(g.bend) < .0012 && Math.abs(g.bendV) < .012) {
    cancelAnimationFrame(g.raf); g.raf = 0; g.lastT = 0;
    g.theta = 0; g.bend = 0; g.bendV = 0;
    mfgShow(false);
  }
}
function mfgWake() {
  const g = _mfg;
  if (!g.raf) { g.lastT = 0; g.raf = requestAnimationFrame(mfgLoop); }
}

// Lance un flip complet (boutons / clavier / fin de drag).
async function mfgFlip(dir) {
  const g = _mfg;
  const S = _miloState.spread;
  const frontIdx = dir > 0 ? miloRightIdx(S) : miloRightIdx(S - 1);
  const backIdx = dir > 0 ? miloLeftIdx(S + 1) : miloLeftIdx(S);
  let ft, bt;
  try {
    [ft, bt] = await Promise.race([
      Promise.all([mfgGetTex(frontIdx), mfgGetTex(backIdx)]),
      // Marge élargie : on préfère attendre la texture COMPLÈTE (toutes les
      // cartes dessinées) plutôt que retomber sur la feuille legacy dont les
      // <img> se chargent pendant l'animation. Grâce au préchargement de
      // mfgWarm, la texture est presque toujours déjà prête → aucun délai.
      new Promise((_, rej) => setTimeout(rej, 900)),
    ]);
  } catch { return false; }
  if (!ft || !bt || !_mfg || !_mfg.ok) return false;
  g.mat.uniforms.uFront.value = ft;
  g.mat.uniforms.uBack.value = bt;
  g.theta = dir > 0 ? 0 : -Math.PI;
  g.bend = 0; g.bendV = 0;
  g.busy = true;
  mfgGhostRings(true);
  mfgShow(true);
  mfgRender();
  // La page révélée dessous est posée APRÈS que la feuille GL couvre la zone.
  const left = document.getElementById('milo-page-left');
  const right = document.getElementById('milo-page-right');
  if (dir > 0) { right.innerHTML = miloPageHTML(miloRightIdx(S + 1)); }
  else { left.innerHTML = miloPageHTML(miloLeftIdx(S - 1)); }
  hydrateFallbackImages(dir > 0 ? right : left);
  mfgWake();
  g.anim = { from: g.theta, to: dir > 0 ? -Math.PI : 0, t0: performance.now(), dur: 1150, cb: () => mfgFinalize(dir, frontIdx, backIdx) };
  return true;
}

// Fin de flip : bascule le DOM, petit « coup de reins » du livre, préchauffe.
function mfgFinalize(dir, frontIdx, backIdx) {
  const g = _mfg;
  const left = document.getElementById('milo-page-left');
  const right = document.getElementById('milo-page-right');
  if (dir > 0) { left.innerHTML = miloPageHTML(backIdx); _miloState.spread += 1; }
  else { right.innerHTML = miloPageHTML(frontIdx); _miloState.spread -= 1; }
  hydrateFallbackImages(dir > 0 ? left : right);
  updateMiloControls(); updateMiloProgress();
  g.busy = false;
  mfgGhostRings(false);
  // Le canvas reste visible le temps que la pointe finisse de flotter, puis
  // la boucle le masque toute seule. (Le « coup de reins » du livre à
  // l'atterrissage a été retiré : le classeur reste immobile.)
  _miloState.flipping = false;
  clearTimeout(_miloFlipGuard);   // arrivé à bon port : le garde-fou est levé
  mfgWarm();
}

// Annulation d'un drag relâché avant la moitié : la page revient se poser.
function mfgCancel(dir, frontIdx, backIdx) {
  const g = _mfg;
  const left = document.getElementById('milo-page-left');
  const right = document.getElementById('milo-page-right');
  // La feuille est revenue se poser : on restaure la page qui était visible.
  if (dir > 0) { right.innerHTML = miloPageHTML(frontIdx); hydrateFallbackImages(right); }
  else { left.innerHTML = miloPageHTML(backIdx); hydrateFallbackImages(left); }
  g.busy = false;
  mfgGhostRings(false);
  _miloState.flipping = false;
}

// ── Drag « vrai livre » : on attrape la page n'importe où et on la tourne ──
function mfgAttachDrag() {
  const g = _mfg;
  const book = g.book;
  // Après un drag, avale le clic résiduel (sinon une carte se coche).
  book.addEventListener('click', e => {
    if (g.suppressClick) { g.suppressClick = false; e.stopPropagation(); e.preventDefault(); }
  }, true);
  // Aucun drag natif (images de cartes, sélection de texte) pendant le geste.
  book.addEventListener('dragstart', e => e.preventDefault());

  let pd = null;                                     // pointerdown en attente de seuil
  book.addEventListener('pointerdown', e => {
    if (!g.ok || g.busy || _miloState.flipping || e.button !== 0) return;
    if (g.binder.classList.contains('closed')) return;
    // Une carte de classeur custom se déplace au drag : pas de flip de page.
    if (e.target.closest && e.target.closest('.milo-cell.is-custom')) return;
    const r = book.getBoundingClientRect();
    const rightHalf = e.clientX > r.left + r.width / 2;
    const S = _miloState.spread;
    const dir = rightHalf ? 1 : -1;
    if (dir > 0 && S >= miloTotalSpreads() - 1) return;
    if (dir < 0 && S <= 0) return;
    pd = { x: e.clientX, y: e.clientY, dir, id: e.pointerId, starting: false };
    // Pré-compose les textures pendant l'hésitation du geste.
    const fi = dir > 0 ? miloRightIdx(S) : miloRightIdx(S - 1);
    const bi = dir > 0 ? miloLeftIdx(S + 1) : miloLeftIdx(S);
    mfgGetTex(fi); mfgGetTex(bi);
  }, true);

  book.addEventListener('pointermove', async e => {
    if (!pd || pd.starting || g.drag || e.pointerId !== pd.id) return;
    const dx = e.clientX - pd.x, dy = e.clientY - pd.y;
    if (Math.abs(dx) < 9 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    // Seuil franchi → le drag démarre pour de vrai. On garde `pd` vivant
    // pendant la composition : si les textures tardent, le PROCHAIN mouvement
    // retente au lieu de laisser un geste mort (page qui « ne répond pas »).
    pd.starting = true;
    const start = pd;
    const S = _miloState.spread;
    const dir = start.dir;
    const frontIdx = dir > 0 ? miloRightIdx(S) : miloRightIdx(S - 1);
    const backIdx = dir > 0 ? miloLeftIdx(S + 1) : miloLeftIdx(S);
    let ft, bt;
    try {
      [ft, bt] = await Promise.race([
        Promise.all([mfgGetTex(frontIdx), mfgGetTex(backIdx)]),
        new Promise((_, rej) => setTimeout(rej, 700)),
      ]);
    } catch { if (pd === start) pd.starting = false; return; }
    if (pd !== start) return;                      // geste relâché entre-temps
    pd = null;
    if (!ft || !bt || g.busy || _miloState.flipping) return;
    _miloState.flipping = true;
    g.busy = true;
    g.suppressClick = true;
    g.mat.uniforms.uFront.value = ft;
    g.mat.uniforms.uBack.value = bt;
    g.theta = dir > 0 ? 0 : -Math.PI;
    g.bend = 0; g.bendV = 0;
    // Mapping RELATIF au point saisi : la page suit le doigt sans téléporter.
    const r0 = book.getBoundingClientRect();
    const q0 = Math.max(-1, Math.min(1, (e.clientX - (r0.left + r0.width / 2)) / (r0.width / 2)));
    g.drag = { dir, frontIdx, backIdx, target: g.theta, grabA: Math.acos(q0), theta0: g.theta, lastX: e.clientX, velX: 0, lastT: performance.now() };
    book.classList.add('dragging');
    document.body.classList.add('milo-no-select');
    try { const sel = window.getSelection(); if (sel) sel.removeAllRanges(); } catch {}
    try { book.setPointerCapture(start.id); } catch {}
    mfgGhostRings(true);
    mfgShow(true);
    mfgRender();
    const left = document.getElementById('milo-page-left');
    const right = document.getElementById('milo-page-right');
    if (dir > 0) { right.innerHTML = miloPageHTML(miloRightIdx(S + 1)); hydrateFallbackImages(right); }
    else { left.innerHTML = miloPageHTML(miloLeftIdx(S - 1)); hydrateFallbackImages(left); }
    mfgWake();
  });
  // Suivi du doigt : delta d'angle depuis le point saisi (aucun saut au départ),
  // vélocité lissée conservée pour la pichenette au relâché.
  book.addEventListener('pointermove', e => {
    if (!g.drag || g.anim) return;
    e.preventDefault();
    const r = book.getBoundingClientRect();
    const q = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)));
    g.drag.target = Math.max(-Math.PI, Math.min(0, g.drag.theta0 + (g.drag.grabA - Math.acos(q))));
    const now = performance.now(), dtm = now - g.drag.lastT;
    if (dtm > 0) {
      g.drag.velX = .7 * g.drag.velX + .3 * ((e.clientX - g.drag.lastX) / dtm);   // px/ms lissé
      g.drag.lastX = e.clientX; g.drag.lastT = now;
    }
  });
  const release = e => {
    pd = null;
    if (!g.drag) return;
    const d = g.drag; g.drag = null;
    book.classList.remove('dragging');
    document.body.classList.remove('milo-no-select');
    // Décision RELATIVE au sens du geste : la page part dès ~1/3 du chemin ou
    // sur une pichenette dans le sens du drag ; seul un retour FRANC annule.
    // (L'ancien seuil « moitié absolue » faisait revenir la page en arrière
    // alors qu'on l'avait clairement emmenée.)
    const prog = d.dir > 0 ? (-g.theta / Math.PI) : (1 + g.theta / Math.PI);
    const flick = d.dir > 0 ? d.velX < -.25 : d.velX > .25;
    const backFlick = d.dir > 0 ? d.velX > .45 : d.velX < -.45;
    const completes = !backFlick && (flick || prog > .32);
    const to = (d.dir > 0) === completes ? -Math.PI : 0;
    const dist = Math.abs(to - g.theta);
    const dur = Math.max(240, Math.min(900, dist * 400 + 140));
    g.anim = {
      from: g.theta, to, t0: performance.now(), dur,
      cb: completes ? () => mfgFinalize(d.dir, d.frontIdx, d.backIdx)
                    : () => mfgCancel(d.dir, d.frontIdx, d.backIdx),
    };
    mfgWake();
  };
  book.addEventListener('pointerup', release);
  book.addEventListener('pointercancel', release);

  // (Le « peek » au survol des bords a été retiré : la page qui se soulevait
  // toute seule — parfois en retard, après la composition de texture — était
  // perçue comme un mouvement parasite. Le livre reste immobile tant qu'on ne
  // le manipule pas.)
}

// ── Drag & drop des cartes entre pochettes (classeurs custom) ──────
// On attrape une carte, elle se soulève et suit le doigt ; on la lâche sur
// n'importe quelle pochette du spread (vide ou non → échange de places).
function attachCardDnD() {
  const book = document.getElementById('milo-book');
  if (!book || binderCtx().owned) return;
  let pend = null, drag = null, swallow = false;
  const cleanup = () => {
    if (drag) { drag.ghost.remove(); drag = null; }
    pend = null;
    document.body.classList.remove('milo-no-select');
    book.classList.remove('card-dragging');
    document.querySelectorAll('.drag-src,.drop-hover').forEach(el => el.classList.remove('drag-src', 'drop-hover'));
  };
  const findCell = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return el && el.closest ? el.closest('.milo-cell[data-slot]') : null;
  };
  book.addEventListener('click', e => {
    if (swallow) { swallow = false; e.stopPropagation(); e.preventDefault(); }
  }, true);
  book.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    // Suppression FIABLE : sur les pages inclinées en 3D, le hit-test natif
    // (elementFromPoint / clic) ne route pas jusqu'au petit ✕ — surtout sur la
    // ligne du bas (foreshortening), et l'appui peut même « manquer » la
    // cellule. On ne dépend donc PAS de e.target : on scanne la position ÉCRAN
    // (getBoundingClientRect, elle correcte) de tous les ✕ et, si l'appui tombe
    // dans l'un (marge incluse), on supprime cette carte directement.
    const rmHit = [...book.querySelectorAll('.milo-cell.is-custom .milo-cell-remove')].find(btn => {
      const rr = btn.getBoundingClientRect(), pad = 10;
      return rr.width > 0 && e.clientX >= rr.left - pad && e.clientX <= rr.right + pad &&
             e.clientY >= rr.top - pad && e.clientY <= rr.bottom + pad;
    });
    if (rmHit) {
      e.preventDefault(); e.stopPropagation();
      const cell = rmHit.closest('.milo-cell.is-custom');
      const slot = cell ? parseInt(cell.dataset.slot, 10) : NaN;
      if (!isNaN(slot)) removeBinderCard(slot);
      return;
    }
    const cell = e.target.closest && e.target.closest('.milo-cell.is-custom');
    if (!cell) return;
    pend = { x: e.clientX, y: e.clientY, cell, id: e.pointerId };
  });
  const moveGhost = e => {
    drag.ghost.style.transform = `translate(${e.clientX - drag.ox}px,${e.clientY - drag.oy}px) rotate(2.5deg) scale(1.05)`;
    const cell = findCell(e.clientX, e.clientY);
    if (drag.over && drag.over !== cell) drag.over.classList.remove('drop-hover');
    if (cell && cell !== drag.over && !cell.classList.contains('drag-src')) cell.classList.add('drop-hover');
    drag.over = cell;
  };
  book.addEventListener('pointermove', e => {
    if (pend && !drag && e.pointerId === pend.id) {
      if (Math.hypot(e.clientX - pend.x, e.clientY - pend.y) < 8) return;
      const cell = pend.cell; pend = null;
      const from = parseInt(cell.dataset.slot, 10);
      const cardEl = cell.querySelector('.milo-cell-card');
      if (!cardEl || isNaN(from)) return;
      const r = cardEl.getBoundingClientRect();
      const ghost = cardEl.cloneNode(true);
      ghost.className = 'milo-card-ghost';
      ghost.style.width = r.width + 'px'; ghost.style.height = r.height + 'px';
      document.body.appendChild(ghost);
      drag = { from, ghost, ox: e.clientX - r.left, oy: e.clientY - r.top, over: null };
      cell.classList.add('drag-src');
      document.body.classList.add('milo-no-select');
      book.classList.add('card-dragging');
      swallow = true;
      if (_mfg && _mfg.ok) _mfg.suppressClick = true;
      try { book.setPointerCapture(e.pointerId); } catch {}
      e.preventDefault();
      moveGhost(e);
    } else if (drag) {
      e.preventDefault();
      moveGhost(e);
    }
  });
  book.addEventListener('pointerup', e => {
    pend = null;
    if (!drag) return;
    const d = drag;
    const target = findCell(e.clientX, e.clientY);
    cleanup();
    if (!target) return;
    const to = parseInt(target.dataset.slot, 10);
    if (isNaN(to) || to === d.from) return;
    const b = binderById(state.currentBinder);
    if (!b) return;
    while (b.cards.length <= Math.max(to, d.from)) b.cards.push(null);
    const tmp = b.cards[to] || null;                 // échange (ou déplacement si vide)
    b.cards[to] = b.cards[d.from] || null;
    b.cards[d.from] = tmp;
    trimBinderTail(b);
    save();
    refreshSpreadPages();
  });
  book.addEventListener('pointercancel', cleanup);
}

// Clavier : ← / → feuillettent (hors champs de saisie).
document.addEventListener('keydown', e => {
  if (state.view !== 'binder-detail') return;
  if (/input|textarea|select/i.test((e.target && e.target.tagName) || '')) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); miloTurn(1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); miloTurn(-1); }
});

// ════════════════════════════════════════════════════════════════
//  SCÈNE 3D DE FOND — le mesh Milobellus (Milotic) qui ondule,
//  colorisé façon ondine : corps crème nacré, ailerons cyan, rose aux
//  volutes. Éclairage crème + teal + rose ; orbes bioluminescentes.
// ════════════════════════════════════════════════════════════════
let _miloScene = null;
function stopMiloScene() {
  if (!_miloScene) return;
  _miloScene.stopped = true;
  cancelAnimationFrame(_miloScene.raf);
  window.removeEventListener('resize', _miloScene.onResize);
  try { _miloScene.renderer.dispose(); } catch {}
  _miloScene = null;
}
function initMiloScene() {
  const canvas = document.getElementById('milo-bg-canvas');
  const THREE = window.THREE;
  if (!canvas || !THREE) return;
  if (miloReduce()) return;                 // pas de 3D lourde en mouvement réduit
  stopMiloScene();
  pauseHero();                              // évite deux boucles WebGL actives
  let W = window.innerWidth, H = window.innerHeight;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050b1a, 0.0052);
  const camera = new THREE.PerspectiveCamera(46, W / H, 0.1, 3000);
  camera.position.set(0, 6, 205);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.4));
  renderer.setSize(W, H, false);
  renderer.outputEncoding = THREE.sRGBEncoding;

  // Éclairage « ondine » : clé crème chaude, remplissage teal, contre-jour rose.
  scene.add(new THREE.AmbientLight(0x16324f, 0.55));
  const key = new THREE.DirectionalLight(0xfff1d8, 1.7); key.position.set(-70, 130, 130); scene.add(key);
  const teal = new THREE.DirectionalLight(0x38c6ec, 1.15); teal.position.set(80, -50, 70); scene.add(teal);
  const rose = new THREE.DirectionalLight(0xff86b0, 1.0); rose.position.set(95, 55, -70); scene.add(rose);
  const glow = new THREE.PointLight(0x9fe8ff, 1.4, 700); glow.position.set(0, 24, 100); scene.add(glow);

  // Texture d'orbe (halo radial doux)
  const oc = document.createElement('canvas'); oc.width = oc.height = 64;
  const octx = oc.getContext('2d');
  const grd = octx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(.3, 'rgba(180,236,255,.85)');
  grd.addColorStop(.6, 'rgba(90,200,255,.3)'); grd.addColorStop(1, 'rgba(90,200,255,0)');
  octx.fillStyle = grd; octx.fillRect(0, 0, 64, 64);
  const orbTex = new THREE.Texture(oc); orbTex.needsUpdate = true;
  const orbs = [];
  for (let i = 0; i < 30; i++) {
    const rosy = Math.random() < 0.32;
    const mat = new THREE.SpriteMaterial({ map: orbTex, color: rosy ? 0xff9ec4 : 0x9fe8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const s = new THREE.Sprite(mat);
    const sz = 5 + Math.random() * 20; s.scale.set(sz, sz, 1);
    s.position.set((Math.random() - .5) * 320, (Math.random() - .5) * 200, (Math.random() - .5) * 220 - 20);
    s.userData = { op: .35 + Math.random() * .5, ph: Math.random() * 6.28, spd: .3 + Math.random() * .7, drift: .04 + Math.random() * .12 };
    scene.add(s); orbs.push(s);
  }
  // Neige marine
  const SN = 500, snPos = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) { snPos[i * 3] = (Math.random() - .5) * 420; snPos[i * 3 + 1] = (Math.random() - .5) * 300; snPos[i * 3 + 2] = (Math.random() - .5) * 260 - 30; }
  const snGeo = new THREE.BufferGeometry(); snGeo.setAttribute('position', new THREE.BufferAttribute(snPos, 3));
  scene.add(new THREE.Points(snGeo, new THREE.PointsMaterial({ color: 0xaee0ff, size: 0.9, transparent: true, opacity: .38, depthWrite: false })));

  let model = null;
  getModelClone('milotic', window.MILOTIC_GLB_BASE64, 'milotic.glb').then(g => {
    const box = new THREE.Box3().setFromObject(g);
    const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    const scale = 168 / (Math.max(size.x, size.y, size.z) || 1);
    g.scale.setScalar(scale);
    g.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    g.traverse(o => {
      if (o.isMesh) {
        o.material = new THREE.MeshStandardMaterial({ color: 0xe6eef4, emissive: 0x1d6f9c, emissiveIntensity: 0.32, metalness: 0.5, roughness: 0.34 });
      }
    });
    const pivot = new THREE.Group(); pivot.add(g);
    pivot.position.set(64, -6, 24); pivot.rotation.y = -0.5;
    scene.add(pivot); model = pivot;
  }).catch(() => {});

  const clock = new THREE.Clock();
  const onResize = () => { W = window.innerWidth; H = window.innerHeight; camera.aspect = W / H; camera.updateProjectionMatrix(); renderer.setSize(W, H, false); };
  window.addEventListener('resize', onResize);
  _miloScene = { renderer, onResize, raf: 0, stopped: false };
  const tick = () => {
    if (_miloScene.stopped) return;
    const t = clock.getElapsedTime();
    if (model) { model.rotation.y = -0.5 + Math.sin(t * 0.12) * 0.3; model.position.y = -6 + Math.sin(t * 0.42) * 5; model.rotation.z = Math.sin(t * 0.2) * 0.05; }
    for (const s of orbs) { const u = s.userData; s.material.opacity = u.op * (0.45 + 0.55 * Math.sin(t * u.spd + u.ph)); s.position.y += u.drift; if (s.position.y > 120) s.position.y = -120; }
    camera.position.x = Math.sin(t * 0.13) * 16; camera.lookAt(0, 3, 0);
    renderer.render(scene, camera);
    _miloScene.raf = requestAnimationFrame(tick);
  };
  tick();
}

// ── Lightbox : visuel de carte en grand ────────────────────────────
function openPhotoLightbox(src, caption = '') {
  if (!src) return;
  const box = document.getElementById('photo-lightbox');
  const img = document.getElementById('lightbox-img');
  const cap = document.getElementById('lightbox-cap');
  if (!box || !img) return;
  img.src = src;
  cap.textContent = caption || '';
  cap.style.display = caption ? '' : 'none';
  box.classList.add('open');
  pauseHero();
}
function closePhotoLightbox() {
  const box = document.getElementById('photo-lightbox');
  if (!box || !box.classList.contains('open')) return;
  box.classList.remove('open');
  if (!anyModalOpen()) resumeHero();
}
function lightboxOpen() { return document.getElementById('photo-lightbox')?.classList.contains('open'); }
function anyModalOpen() { return !!document.querySelector('.modal-overlay.open'); }
function pauseHero() { if (_hero && !_hero.paused) { _hero.paused = true; cancelAnimationFrame(_hero.raf); } }
function resumeHero() { if (_hero && _hero.paused) { _hero.paused = false; _hero.raf = requestAnimationFrame(_hero.animate); } }

function openModal(m) { (typeof m === 'string' ? document.getElementById(m) : m).classList.add('open'); pauseHero(); }
function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
  if (!anyModalOpen()) resumeHero();
  // Quitter le picker d'un classeur par n'importe quel chemin (✕, overlay…)
  // rafraîchit la double-page : les ajouts sont toujours visibles.
  if (id === 'modal-card-picker' && state.pickerMode === 'binder' && state.view === 'binder-detail') refreshSpreadPages();
}
function closeTopModal() {
  const picker = document.getElementById('modal-card-picker');
  const detail = document.getElementById('modal-card-detail');
  if (picker.classList.contains('open')) { picker.classList.remove('open'); if (!anyModalOpen()) resumeHero(); return; }
  if (detail.classList.contains('open')) { detail.classList.remove('open'); if (!anyModalOpen()) resumeHero(); return; }
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
  resumeHero();
}
document.addEventListener('click', e => { if (e.target.classList.contains('modal-overlay')) { e.target.classList.remove('open'); if (!anyModalOpen()) resumeHero(); } });
// Échap ferme la couche la plus haute, dans l'ordre : lightbox → palette →
// modale. Chaque dialogue a donc TOUJOURS une échappatoire au clavier.
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (lightboxOpen()) closePhotoLightbox();
  else if (paletteOpen()) closePalette();
  else closeTopModal();
});

function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
function esc(s) { if (s == null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
// Échappe une valeur destinée à une chaîne JS entre apostrophes DANS un
// attribut HTML (onclick/onerror="fn('…')"). esc() y était FAUX : il produit
// &#39; que le parseur HTML redécode en ' → chaîne JS cassée (SyntaxError) sur
// les noms à apostrophe (« Taupiqueur d'Alola »…). Ici l'apostrophe et
// l'antislash sont échappés au niveau JS (\' , \\), le reste en entités HTML
// qui se redécodent proprement à l'intérieur de la chaîne.
function jss(s) {
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\').replace(/'/g, "\\'")
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\r?\n/g, ' ');
}

// ════════════════════════════════════════════════════════════════
//  ACTUALISATION DES SÉRIES — écran de sync dédié + détection des
//  nouvelles séries (≠ chargement initial de la page)
// ════════════════════════════════════════════════════════════════
const SERIES_STORE_KEY = 'pkm_known_series_v1';
function getKnownSeries() { try { return JSON.parse(localStorage.getItem(SERIES_STORE_KEY)) || []; } catch { return []; } }
function setKnownSeries(ids) { try { localStorage.setItem(SERIES_STORE_KEY, JSON.stringify(ids)); } catch {} }

// Vérification silencieuse au démarrage : signale (pastille sur le bouton)
// qu'une nouvelle série est sortie depuis la dernière visite.
async function checkForNewSeries() {
  try {
    const series = await apiFetch('/series');
    const known = getKnownSeries();
    if (!known.length) { setKnownSeries(series.map(s => s.id)); return; }
    const fresh = series.filter(s => !known.includes(s.id));
    if (fresh.length) {
      const btn = document.getElementById('btn-refresh');
      btn?.classList.add('has-new');
      btn?.setAttribute('title', `${fresh.length} nouvelle série disponible — clique pour actualiser`);
    }
  } catch {}
}

let _refreshBusy = false;
async function refreshSeries() {
  if (_refreshBusy) return;
  _refreshBusy = true;
  const btn = document.getElementById('btn-refresh');
  const overlay = document.getElementById('refresh-overlay');
  const title = document.getElementById('refresh-title');
  const sub = document.getElementById('refresh-sub');
  btn?.classList.add('spinning');
  sub.classList.remove('done');
  title.textContent = 'Synchronisation';
  sub.textContent = 'Recherche de nouvelles séries…';
  overlay.classList.add('open');
  pauseHero();          // évite deux contextes WebGL lourds simultanés
  startRefreshFX();
  startRefresh3D();      // Giratina + Milobellus présents pendant la sync
  const t0 = performance.now();

  // Purge des caches réseau pour forcer une récupération fraîche :
  // — structure (séries/sets), en mémoire ET sur disque, sinon une nouvelle
  //   série (ex. Nuit Noire) resterait invisible jusqu'à expiration du cache ;
  // — visuels de repli et fiches externes, pour capter les images fraîchement
  //   publiées des nouveaux sets.
  // Les COTES, elles, ne sont PAS purgées : elles appartiennent au bouton de
  // chaque carte (syncCardPrice). « Actualiser » ne doit jamais vider les
  // valeurs enregistrées — un hoquet réseau afficherait sinon un coffre à 0 €.
  Object.keys(cache).forEach(k => { if (k.startsWith('/series') || k.startsWith('/sets') || k.startsWith('/cards')) delete cache[k]; });
  _apiStore = { total: 0, order: [], map: {} };
  try { localStorage.removeItem(APICACHE_KEY); } catch {}
  _soldStore = {};
  try { localStorage.removeItem(SOLD_KEY); } catch {}
  Object.keys(fallbackSetCache).forEach(k => delete fallbackSetCache[k]);
  Object.keys(fallbackCache).forEach(k => delete fallbackCache[k]);
  Object.keys(ghSetJsonCache).forEach(k => delete ghSetJsonCache[k]);
  Object.keys(ghSetCache).forEach(k => delete ghSetCache[k]);
  Object.keys(ghIdCache).forEach(k => delete ghIdCache[k]);
  Object.keys(ptcgCardCache).forEach(k => delete ptcgCardCache[k]);
  Object.keys(enCardCache).forEach(k => delete enCardCache[k]);
  _ghSetsIndexPromise = null;

  let series = [], fresh = [];
  try {
    series = await apiFetch('/series');
    const known = getKnownSeries();
    if (known.length) fresh = series.filter(s => !known.includes(s.id));
    setKnownSeries(series.map(s => s.id));
  } catch {}

  // Durée minimale pour apprécier l'animation
  await new Promise(r => setTimeout(r, Math.max(0, 1900 - (performance.now() - t0))));

  sub.classList.add('done');
  if (!series.length) { title.textContent = 'Hors ligne'; sub.textContent = 'Impossible de contacter le serveur'; }
  else if (fresh.length) { title.textContent = 'Nouveautés !'; sub.textContent = `${fresh.length} nouvelle${fresh.length>1?'s':''} série${fresh.length>1?'s':''} — ${fresh.map(s => s.name).join(' · ')}`; }
  else { title.textContent = 'À jour'; sub.textContent = `${series.length} séries synchronisées`; }
  await new Promise(r => setTimeout(r, fresh.length ? 1700 : 1050));

  overlay.classList.add('closing');
  overlay.classList.remove('open');
  setTimeout(() => { overlay.classList.remove('closing'); stopRefreshFX(); stopRefresh3D(); }, 520);
  btn?.classList.remove('spinning', 'has-new');
  btn?.setAttribute('title', 'Rechercher les nouvelles séries');
  _refreshBusy = false;

  if (series.length) {
    renderViewContent(state.view);
    repositionNavSoon();
    // Cote les cartes encore inconnues (sans toucher aux cotes enregistrées).
    ensurePrices(trackedCardIds(), n => {
      if (n && state.view === 'home') { computeCollectionValue(); fillWishlistRemaining(state.wishlists); refreshSyncMeta(); }
    });
    if (fresh.length) toast(`${fresh.length} nouvelle${fresh.length>1?'s':''} série${fresh.length>1?'s':''} disponible${fresh.length>1?'s':''} !`, 'success');
    else toast('Séries à jour', 'success');
  } else {
    toast('Actualisation impossible (hors ligne)', 'error');
  }
}

// Effet « hyperespace » cyan/violet derrière l'écran de synchronisation
let _refreshFX = null;
function startRefreshFX() {
  const canvas = document.getElementById('refresh-canvas');
  if (!canvas) return;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let W, H, cx, cy;
  const resize = () => { W = canvas.width = canvas.clientWidth * DPR; H = canvas.height = canvas.clientHeight * DPR; cx = W / 2; cy = H / 2; };
  resize();
  const onResize = () => resize();
  window.addEventListener('resize', onResize);
  _refreshFX = { onResize, raf: 0, stopped: false };
  const N = reduce ? 0 : 150;
  const spawn = () => ({ a: Math.random() * Math.PI * 2, d: Math.random() * Math.min(W, H) * 0.14, v: 1 + Math.random() * 3, w: 0.6 + Math.random() * 1.7, c: Math.random() < 0.5 ? [79, 214, 255] : [163, 133, 240] });
  const P = []; for (let i = 0; i < N; i++) P.push(spawn());
  const maxD = Math.hypot(W, H) * 0.62;
  const draw = () => {
    if (_refreshFX.stopped) return;
    ctx.fillStyle = 'rgba(3,4,12,0.30)';
    ctx.fillRect(0, 0, W, H);
    for (const p of P) {
      const x1 = cx + Math.cos(p.a) * p.d, y1 = cy + Math.sin(p.a) * p.d;
      p.d += p.v * (1 + p.d / Math.max(W, H));
      const x2 = cx + Math.cos(p.a) * p.d, y2 = cy + Math.sin(p.a) * p.d;
      const alpha = Math.min(1, p.d / (Math.min(W, H) * 0.5));
      ctx.strokeStyle = `rgba(${p.c[0]},${p.c[1]},${p.c[2]},${alpha * 0.8})`;
      ctx.lineWidth = p.w * DPR;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      if (p.d > maxD) Object.assign(p, spawn(), { d: 0 });
    }
    _refreshFX.raf = requestAnimationFrame(draw);
  };
  if (N) _refreshFX.raf = requestAnimationFrame(draw);
}
function stopRefreshFX() {
  if (!_refreshFX) return;
  _refreshFX.stopped = true;
  cancelAnimationFrame(_refreshFX.raf);
  window.removeEventListener('resize', _refreshFX.onResize);
  const canvas = document.getElementById('refresh-canvas');
  if (canvas) { try { canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height); } catch {} }
  _refreshFX = null;
}

// Scène 3D compacte pour l'écran d'actualisation : Giratina + Milobellus
// (clones du cache → instantané) flottent dans l'abysse avec éclairs, en
// arrière-plan des anneaux du HUD. Rend l'attente spectaculaire.
let _refresh3D = null;
function startRefresh3D() {
  if (isPhone()) return;   // pas de modèles chargés sur téléphone (voir isPhone)
  const canvas = document.getElementById('refresh-canvas-3d');
  const THREE = window.THREE;
  if (!canvas || !THREE || !THREE.GLTFLoader) return;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;
  let W = window.innerWidth, H = window.innerHeight;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x03081a, 0.011);
  const camera = new THREE.PerspectiveCamera(52, W / H, 0.1, 2000);
  camera.position.set(0, 6, 215);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(W, H, false);
  renderer.outputEncoding = THREE.sRGBEncoding;

  // Éclairage plus généreux que le hero : sur l'écran de sync, les deux mesh
  // doivent rester bien VISIBLES en permanence (pas seulement aux flashs).
  const ambient = new THREE.AmbientLight(0x1a3358, 0.62); scene.add(ambient);
  const key = new THREE.DirectionalLight(0x9fe8ff, 2.3); key.position.set(-70, 120, 110); scene.add(key);
  const fill = new THREE.DirectionalLight(0x3bccff, 1.0); fill.position.set(40, -60, 60); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xb488ff, 1.5); rim.position.set(85, 50, -90); scene.add(rim);
  const flash = new THREE.DirectionalLight(0xeafcff, 0); flash.position.set(-30, 70, 120); scene.add(flash);

  // texture radiale (halos + orbes)
  const tc = document.createElement('canvas'); tc.width = tc.height = 64;
  const tg = tc.getContext('2d').createRadialGradient(32, 32, 0, 32, 32, 32);
  tg.addColorStop(0, 'rgba(255,255,255,1)'); tg.addColorStop(.3, 'rgba(180,235,255,.85)'); tg.addColorStop(.6, 'rgba(80,200,255,.3)'); tg.addColorStop(1, 'rgba(80,200,255,0)');
  const tctx = tc.getContext('2d'); tctx.fillStyle = tg; tctx.fillRect(0, 0, 64, 64);
  const dot = new THREE.Texture(tc); dot.needsUpdate = true;

  const orbs = [];
  for (let i = 0; i < 30; i++) {
    const violet = Math.random() < 0.3;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: violet ? 0x9b6fe8 : 0x8fe8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    const sz = 4 + Math.random() * 14; s.scale.set(sz, sz, 1);
    s.position.set((Math.random() - .5) * 300, (Math.random() - .5) * 190, (Math.random() - .5) * 160 - 20);
    s.userData = { op: .4 + Math.random() * .5, ph: Math.random() * 6.28, spd: .4 + Math.random() * .8, drift: .05 + Math.random() * .18 };
    scene.add(s); orbs.push(s);
  }
  const halos = [];
  function halo(color, size, x, y, z, op) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.scale.set(size, size, 1); s.position.set(x, y, z); scene.add(s);
    halos.push({ s, op, ph: Math.random() * 6.28, spd: .4 + Math.random() * .5 });
  }

  const CFG = [
    { key: 'giratina', b64: window.GIRATINA_GLB_BASE64, file: 'giratina.glb',
      mat: { color: 0x5a4288, emissive: 0xab35d2, emissiveIntensity: 1.0, metalness: 0.4, roughness: 0.4 },
      size: 188, pos: { x: -62, y: 16, z: -18 }, rotY: 0.82, spin: -0.16, floatAmp: 6, floatSpd: 0.5,
      halo: 0x8a3fd0, haloCore: 0xd58aff, haloSize: 300 },
    { key: 'milotic', b64: window.MILOTIC_GLB_BASE64, file: 'milotic.glb',
      mat: { color: 0x2f8fd8, emissive: 0x16487e, emissiveIntensity: 0.55, metalness: 0.74, roughness: 0.28 },
      size: 150, pos: { x: 66, y: -8, z: 6 }, rotY: -0.6, spin: 0.2, floatAmp: 6, floatSpd: 0.62,
      halo: 0x2a9fe0, haloCore: 0x9ff0ff, haloSize: 220 },
  ];
  const built = [];
  for (const c of CFG) {
    getModelClone(c.key, c.b64, c.file).then(root => {
      root.traverse(o => { if (o.isMesh) o.material = new THREE.MeshStandardMaterial({ ...c.mat, flatShading: false }); });
      const box = new THREE.Box3().setFromObject(root); const ctr = box.getCenter(new THREE.Vector3()); const sz = box.getSize(new THREE.Vector3());
      root.position.sub(ctr);
      const g = new THREE.Group(); g.scale.setScalar(c.size / (Math.max(sz.x, sz.y, sz.z) || 1));
      g.position.set(c.pos.x, c.pos.y, c.pos.z); g.rotation.y = c.rotY; g.add(root); scene.add(g);
      halo(c.halo, c.haloSize, c.pos.x, c.pos.y + 6, c.pos.z - 60, 0.34);
      halo(c.haloCore, c.haloSize * .55, c.pos.x, c.pos.y + 2, c.pos.z - 44, 0.55);
      built.push({ g, c });
    }).catch(() => {});
  }

  const onResize = () => { W = window.innerWidth; H = window.innerHeight; camera.aspect = W / H; camera.updateProjectionMatrix(); renderer.setSize(W, H, false); };
  window.addEventListener('resize', onResize);
  const clock = new THREE.Clock();
  let flashE = 0, nextFlash = 0.8;
  _refresh3D = { renderer, onResize, raf: 0, stopped: false };
  const tick = () => {
    if (_refresh3D.stopped) return;
    const t = clock.getElapsedTime();
    if (t > nextFlash) { flashE = 1; flash.position.set((Math.random() - .5) * 160, 40 + Math.random() * 80, 100); flash.color.setHex(Math.random() < .5 ? 0xcdf2ff : 0xe9ccff); nextFlash = t + 1.6 + Math.random() * 2.2; }
    flashE *= 0.86; if (flashE < 0.002) flashE = 0;
    flash.intensity = flashE * 7; ambient.intensity = 0.62 + flashE * 0.9; key.intensity = 2.3 + flashE * 2;
    for (const m of built) { m.g.rotation.y = m.c.rotY + t * m.c.spin; m.g.position.y = m.c.pos.y + Math.sin(t * m.c.floatSpd) * m.c.floatAmp; }
    for (const h of halos) h.s.material.opacity = h.op * (0.7 + 0.3 * Math.sin(t * h.spd + h.ph)) + flashE * 0.4;
    for (const o of orbs) { const u = o.userData; o.material.opacity = u.op * (0.5 + 0.5 * Math.sin(t * u.spd + u.ph)); o.position.y += u.drift; if (o.position.y > 100) o.position.y = -100; }
    camera.position.x = Math.sin(t * 0.25) * 10; camera.lookAt(0, 4, 0);
    renderer.render(scene, camera);
    _refresh3D.raf = requestAnimationFrame(tick);
  };
  tick();
}
function stopRefresh3D() {
  if (!_refresh3D) return;
  _refresh3D.stopped = true;
  cancelAnimationFrame(_refresh3D.raf);
  window.removeEventListener('resize', _refresh3D.onResize);
  try { _refresh3D.renderer.dispose(); } catch {}
  _refresh3D = null;
}

// ════════════════════════════════════════════════════════════════
//  SCENE 3D — "Abysses" (Three.js + modele Milobellus colorise)
//  Fosse oceanique sombre : Milobellus emerge de l'obscurite, colore
//  en degrade bleu profond, eclaire de cyan, entoure d'orbes
//  bioluminescentes et de rais de lumiere descendants.
// ════════════════════════════════════════════════════════════════
// ── Cache partagé des modèles GLB ───────────────────────────────────
// Chaque .glb n'est parsé qu'UNE fois (opération coûteuse pour Giratina,
// ~7 Mo) ; l'intro le parse en premier, le hero d'accueil réutilise ensuite
// un simple clone (géométrie/textures partagées) → aucun temps de chargement
// ni à-coup lors de l'arrivée sur l'accueil.
const _glbSourceCache = {};
function _b64ToBuf(b64) {
  const bin = atob(b64), len = bin.length, bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
function loadModelSource(key, b64, file) {
  if (!_glbSourceCache[key]) {
    // `b64` peut être undefined : model-data.js n'est plus chargé d'office (12 Mo).
    // On le réclame ici — il ne viendra qu'en file://, où fetch ne peut rien lire.
    _glbSourceCache[key] = ensureModelData().then(() => new Promise((resolve, reject) => {
      const THREE = window.THREE;
      if (!THREE || !THREE.GLTFLoader) return reject(new Error('GLTFLoader indisponible'));
      const loader = new THREE.GLTFLoader();
      const ok = gltf => resolve(gltf.scene);
      const data = b64 || window[key === 'milotic' ? 'MILOTIC_GLB_BASE64' : 'GIRATINA_GLB_BASE64'];
      try {
        if (data) loader.parse(_b64ToBuf(data), '', ok, reject);
        else loader.load(file, ok, undefined, reject);
      } catch (e) { reject(e); }
    }));
  }
  return _glbSourceCache[key];
}
// Renvoie un clone prêt à l'emploi (source jamais mutée → clonable à l'infini)
function getModelClone(key, b64, file) {
  return loadModelSource(key, b64, file).then(src => src.clone(true));
}
// Lance le parsing des modèles au plus tôt (dès que THREE est prêt), pour que
// le cache soit chaud avant même la fin de l'intro.
function warmupModels() {
  if (isPhone()) return;   // ~9 Mo de modèles que le mobile n'affiche pas
  loadModelSource('milotic', window.MILOTIC_GLB_BASE64, 'milotic.glb').catch(() => {});
  loadModelSource('giratina', window.GIRATINA_GLB_BASE64, 'giratina.glb').catch(() => {});
}

let _hero = null;
function destroyHero3D() {
  if (!_hero) return;
  cancelAnimationFrame(_hero.raf);
  window.removeEventListener('resize', _hero.onResize);
  _hero.canvas?.removeEventListener('pointermove', _hero.onMove);
  try { _hero.renderer.dispose(); } catch {}
  _hero = null;
}
function initHero3D() {
  if (isPhone()) return;   // scène d'ambiance réservée au desktop (voir isPhone)
  const canvas = document.getElementById('hero-canvas');
  if (!canvas || !window.THREE) return;
  const loadEl0 = document.getElementById('hero3d-loading'); if (loadEl0) loadEl0.style.display = 'none';
  // Scène déjà construite (canvas persistant réutilisé) : NE RIEN reconstruire —
  // pas de re-parsing/re-clonage des GLB. On réveille juste l'animation et on
  // recale la taille (la vue était masquée pendant la transition → dims à 0).
  if (_hero && _hero.canvas === canvas) {
    resumeHero();
    const refit = () => { if (_hero && _hero.onResize) _hero.onResize(); };
    requestAnimationFrame(refit); setTimeout(refit, 80); setTimeout(refit, 320);
    return;
  }
  destroyHero3D();
  const THREE = window.THREE;
  const wrap = canvas.parentElement;
  let W = wrap.clientWidth, H = wrap.clientHeight;
  if (!W || !H) return;
  // Modèles pré-parsés & clonés (cache chaud) → aucun spinner de chargement sur
  // l'accueil : le fond abyssal s'affiche tout de suite et les mesh apparaissent
  // dans la foulée. On masque donc l'indicateur d'emblée (ré-affiché seulement
  // en cas d'échec réel de chargement des deux modèles).
  const loadEl = document.getElementById('hero3d-loading'); if (loadEl) loadEl.style.display = 'none';

  const scene = new THREE.Scene();
  // Brume bleu abyssal — fond océanique profond (plus dense = plus sombre)
  scene.fog = new THREE.FogExp2(0x03081a, 0.0125);

  const camera = new THREE.PerspectiveCamera(54, W / H, 0.1, 2000);
  camera.position.set(12, 8, 205);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(W, H, false);
  renderer.outputEncoding = THREE.sRGBEncoding;

  // ── Éclairage abyssal (volontairement sombre : les modèles vivent dans
  //    l'ombre et sont révélés par les flashs / éclairs) ──
  const ambient = new THREE.AmbientLight(0x0c2036, 0.30);
  scene.add(ambient);
  const AMBIENT_BASE = 0.30;
  // lueur froide rasante principale (révèle les écailles) — atténuée
  const keyLight = new THREE.DirectionalLight(0x7fe0ff, 1.5);
  keyLight.position.set(-70, 130, 110);
  scene.add(keyLight);
  // rebond océanique cyan depuis le bas
  const fillLight = new THREE.DirectionalLight(0x3bccff, 0.7);
  fillLight.position.set(40, -60, 60);
  scene.add(fillLight);
  // contre-jour violet doux (profondeur, détache du fond)
  const rimLight = new THREE.DirectionalLight(0x8a78e8, 1.0);
  rimLight.position.set(90, 50, -90);
  scene.add(rimLight);
  // point bioluminescent qui roame entre les modèles
  const glowLight = new THREE.PointLight(0x6fe0ff, 1.6, 420);
  glowLight.position.set(0, 30, 70);
  scene.add(glowLight);
  // ⚡ lumière de flash (éclair / étoile filante) — éteinte par défaut,
  //    son intensité explose ponctuellement pour révéler les modèles
  const flashLight = new THREE.DirectionalLight(0xeafcff, 0);
  flashLight.position.set(-40, 80, 120);
  scene.add(flashLight);

  // Modèles chargés (Milobellus + Giratina) et leurs halos lumineux
  const loadedModels = [];
  const haloSprites = [];
  let modelsLoaded = 0;

  // ── Orbes bioluminescentes (sprites lumineux flottants) ──
  function makeOrbTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(180,235,255,0.9)');
    grd.addColorStop(0.55, 'rgba(59,204,255,0.35)');
    grd.addColorStop(1, 'rgba(59,204,255,0)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.Texture(c); tex.needsUpdate = true; return tex;
  }
  const orbTex = makeOrbTexture();
  const orbs = [];
  const ORB_N = 44;
  for (let i = 0; i < ORB_N; i++) {
    const violet = Math.random() < 0.28;
    const mat = new THREE.SpriteMaterial({ map: orbTex, color: violet ? 0x9b6fe8 : 0x8fe8ff, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false });
    const s = new THREE.Sprite(mat);
    const sz = 4 + Math.random() * 16;
    s.scale.set(sz, sz, 1);
    s.position.set((Math.random()-0.5)*280, (Math.random()-0.5)*180, (Math.random()-0.5)*200 - 10);
    s.userData = { baseOp: 0.45 + Math.random()*0.55, ph: Math.random()*Math.PI*2, spd: 0.3 + Math.random()*0.7, drift: 0.05 + Math.random()*0.15 };
    scene.add(s); orbs.push(s);
  }

  // ── Fines particules (neige marine en suspension) ──
  const SN = 900;
  const snPos = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) {
    snPos[i*3] = (Math.random()-0.5)*400;
    snPos[i*3+1] = (Math.random()-0.5)*300;
    snPos[i*3+2] = (Math.random()-0.5)*300 - 30;
  }
  const snGeo = new THREE.BufferGeometry();
  snGeo.setAttribute('position', new THREE.BufferAttribute(snPos, 3));
  const snow = new THREE.Points(snGeo, new THREE.PointsMaterial({ color: 0x9fd8ff, size: 0.8, transparent: true, opacity: 0.4, depthWrite: false }));
  scene.add(snow);

  // ── Rais de lumière descendants (god rays façon faisceaux) ──
  const rays = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const geo = new THREE.PlaneGeometry(34 + Math.random()*24, 380);
    const mat = new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0x6a3fc0 : 0x2fa8e8, transparent: true, opacity: 0.04, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const p = new THREE.Mesh(geo, mat);
    p.position.set(-165 + i*46 + (Math.random()-0.5)*28, 60, -120 - Math.random()*50);
    p.rotation.z = (Math.random()-0.5)*0.32;
    rays.add(p);
  }
  // Rais de lumière (rectangles translucides) retirés à la demande — non ajoutés à la scène.

  // ── Auras lumineuses de fond (grandes nappes douces qui « respirent ») ──
  // Elles posent une ambiance colorée derrière les modèles et s'intensifient
  // au moment des flashs.
  const auras = [];
  const AURA_DEFS = [
    { color: 0x1f6fc0, x: -30, y: 20, z: -130, size: 480, op: 0.10 }, // nappe cyan
    { color: 0x6a32b8, x: 40, y: 30, z: -150, size: 520, op: 0.11 },  // nappe violette
    { color: 0x123a78, x: 10, y: -10, z: -110, size: 420, op: 0.08 }, // bleu profond
    { color: 0x7a2fd0, x: -70, y: 40, z: -180, size: 600, op: 0.09 }, // grande nappe violette (Giratina)
    { color: 0x0f2a55, x: 60, y: -30, z: -140, size: 460, op: 0.07 }, // abysse froid
  ];
  for (const d of AURA_DEFS) {
    const mat = new THREE.SpriteMaterial({ map: orbTex, color: d.color, transparent: true, opacity: d.op, blending: THREE.AdditiveBlending, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.scale.set(d.size, d.size, 1);
    s.position.set(d.x, d.y, d.z);
    scene.add(s);
    auras.push({ sprite: s, baseOp: d.op, ph: Math.random() * Math.PI * 2, spd: 0.2 + Math.random() * 0.25 });
  }

  // ── Étoiles filantes / traînées lumineuses ──
  // Texture de traînée : tête brillante + queue dégradée.
  function makeStreakTexture() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 32;
    const ctx = c.getContext('2d');
    const grd = ctx.createLinearGradient(0, 0, 256, 0);
    grd.addColorStop(0.0, 'rgba(255,255,255,0)');
    grd.addColorStop(0.55, 'rgba(200,235,255,0.35)');
    grd.addColorStop(0.88, 'rgba(235,250,255,0.95)');
    grd.addColorStop(1.0, 'rgba(255,255,255,1)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, 256, 32);
    // tête plus lumineuse (halo rond)
    const h = ctx.createRadialGradient(240, 16, 0, 240, 16, 22);
    h.addColorStop(0, 'rgba(255,255,255,1)');
    h.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = h; ctx.fillRect(218, 0, 60, 32);
    const tex = new THREE.Texture(c); tex.needsUpdate = true; return tex;
  }
  const streakTex = makeStreakTexture();
  const streaks = []; // étoiles filantes actives
  const STREAK_TINTS = [0xbfefff, 0xeaffff, 0xc9a8ff, 0x9ff0ff];

  function spawnShootingStar() {
    const mat = new THREE.SpriteMaterial({ map: streakTex, color: STREAK_TINTS[(Math.random() * STREAK_TINTS.length) | 0], transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const s = new THREE.Sprite(mat);
    // départ en haut, hors-champ à gauche/centre ; traverse en diagonale
    const startX = -220 + Math.random() * 160;
    const startY = 70 + Math.random() * 70;
    const z = -30 - Math.random() * 90;
    s.position.set(startX, startY, z);
    const ang = -0.22 - Math.random() * 0.30; // descente vers la droite
    const speed = 260 + Math.random() * 220;
    const vel = new THREE.Vector3(Math.cos(ang) * speed, Math.sin(ang) * speed, 0);
    mat.rotation = ang; // oriente la traînée dans le sens du déplacement
    const len = 110 + Math.random() * 90;
    s.scale.set(len, 7 + Math.random() * 5, 1);
    scene.add(s);
    streaks.push({ sprite: s, mat, vel, life: 0, maxLife: 0.8 + Math.random() * 0.6 });
  }

  // ── Planificateur de flashs (éclairs) ──
  let flashEnergy = 0;       // intensité courante du flash (0→1)
  let nextFlashAt = 1.2;     // prochain déclenchement (en secondes)
  let lastT = 0;
  function triggerFlash(t) {
    flashEnergy = 1;
    // direction + teinte aléatoires (cyan glacial ou violet)
    flashLight.position.set((Math.random() - 0.5) * 180, 40 + Math.random() * 90, 90 + Math.random() * 80);
    flashLight.color.setHex(Math.random() < 0.5 ? 0xcdf2ff : 0xe9ccff);
    spawnShootingStar();
    if (Math.random() < 0.45) spawnShootingStar(); // parfois une volée
    // prochain flash dans 2.4–6 s
    nextFlashAt = t + 2.4 + Math.random() * 3.6;
  }

  // ════════════════════════════════════════════════════════════════
  //  Chargement des modèles — Milobellus (cyan) + Giratina (violet)
  // ════════════════════════════════════════════════════════════════
  // Chaque modèle a sa colorisation, sa position, son comportement
  // d'animation et ses deux halos (un large diffus + un serré intense).
  const MODEL_CONFIGS = [
    {
      key: 'milotic',
      b64: window.MILOTIC_GLB_BASE64, file: 'milotic.glb',
      // émissif baissé → reste dans l'ombre, révélé surtout par les flashs
      material: { color: 0x2f8fd8, emissive: 0x16487e, emissiveIntensity: 0.5, metalness: 0.74, roughness: 0.28 },
      // Milobellus est LE modèle de premier plan : grand et proche (z élevé),
      // mouvement plus calme (rotation/flottement doux).
      targetSize: 178, pos: { x: 70, y: -8, z: 52 }, baseRotY: -0.55,
      haloColor: 0x2a9fe0, haloColorCore: 0x9ff0ff, haloSize: 220,
      floatAmp: 4, floatSpd: 0.42, spinSpd: 0.045, mouseRot: 0.38,
    },
    {
      key: 'giratina',
      b64: window.GIRATINA_GLB_BASE64, file: 'giratina.glb',
      // teinte remontée + émissif renforcé + moins de métal → le mesh reste
      // sombre et dans l'ambiance abyssale, mais ses couleurs (violet/gris)
      // restent lisibles même hors des flashs (au lieu de sombrer dans le noir)
      material: { color: 0x5a4288, emissive: 0xab35d2, emissiveIntensity: 1.0, metalness: 0.4, roughness: 0.4 },
      // Giratina reste en ARRIÈRE-PLAN : repoussé dans la profondeur (z très
      // négatif), à gauche, mouvement lent → il encadre Milobellus sans le voler.
      targetSize: 198, pos: { x: -66, y: 26, z: -72 }, baseRotY: 0.82,
      haloColor: 0x8a3fd0, haloColorCore: 0xd58aff, haloSize: 320,
      floatAmp: 5, floatSpd: 0.34, spinSpd: -0.04, mouseRot: 0.22,
    },
  ];

  // Crée un halo (sprite additif) derrière un modèle pour le détacher de l'abysse
  function makeHalo(color, size, pos, baseOp) {
    const mat = new THREE.SpriteMaterial({ map: orbTex, color, transparent: true, opacity: baseOp, blending: THREE.AdditiveBlending, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.scale.set(size, size, 1);
    s.position.copy(pos);
    scene.add(s);
    haloSprites.push({ sprite: s, baseOp, ph: Math.random() * Math.PI * 2, spd: 0.4 + Math.random() * 0.4 });
    return s;
  }

  // Mise en scène d'un modèle chargé : colorisation, recentrage, échelle, halos
  function setupModel(root, cfg) {
    root.traverse(o => {
      if (o.isMesh) {
        o.material = new THREE.MeshStandardMaterial({ ...cfg.material, flatShading: false });
        o.material.needsUpdate = true;
      }
    });
    // Recentrage + mise à l'échelle automatiques (indépendants du modèle source)
    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    root.position.sub(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scl = cfg.targetSize / maxDim;

    const group = new THREE.Group();
    group.scale.setScalar(scl);
    group.position.set(cfg.pos.x, cfg.pos.y, cfg.pos.z);
    group.rotation.y = cfg.baseRotY;
    group.add(root);
    scene.add(group);

    // Deux halos superposés pour un glow plus marqué :
    //   - un large et diffus qui « auréole » le modèle
    //   - un plus serré et intense juste derrière lui
    makeHalo(cfg.haloColor, cfg.haloSize, new THREE.Vector3(cfg.pos.x, cfg.pos.y + 8, cfg.pos.z - 70), 0.34);
    makeHalo(cfg.haloColorCore, cfg.haloSize * 0.6, new THREE.Vector3(cfg.pos.x, cfg.pos.y + 4, cfg.pos.z - 52), 0.55);

    loadedModels.push({ group, cfg });

    modelsLoaded++;
    const skel = document.getElementById('hero3d-loading'); if (skel) skel.style.display = 'none';
  }

  function onModelError(cfg, err) {
    console.warn('GLB load error (' + cfg.key + ')', err);
    // On n'affiche le message d'erreur que si AUCUN modèle n'a pu charger.
    if (modelsLoaded === 0) {
      const skel = document.getElementById('hero3d-loading'); if (skel) { skel.style.display = 'flex'; skel.textContent = 'Modèle 3D indisponible'; }
    }
  }

  // Réutilise le cache partagé : le modèle a déjà été parsé par l'intro, on ne
  // reçoit ici qu'un clone (instantané) → pas de re-parsing, pas d'à-coup.
  if (THREE.GLTFLoader) {
    for (const cfg of MODEL_CONFIGS) {
      getModelClone(cfg.key, cfg.b64, cfg.file)
        .then(root => setupModel(root, cfg))
        .catch(err => onModelError(cfg, err));
    }
  } else {
    onModelError({ key: 'all' }, new Error('GLTFLoader indisponible'));
  }

  // ── Interaction souris ──
  let mx = 0, my = 0, tx = 0, ty = 0;
  const onMove = e => {
    const r = (canvas.parentElement || wrap).getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
  };
  canvas.addEventListener('pointermove', onMove);
  const onResize = () => {
    // Lit le parent COURANT du canvas (celui-ci est ré-inséré dans un nouveau
    // hero à chaque retour sur l'accueil → l'ancien `wrap` devient périmé).
    const host = canvas.parentElement || wrap;
    W = host.clientWidth; H = host.clientHeight;
    if (!W || !H) return;
    camera.aspect = W / H; camera.updateProjectionMatrix();
    renderer.setSize(W, H, false);
  };
  window.addEventListener('resize', onResize);

  const clock = new THREE.Clock();
  function animate() {
    const t = clock.getElapsedTime();
    const dt = Math.min(t - lastT, 0.05); lastT = t;
    mx += (tx - mx) * 0.045; my += (ty - my) * 0.045;

    // ⚡ Flashs / éclairs : déclenchement périodique + décroissance rapide
    if (t > nextFlashAt) triggerFlash(t);
    flashEnergy *= 0.86;                       // extinction rapide (~0.4 s)
    if (flashEnergy < 0.002) flashEnergy = 0;
    flashLight.intensity = flashEnergy * 7.5;  // révèle violemment les modèles
    ambient.intensity = AMBIENT_BASE + flashEnergy * 1.1;
    keyLight.intensity = 1.5 + flashEnergy * 2.2;

    // Modèles : rotation lente + flottement, chacun selon sa config
    for (const m of loadedModels) {
      const c = m.cfg;
      m.group.rotation.y = c.baseRotY + t * c.spinSpd + mx * c.mouseRot;
      m.group.rotation.x = -0.04 + my * 0.16;
      m.group.position.y = c.pos.y + Math.sin(t * c.floatSpd) * c.floatAmp;
    }
    if (loadedModels.length) {
      glowLight.position.x = Math.sin(t * 0.5) * 60;
      glowLight.position.y = 28 + Math.cos(t * 0.6) * 25;
    }

    // halos : respiration douce + sursaut lumineux pendant les flashs
    for (const h of haloSprites) {
      h.sprite.material.opacity = h.baseOp * (0.7 + 0.3 * Math.sin(t * h.spd + h.ph)) + flashEnergy * 0.4;
    }

    // auras de fond : respiration lente + intensification au flash
    for (const a of auras) {
      a.sprite.material.opacity = a.baseOp * (0.75 + 0.25 * Math.sin(t * a.spd + a.ph)) + flashEnergy * 0.22;
    }

    // étoiles filantes : déplacement, enveloppe d'opacité, recyclage
    for (let i = streaks.length - 1; i >= 0; i--) {
      const st = streaks[i];
      st.life += dt;
      st.sprite.position.addScaledVector(st.vel, dt);
      const k = st.life / st.maxLife;            // 0→1
      st.mat.opacity = Math.sin(Math.min(k, 1) * Math.PI) * 0.95; // fondu entrée/sortie
      if (st.life >= st.maxLife) {
        scene.remove(st.sprite);
        st.mat.dispose();
        streaks.splice(i, 1);
      }
    }

    // orbes : pulsation + dérive ascendante
    for (const o of orbs) {
      const u = o.userData;
      o.material.opacity = u.baseOp * (0.5 + 0.5 * Math.sin(t * u.spd + u.ph));
      o.position.y += u.drift;
      if (o.position.y > 95) o.position.y = -95;
    }

    // neige marine : chute lente
    const sp = snGeo.attributes.position.array;
    for (let i = 0; i < SN; i++) {
      sp[i*3+1] -= 0.06 + (i % 4) * 0.01;
      if (sp[i*3+1] < -150) sp[i*3+1] = 150;
    }
    snGeo.attributes.position.needsUpdate = true;

    rays.children.forEach((r, i) => { r.material.opacity = (0.03 + Math.sin(t * 0.4 + i) * 0.02) + flashEnergy * 0.08; });

    // Cadrage rapproché sur la composition, léger parallaxe à la souris
    camera.position.x += (12 + mx * 18 - camera.position.x) * 0.04;
    camera.position.y += (8 - my * 13 - camera.position.y) * 0.04;
    camera.lookAt(14, 6, 0);

    renderer.render(scene, camera);
    _hero.raf = requestAnimationFrame(animate);
  }
  _hero = { renderer, canvas, onResize, onMove, raf: 0, animate, paused: false };
  animate();
}

/* ═══════════════════════════════════════════════════════════════════
   INTRO CINÉMATIQUE
   Milotic + Giratina émergent des abysses pendant le chargement,
   puis « warp + flash » vers l'accueil.
   ═══════════════════════════════════════════════════════════════════ */
function b64ToArrayBuffer(b64) {
  const bin = atob(b64); const len = bin.length; const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
function runIntro(onReveal) {
  const intro = document.getElementById('intro');
  // La coque s'appelle .app (rail + cadre + tab bar). Garde-fou : si elle
  // manquait, l'intro ne doit JAMAIS bloquer le démarrage de l'app.
  const shell = document.querySelector('.app');
  shell?.classList.add('booting');

  // Sur téléphone on prend la MÊME sortie que « mouvement réduit » : un court
  // fondu de marque. L'intro 3D coûte un contexte WebGL et le clonage des deux
  // modèles (9 Mo) pour deux secondes d'écran — sur mobile, ce n'est pas un
  // moment premium, c'est une attente.
  const reduce = isPhone() || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const canvas = document.getElementById('intro-canvas');
  const THREE = window.THREE;

  // Révèle l'app une seule fois (avec garde-fou anti-échec)
  let revealed = false;
  const reveal = () => {
    if (revealed) return; revealed = true;
    shell?.classList.remove('booting'); shell?.classList.add('arrive');
    // La classe est RETIRÉE dès l'animation finie, et ce n'est pas cosmétique :
    // `animation-fill-mode:both` garde la propriété `transform` sous contrôle de
    // l'animation, donc `.app` reste une « containing block » — et TOUT ce qui
    // est en position:fixed dedans (la tab bar du téléphone, le rail du desktop)
    // se met à défiler avec la page au lieu de rester collé à l'écran.
    const done = () => shell?.classList.remove('arrive');
    shell?.addEventListener('animationend', done, { once: true });
    setTimeout(done, 900);   // filet si l'événement ne vient pas (reduced-motion)
    try { onReveal && onReveal(); } catch (e) { console.warn(e); }
  };
  const teardown = () => { try { intro && intro.remove(); } catch {} };

  // Repli : pas de 3D (téléphone, mouvement réduit, WebGL indisponible) →
  // fondu de marque. La BARRE DE PROGRESSION vit ici aussi : sur ce chemin elle
  // restait figée à 0 % puis l'app apparaissait d'un coup, ce qui donnait
  // l'impression d'un chargement cassé. Elle suit maintenant les vraies étapes
  // du démarrage (catalogue relu, cotes prêtes, premier rendu).
  if (reduce || !canvas || !THREE) {
    const bar0 = document.getElementById('intro-bar'), pct0 = document.getElementById('intro-pct');
    const set0 = v => { if (bar0) bar0.style.width = v + '%'; if (pct0) pct0.textContent = Math.round(v) + '%'; };
    let p = 6; set0(p);
    // Montée continue et honnête : on avance vers 92 % pendant le vrai travail
    // (lecture IndexedDB, relecture du dépôt, préparation du rendu), et on
    // termine à 100 % au moment où l'app se révèle.
    const tick = setInterval(() => { p = Math.min(92, p + (92 - p) * 0.18 + 1.5); set0(p); }, 90);
    const done = () => {
      clearInterval(tick); set0(100);
      const flash = document.getElementById('intro-flash');
      if (flash) flash.classList.add('bloom');
      setTimeout(() => { intro && intro.classList.add('exit'); reveal(); }, 220);
      setTimeout(teardown, 1000);
    };
    // On attend deux choses : que l'app soit PRÊTE (`_introReady`, résolu par le
    // démarrage) et qu'un minimum de temps se soit écoulé. Sans ce plancher, la
    // barre passerait de 6 à 100 % en un tiers de seconde — un clignotement,
    // pas un chargement. Plafond à 4 s pour ne jamais retenir l'utilisateur.
    const MIN_MS = reduce ? 500 : 950;
    const t0 = performance.now();
    const wait = window._introReady || Promise.resolve();
    Promise.race([wait, new Promise(r => setTimeout(r, 4000))])
      .then(() => setTimeout(done, Math.max(0, MIN_MS - (performance.now() - t0))));
    return;
  }

  // ── Scène (abysses profonds, très sombre — révélé par les éclairs) ──
  let W = innerWidth, H = innerHeight;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x02070f, 0.0092);
  const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 3000);
  camera.position.set(0, 6, 340);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(W, H);
  renderer.outputEncoding = THREE.sRGBEncoding;

  const ambient = new THREE.AmbientLight(0x241a0a, 0.34); scene.add(ambient);
  // Clé chaude (dorée) pour se marier au fond jaune et accrocher le métal ;
  // le contre-jour violet + les éclairs cyan gardent le contraste électrique.
  const key = new THREE.DirectionalLight(0xffce7a, 1.5); key.position.set(-1, 1, 1); scene.add(key);
  const rim = new THREE.DirectionalLight(0xb488ff, 0.9); rim.position.set(1, .5, -1); scene.add(rim);
  const glow = new THREE.PointLight(0x6fe0ff, 1.4, 700); glow.position.set(0, 30, 120); scene.add(glow);
  const flashLight = new THREE.DirectionalLight(0xeafcff, 0); flashLight.position.set(0.2, 0.4, 1); scene.add(flashLight);
  const boltLight = new THREE.PointLight(0xdff4ff, 0, 900); boltLight.position.set(0, 40, 40); scene.add(boltLight);

  // Texture radiale douce (halos + particules)
  function radialTex() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d').createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    const ctx = c.getContext('2d'); ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    const t = new THREE.Texture(c); t.needsUpdate = true; return t;
  }
  const dotTex = radialTex();

  const halos = [];
  function makeHalo(color, size, pos, op) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.scale.set(size, size, 1); s.position.copy(pos); scene.add(s);
    halos.push({ s, baseOp: op, ph: Math.random() * 6.28, spd: 0.5 + Math.random() * 0.6 });
    return s;
  }

  // Champ de particules (neige marine → warp à la sortie)
  const PN = 520; const pPos = new Float32Array(PN * 3); const pVel = [];
  for (let i = 0; i < PN; i++) {
    pPos[i*3] = (Math.random()-.5)*520; pPos[i*3+1] = (Math.random()-.5)*360; pPos[i*3+2] = (Math.random()-.5)*700 - 60;
    pVel.push(6 + Math.random()*10);
  }
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ map: dotTex, color: 0x9fe6ff, size: 3.4, transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(particles);

  // ── Rais océaniques (god rays descendants) ──
  const rays = new THREE.Group();
  for (let i = 0; i < 9; i++) {
    const geo = new THREE.PlaneGeometry(26 + Math.random() * 34, 620);
    const mat = new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? 0x7fd8ff : 0x3aa8e8, transparent: true, opacity: 0.05 + Math.random() * 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const p = new THREE.Mesh(geo, mat);
    p.position.set(-260 + i * 62 + Math.random() * 30, 120, -180 - Math.random() * 120);
    p.rotation.z = 0.16 + Math.random() * 0.12;
    p.userData = { baseOp: mat.opacity, ph: Math.random() * 6.28, spd: 0.3 + Math.random() * 0.5 };
    rays.add(p);
  }
  // Rais de lumière (rectangles translucides) retirés à la demande — non ajoutés à la scène.

  // ── Éclairs (bolts zigzag) : géométries préparées, révélées par éclats ──
  function makeBolt() {
    const pts = []; let x = 0, y = 300;
    while (y > -300) { pts.push(new THREE.Vector3(x, y, 0)); x += (Math.random() - 0.5) * 46; y -= 24 + Math.random() * 26; }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const line = new THREE.Line(geo, mat);
    line.visible = false; scene.add(line);
    return line;
  }
  const bolts = [makeBolt(), makeBolt(), makeBolt(), makeBolt()];
  let boltEnergy = 0, activeBolt = null;
  function strike(big) {
    activeBolt = bolts[(Math.random() * bolts.length) | 0];
    activeBolt.position.set(-220 + Math.random() * 440, 0, -140 - Math.random() * 160);
    activeBolt.scale.set(0.6 + Math.random() * 0.9, 1, 1);
    activeBolt.rotation.z = (Math.random() - 0.5) * 0.5;
    activeBolt.visible = true;
    boltEnergy = big ? 1.0 : 0.7;
    flashLight.intensity = big ? 7.5 : 4.8;
    boltLight.intensity = big ? 6 : 3.5;
    boltLight.position.set(activeBolt.position.x, 30, 60);
    if (strikeEl) strikeEl.style.opacity = big ? '0.65' : '0.4';
  }

  const MODELS = [
    { key: 'milotic', b64: window.MILOTIC_GLB_BASE64, file: 'milotic.glb',
      // Sombres + très métalliques + quasi pas d'émissif → révélés par les
      // lumières/éclairs de la scène (vraie réaction à la lumière).
      material: { color: 0x1b4d74, emissive: 0x071c2b, emissiveIntensity: 0.12, metalness: 0.9, roughness: 0.34 },
      // Milobellus DEVANT : grand, proche (z élevé), mouvement doux.
      targetSize: 176, pos: { x: 48, y: -6, z: 55 }, rotY: -0.5, spin: 0.07, floatAmp: 5, floatSpd: 0.5,
      halo: 0x2fb0ff, haloCore: 0xbff2ff, haloSize: 265 },
    { key: 'giratina', b64: window.GIRATINA_GLB_BASE64, file: 'giratina.glb',
      material: { color: 0x392a58, emissive: 0x270e3a, emissiveIntensity: 0.16, metalness: 0.58, roughness: 0.42 },
      // Giratina DERRIÈRE : repoussé dans la profondeur (z très négatif), lent.
      targetSize: 196, pos: { x: -74, y: 24, z: -80 }, rotY: 0.8, spin: -0.05, floatAmp: 6, floatSpd: 0.38,
      halo: 0x8a3fd0, haloCore: 0xe0a8ff, haloSize: 380 },
  ];
  const built = [];
  let modelsReady = 0;
  function setup(root, cfg) {
    root.traverse(o => { if (o.isMesh) { o.material = new THREE.MeshStandardMaterial({ ...cfg.material, flatShading: false, transparent: true, opacity: 1 }); } });
    const box = new THREE.Box3().setFromObject(root); const c = box.getCenter(new THREE.Vector3()); const sz = box.getSize(new THREE.Vector3());
    root.position.sub(c);
    const scl = cfg.targetSize / (Math.max(sz.x, sz.y, sz.z) || 1);
    const g = new THREE.Group(); g.scale.setScalar(scl); g.position.set(cfg.pos.x, cfg.pos.y, cfg.pos.z); g.rotation.y = cfg.rotY; g.add(root); scene.add(g);
    // Trois halos superposés : large diffus, médian, cœur intense — pulsent + s'embrasent aux éclairs
    makeHalo(cfg.halo, cfg.haloSize * 1.35, new THREE.Vector3(cfg.pos.x, cfg.pos.y + 8, cfg.pos.z - 80), 0.16);
    makeHalo(cfg.halo, cfg.haloSize, new THREE.Vector3(cfg.pos.x, cfg.pos.y + 6, cfg.pos.z - 60), 0.34);
    makeHalo(cfg.haloCore, cfg.haloSize * .55, new THREE.Vector3(cfg.pos.x, cfg.pos.y + 2, cfg.pos.z - 44), 0.6);
    const mats = []; g.traverse(o => { if (o.isMesh && o.material) mats.push(o.material); });
    built.push({ g, cfg, mats }); modelsReady++;
  }
  if (THREE.GLTFLoader) {
    // Réutilise le cache partagé (clone) : parse unique, réutilisé par le hero
    for (const cfg of MODELS) {
      getModelClone(cfg.key, cfg.b64, cfg.file).then(root => setup(root, cfg)).catch(() => {});
    }
  }

  // ── HUD progress ──
  const bar = document.getElementById('intro-bar'); const pct = document.getElementById('intro-pct');
  const flashEl = document.getElementById('intro-flash');
  const strikeEl = document.getElementById('intro-strike');
  let progress = 0;
  const setProg = v => { progress = v; if (bar) bar.style.width = v + '%'; if (pct) pct.textContent = Math.round(v) + '%'; };

  const t0 = performance.now();
  // Le chargement est RÉEL : on précharge les modèles 3D (les cotes, elles, sont
  // relues du disque et complétées en fond). La barre suit la progression ; on ne
  // révèle l'app qu'une fois tout prêt (min. d'affichage pour l'esthétique,
  // plafond de sécurité pour ne jamais rester bloqué sur un réseau lent).
  // Le minimum laisse l'intro exister (marque) sans retenir l'utilisateur ;
  // le plafond couvre un réseau lent sans jamais bloquer indéfiniment.
  const MIN_MS = 1500, MAX_MS = 12000;
  let preloadFrac = 0, preloadDone = false;
  preloadEverything(f => { preloadFrac = Math.max(preloadFrac, f); })
    .then(() => { preloadDone = true; })
    .catch(() => { preloadDone = true; });
  let exiting = false, warp = 0, nextFlash = 1.0;
  // Sorties de secours par timers : le tick rAF est gelé quand l'onglet est en
  // arrière-plan — sans ceci, l'intro resterait affichée indéfiniment.
  const exitWhenReady = () => {
    if (exiting) return;
    if (preloadDone) { const wait = Math.max(0, MIN_MS - (performance.now() - t0)); setTimeout(() => beginExit(), wait); }
    else setTimeout(exitWhenReady, 250);
  };
  setTimeout(exitWhenReady, MIN_MS);
  setTimeout(() => beginExit(), MAX_MS);

  function beginExit() {
    if (exiting) return; exiting = true;
    setProg(100);
    flashEl && flashEl.classList.add('bloom');
    // Révèle l'app au pic du flash, puis dissout l'intro
    setTimeout(reveal, 330);
    setTimeout(() => { intro && intro.classList.add('exit'); }, 340);
    setTimeout(() => { cancelAnimationFrame(raf); try { renderer.dispose(); } catch {} removeEventListener('resize', onResize); teardown(); }, 1150);
  }

  function onResize() { W = innerWidth; H = innerHeight; camera.aspect = W / H; camera.updateProjectionMatrix(); renderer.setSize(W, H); }
  addEventListener('resize', onResize);

  const clock = new THREE.Clock(); let raf = 0;
  function tick() {
    const t = clock.getElapsedTime();
    const elapsed = performance.now() - t0;

    // Progression : suit le préchargement réel (modèles + cotes). On garde une
    // petite marge tant que ce n'est pas 100 % fini pour que la barre ne colle
    // pas à 100 avant la vraie fin.
    if (!exiting) {
      const target = preloadDone ? 100 : Math.min(96, preloadFrac * 100);
      if (target > progress) setProg(progress + (target - progress) * 0.14);
      // Sortie : tout est prêt ET le minimum d'affichage est écoulé — ou plafond.
      if ((preloadDone && elapsed >= MIN_MS) || elapsed >= MAX_MS) beginExit();
    }

    // ⚡ Éclairs : plus fréquents, parfois en rafale double
    if (t > nextFlash && !exiting) {
      strike(Math.random() < 0.45);
      if (Math.random() < 0.35) setTimeout(() => { if (!exiting) strike(false); }, 90 + Math.random() * 110); // double flash
      nextFlash = t + 0.55 + Math.random() * 1.15;
    }
    // Décroissances
    flashLight.intensity *= 0.86;
    boltLight.intensity *= 0.8;
    boltEnergy *= 0.82;
    if (strikeEl) { const cur = parseFloat(strikeEl.style.opacity || '0'); strikeEl.style.opacity = (cur * 0.78) + ''; }
    ambient.intensity = 0.32 + flashLight.intensity * 0.05;
    // Éclat visible du bolt actif (scintillement pendant l'éclair)
    if (activeBolt) {
      activeBolt.material.opacity = boltEnergy * (0.6 + Math.random() * 0.4);
      if (boltEnergy < 0.04) { activeBolt.visible = false; activeBolt = null; }
    }

    // Rais océaniques : respiration lente + embrasement aux éclairs
    for (const r of rays.children) {
      const u = r.userData;
      r.material.opacity = u.baseOp * (0.65 + 0.35 * Math.sin(t * u.spd + u.ph)) + flashLight.intensity * 0.02;
    }
    // Halos : pulsation douce + flare synchronisé aux éclairs
    for (const h of halos) {
      h.s.material.opacity = h.baseOp * (0.7 + 0.3 * Math.sin(t * h.spd + h.ph)) + flashLight.intensity * 0.05;
    }

    // Modèles : rotation + flottement ; à la sortie, ils dérivent doucement et
    // se DISSOLVENT dans le flash (fondu d'opacité) plutôt que de foncer vers la
    // caméra — cela évite l'à-coup de remplissage (grands triangles) qui faisait
    // « buguer » la toute fin de l'intro, tout en restant spectaculaire.
    for (const m of built) {
      m.g.rotation.y = m.cfg.rotY + t * m.cfg.spin;
      m.g.position.y = m.cfg.pos.y + Math.sin(t * m.cfg.floatSpd) * m.cfg.floatAmp;
      if (exiting) {
        m.g.position.z += 3.4;                         // dérive avant douce et linéaire
        m.g.rotation.y += warp * 0.02;                // léger tourbillon
        for (const mm of m.mats) mm.opacity = Math.max(0, mm.opacity - 0.05);
      }
    }

    // Particules : dérive vers la caméra ; warp = accélération à la sortie (bornée)
    if (exiting) warp = Math.min(warp + 0.035, 1.3);
    const arr = pGeo.attributes.position.array;
    for (let i = 0; i < PN; i++) {
      arr[i*3+2] += pVel[i] * (0.15 + warp * 2.2);
      if (arr[i*3+2] > 320) { arr[i*3+2] = -700; }
    }
    pGeo.attributes.position.needsUpdate = true;
    particles.material.size = 3.4 + warp * 7;
    particles.material.opacity = 0.7 + warp * 0.3;

    // Caméra : plongée lente pendant le chargement, poussée maîtrisée à la sortie
    const targetZ = exiting ? 78 : 190 - Math.min(elapsed / MIN_MS, 1) * 150;
    camera.position.z += (targetZ - camera.position.z) * (exiting ? 0.10 : 0.03);
    camera.position.x += (Math.sin(t * 0.3) * 10 - camera.position.x) * 0.02;
    camera.lookAt(0, 4, 0);

    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  tick();
}

// ══════════════════════════════════════════════════════════════════
//  INVESTISSEMENT — portefeuille (deux volets via slider)
//   • Scellé : produits par catégorie (ETB · Coffrets · Displays · Items)
//   • Cartes : mêmes colonnes, + rattachement d'une carte du catalogue
//     (preview à côté de ses infos).
//  Colonnes de VALEUR par semestre (juil./déc.). Persisté dans le state.
// ══════════════════════════════════════════════════════════════════
const DEFAULT_SEALED_PERIODS = ['2026-07', '2026-12', '2027-07', '2027-12'];
const SEALED_CATS = [
  ['etb',     'Elite Trainer Boxes'],
  ['coffret', 'Coffrets, boîtes & packs'],
  ['display', 'Displays scellées'],
  ['item',    'Items & autres'],
];
const SEALED_CAT_LABEL = Object.fromEntries(SEALED_CATS);
function sealedCatOf(txt) {
  const s = String(txt || '').toLowerCase();
  if (/elite\s*trainer|\betb\b/.test(s)) return 'etb';
  if (/display/.test(s)) return 'display';
  if (/coffret|bo[iî]te|pack|blister|tripack|artset|pokebox|booster\s*box/.test(s)) return 'coffret';
  return 'item';
}
function sealedUid() { return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function sealedPeriods() {
  if (!state.sealedPeriods || !state.sealedPeriods.length) state.sealedPeriods = DEFAULT_SEALED_PERIODS.slice();
  return state.sealedPeriods;
}
const MONTH_FR = { '01': 'Janv.', '02': 'Févr.', '03': 'Mars', '04': 'Avr.', '05': 'Mai', '06': 'Juin', '07': 'Juil.', '08': 'Août', '09': 'Sept.', '10': 'Oct.', '11': 'Nov.', '12': 'Déc.' };
function periodLabel(key) { const [y, m] = String(key).split('-'); return `${MONTH_FR[m] || m} ${y}`; }
function periodShort(key) { const [y, m] = String(key).split('-'); return `${MONTH_FR[m] || m} ’${String(y).slice(2)}`; }
function nextPeriod(key) { let [y, m] = String(key).split('-').map(Number); if (m >= 12) { y += 1; m = 7; } else if (m >= 7) { m = 12; } else { m = 7; } return `${y}-${String(m).padStart(2, '0')}`; }

function parseMoney(s) {
  if (s == null || s === '') return null;
  if (typeof s === 'number') return isFinite(s) ? s : null;
  let t = String(s).replace(/[^\d.,-]/g, '').trim();
  if (!t) return null;
  if (t.includes(',') && t.includes('.')) {
    if (t.lastIndexOf(',') > t.lastIndexOf('.')) t = t.replace(/\./g, '').replace(',', '.');
    else t = t.replace(/,/g, '');
  } else if (t.includes(',')) t = t.replace(',', '.');
  const n = parseFloat(t);
  return isNaN(n) ? null : n;
}

// ── Maths (génériques : acceptent une liste — scellés OU cartes) ──
function sealedVal(p, key) { const v = p.values ? p.values[key] : null; return (v != null && isFinite(v)) ? Number(v) : null; }
function sealedLatestDataIndex(list) {
  list = list || state.sealed; const P = sealedPeriods(); let idx = -1;
  P.forEach((k, i) => { if (list.some(p => sealedVal(p, k) != null)) idx = i; });
  return idx;
}
function sealedValueAt(p, i) {
  const P = sealedPeriods(); let v = null;
  for (let j = 0; j <= i && j < P.length; j++) { const x = sealedVal(p, P[j]); if (x != null) v = x; }
  return v == null ? (Number(p.buyPrice) || 0) : v;
}
function sealedInvested(p) { return Number(p.buyPrice) || 0; }
function sealedCurrent(p, list) { const i = sealedLatestDataIndex(list || state.sealed); return i < 0 ? sealedInvested(p) : sealedValueAt(p, i); }
function sealedPnL(p, list) { return sealedCurrent(p, list || state.sealed) - sealedInvested(p); }
function sealedByCat(cat) { return state.sealed.filter(p => (p.cat || 'item') === cat); }
function sealedCatPeriodRawTotal(cat, key) { let s = 0, n = 0; for (const p of sealedByCat(cat)) { const v = sealedVal(p, key); if (v != null) { s += v; n++; } } return n ? s : null; }
function sealedCatTotals(cat) {
  const list = sealedByCat(cat); let invested = 0, value = 0;
  for (const p of list) { invested += sealedInvested(p); value += sealedCurrent(p); }
  return { invested, value, pnl: value - invested, perf: invested > 0 ? (value - invested) / invested : 0, count: list.length };
}
function sealedTotals(list) {
  list = list || state.sealed; let invested = 0, value = 0;
  for (const p of list) { invested += sealedInvested(p); value += sealedCurrent(p, list); }
  return { invested, value, pnl: value - invested, perf: invested > 0 ? (value - invested) / invested : 0, count: list.length };
}
function fmtPct(x) { return `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(0)} %`; }
function fmtSign(v) { return `${v >= 0 ? '+' : '−'}${fmt(Math.abs(v))}`; }
function investBadge() { const b = document.getElementById('badge-invest'); if (b) b.textContent = state.sealed.length + state.investCards.length; }

// ── Vue + slider ────────────────────────────────────────────────
function renderInvest() {
  if (!state.investMode) state.investMode = 'sealed';
  state.investSeriesOpen = null;   // entrer dans la section ramène toujours à la grille des séries
  const el = document.getElementById('view-invest');
  const m = state.investMode;
  el.innerHTML = `
    <div class="inv-switch-wrap">
      <div class="inv-switch" id="inv-switch" data-mode="${m}">
        <span class="inv-switch-pill"></span>
        <button class="inv-switch-btn ${m === 'sealed' ? 'active' : ''}" data-mode="sealed" onclick="setInvestMode('sealed')">Scellé</button>
        <button class="inv-switch-btn ${m === 'cards' ? 'active' : ''}" data-mode="cards" onclick="setInvestMode('cards')">Cartes</button>
      </div>
    </div>
    <div id="inv-mode-body"></div>`;
  renderInvestBody();
  investBadge();
}
function setInvestMode(m) {
  if (state.investMode === m) return;
  state.investMode = m; save();
  const sw = document.getElementById('inv-switch');
  if (sw) { sw.dataset.mode = m; sw.querySelectorAll('.inv-switch-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === m)); }
  renderInvestBody();
}
function renderInvestBody() {
  const body = document.getElementById('inv-mode-body'); if (!body) return;
  // Dans une série ouverte, le sélecteur Scellé/Cartes fait partie du « haut de
  // section » qui n'a plus lieu d'être : la flèche de retour ramène à la grille,
  // et il réapparaît là. Un attribut, pas un re-render (la bascule est animée).
  document.getElementById('view-invest')?.toggleAttribute('data-series-open',
    !!(state.investMode === 'cards' && state.investSeriesOpen));
  // La lumière au curseur et les révélations sont (ré)attachées après chaque
  // rendu du volet : les deux moteurs ignorent les nœuds déjà équipés.
  setTimeout(() => { attachSpotlights(body); attachReveals(body); }, 0);
  if (state.investMode === 'cards') {
    body.innerHTML = investCardsBodyHTML();
    // Visuels manquants (promos surtout : absents du catalogue FR mais présents
    // en anglais) → retrouvés puis ENREGISTRÉS pour ne plus jamais les chercher.
    hydrateFallbackImages(body, (setId, localId, found) => {
      let changed = false;
      for (const p of state.investCards) {
        if (!p.image && String(p.setId) === String(setId) && String(p.localId) === String(localId)) { p.image = found; changed = true; }
      }
      if (changed) save();
    });
    // Dates de sortie manquantes → on les récupère puis on re-trie en place.
    ensureSetDates(() => { if (state.view === 'invest' && state.investMode === 'cards' && !state.investSeriesOpen) renderInvestBody(); });
    // Visuels encore absents (promos dont l'API n'expose pas le champ image) :
    // URL d'asset reconstruite puis testée. Limité à la série ouverte.
    if (state.investSeriesOpen) {
      const sid = state.investSeriesOpen;
      fillMissingCardImages(state.investCards.filter(p => String(p.setId) === String(sid)),
        () => { if (state.view === 'invest' && String(state.investSeriesOpen) === String(sid)) renderInvestBody(); });
    }
    if (!window._investCountedCards && state.investCards.length) { window._investCountedCards = true; animateCount(document.getElementById('inv-kpi-value'), cardsTotalValue()); }
  } else {
    body.innerHTML = investSealedBodyHTML();
    if (state.sealed.length) drawPortfolioChart(state.sealed);
    if (!window._investCountedSealed && state.sealed.length) { window._investCountedSealed = true; animateCount(document.getElementById('inv-kpi-value'), sealedTotals(state.sealed).value); }
  }
}
function investKpisHTML(t) {
  const pos = t.pnl >= 0;
  return `<div class="inv-kpis">
      <div class="inv-kpi"><span class="inv-kpi-val">${fmt(t.invested)}</span><span class="inv-kpi-lab">Total investi</span></div>
      <div class="inv-kpi"><span class="inv-kpi-val" id="inv-kpi-value">${fmt(t.value)}</span><span class="inv-kpi-lab">Valeur actuelle</span></div>
      <div class="inv-kpi"><span class="inv-kpi-val ${pos ? 'pos' : 'neg'}" id="inv-kpi-pnl">${fmtSign(t.pnl)}</span><span class="inv-kpi-lab">Plus-value</span></div>
      <div class="inv-kpi"><span class="inv-kpi-val ${pos ? 'pos' : 'neg'}" id="inv-kpi-perf">${fmtPct(t.perf)}</span><span class="inv-kpi-lab">Performance</span></div>
    </div>`;
}

// ── Volet SCELLÉ ────────────────────────────────────────────────
function investSealedBodyHTML() {
  const t = sealedTotals(state.sealed);
  const cats = SEALED_CATS.map(([k]) => k).filter(k => sealedByCat(k).length);
  const shownCats = cats.length ? cats : ['etb'];
  return `
    <div class="inv-hero spot">
      <div class="inv-hero-glow" aria-hidden="true"></div>
      <div class="inv-hero-top">
        <div><h1 class="page-title">Portefeuille scellé</h1><div class="inv-sub">Displays, ETB &amp; coffrets — la valeur de ta collection, semestre après semestre.</div></div>
        <label class="btn btn-ghost btn-import">
          <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><path d="M12 15V4m0 0 4 4m-4-4L8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          <span>Importer Excel</span><input type="file" accept=".xlsx,.xls,.csv" hidden onchange="onSealedFile(this)">
        </label>
      </div>
      ${investKpisHTML(t)}
    </div>
    ${state.sealed.length ? `<div class="panel inv-chart-panel">
      <div class="inv-chart-top"><div class="panel-title" style="margin:0">Évolution du portefeuille</div><button class="inv-add ghost" onclick="addSealedPeriod()">${ICO.plus}<span>Semestre</span></button></div>
      <div class="inv-chart" id="inv-chart-portfolio"></div></div>` : ''}
    ${shownCats.map(sealedCatSectionHTML).join('')}`;
}
function sealedCatSectionHTML(cat) {
  const P = sealedPeriods();
  const list = sealedByCat(cat);
  const periodHeads = P.map(k => `<th class="c-num c-per">${periodShort(k)}${P.length > 1 ? `<button class="per-x" title="Retirer ${periodLabel(k)}" aria-label="Retirer ${periodLabel(k)}" onclick="removeSealedPeriod('${k}')">${ICO.close}</button>` : ''}</th>`).join('');
  return `<section class="inv-cat">
    <div class="inv-cat-head">
      <h2 class="inv-cat-title">${esc(SEALED_CAT_LABEL[cat] || cat)}</h2>
      <div class="inv-cat-meta" id="meta-${cat}">${sealedCatMetaHTML(cat)}</div>
    </div>
    <div class="inv-table-scroll">
      <table class="inv-table">
        <thead><tr><th class="c-name">Produit</th><th class="c-num">Prix d'achat</th>${periodHeads}<th class="c-num">Plus-value</th><th class="c-act"></th></tr></thead>
        <tbody>${list.map(sealedRowHTML).join('') || `<tr class="inv-empty-row"><td colspan="${P.length + 4}">Rien ici pour l'instant — ajoute ta première ligne ci-dessous.</td></tr>`}</tbody>
        <tfoot id="foot-${cat}">${sealedFooterHTML(cat)}</tfoot>
      </table>
    </div>
    <div class="inv-cat-actions"><button class="inv-add" onclick="addSealedRow('${cat}')">${ICO.plus}<span>Ajouter une ligne</span></button></div>
  </section>`;
}
function sealedCatMetaHTML(cat) {
  const list = sealedByCat(cat); if (!list.length) return '';
  const ct = sealedCatTotals(cat), pos = ct.pnl >= 0;
  return `<span>${list.length} produit${list.length > 1 ? 's' : ''}</span><span class="dot">·</span><span>investi ${fmt(ct.invested)}</span><span class="dot">·</span><span>valeur ${fmt(ct.value)}</span><span class="inv-cat-perf ${pos ? 'pos' : 'neg'}">${fmtPct(ct.perf)}</span>`;
}
function sealedFooterHTML(cat) {
  const list = sealedByCat(cat); if (!list.length) return '';
  const P = sealedPeriods(), ct = sealedCatTotals(cat), pos = ct.pnl >= 0;
  return `<tr><td class="c-name">Sous-total</td><td class="c-num">${fmt(ct.invested)}</td>
    ${P.map(k => { const v = sealedCatPeriodRawTotal(cat, k); return `<td class="c-num">${v == null ? '—' : fmt(v)}</td>`; }).join('')}
    <td class="c-num ${pos ? 'pos' : 'neg'}">${fmtSign(ct.pnl)}</td><td class="c-act"></td></tr>`;
}
function sealedRowHTML(p) {
  const P = sealedPeriods();
  const pnl = sealedPnL(p), pos = pnl >= 0;
  const cells = P.map(k => `<td class="c-num"><input class="inv-in inv-num" type="number" step="0.01" inputmode="decimal" value="${p.values && p.values[k] != null ? p.values[k] : ''}" placeholder="—" onchange="updateSealedValue('${p.id}','${k}',this.value)"></td>`).join('');
  return `<tr data-id="${p.id}">
    <td class="c-name"><input class="inv-in inv-in-name" value="${esc(p.name || '')}" placeholder="Nom du produit" onchange="updateSealedField('${p.id}','name',this.value)"></td>
    <td class="c-num"><input class="inv-in inv-num" type="number" step="0.01" inputmode="decimal" value="${p.buyPrice ?? ''}" placeholder="—" onchange="updateSealedField('${p.id}','buyPrice',this.value)"></td>
    ${cells}
    <td class="c-num inv-pnl-cell ${pos ? 'pos' : 'neg'}" id="sp-${p.id}">${fmtSign(pnl)}</td>
    <td class="c-act"><button class="inv-del" title="Supprimer la ligne" aria-label="Supprimer la ligne" onclick="deleteSealedRow('${p.id}')">${ICO.close}</button></td>
  </tr>`;
}

// ── Volet CARTES (bulles par série → détail trié par prix) ──────
function cardQty(p) { return Math.max(1, Number(p.qty) || 1); }
function cardCote(p) { const r = getCachedRawPrice(p.cardId); return (r && r.raw != null) ? r.raw : null; }
function cardValue(p) { const c = cardCote(p); return c == null ? 0 : c * cardQty(p); }
function cardInvested(p) { return p.buyPrice != null ? (Number(p.buyPrice) || 0) * cardQty(p) : 0; }
function cardsTotalValue() { return state.investCards.reduce((a, p) => a + cardValue(p), 0); }
function cardsTotalInvested() { return state.investCards.reduce((a, p) => a + cardInvested(p), 0); }
// Les sets PROMO n'ont pas de logo chez TCGdex — un seul existe (Épée et
// Bouclier). On le réutilise pour toutes les catégories de promos plutôt que
// de laisser un trou dans la grille.
const PROMO_LOGO = 'https://assets.tcgdex.net/fr/swsh/swshp/logo';
function isPromoSet(setId, setName) {
  return /promo/i.test(String(setName || '')) || /p$/.test(String(setId || ''));
}
function groupLogo(setId, setName, logo) {
  if (logo) return logo;
  return isPromoSet(setId, setName) ? PROMO_LOGO : null;
}

// ── Visuels manquants : reconstruction de l'URL d'asset ────────────
// Certaines cartes (promos récentes surtout) n'exposent PAS de champ `image`
// dans l'API alors que le fichier existe bien sur le CDN — parfois seulement
// en anglais. On déduit le chemin depuis une carte voisine du même set qui,
// elle, a une image, puis on teste l'URL construite (FR puis EN).
const _guessImgCache = {};
function loadsOk(url) {
  return new Promise(res => {
    const im = new Image();
    im.onload = () => res(true);
    im.onerror = () => res(false);
    im.src = url;
  });
}
async function guessCardImage(setId, localId) {
  if (!setId || !localId || String(setId).startsWith('?')) return null;
  const key = `${setId}#${localId}`;
  if (key in _guessImgCache) return _guessImgCache[key];
  const bases = [];
  // 1) Gabarit tiré d'une carte voisine qui a déjà une image (chemin garanti).
  for (const loc of ['fr', 'en']) {
    const map = await fetchLocaleSetImages(loc, setId);
    const any = map.values().next();
    if (!any.done && any.value) { bases.push(String(any.value).replace(/\/[^/]+$/, '')); break; }
  }
  // 2) Chemin RECONSTRUIT depuis l'id du bloc : indispensable pour les sets où
  //    AUCUNE carte n'expose d'image (promos Méga-Évolution : rien côté FR ni
  //    EN dans l'API, alors que les fichiers existent bien sur le CDN).
  try {
    const set = await apiFetch(`/sets/${setId}`);
    const serieId = set?.serie?.id;
    if (serieId) for (const loc of ['fr', 'en']) bases.push(`https://assets.tcgdex.net/${loc}/${serieId}/${setId}`);
  } catch {}
  // Chaque base est testée en FR puis en EN (le visuel n'existe parfois qu'en EN).
  const seen = new Set(), candidates = [];
  for (const b of bases) {
    for (const v of [b, b.replace('/fr/', '/en/')]) {
      const url = `${v}/${localId}`;
      if (!seen.has(url)) { seen.add(url); candidates.push(url); }
    }
  }
  for (const c of candidates) {
    if (await loadsOk(`${c}/low.webp`)) { _guessImgCache[key] = c; return c; }
  }
  _guessImgCache[key] = null;
  return null;
}
// Complète les cartes du portefeuille dont le visuel manque encore, puis
// rafraîchit l'affichage. Résultat ENREGISTRÉ : une seule recherche par carte.
async function fillMissingCardImages(list, onDone) {
  const todo = (list || state.investCards).filter(p => !p.image && p.cardId && p.localId);
  if (!todo.length) return;
  let changed = 0;
  await runPool(todo, async p => {
    const found = await guessCardImage(p.setId, p.localId).catch(() => null);
    if (found) { p.image = found; changed++; }
  }, 6);
  if (changed) { save(); if (onDone) onDone(changed); }
}

// Dates de sortie des sets (persistées) : servent au tri chronologique des
// séries. Renseignées une fois depuis l'API, puis relues du state.
function setReleaseDate(setId) { return (state.setDates && state.setDates[setId]) || ''; }
async function ensureSetDates(onReady) {
  state.setDates = state.setDates || {};
  // Le BLOC (« Écarlate et Violet », « Épée et Bouclier »…) vient du MÊME appel
  // /sets/{id} que la date : regrouper les séries ne coûte aucune requête de
  // plus. Un set déjà daté mais sans bloc est donc redemandé une fois.
  state.setBlocs = state.setBlocs || {};
  const ids = [...new Set(state.investCards.map(p => p.setId)
    .filter(id => id && !String(id).startsWith('?') && (!state.setDates[id] || !state.setBlocs[id])))];
  if (!ids.length) return;
  await runPool(ids, async id => {
    try {
      const s = await apiFetch('/sets/' + id);
      const d = s?.releaseDate; if (d) state.setDates[id] = String(d).replace(/\//g, '-');
      if (s?.serie?.id) state.setBlocs[id] = { id: String(s.serie.id), name: s.serie.name || String(s.serie.id) };
    } catch {}
  }, 6);
  save();
  if (onReady) onReady();
}
// ══════════════════════════════════════════════════════════════════
//  SOUS-SÉRIES (Galerie de Dresseurs, Galerie Galaroise, Shiny Vault)
//  Chez TCGdex ce sont des SETS À PART (`swsh12tg`, `swsh12.5gg`,
//  `swsh4.5sv`), alors que pour le collectionneur ce sont les mêmes boosters :
//  « Tempête Argentée » et sa « Galerie de Dresseurs » donnaient DEUX bulles
//  pour UNE série (idem Stars Étincelantes, Origine Perdue, Astres Radieux).
//  On les replie donc à L'AFFICHAGE seulement : chaque carte garde son `setId`
//  réel, dont dépendent sa cote et son lien Cardmarket (voir pickSet).
//
//  Le suffixe seul ne suffit PAS à décider : « 2024sv » est la Collection
//  McDonald's 2024, pas un Shiny Vault. D'où deux garde-fous : le radical doit
//  ressembler à un identifiant de set (il finit par un chiffre, et n'est pas
//  qu'un millésime), et il doit EXISTER pour de vrai — dans la collection pour
//  le portefeuille, dans la série pour le sélecteur.
// ══════════════════════════════════════════════════════════════════
function subsetParentId(setId) {
  const id = String(setId || '');
  for (const suf of SUBSET_SUFFIXES) {
    if (id.length <= suf.length || !id.endsWith(suf)) continue;
    const base = id.slice(0, -suf.length);
    if (base.length < 3 || /^\d+$/.test(base) || !/\d$/.test(base)) continue;
    return base;
  }
  return null;
}
// Identifiant de set sous lequel AFFICHER une carte : celui de son set parent
// si ce parent fait partie de `known`, le sien sinon.
function displaySetId(setId, known) {
  const base = subsetParentId(setId);
  return base && known && known.has(base) ? base : setId;
}
// Les setId « affichables » du portefeuille : sert de référence pour savoir si
// le parent d'une sous-série est lui aussi présent.
function investSetIds() {
  return new Set((state.investCards || []).map(p => p.setId).filter(Boolean).map(String));
}
// Toutes les cartes d'une série TELLE QU'AFFICHÉE (galeries comprises).
function investCardsOfSeries(setId) {
  const known = investSetIds(), key = String(setId);
  return (state.investCards || []).filter(p => p.setId && displaySetId(String(p.setId), known) === key);
}
function cardsGrouped() {
  const g = {}, known = investSetIds();
  for (const p of state.investCards) {
    const k = p.setId ? displaySetId(String(p.setId), known) : ('?' + (p.setName || ''));
    const e = g[k] || (g[k] = { setId: k, setName: '', logo: null, cards: [], __exact: false });
    e.cards.push(p);
    // Le nom et le logo du groupe viennent du set PARENT dès qu'on en a une
    // carte : sans ça « Tempête Argentée » s'appelait « Tempête Argentée
    // Galerie de Dresseurs » selon la première carte rencontrée.
    const exact = String(p.setId || k) === k;
    if (!e.setName || (exact && !e.__exact)) {
      e.setName = p.setName || 'Série inconnue';
      e.logo = groupLogo(p.setId, p.setName, p.logo);
      e.__exact = exact;
    }
  }
  const arr = Object.values(g).map(s => { s.value = s.cards.reduce((a, p) => a + cardValue(p), 0); s.count = s.cards.length; s.date = setReleaseDate(s.setId); return s; });
  // Tri CHRONOLOGIQUE : sorties les plus récentes d'abord ; les séries dont la
  // date est encore inconnue passent à la fin (jamais mélangées au milieu).
  arr.sort((a, b) => {
    if (a.date && b.date) return a.date < b.date ? 1 : a.date > b.date ? -1 : b.count - a.count;
    if (a.date) return -1;
    if (b.date) return 1;
    return b.count - a.count;
  });
  return arr;
}
function investCardsBodyHTML() {
  const total = cardsTotalValue(), invested = cardsTotalInvested();
  const groups = cardsGrouped();
  const nCards = state.investCards.length;
  // Série ouverte = on est DANS une série : le titre « Portefeuille cartes »,
  // son texte d'explication, les boutons d'import et les compteurs globaux
  // n'ont plus rien à y faire. On ne garde que le logo, le retour et le « + ».
  if (nCards && state.investSeriesOpen) return cardsSeriesDetailHTML(state.investSeriesOpen, groups);
  return `
    <!-- Ni titre de page, ni texte d'explication, ni bouton d'import CSV : ils
         mangeaient un demi-écran pour ne rien apprendre à qui ouvre son propre
         portefeuille. L'import reste dans l'état vide — c'est là qu'il sert.
         Les compteurs restent : ce sont des chiffres, pas du décor. -->
    <div class="inv-kpis inv-kpis-solo">
      <div class="inv-kpi"><span class="inv-kpi-val" id="inv-kpi-value">${fmt(total)}</span><span class="inv-kpi-lab">Valeur des cartes</span></div>
      <div class="inv-kpi"><span class="inv-kpi-val">${nCards}</span><span class="inv-kpi-lab">Carte${nCards > 1 ? 's' : ''}</span></div>
      <div class="inv-kpi"><span class="inv-kpi-val">${groups.length}</span><span class="inv-kpi-lab">Série${groups.length > 1 ? 's' : ''}</span></div>
      ${invested > 0 ? `<div class="inv-kpi"><span class="inv-kpi-val ${total - invested >= 0 ? 'pos' : 'neg'}">${fmtSign(total - invested)}</span><span class="inv-kpi-lab">Plus-value</span></div>` : ''}
    </div>
    ${nCards
      ? (state.investSeriesOpen ? cardsSeriesDetailHTML(state.investSeriesOpen, groups) : cardsBlocsHTML(groups))
      : `<div class="empty-state"><div class="empty-state-icon">${ICO.card}</div><div class="empty-state-title">Aucune carte suivie</div>
          <div class="empty-state-sub">Importe ton export Pokécardex (CSV) — j'ajoute toutes les cartes (hors communes, peu communes et holo), avec leur visuel et leur cote. Ou ajoute-les à la main.</div>
          <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:6px"><label class="btn btn-primary btn-import"><span>Importer un CSV</span><input type="file" accept=".csv,.txt" hidden onchange="onCardsFile(this)"></label>
          <button class="btn btn-ghost" onclick="addInvestCard()">${PLUS}Ajouter une carte</button></div></div>`}`;
}
// Volets par BLOC. Un portefeuille de 40 séries en grille plate ne se lit
// pas ; par bloc, on retrouve « ses » séries d'un coup d'œil. Le bloc le plus
// récent est ouvert, les autres sont repliés (état runtime : on ne persiste pas
// un pli d'interface).
let _blocsOpen = null;
function cardsBlocsHTML(groups) {
  const map = new Map();
  for (const g of groups) {
    const b = (state.setBlocs || {})[g.setId];
    const id = b ? b.id : '_autres';
    const name = b ? b.name : 'Autres séries';
    if (!map.has(id)) map.set(id, { id, name, series: [], value: 0, count: 0, date: '' });
    const e = map.get(id);
    e.series.push(g); e.value += g.value; e.count += g.count;
    if ((g.date || '') > e.date) e.date = g.date || '';
  }
  const blocs = [...map.values()].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  // Le pli est un état RUNTIME, et il doit rester cohérent quand la liste des
  // blocs change : au premier rendu les blocs ne sont pas encore connus (une
  // seule entrée « Autres séries »), et sans ce garde-fou c'est elle qui
  // restait ouverte une fois les vrais blocs arrivés.
  if (!_blocsOpen || !blocs.some(b => _blocsOpen.has(b.id)))
    _blocsOpen = new Set(blocs.length ? [blocs[0].id] : []);
  const CHEV = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return blocs.map(b => {
    const open = _blocsOpen.has(b.id);
    return `<section class="bloc ${open ? 'open' : ''}" data-bloc="${esc(b.id)}">
      <button class="bloc-head" onclick="toggleBloc('${esc(b.id)}')" aria-expanded="${open}">
        <span class="bloc-chev" aria-hidden="true">${CHEV}</span>
        <span class="bloc-name">${esc(b.name)}</span>
        <span class="bloc-meta">${b.series.length} série${b.series.length > 1 ? 's' : ''} · ${b.count} carte${b.count > 1 ? 's' : ''}</span>
        <span class="bloc-val">${fmt(b.value)}</span>
      </button>
      <div class="bloc-body"${open ? '' : ' hidden'}>${cardsSeriesGridHTML(b.series)}</div>
    </section>`;
  }).join('');
}
// Dépliage EN PLACE (pas de re-render) : les vignettes arrivent en cascade,
// comme les icônes de l'en-tête. `hidden` est retiré avant de mesurer, sinon la
// hauteur cible vaut zéro.
function toggleBloc(id) {
  const sec = document.querySelector(`.bloc[data-bloc="${id}"]`);
  if (!sec) return;
  const body = sec.querySelector('.bloc-body');
  const open = !sec.classList.contains('open');
  _blocsOpen = _blocsOpen || new Set();
  open ? _blocsOpen.add(id) : _blocsOpen.delete(id);
  sec.querySelector('.bloc-head')?.setAttribute('aria-expanded', String(open));
  // L'animation se fait sur une hauteur INLINE, posée le temps de la
  // transition puis retirée : au repos, un corps ouvert n'a aucune contrainte
  // de hauteur (il grandit si les cotes arrivent) et un corps replié est
  // simplement `hidden`. C'est ce qui manquait : la hauteur figée à 0 en CSS
  // s'appliquait aussi au bloc ouvert d'entrée de jeu.
  if (body._blocTimer) { clearTimeout(body._blocTimer); body._blocTimer = null; }
  if (open) {
    body.hidden = false;
    sec.classList.add('open');
    const h = body.scrollHeight;
    body.style.maxHeight = '0px';
    requestAnimationFrame(() => { body.style.maxHeight = h + 'px'; });
    body._blocTimer = setTimeout(() => { body.style.maxHeight = ''; body._blocTimer = null; }, 420);
  } else {
    body.style.maxHeight = body.scrollHeight + 'px';
    requestAnimationFrame(() => { body.style.maxHeight = '0px'; sec.classList.remove('open'); });
    body._blocTimer = setTimeout(() => {
      body.hidden = true; body.style.maxHeight = ''; body._blocTimer = null;
    }, 420);
  }
}
function cardsSeriesGridHTML(groups) {
  return `<div class="cardser-grid">${groups.map(g => `
    <button class="cardser-bubble" onclick="openInvestSeries('${esc(g.setId)}')">
      <div class="cardser-logo">${g.logo ? `<img src="${g.logo}.png" alt="${esc(g.setName)}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'cardser-fallback',textContent:'◆'}))">` : `<div class="cardser-fallback">◆</div>`}</div>
      <div class="cardser-name">${esc(g.setName)}</div>
      <div class="cardser-count">${g.count} carte${g.count > 1 ? 's' : ''}${g.date ? ` · ${esc(g.date.slice(0, 4))}` : ''}</div>
      <div class="cardser-val">${fmt(g.value)}</div>
    </button>`).join('')}</div>`;
}
// `groups` est passé par l'appelant quand il l'a déjà : regrouper 1 300 cartes
// deux fois pour le même rendu ne servait à rien.
function cardsSeriesDetailHTML(setId, groups) {
  groups = groups || cardsGrouped();
  const g = groups.find(x => String(x.setId) === String(setId));
  if (!g) { state.investSeriesOpen = null; return cardsBlocsHTML(groups); }
  const cards = g.cards.slice().sort((a, b) => (cardCote(b) ?? -1) - (cardCote(a) ?? -1));
  return `
    <div class="cardser-bar">
      <button class="cardser-back" onclick="closeInvestSeries()" title="Toutes les séries" aria-label="Retour aux séries">${ICO.left}</button>
      ${g.logo
        ? `<div class="cardser-bar-logo"><img src="${g.logo}.png" alt="${esc(g.setName)}" onerror="this.closest('.cardser-bar-logo').replaceWith(Object.assign(document.createElement('span'),{className:'cardser-bar-name',textContent:${JSON.stringify(g.setName)}}))"></div>`
        : `<span class="cardser-bar-name">${esc(g.setName)}</span>`}
      <button class="cardser-add" onclick="addInvestCard('${esc(String(g.setId))}')" title="Ajouter une carte à ${esc(g.setName)}" aria-label="Ajouter une carte à cette série">${ICO.plus || PLUS}</button>
      <span class="cardser-bar-meta">${g.count} · ${fmt(g.value)}</span>
    </div>
    <div class="cardlist">${cards.map(cardTileHTML).join('')}</div>`;
}
// Puce de rareté : couleur portée par la rareté elle-même (lecture immédiate).
function rarityClass(r) {
  const s = _cardNorm(r);
  if (/secrete|hyper/.test(s)) return 'r-secret';
  if (/illustration speciale/.test(s)) return 'r-special';
  if (/illustration/.test(s)) return 'r-illus';
  if (/ultra/.test(s)) return 'r-ultra';
  if (/double/.test(s)) return 'r-double';
  if (/promo/.test(s)) return 'r-promo';
  return 'r-base';
}
function cardTileHTML(p) {
  const cote = cardCote(p);
  const qty = cardQty(p);
  const img = p.image ? IMG(p.image, 'low') : '';
  const total = cote != null ? cote * qty : null;
  const pnl = (p.buyPrice != null && cote != null) ? (cote - p.buyPrice) * qty : null;
  const cmHref = (p.cardId && _cmUrlStore[p.cardId]) || cmSearchLink(p.name);
  // COULEUR DE LA CARTE, SANS REQUÊTE. `data-cc` déclenche paintCards(), qui
  // demandait la fiche de CHAQUE carte à l'API pour en lire le type — 48
  // requêtes mesurées à l'ouverture d'une seule série, alors que le type est
  // DÉJÀ enregistré dans le portefeuille. On l'écrit donc en dur, et on ne
  // laisse `data-cc` que pour les rares cartes importées sans type.
  const tc = p.type ? TYPE_COLOR[p.type] : null;
  return `<article class="cardtile" data-id="${p.id}"${tc ? ` style="--tc:${tc}"` : ` data-cc="${esc(p.cardId || '')}"`}>
    <button class="cardtile-art" onclick="openInvestCardPreview('${p.id}')" title="Agrandir ${esc(p.name)}" aria-label="Agrandir ${esc(p.name)}">
      ${img ? `<img src="${img}" alt="" loading="lazy" decoding="async" onerror="imgFail(this,'${esc(String(p.localId || ''))}','${esc(p.setId || '')}','${jss(p.name)}')">` : noImgHTML(p.localId, p.name, p.setId)}
      <span class="cardtile-zoom" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="m20 20-3.2-3.2M11 8.5v5M8.5 11h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>
    </button>
    <div class="cardtile-body">
      <h3 class="cardtile-name" title="${esc(p.name)}">${esc(p.name)}</h3>
      <div class="cardtile-meta">
        ${p.number ? `<span class="cardtile-num">${esc(String(p.number))}</span>` : ''}
        ${p.rarity ? `<span class="cardtile-rar ${rarityClass(p.rarity)}">${esc(p.rarity)}</span>` : ''}
      </div>
      <div class="cardtile-price">
        <span class="cardtile-cote" id="cote-${p.id}">${cote != null ? fmt(cote) : '<span class="cote-wait">cote…</span>'}</span>
        ${qty > 1 && total != null ? `<span class="cardtile-sum" id="sum-${p.id}">×${qty} = ${fmt(total)}</span>` : `<span class="cardtile-sum" id="sum-${p.id}"></span>`}
        <button class="cardtile-sync" onclick="syncCardPrice('${p.id}',event)"
          title="Refaire la cote de cette carte" aria-label="Refaire la cote de ${esc(p.name)}">
          <svg class="ico-sync" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20.5 12a8.5 8.5 0 0 1-13.9 6.6M3.5 12a8.5 8.5 0 0 1 13.9-6.6" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/><path d="M17.4 2.2v3.6h-3.6M6.6 21.8v-3.6h3.6" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <div class="cardtile-buyline">
        <button class="buy-chip ${p.buyPrice != null ? 'set' : ''}" onclick="toggleCardBuy(event,'${p.id}')"
          aria-label="Valeur d'achat de ${esc(p.name)}">${p.buyPrice != null ? `achat ${fmt(p.buyPrice)}` : `+ achat`}</button>
        <span class="cardtile-pnl ${pnl == null ? '' : pnl >= 0 ? 'pos' : 'neg'}" id="pnl-${p.id}">${pnl == null ? '' : fmtSign(pnl)}</span>
      </div>
      <div class="cardtile-foot">
        <div class="qty" role="group" aria-label="Quantité de ${esc(p.name)}">
          <button class="qty-btn" onclick="bumpCardQty('${p.id}',-1)" aria-label="Retirer un exemplaire" ${qty <= 1 ? 'disabled' : ''}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 12h12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>
          <span class="qty-val" id="qty-${p.id}">${qty}</span>
          <button class="qty-btn" onclick="bumpCardQty('${p.id}',1)" aria-label="Ajouter un exemplaire">${ICO.plus}</button>
        </div>
        <a class="cm-link" id="cm-${p.id}" href="${cmHref}" target="_blank" rel="noopener">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14 4h6v6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 4 11 13" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M18 15v3.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H9" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>
          <span>Cardmarket</span>
        </a>
        <button class="cardtile-del" onclick="deleteInvestCard('${p.id}')" aria-label="Retirer ${esc(p.name)}" title="Retirer la carte">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
    </div>
  </article>`;
}
function openInvestSeries(setId) { state.investSeriesOpen = setId; renderInvestBody(); scrollViewToTop('invest'); resolveSeriesLive(setId); }
function closeInvestSeries() { state.investSeriesOpen = null; renderInvestBody(); }
// Cotes + liens CM précis pour la série ouverte uniquement (léger : quelques dizaines).
function resolveSeriesLive(setId) {
  // Les cartes de galerie font partie de la série affichée : sans ça leurs
  // cotes n'étaient jamais résolues à l'ouverture (elles ne « collaient » plus
  // au setId du groupe, qui est désormais celui du set parent).
  const cards = investCardsOfSeries(setId).filter(p => p.cardId);
  if (!cards.length) return;
  ensurePrices(cards.map(p => p.cardId), n => { if (n && String(state.investSeriesOpen) === String(setId)) refreshSeriesCotes(setId); });
  // Liens Cardmarket : base LOCALE de slugs uniquement (`localOnly`). La
  // résolution complète coûte ~7 s par carte et passe par des proxys sous
  // quota : la lancer pour les 48 cartes d'une série à chaque ouverture, c'était
  // se faire limiter pour des liens que personne n'allait cliquer. Celles qui
  // n'y sont pas gardent leur lien de recherche, et la fiche exacte est
  // retrouvée au moment où on recote la carte (syncCardPrice).
  const missing = cards.filter(p => !_cmUrlStore[p.cardId]);
  if (missing.length) runPool(missing, async p => {
    try { const u = await resolveCmUrl(p.cardId, true); if (u) { const a = document.getElementById('cm-' + p.id); if (a) a.href = u; } } catch {}
  }, 4);
}
function refreshSeriesCotes(setId) {
  for (const p of investCardsOfSeries(setId)) {
    const el = document.getElementById('cote-' + p.id); if (el) { const c = cardCote(p); el.textContent = c != null ? fmt(c) : '—'; }
  }
  const v = document.getElementById('inv-kpi-value'); if (v) v.textContent = fmt(cardsTotalValue());
}

// ── Édition SCELLÉ ──────────────────────────────────────────────
function updateSealedValue(id, key, value) {
  const p = state.sealed.find(x => x.id === id); if (!p) return;
  p.values = p.values || {}; p.values[key] = value === '' ? null : parseMoney(value);
  save(); refreshSealedTotalsUI();
}
function updateSealedField(id, field, value) {
  const p = state.sealed.find(x => x.id === id); if (!p) return;
  if (field === 'buyPrice') p.buyPrice = parseMoney(value); else if (field === 'name') p.name = value.trim();
  save(); refreshSealedTotalsUI();
}
function addSealedRow(cat) {
  state.sealed.push({ id: sealedUid(), cat, name: '', buyPrice: null, values: {} });
  save(); renderInvestBody(); investBadge();
  requestAnimationFrame(() => { const n = document.querySelectorAll('#inv-mode-body tr[data-id] .inv-in-name'); n[n.length - 1]?.focus(); });
}
function deleteSealedRow(id) {
  const i = state.sealed.findIndex(x => x.id === id); if (i < 0) return;
  state.sealed.splice(i, 1); save(); renderInvestBody(); investBadge(); toast('Ligne supprimée', 'success');
}
function addSealedPeriod() {
  const P = sealedPeriods(); P.push(nextPeriod(P[P.length - 1] || '2026-07'));
  save(); renderInvestBody(); toast('Semestre ajouté', 'success');
}
function removeSealedPeriod(key) {
  const P = sealedPeriods(); const i = P.indexOf(key); if (i < 0 || P.length <= 1) return;
  P.splice(i, 1);
  for (const p of state.sealed) if (p.values) delete p.values[key];
  for (const p of state.investCards) if (p.values) delete p.values[key];
  save(); renderInvestBody(); toast(`Colonne ${periodLabel(key)} retirée`, 'success');
}
function refreshSealedTotalsUI() {
  const t = sealedTotals(state.sealed), pos = t.pnl >= 0;
  const setTxt = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  setTxt('inv-kpi-value', fmt(t.value));
  const pnlEl = document.getElementById('inv-kpi-pnl'); if (pnlEl) { pnlEl.textContent = fmtSign(t.pnl); pnlEl.className = `inv-kpi-val ${pos ? 'pos' : 'neg'}`; }
  const perfEl = document.getElementById('inv-kpi-perf'); if (perfEl) { perfEl.textContent = fmtPct(t.perf); perfEl.className = `inv-kpi-val ${pos ? 'pos' : 'neg'}`; }
  for (const p of state.sealed) { const sp = document.getElementById('sp-' + p.id); if (sp) { const pnl = sealedPnL(p), pp = pnl >= 0; sp.textContent = fmtSign(pnl); sp.className = `c-num inv-pnl-cell ${pp ? 'pos' : 'neg'}`; } }
  for (const [cat] of SEALED_CATS) { const meta = document.getElementById('meta-' + cat); if (meta) meta.innerHTML = sealedCatMetaHTML(cat); const foot = document.getElementById('foot-' + cat); if (foot) foot.innerHTML = sealedFooterHTML(cat); }
  drawPortfolioChart(state.sealed);
}

// ── Édition CARTES ──────────────────────────────────────────────
// « Ajouter une carte » n'crée RIEN tant qu'une carte n'a pas été choisie :
// annuler le sélecteur ne doit pas laisser de ligne vide « Série inconnue ».
// `setId` : on entre directement dans les cartes de CETTE série. Cliquer « + »
// depuis une série et devoir la re-choisir dans une liste de 200 était un
// détour absurde.
async function addInvestCard(setId) {
  state._investCardTarget = null;   // mode création (voir pickCard)
  await openCardPicker('investCard');
  if (setId) { try { await pickSet(String(setId)); } catch (e) { console.warn('pickSet', e); } }
}
function deleteInvestCard(id) {
  const i = state.investCards.findIndex(x => x.id === id); if (i < 0) return;
  state.investCards.splice(i, 1); save(); renderInvestBody(); investBadge(); toast('Carte retirée', 'success');
}
// Quantité : mise à jour EN PLACE (cote, total, plus-value, KPI) — la tuile
// n'est pas reconstruite, donc aucun saut de scroll ni perte de focus.
function bumpCardQty(id, delta) {
  const p = state.investCards.find(x => x.id === id); if (!p) return;
  const next = Math.max(1, cardQty(p) + delta);
  if (next === cardQty(p)) return;
  p.qty = next; save();
  refreshCardTile(p);
  refreshInvestTotals();
}
function refreshCardTile(p) {
  const qty = cardQty(p), cote = cardCote(p);
  const q = document.getElementById('qty-' + p.id); if (q) q.textContent = qty;
  const row = document.querySelector(`.cardtile[data-id="${p.id}"]`);
  if (row) { const minus = row.querySelector('.qty-btn'); if (minus) minus.disabled = qty <= 1; }
  const c = document.getElementById('cote-' + p.id); if (c) c.textContent = cote != null ? fmt(cote) : '—';
  const s = document.getElementById('sum-' + p.id); if (s) s.textContent = (qty > 1 && cote != null) ? `×${qty} = ${fmt(cote * qty)}` : '';
  const pn = document.getElementById('pnl-' + p.id);
  if (pn) {
    if (p.buyPrice != null && cote != null) { const d = (cote - p.buyPrice) * qty; pn.textContent = fmtSign(d); pn.className = `cardtile-pnl ${d >= 0 ? 'pos' : 'neg'}`; }
    else { pn.textContent = ''; pn.className = 'cardtile-pnl'; }
  }
}
// Valeur d'achat (optionnelle) : le bouton se transforme en champ le temps de
// la saisie, puis reprend sa place — pas de modal pour une seule valeur.
function toggleCardBuy(ev, id) {
  const btn = ev.currentTarget.closest('.buy-chip'); const p = state.investCards.find(x => x.id === id);
  if (!btn || !p) return;
  const inp = document.createElement('input');
  inp.className = 'buy-input'; inp.type = 'number'; inp.step = '0.01'; inp.min = '0'; inp.inputMode = 'decimal';
  inp.placeholder = 'achat €'; inp.value = p.buyPrice ?? '';
  inp.setAttribute('aria-label', "Valeur d'achat");
  let done = false;
  const commit = () => {
    if (done) return; done = true;
    p.buyPrice = inp.value === '' ? null : parseMoney(inp.value);
    save();
    inp.replaceWith(btn);
    btn.textContent = p.buyPrice != null ? `achat ${fmt(p.buyPrice)}` : '+ achat';
    btn.classList.toggle('set', p.buyPrice != null);
    refreshCardTile(p);
  };
  // Deux voies de validation (commit est idempotent) : `change` couvre les cas
  // où `blur` n'arrive pas (claviers mobiles, autofill).
  inp.onblur = commit;
  inp.onchange = commit;
  inp.onkeydown = e => { if (e.key === 'Enter') inp.blur(); else if (e.key === 'Escape') { inp.value = p.buyPrice ?? ''; inp.blur(); } };
  btn.replaceWith(inp); inp.focus(); inp.select();
}
function pickInvestCard(id) { state._investCardTarget = id; openCardPicker('investCard'); }
function openInvestCardPreview(id) {
  const p = state.investCards.find(x => x.id === id); if (!p || !p.image) return;
  openPhotoLightbox(IMG(p.image, 'high'), p.name || '');
}

// ── Import CSV (export Pokécardex) ──────────────────────────────
// Parse un fichier délimité (gère les guillemets et « ; » internes).
function parseDelimited(text, delim) {
  text = text.replace(/^﻿/, '');
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (ch !== '\r') cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
function parseCardsCsv(text) {
  const raw = parseDelimited(text, ';');
  if (!raw.length) return [];
  const head = raw[0].map(h => String(h || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim());
  const col = names => { for (const n of names) { const i = head.indexOf(n); if (i >= 0) return i; } return -1; };
  const ci = { serie: col(['serie']), numero: col(['numero']), nom: col(['nom', 'name']), type: col(['type']), rarete: col(['rarete']), version: col(['version']), quantite: col(['quantite']) };
  const out = [];
  for (let r = 1; r < raw.length; r++) {
    const row = raw[r]; if (!row || !row.length) continue;
    const nom = ci.nom >= 0 ? row[ci.nom] : ''; if (!String(nom).trim()) continue;
    out.push({ serie: row[ci.serie] || '', numero: row[ci.numero] || '', nom, type: row[ci.type] || '', rarete: row[ci.rarete] || '', version: row[ci.version] || '', quantite: row[ci.quantite] || '1' });
  }
  return out;
}
function onCardsFile(input) {
  const file = input.files && input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try { const rows = parseCardsCsv(e.target.result); if (!rows.length) { toast('CSV vide ou non reconnu', 'error'); return; } importCardRows(rows); }
    catch (err) { console.warn('csv', err); toast('CSV illisible', 'error'); }
  };
  reader.onerror = () => toast('Lecture du fichier échouée', 'error');
  reader.readAsText(file, 'utf-8');
  input.value = '';
}
const _cardNorm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
// Alias pokecardex → nom de set tcgdex (clés/valeurs normalisées) pour les cas où le nom diffère.
const CARD_SET_ALIASES = {
  'promos ecarlate et violet': 'svp black star promos',
  'promos epee et bouclier': 'promo swsh',
  'promos soleil et lune': 'promo sm',
  'promos x y': 'promo xy',
  'promos mega evolution': 'mep black star promos',
  'promos black star heartgold soulsilver': 'promo hgss',
  'promos black star noir blanc': 'promo bw',
  'energies ecarlate et violet': 'ecarlate et violet energie',
  'promo mcdonald s 2024': 'collection mcdonald s 2024',
  'promo mcdonald s 2022': 'collection mcdonald s 2022',
};
// Clé de numéro commune aux DEUX côtés (CSV et tcgdex) : les numéros purement
// chiffrés perdent leurs zéros de tête (« 055 » → « 55 »), les alphanumériques
// sont conservés tels quels en majuscules (« GG01 », « SWSH028 », « TG02 »).
// Indispensable : String(parseInt('GG01')) valait « NaN » et cassait l'index.
function cardLocalKey(s) {
  const t = String(s == null ? '' : s).trim().toUpperCase();
  return /^\d+$/.test(t) ? String(parseInt(t, 10)) : t;
}
let _cardSetIndex = null;
async function buildCardSetIndex() {
  if (_cardSetIndex) return _cardSetIndex;
  const idx = {};
  const series = await apiFetch('/series');
  await runPool(series, async s => {
    try { const full = await apiFetch('/series/' + s.id); (full.sets || []).forEach(set => { idx[_cardNorm(set.name)] = { id: set.id, name: set.name, logo: set.logo || null }; }); } catch {}
  }, 6);
  _cardSetIndex = idx;
  return idx;
}
function resolveCardSetKey(serie, idx) {
  const k = _cardNorm(serie);
  if (idx[k]) return k;
  const a = CARD_SET_ALIASES[k]; if (a != null && idx[a]) return a;
  if (String(serie).includes(':')) { const seg = _cardNorm(String(serie).split(':').pop()); if (idx[seg]) return seg; }
  if (k.startsWith('promos ')) { const seg = k.slice(7); if (idx[seg]) return seg; }
  // Rattrapage souple : différences de graphie mineures côté tcgdex
  // (« Duels au Sommet » vs « Duels au Sommets »). On exige une clé assez
  // longue et un préfixe commun pour éviter les faux positifs.
  const tail = String(serie).includes(':') ? _cardNorm(String(serie).split(':').pop()) : k;
  if (tail.length >= 6) {
    const near = Object.keys(idx).filter(x => x.startsWith(tail) || tail.startsWith(x));
    if (near.length === 1) return near[0];
  }
  return null;
}
// Numéro imprimé du CSV → clé d'index (« 055/084 » → « 55 », « GG01/GG70 » → « GG01 »)
function cardNumLocal(numero) { return cardLocalKey(String(numero).split('/')[0]); }
// Sous-séries d'un set (Galerie de Dresseurs, Galerie Galaroise, Coffre
// Étincelant…) : dans tcgdex ce sont des sets DISTINCTS dont le nom commence
// par celui du set de base. Leurs cartes (TG01, GG01, SV105…) sont fusionnées
// dans l'index du set parent pour que les numéros à préfixe se résolvent.
function companionSetKeys(baseKey, idx) {
  return Object.keys(idx).filter(k => k !== baseKey && k.startsWith(baseKey + ' '));
}
async function importCardRows(rows) {
  const EXCLUDE = new Set(['commune', 'unco', 'holographique']);
  const kept = rows.filter(r => !EXCLUDE.has(_cardNorm(r.rarete)));
  if (!kept.length) { toast('Aucune carte à importer (toutes filtrées)', 'error'); return; }
  const el = ensureBusyEl(); el.querySelector('.busy-label').textContent = 'Préparation du catalogue…'; el.classList.add('open');
  // Yield via setTimeout (PAS requestAnimationFrame) : rAF est gelé quand
  // l'onglet passe en arrière-plan — l'import resterait bloqué à mi-chemin.
  const yieldUI = () => new Promise(res => setTimeout(res, 0));
  await yieldUI();
  try {
    const idx = await buildCardSetIndex();
    const bySet = {};
    for (const r of kept) { const key = resolveCardSetKey(r.serie, idx); const bk = key || ('?' + r.serie); (bySet[bk] = bySet[bk] || { key, serie: r.serie, rows: [] }).rows.push(r); }
    const groups = Object.values(bySet);
    const cards = []; let done = 0, resolved = 0;
    for (const g of groups) {
      el.querySelector('.busy-label').textContent = `Résolution des cartes… ${++done}/${groups.length} séries`;
      await yieldUI();
      const info = g.key ? idx[g.key] : null;
      let byLocal = null;
      if (info) {
        byLocal = {};
        // Set de base, puis ses sous-séries (TG/GG/SV…) sans écraser les clés déjà vues.
        const keys = [g.key, ...companionSetKeys(g.key, idx)];
        for (const k of keys) {
          try {
            const set = await apiFetch('/sets/' + idx[k].id);
            (set.cards || []).forEach(c => { const key = cardLocalKey(c.localId); if (!(key in byLocal)) byLocal[key] = c; });
          } catch {}
        }
      }
      for (const r of g.rows) {
        const c = byLocal ? byLocal[cardNumLocal(r.numero)] : null;
        if (c) resolved++;
        cards.push({
          id: sealedUid(), cardId: c ? c.id : null, name: (c && c.name) || r.nom,
          setId: info ? info.id : ('?' + r.serie), setName: info ? info.name : r.serie, logo: info ? info.logo : null,
          number: r.numero, localId: c ? c.localId : cardNumLocal(r.numero), rarity: r.rarete, type: r.type,
          qty: Math.max(1, parseInt(r.quantite, 10) || 1), image: c ? c.image : '', buyPrice: null,
        });
      }
    }
    // Réimport : on CONSERVE les valeurs d'achat déjà saisies (clé = carte
     // résolue, sinon série+numéro) — un nouvel export ne doit pas les effacer.
    const prevBuy = new Map();
    for (const old of state.investCards) {
      if (old.buyPrice == null) continue;
      prevBuy.set(old.cardId || `${old.setName}#${old.number}`, old.buyPrice);
    }
    if (prevBuy.size) {
      let kept = 0;
      for (const c of cards) { const b = prevBuy.get(c.cardId || `${c.setName}#${c.number}`); if (b != null) { c.buyPrice = b; kept++; } }
      if (kept) console.info(`[import cartes] ${kept} valeur(s) d'achat conservée(s)`);
    }
    state.investCards = cards; state.investSeriesOpen = null; window._investCountedCards = false;
    save(); el.classList.remove('open');
    state.investMode = 'cards'; renderInvest(); investBadge();
    toast(`${cards.length} cartes importées (${resolved} avec visuel)`, 'success');
    prefetchCardPrices();
  } catch (err) { console.warn('import cartes', err); el.classList.remove('open'); toast('Import échoué', 'error'); }
}
// Cote en arrière-plan les cartes de l'app qui n'ont AUCUNE valeur enregistrée
// (après un import, une restauration…) puis met les totaux à jour en place.
function prefetchCardPrices() {
  ensurePrices(trackedCardIds(), n => {
    if (!n) return;
    if (state.view === 'invest' && state.investMode === 'cards') { const v = document.getElementById('inv-kpi-value'); if (v) v.textContent = fmt(cardsTotalValue()); if (state.investSeriesOpen) refreshSeriesCotes(state.investSeriesOpen); }
    if (state.view === 'home') { computeCollectionValue(); refreshSyncMeta(); }
  });
}

// ── Courbe (SVG maison) — générique sur une liste ───────────────
function drawPortfolioChart(list) {
  list = list || state.sealed;
  const box = document.getElementById('inv-chart-portfolio'); if (!box) return;
  const P = sealedPeriods(), li = sealedLatestDataIndex(list);
  const invested = list.reduce((a, p) => a + sealedInvested(p), 0);
  const labels = ['Achat'], vals = [invested];
  for (let i = 0; i <= li; i++) { labels.push(periodShort(P[i])); vals.push(list.reduce((a, p) => a + sealedValueAt(p, i), 0)); }
  if (vals.length < 2) { box.innerHTML = `<div class="chart-empty">Renseigne les valeurs d'un semestre pour voir la courbe se dessiner.</div>`; return; }
  const W = 760, H = 200, padL = 8, padR = 12, padT = 20, padB = 12;
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min = min * 0.9 || 0; max = max * 1.1 || 1; }
  const rng = max - min || 1;
  const X = i => padL + i * ((W - padL - padR) / (vals.length - 1));
  const Y = v => padT + (1 - (v - min) / rng) * (H - padT - padB);
  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
  const area = `${line} L ${X(vals.length - 1).toFixed(1)} ${(H - padB).toFixed(1)} L ${X(0).toFixed(1)} ${(H - padB).toFixed(1)} Z`;
  const dots = vals.map((v, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${i === vals.length - 1 ? 4 : 2.6}" fill="var(--acc)"/>`).join('');
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="inv-svg">
      <defs><linearGradient id="invGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--acc)" stop-opacity=".30"/><stop offset="100%" stop-color="var(--acc)" stop-opacity="0"/></linearGradient></defs>
      <path d="${area}" fill="url(#invGrad)"/>
      <path d="${line}" fill="none" stroke="var(--acc)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}
    </svg>
    <div class="inv-chart-axis">${labels.map((l, i) => `<span>${esc(l)}<b>${fmt(vals[i])}</b></span>`).join('')}</div>`;
}

// ── Import Excel / CSV (format « Suivi de collection ») ──────────
let _sealedImport = null;
function onSealedFile(input) {
  const file = input.files && input.files[0]; if (!file) return;
  if (typeof XLSX === 'undefined') { toast('Lecteur Excel pas encore prêt, réessaie dans un instant', 'error'); input.value = ''; return; }
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
      const parsed = parseSealedWorkbook(rows);
      if (!parsed.products.length) { toast('Aucun produit détecté dans ce fichier', 'error'); return; }
      _sealedImport = parsed; openSealedImportConfirm(parsed);
    } catch (err) { console.warn('import', err); toast('Fichier illisible (.xlsx, .xls, .csv)', 'error'); }
  };
  reader.onerror = () => toast('Lecture du fichier échouée', 'error');
  reader.readAsArrayBuffer(file);
  input.value = '';
}
function parseSealedWorkbook(rows) {
  let products = [], curCat = null, colBuy = 1, periodCols = {};
  for (const r of rows) {
    const first = String(r[0] || '').trim(), low = first.toLowerCase();
    if (!first) continue;
    if (/nom du banger|^produit$|^nom$/.test(low) && r.some(c => /valeur/i.test(String(c)))) {
      periodCols = {};
      r.forEach((c, i) => {
        const m = String(c).match(/valeur\s*(\d{1,2})[\/.\-](\d{4})/i);
        if (m) periodCols[`${m[2]}-${String(m[1]).padStart(2, '0')}`] = i;
        if (/prix\s*d.?achat/i.test(String(c))) colBuy = i;
      });
      continue;
    }
    if (/sous-total|total global|total invest|performance globale|valeur actuelle/i.test(low)) continue;
    const buyVal = parseMoney(r[colBuy]);
    const hasVal = Object.values(periodCols).some(i => parseMoney(r[i]) != null);
    const filled = r.filter(c => String(c).trim() !== '').length;
    if (filled <= 1 || (buyVal == null && !hasVal)) { curCat = sealedCatOf(first); continue; }
    const values = {};
    for (const [key, i] of Object.entries(periodCols)) { const v = parseMoney(r[i]); if (v != null) values[key] = v; }
    products.push({ id: sealedUid(), cat: curCat || sealedCatOf(first), name: first, buyPrice: buyVal, values });
  }
  const dataPeriods = new Set();
  for (const p of products) for (const k in p.values) dataPeriods.add(k);
  const periods = Array.from(new Set([...DEFAULT_SEALED_PERIODS, ...dataPeriods])).sort();
  return { periods, products };
}
function ensureSealedModal() {
  let m = document.getElementById('modal-sealed-import');
  if (m) return m;
  m = document.createElement('div');
  m.className = 'modal-overlay'; m.id = 'modal-sealed-import';
  m.innerHTML = `<div class="modal" style="max-width:480px">
      <div class="modal-header"><div class="modal-title">Importer le portefeuille</div><button class="modal-close" onclick="closeModal('modal-sealed-import')" aria-label="Fermer">${ICO.close}</button></div>
      <div class="modal-body" id="sealed-import-body"></div>
      <div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal('modal-sealed-import')">Annuler</button><button class="btn btn-primary" onclick="confirmSealedImport()">Remplacer le portefeuille</button></div>
    </div>`;
  document.body.appendChild(m);
  return m;
}
function openSealedImportConfirm(parsed) {
  ensureSealedModal();
  const byCat = {};
  for (const p of parsed.products) byCat[p.cat] = (byCat[p.cat] || 0) + 1;
  document.getElementById('sealed-import-body').innerHTML = `
    <p class="sealed-imp-hint">J'ai lu <b>${parsed.products.length} produit${parsed.products.length > 1 ? 's' : ''}</b> répartis en :</p>
    <ul class="sealed-imp-list">${SEALED_CATS.filter(([k]) => byCat[k]).map(([k, lbl]) => `<li><span>${esc(lbl)}</span><b>${byCat[k]}</b></li>`).join('')}</ul>
    <p class="sealed-imp-note">Colonnes de valeur : ${parsed.periods.map(periodLabel).join(' · ')}.<br>Importer <b>remplacera</b> le portefeuille scellé actuel (${state.sealed.length} ligne${state.sealed.length > 1 ? 's' : ''}).</p>`;
  openModal('modal-sealed-import');
}
function confirmSealedImport() {
  if (!_sealedImport) return;
  state.sealed = _sealedImport.products; state.sealedPeriods = _sealedImport.periods.slice();
  _sealedImport = null; window._investCountedSealed = false;
  save(); closeModal('modal-sealed-import');
  state.investMode = 'sealed'; renderInvest();
  toast(`${state.sealed.length} produits importés`, 'success');
}

/* ══════════════════════════════════════════════════════════════════════
   AUTO-MISE À JOUR — que le code déployé ARRIVE, sans rien demander

   Le 2026-08-26, trois corrections d'affilée n'ont jamais tourné sur l'iPhone :
   l'app installée servait l'ancien code. La cause : `index.html` est la SEULE
   ressource sans `?v=` dans son URL (app.js et style.css portent leur version).
   Une copie périmée d'elle épingle donc l'app sur l'ancien app.js et l'ancien
   style.css, indéfiniment, quel que soit le nombre de réouvertures.

   Deux verrous, désormais :
   · le service worker demande la PAGE en ignorant le cache HTTP (voir sw.js) ;
   · l'app se compare elle-même au déploiement. `BUILD` est gravé dans ce
     fichier ; `version.json` est relu à chaque démarrage SANS CACHE. S'ils
     divergent, c'est que le code qui tourne est périmé : on vide les caches, on
     congédie le service worker et on recharge UNE fois.

   Le garde-fou anti-boucle est une clé de session : si le rechargement ne
   suffit pas (serveur en retard, déploiement à moitié propagé), on n'insiste
   pas et on laisse l'app tourner telle quelle.
   ══════════════════════════════════════════════════════════════════════ */
const BUILD = 'ui37';
async function purgeAppCaches() {
  try {
    if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
  } catch (e) { console.warn('purge caches', e); }
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
    for (const r of regs) await r.unregister();
  } catch (e) { console.warn('purge sw', e); }
}
async function selfHeal() {
  if (!location.protocol.startsWith('http')) return;
  // `?fresh=1` : sortie de secours à taper une fois, quand l'app est déjà
  // collée à une version qui ne contient pas ce mécanisme.
  const forced = /[?&]fresh=1/.test(location.search);
  let remote = null;
  try {
    const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (r.ok) remote = (await r.json()).build;
  } catch {}
  if (!forced && (!remote || remote === BUILD)) return;
  if (sessionStorage.getItem('irondex-healed') === (remote || 'forced')) return;   // déjà tenté
  try { sessionStorage.setItem('irondex-healed', remote || 'forced'); } catch {}
  console.warn('[maj] code périmé', BUILD, '→', remote, '· purge et rechargement');
  await purgeAppCaches();
  const u = new URL(location.href);
  u.searchParams.delete('fresh');
  u.searchParams.set('maj', remote || String(Date.now()));
  location.replace(u.toString());
}

document.addEventListener('DOMContentLoaded', async () => {
  selfHeal();   // non bloquant : si une mise à jour s'impose, elle recharge
  // Promesse « prêt à peindre », consommée par la barre de progression de
  // l'intro sur le chemin sans 3D.
  window._introReady = new Promise(res => { window._introReadyResolve = res; });
  ensureSoftButtonAssets();    // matériau des boutons prêt avant le 1er rendu
  loadApiCache();   // réinjecte les séries/sets déjà connus (navigation instantanée)
  loadPriceCache(); // cotes de la dernière session → valeur du coffre instantanée
  try { await load(); } catch (e) { console.warn('load', e); }  // copie locale prête avant le rendu
  // Le DÉPÔT est l'arbitre : on le relit tout de suite. Sur un appareil vierge
  // (l'iPhone à sa première ouverture) c'est LUI qui remplit la collection ;
  // ailleurs, le plus récent gagne. Non bloquant : l'app s'affiche déjà avec
  // la copie locale, la mise à jour arrive quand le réseau répond.
  if (ghCfg().owner) {
    ghPull().catch(e => console.warn('ghPull', e));
    ghPullPrices().catch(e => console.warn('ghPullPrices', e));
    // Des modifications d'une session précédente n'ont jamais pu partir (jeton
    // expiré, hors ligne, app fermée trop vite) ? On retente maintenant. Le
    // garde-fou anti-écrasement de ghFlush protège le cas où le dépôt serait
    // plus récent — et ghPull, qui tourne juste au-dessus, a déjà tranché.
    if (pushPending() && ghOn()) setTimeout(() => ghPushSoon('collection'), 3000);
    // …et à CHAQUE retour au premier plan. Sur iPhone une app installée n'est
    // jamais « rechargée » : sans ça, les cartes ajoutées depuis un autre
    // appareil n'arrivaient qu'après une fermeture complète.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      if (Date.now() - _ghLastPull < 20000) return;   // pas à chaque va-et-vient
      ghPull().catch(() => {});
      ghPullPrices().catch(() => {});
      if (pushPending() && ghOn()) ghPushSoon('collection');
    });
  }
  // LIRE NE DEMANDE AUCUN JETON : le dépôt est public, `ghRead` passe par
  // raw.githubusercontent (voir ghRead) et ne retombe sur l'API authentifiée que
  // pour un dépôt privé. Un jeton absent ou expiré n'empêche donc pas la
  // collection d'arriver — il n'empêche que l'ENVOI. La pastille doit dire cette
  // nuance au lieu d'afficher une erreur rouge qui laisse croire à une panne.
  ghPaintStatus(ghOn() ? 'ok' : (ghCfg().owner ? 'read' : 'off'));
  // Signal pour la barre de l'intro (chemin sans 3D) : le catalogue est relu,
  // les cotes sont là, on peut peindre.
  try { window._introReadyResolve && window._introReadyResolve(); } catch {}
  // AVERTISSEMENT FRANC : une machine qui a des données mais pas de jeton
  // travaille dans le vide — c'est exactement ce qui est arrivé (des cartes
  // ajoutées sur un poste, jamais envoyées, invisibles ailleurs). La pastille
  // grise ne suffisait pas.
  setTimeout(() => {
    if (!ghOn() && !ghLocalEmpty()) {
      ghPaintStatus(ghCfg().owner ? 'read' : 'warn');
      // Le ton compte : sans jeton, l'appareil n'est pas « en panne », il est en
      // LECTURE SEULE. Il reçoit tout, il n'envoie rien.
      toast(ghCfg().owner
        ? 'Lecture seule sur cet appareil : la collection est bien relue du dépôt, mais tes modifications d\u2019ici ne sont pas envoyées.'
        : 'Coffre en ligne non configuré ici : tes modifications restent sur cet appareil.', 'error');
    }
  }, 2600);
  // Service worker : rend l'app installable sur l'iPhone et lisible hors ligne.
  // Inutile (et interdit) en file://.
  //
  // ATTENTION, leçon apprise à la dure : une app installée peut rester collée
  // à un ANCIEN service worker et servir l'ancien code indéfiniment — un bug
  // corrigé et déployé restait visible sur l'iPhone après plusieurs
  // réouvertures. On force donc la vérification à chaque démarrage, et quand
  // un nouveau worker prend la main on recharge UNE fois (le garde-fou
  // `controller` évite la boucle : on ne recharge que si on était déjà piloté
  // par une version précédente).
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    const wasControlled = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (wasControlled && !reloading) { reloading = true; location.reload(); }
    });
    navigator.serviceWorker.register('sw.js')
      .then(reg => { try { reg.update(); } catch {} })
      .catch(e => console.warn('sw', e));
  }
  warmupModels();  // parse les GLB au plus tôt → cache chaud avant la fin de l'intro
  runIntro(() => {
    render();
    // Positionne la pastille une fois la mise en page prête, puis une fois les
    // polices chargées (leurs largeurs changent) — évite les recalages/sautillements.
    repositionNavSoon(true);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { positionNavIndicator(true); syncTopbarHeight(); });
    setTimeout(() => positionNavIndicator(true), 450);
    setTimeout(checkForNewSeries, 1400);
    setTimeout(refreshSyncMeta, 600);         // « cotes il y a … » une fois l'accueil peint
    setTimeout(offerRecoveryIfNeeded, 900);   // propose la récupération si des sections sont vides
    bindBackupShortcuts();
    bindBrandReveal();                        // en-tête téléphone : actions au tap sur la marque
    bindPalette();                            // ⌘K / « / » — accélérateur global
    watchSoft();                              // tout nouveau bouton reçoit le matériau
    applySoft(document);                      // …et le châssis (rail, en-tête, tab bar) une fois pour toutes
    attachSpotlights();                       // lumière au curseur sur les surfaces
    attachReveals();                          // révélations au scroll
    // Scène Spline OPTIONNELLE : activée seulement si une URL .splinecode est
    // configurée (window.MILO_SPLINE_SCENE). Par défaut MiloDex garde sa 3D
    // locale — disponible hors ligne et faite de vrais scans de cartes.
    if (window.MILO_SPLINE_SCENE) {
      const c = document.createElement('canvas');
      c.id = 'spline-canvas';
      c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none';
      document.querySelector('.hero-3d')?.prepend(c);
      mountSplineScene(c, window.MILO_SPLINE_SCENE);
    }
    // Précharge la liste des séries à l'inactivité → 1re ouverture du picker instantanée
    const idle = window.requestIdleCallback || (cb => setTimeout(cb, 1200));
    idle(() => prefetchApi('/series'));
  });
});
// Rotation / changement de taille : on se REPLACE d'un coup (un glissement
// pendant que la barre change de largeur se lit comme un bug), et une seule
// fois par frame — `resize` part en rafale sur iOS (barre d'adresse, clavier),
// et chaque appel force un calcul de mise en page.
window.addEventListener('resize', () => { repositionNavSoon(true); syncTopbarHeight(); setPagerColumn(state.view, true); });
window.addEventListener('orientationchange', () => setTimeout(() => repositionNavSoon(true), 60));
