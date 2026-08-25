#!/usr/bin/env python3
"""PONT CARDMARKET — le PREMIER PRIX de la fiche, en français et Near Mint.

    pip3 install playwright          # (pas de « playwright install » : on
                                     #  pilote le Brave/Chrome déjà installé)
    python3 scripts/cm_price_bridge.py

Puis, dans IronDex, cliquer « Sync » : les cotes sont recalculées sur le
PREMIER PRIX de la liste d'offres Cardmarket filtrée cartes françaises
(language=2) en état Near Mint minimum (minCondition=2) — exactement la page
qui s'ouvre quand on clique le lien CM d'une carte.

POURQUOI UN PONT (et pas un fetch depuis l'app)
-----------------------------------------------
Les cotes affichées jusqu'ici venaient des MOYENNES publiées par TCGdex /
pokemontcg.io : elles agrègent toutes les langues, donc surtout l'anglais. La
seule source du prix français, c'est la liste d'offres de la fiche Cardmarket
elle-même. Or elle n'est lisible NI par l'app NI par un script :

  · curl / requests / curl_cffi (même avec l'empreinte TLS de Chrome)
    → Cloudflare répond « Just a moment… » (challenge JavaScript) ;
  · les proxys CORS publics (corsproxy, allorigins, codetabs)
    → 403 / 522, leurs IP sont bloquées ;
  · Chromium en mode headless → « Attention Required! | Cloudflare ».

Ce qui passe : un VRAI navigateur, fenêtre visible. Une fois le challenge
résolu (~4 s, une seule fois par profil), la page cardmarket.com peut lire
n'importe quelle autre fiche par `fetch()` SAME-ORIGIN — ~400 ms par carte,
sans rendu, sans nouvelle navigation. C'est tout le principe de ce pont : une
fenêtre Brave ouverte sur cardmarket.com, et un petit serveur HTTP local à qui
l'app demande « le premier prix de cette fiche ».

Le pont est FACULTATIF : s'il n'est pas lancé, IronDex retombe sur les
moyennes comme avant (avec ses garde-fous d'appariement).
"""
import argparse
import asyncio
import glob
import json
import os
import signal
import subprocess
import sys
import threading
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

try:
    from playwright.async_api import async_playwright
except ImportError:
    sys.exit("playwright manquant : pip3 install playwright")

# Navigateurs acceptables, par ordre de préférence. On réutilise un navigateur
# DÉJÀ installé (pas de téléchargement de 150 Mo) : Cloudflare accepte ces
# binaires-là, pas le Chromium de test de Playwright en headless.
BROWSERS = [
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
]
HOME_URL = 'https://www.cardmarket.com/fr/Pokemon'
DEFAULT_PROFILE = os.path.expanduser('~/.irondex/cm-bridge-profile')

# ── Lecture d'une fiche, DANS la page cardmarket.com ───────────────────
# Exécuté par le navigateur, donc : cookies de session + clearance Cloudflare
# inclus, origine identique, aucun CORS. On lit le HTML BRUT (DOMParser, sans
# exécution de script) : les attributs `title` / `data-original-title` y sont
# encore intacts — Bootstrap ne les a pas déplacés dans ses tooltips.
# ── Lecture de la PREMIÈRE offre d'une fiche ───────────────────────────
# `EXTRACT` lit un document : celui d'un `fetch()` (HTML brut, attributs
# `title` intacts) ou celui de la page après navigation (Bootstrap a déplacé
# les infobulles dans `data-bs-original-title`) — les deux cas sont couverts.
JS_EXTRACT = r"""
(doc) => {
  const attr = (el, ...names) => {
    for (const n of names) { const v = el && el.getAttribute(n); if (v) return v; }
    return null;
  };
  const parseAmount = (txt) => {
    if (!txt) return null;
    // Cardmarket FR : « 31,98 € », « 1.234,56 € » (point = millier).
    let s = String(txt).replace(/[^\d.,]/g, '');
    if (!s) return null;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/\./g, '');
    const v = parseFloat(s);
    return Number.isFinite(v) ? v : null;
  };
  const title = (doc.title || '').replace(/\s*\|\s*Cardmarket\s*$/i, '').trim();
  if (/just a moment|un instant|attention required|checking your browser|verifying you are human/i.test(doc.title || ''))
    return { challenge: true };
  const row = doc.querySelector('#table-body .article-row') || doc.querySelector('.article-row');
  if (!row) {
    // Aucune offre : soit la fiche existe mais personne ne vend cette carte
    // dans ce filtre (français + NM), soit le slug a atterri sur la page de la
    // SÉRIE (fiche inexistante) — le second est un défaut d'appariement, pas
    // un marché vide, et l'app doit pouvoir les distinguer.
    const isProduct = !!(doc.querySelector('.info-list-container') || doc.querySelector('#tabContent-info'));
    return { price: null, reason: isProduct ? 'no-offer' : 'not-product', title };
  }
  const priceEl = row.querySelector('.price-container .color-primary')
               || row.querySelector('.color-primary.fw-bold')
               || row.querySelector('.color-primary');
  const attrs = row.querySelector('.product-attributes');
  const condEl = row.querySelector('.article-condition');
  const langEl = attrs && (attrs.querySelector('span[data-original-title]')
              || attrs.querySelector('span[data-bs-original-title]')
              || attrs.querySelector('span[title]:not([class*=condition])'));
  return {
    price: parseAmount(priceEl && priceEl.textContent),
    currency: 'EUR',
    // État réel de la PREMIÈRE offre (le filtre est « au moins NM » : ça peut
    // donc être Mint, jamais moins bien).
    cond: condEl ? (attr(condEl, 'title', 'data-original-title', 'data-bs-original-title')
                    || (condEl.textContent || '').trim()) : null,
    // Langue réelle de la première offre — doit dire « Français ».
    lang: attr(langEl, 'data-original-title', 'data-bs-original-title', 'title'),
    seller: (row.querySelector('.seller-name a') || {}).textContent || null,
    qty: parseInt(((row.querySelector('.item-count') || {}).textContent || '').trim(), 10) || null,
    title,
    offers: doc.querySelectorAll('.article-row').length,
  };
}
"""
# Voie RAPIDE (~0,4 s) : la page cardmarket.com lit une autre fiche par
# `fetch()` same-origin. Cloudflare la challenge quand l'IP a trop demandé —
# d'où la voie lente ci-dessous.
JS_FETCH = r"""
async ([url, extractSrc]) => {
  const extract = eval(extractSrc);
  let r, html;
  try { r = await fetch(url, { credentials: 'include' }); html = await r.text(); }
  catch (e) { return { error: String(e && e.message || e) }; }
  const out = extract(new DOMParser().parseFromString(html, 'text/html'));
  out.status = r.status;
  if (r.status === 404) { out.price = null; out.reason = 'not-found'; }
  return out;
}
"""
# Voie LENTE (~2-3 s) : vraie navigation. Cloudflare traite une visite bien
# plus favorablement qu'un XHR, et la navigation rafraîchit la clearance.
JS_LIVE = r"""
(extractSrc) => eval(extractSrc)(document)
"""


def normalize_url(raw: str) -> str | None:
    """Fiche produit Cardmarket + filtres FR/NM garantis, ou None si hors sujet.

    On n'accepte QUE les fiches produit : une URL de recherche ou la
    redirection prices.pokemontcg.io ne décrit pas une carte précise (et cette
    dernière est cross-origin, donc illisible depuis la page).
    """
    try:
        u = urllib.parse.urlparse(raw)
    except Exception:
        return None
    if not u.netloc.endswith('cardmarket.com'):
        return None
    if '/Products/Singles/' not in u.path:
        return None
    q = urllib.parse.parse_qs(u.query)
    q['language'] = ['2']       # cartes françaises
    q['minCondition'] = ['2']   # Near Mint minimum
    return urllib.parse.urlunparse(('https', 'www.cardmarket.com', u.path, '',
                                    urllib.parse.urlencode(q, doseq=True), ''))


class Bridge:
    """Une fenêtre de navigateur sur cardmarket.com, et une file d'attente.

    Deux choses comptent ici, et ce sont les deux mêmes : la CADENCE. Lire une
    fiche coûte ~400 ms, donc rien n'empêche techniquement d'en lire dix par
    seconde — mais Cloudflare recompte, et au bout de ~80 fiches à ce rythme il
    coupe et redemande un challenge (mesuré). On lit donc lentement, à une
    fiche à la fois par défaut, avec un intervalle minimum entre deux départs :
    une collection de 1 000 cartes se recote en ~20 min, sans se faire couper.
    """

    def __init__(self, browser: str, profile: str, concurrency: int, delay: float):
        self.browser, self.profile = browser, profile
        self.sem = asyncio.Semaphore(concurrency)
        self.delay = delay
        self.page = None
        self.ready = False
        self.served = 0
        self.blocked = 0            # fiches abandonnées faute de clearance
        self.challenges = 0         # nombre de challenges Cloudflare traversés
        self._clear_lock = asyncio.Lock()
        self._gate = asyncio.Lock()
        self._next_at = 0.0
        self.pw = None
        self._relaunch_lock = asyncio.Lock()
        self.relaunches = 0
        self.needs_human = False   # Cloudflare demande une action humaine
        self.fast = True            # voie rapide (fetch) autorisée
        self.fast_fails = 0         # challenges consécutifs sur la voie rapide
        self.nav_since_probe = 0    # navigations depuis le dernier test de la voie rapide

    async def start(self, pw):
        self.pw = pw
        self.ctx = await pw.chromium.launch_persistent_context(
            user_data_dir=self.profile,
            executable_path=self.browser,
            headless=False,                    # headless = blocage Cloudflare
            viewport={'width': 1180, 'height': 820},
            locale='fr-FR',
            args=['--disable-blink-features=AutomationControlled',
                  '--no-first-run', '--no-default-browser-check'],
        )
        self.page = self.ctx.pages[0] if self.ctx.pages else await self.ctx.new_page()
        await self._clear()

    async def _slot(self):
        """Espace les départs de requête (cadence globale, tous appels confondus)."""
        async with self._gate:
            loop = asyncio.get_running_loop()
            now = loop.time()
            wait = max(0.0, self._next_at - now)
            self._next_at = max(now, self._next_at) + self.delay
        if wait:
            await asyncio.sleep(wait)

    async def _clear(self, patience: float = 75.0):
        """Ouvre cardmarket.com et attend que Cloudflare rende la main.

        La fenêtre est VISIBLE exprès : si Cloudflare exige une case à cocher,
        l'utilisateur peut la cocher lui-même et la synchro reprend d'elle-même.
        """
        async with self._clear_lock:
            if self.ready:
                return True             # un autre appel vient de rétablir la clearance
            deadline = asyncio.get_running_loop().time() + patience
            tries = 0
            while asyncio.get_running_loop().time() < deadline:
                if tries:
                    await asyncio.sleep(3)
                tries += 1
                try:
                    await self.page.goto(HOME_URL, wait_until='domcontentloaded', timeout=45000)
                except Exception as e:
                    print(f'  navigation impossible : {e}', flush=True)
                    continue
                for _ in range(10):
                    t = (await self.page.title()) or ''
                    low = t.lower()
                    if 'cardmarket' in low and not any(k in low for k in ('instant', 'moment', 'attention required')):
                        self.ready = True
                        self.needs_human = False
                        return True
                    await asyncio.sleep(1.5)
                print('  challenge Cloudflare en cours — si une case à cocher '
                      'apparaît dans la fenêtre du navigateur, la cocher', flush=True)
            self.ready = False
            print('  clearance non obtenue : les cartes suivantes retombent sur '
                  'les moyennes (relancer plus tard pour les recoter)', flush=True)
            return False

    def _kill_orphans(self):
        """Tue les navigateurs restés accrochés à NOTRE profil, et enlève ses
        verrous.

        C'est LA raison pour laquelle une relance échouait : quand la fenêtre
        meurt, un processus Brave survit parfois en gardant `SingletonLock` du
        profil. Le Brave suivant voit ce verrou, passe la main à l'orphelin puis
        s'arrête — Playwright perd la connexion et le pont reste mort pour de
        bon. Le profil est le NÔTRE (`~/.irondex/cm-bridge-profile`) : on ne
        touche donc jamais au navigateur personnel de l'utilisateur.
        """
        try:
            out = subprocess.run(['pgrep', '-f', self.profile], capture_output=True, text=True).stdout
            mine = str(os.getpid())
            for pid in [p for p in out.split() if p and p != mine]:
                try: os.kill(int(pid), signal.SIGKILL)
                except Exception: pass
        except Exception:
            pass
        for name in ('SingletonLock', 'SingletonCookie', 'SingletonSocket'):
            try: os.unlink(os.path.join(self.profile, name))
            except Exception: pass

    async def watchdog(self, every: float = 20.0):
        """Surveille la fenêtre ET la clearance.

        Deux pannes distinctes, et la seconde m'avait échappé : une fenêtre
        MORTE (on relance), et une fenêtre VIVANTE à qui Cloudflare refuse la
        clearance. Dans ce second cas le pont restait « pas prêt » indéfiniment
        — le clic Sync refusait de partir sans que rien ne retente. On refait
        donc un passage de clearance, en espaçant les tentatives.
        """
        fails = 0
        while True:
            await asyncio.sleep(every * (1 + min(fails, 5)))   # 20 s → 2 min
            if not await self.alive():
                await self.ensure_alive()
                fails = 0
                continue
            if self.ready or self._clear_lock.locked():
                fails = 0
                continue
            ok = await self._clear(patience=45)
            fails = 0 if ok else fails + 1
            if fails == 2:
                print('  Cloudflare insiste : REGARDE LA FENÊTRE BRAVE du pont — '
                      's\'il y a une case « Vérifiez que vous êtes humain », coche-la, '
                      'la synchro repartira toute seule.', flush=True)
            self.needs_human = fails >= 2

    async def alive(self) -> bool:
        """La fenêtre du navigateur répond-elle encore ?

        Un simple drapeau ne suffit pas : la fenêtre peut être fermée à la main
        (ou plantée) alors que le pont se croit prêt. Il répondait alors
        `ready: true` en renvoyant des erreurs, et l'app retombait en silence
        sur les moyennes — le pire des deux mondes. On demande donc VRAIMENT
        son titre à la page, et on relance si elle ne répond plus.
        """
        try:
            if self.page is not None and not self.page.is_closed():
                await self.page.title()
                return True
        except Exception:
            pass
        return False

    async def ensure_alive(self) -> bool:
        if await self.alive():
            return True
        async with self._relaunch_lock:
            if await self.alive():
                return True         # un autre appel vient de relancer
            print('  fenêtre du navigateur fermée → relance', flush=True)
            self.ready = False
            self.relaunches += 1
            try:
                await self.ctx.close()
            except Exception:
                pass
            self._kill_orphans()
            try:
                await self.start(self.pw)
            except Exception as e:
                print(f'  relance impossible : {e}', flush=True)
                return False
        return self.ready

    async def price(self, raw_url: str) -> dict:
        url = normalize_url(raw_url)
        if not url:
            return {'ok': False, 'price': None, 'reason': 'not-product'}
        async with self.sem:
            await self._slot()
            if not await self.ensure_alive():
                self.blocked += 1
                return {'ok': False, 'price': None, 'reason': 'browser-down', 'url': url}
            if not self.ready and not await self._clear():
                self.blocked += 1
                return {'ok': False, 'price': None, 'reason': 'blocked', 'url': url}
            res = await self._eval(url)
            if res.get('challenge'):
                # Clearance périmée en pleine synchro : on la refait, puis on
                # réessaie CETTE fiche — elle ne doit pas être perdue pour si peu.
                self.challenges += 1
                self.ready = False
                if not await self._clear():
                    self.blocked += 1
                    return {'ok': False, 'price': None, 'reason': 'blocked', 'url': url}
                res = await self._eval(url)
                if res.get('challenge'):
                    self.blocked += 1
                    return {'ok': False, 'price': None, 'reason': 'blocked', 'url': url}
        self.served += 1
        out = {'ok': 'error' not in res, 'url': url}
        out.update(res)
        return out

    async def _eval_fetch(self, url: str) -> dict:
        try:
            return await self.page.evaluate(JS_FETCH, [url, JS_EXTRACT])
        except Exception as e:
            return {'error': str(e)[:200]}

    async def _eval_nav(self, url: str) -> dict:
        """Voie lente : on VISITE la fiche. Plus lent, mais Cloudflare
        challenge beaucoup moins une navigation qu'un XHR — et cette visite
        remet à jour la clearance pour les suivantes."""
        try:
            await self.page.goto(url, wait_until='domcontentloaded', timeout=45000)
            for _ in range(12):
                res = await self.page.evaluate(JS_LIVE, JS_EXTRACT)
                if not res.get('challenge'):
                    res['status'] = 200
                    return res
                await asyncio.sleep(1.5)   # challenge en cours de résolution
            return res
        except Exception as e:
            return {'error': str(e)[:200]}

    async def _eval(self, url: str) -> dict:
        """Voie rapide si elle est autorisée, voie lente sinon.

        Trois `fetch()` challengés d'affilée = l'IP est surveillée : on passe en
        navigation pour le reste de la synchro, en re-testant la voie rapide
        toutes les 30 fiches (le marquage Cloudflare finit par retomber).
        """
        if self.fast or self.nav_since_probe >= 30:
            res = await self._eval_fetch(url)
            if not res.get('challenge') and not res.get('error'):
                self.fast, self.fast_fails, self.nav_since_probe = True, 0, 0
                return res
            # Une erreur de fetch (réseau, page rechargée) n'est pas un signe de
            # surveillance : on retente simplement par navigation.
            if res.get('challenge'):
                self.fast_fails += 1
                self.nav_since_probe = 0
            if self.fast and self.fast_fails >= 3:
                self.fast = False
                print('  Cloudflare refuse la lecture directe → passage en '
                      'navigation (plus lent, plus sûr)', flush=True)
        self.nav_since_probe += 1
        return await self._eval_nav(url)


async def gather_prices(bridge: Bridge, urls) -> list:
    # `asyncio.gather` doit être construit DANS la boucle : le thread HTTP n'a
    # pas de boucle courante, il ne peut que soumettre une coroutine.
    return await asyncio.gather(*(bridge.price(u) for u in urls))


class Handler(BaseHTTPRequestHandler):
    bridge: Bridge = None
    loop: asyncio.AbstractEventLoop = None

    def log_message(self, *a):
        pass    # une ligne par carte noierait la sortie utile

    def _send(self, code: int, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        # L'app est servie depuis localhost:4599 (ou file://) : sans CORS
        # ouvert, le navigateur refuserait de lire la réponse.
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send(204, {})

    def _run(self, coro, timeout):
        return asyncio.run_coroutine_threadsafe(coro, Handler.loop).result(timeout=timeout)

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(u.query)
        if u.path == '/health':
            b = Handler.bridge
            # `alive` est un vrai aller-retour vers la page : c'est le seul moyen
            # de ne pas annoncer « prêt » avec une fenêtre morte. Si elle l'est,
            # on lance la relance en fond et on répond franchement « pas prêt ».
            alive = self._run(b.alive(), 10)
            if not alive:
                asyncio.run_coroutine_threadsafe(b.ensure_alive(), Handler.loop)
            return self._send(200, {'ok': True, 'ready': bool(b.ready and alive), 'alive': alive,
                                    'relaunches': b.relaunches, 'served': b.served,
                                    'blocked': b.blocked, 'challenges': b.challenges,
                                    'needsHuman': b.needs_human,
                                    'delay': b.delay, 'mode': 'fetch' if b.fast else 'navigation',
                                    'browser': os.path.basename(b.browser)})
        if u.path == '/price':
            url = (q.get('url') or [''])[0]
            if not url:
                return self._send(400, {'ok': False, 'reason': 'missing url'})
            try:
                return self._send(200, self._run(Handler.bridge.price(url), 90))
            except Exception as e:
                return self._send(200, {'ok': False, 'reason': 'bridge-error', 'error': str(e)[:200]})
        self._send(404, {'ok': False})

    def do_POST(self):
        u = urllib.parse.urlparse(self.path)
        if u.path != '/prices':
            return self._send(404, {'ok': False})
        try:
            n = int(self.headers.get('Content-Length') or 0)
            urls = (json.loads(self.rfile.read(n) or '{}') or {}).get('urls') or []
        except Exception:
            return self._send(400, {'ok': False, 'reason': 'bad json'})
        urls = [str(x) for x in urls][:200]
        try:
            res = self._run(gather_prices(Handler.bridge, urls), 30 + 8 * len(urls))
            return self._send(200, {'ok': True, 'prices': res})
        except Exception as e:
            return self._send(200, {'ok': False, 'reason': 'bridge-error', 'error': str(e)[:200]})


async def main():
    ap = argparse.ArgumentParser(description='Pont Cardmarket (premier prix FR / Near Mint) pour IronDex')
    ap.add_argument('--port', type=int, default=4610)
    ap.add_argument('--profile', default=DEFAULT_PROFILE,
                    help='profil navigateur dédié (garde la clearance Cloudflare d\'une session à l\'autre)')
    ap.add_argument('--browser', default=None, help='chemin du binaire Chromium/Brave/Chrome')
    # Une fiche à la fois, une par seconde : au-delà, Cloudflare coupe au bout
    # d'environ 80 fiches (mesuré à ~2/s) et redemande un challenge. À cette
    # cadence, 1 000 cartes se recotent en ~20 min sans jamais se faire couper.
    ap.add_argument('--concurrency', type=int, default=1)
    ap.add_argument('--delay', type=float, default=1.0,
                    help='secondes minimum entre deux fiches (baisser = risque de blocage)')
    args = ap.parse_args()

    browser = args.browser or next((b for b in BROWSERS if os.path.exists(b)), None)
    if not browser:
        sys.exit('aucun navigateur Chromium trouvé — installer Brave ou Chrome, ou passer --browser <chemin>')
    os.makedirs(args.profile, exist_ok=True)

    async with async_playwright() as pw:
        bridge = Bridge(browser, args.profile, args.concurrency, args.delay)
        bridge._kill_orphans()      # reste d'une session précédente
        print(f'navigateur : {browser}')
        print('ouverture de cardmarket.com (Cloudflare, ~5 s)…', flush=True)
        await bridge.start(pw)
        print('clearance OK' if bridge.ready else 'clearance NON obtenue (résoudre le captcha dans la fenêtre)')

        Handler.bridge, Handler.loop = bridge, asyncio.get_running_loop()
        srv = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        asyncio.create_task(bridge.watchdog())
        print(f'pont prêt sur http://127.0.0.1:{args.port}  ·  cliquer « Sync » dans IronDex')
        print('laisser cette fenêtre (et le navigateur) ouverts pendant la synchro — Ctrl+C pour arrêter')
        try:
            while True:
                await asyncio.sleep(3600)
        except (KeyboardInterrupt, asyncio.CancelledError):
            pass
        finally:
            srv.shutdown()
            await bridge.ctx.close()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print('\narrêt')
