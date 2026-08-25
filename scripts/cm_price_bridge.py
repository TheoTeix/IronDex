#!/usr/bin/env python3
"""PONT CARDMARKET — le PREMIER PRIX de la fiche, en français et Near Mint.

    pip3 install curl_cffi          # requis
    pip3 install playwright         # requis seulement pour « --login »

    python3 scripts/cm_price_bridge.py            # tourne EN FOND, aucune fenêtre
    python3 scripts/cm_price_bridge.py --login    # renouvelle l'accès (1 fenêtre, ~10 s)

AUCUNE FENÊTRE EN USAGE NORMAL
------------------------------
La version précédente gardait un navigateur ouvert en permanence, parce que
Cloudflare refuse curl, les proxys CORS et le mode headless. Ça marchait, mais
ça imposait une fenêtre à l'écran — inacceptable au quotidien.

Ce que le test a montré : le blocage ne porte pas sur le client HTTP, il porte
sur la CLEARANCE. Avec le cookie `cf_clearance` obtenu une fois par un vrai
navigateur, le même User-Agent et l'empreinte TLS de Chrome
(`curl_cffi impersonate="chrome"`), une requête HTTP pure ramène la fiche
complète (200, table d'offres présente — vérifié). Le navigateur ne sert donc
plus qu'à FABRIQUER ce cookie, et seulement quand l'utilisateur lance `--login`.

Conséquences :
  · usage normal : ZÉRO fenêtre, aucun Chromium en mémoire, ~0,3 s par fiche ;
  · quand la clearance expire, le pont ne bricole pas : il le DIT
    (`/health → needsLogin`), l'app le répète, et l'utilisateur relance
    `--login` quand ça l'arrange.

Les cookies vivent dans ~/.irondex/cm-cookies.json (jamais dans le dépôt).
Le pont reste FACULTATIF : sans lui, IronDex retombe sur les moyennes des API.
"""
import argparse
import json
import os
import re
import sys
import threading
import time
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

try:
    from curl_cffi import requests as curl_requests
except ImportError:
    sys.exit("curl_cffi manquant : pip3 install curl_cffi")

HOME_URL = 'https://www.cardmarket.com/fr/Pokemon'
COOKIE_FILE = os.path.expanduser('~/.irondex/cm-cookies.json')
PROFILE = os.path.expanduser('~/.irondex/cm-bridge-profile')
# `--login` a besoin d'un navigateur INSTALLÉ (le Chromium de Playwright ne
# passe pas Cloudflare). On couvre macOS, Windows et Linux : le pont peut ainsi
# tourner sur un PC tour comme sur le Mac.
BROWSERS = [
    # macOS
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    # Windows
    r'C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe',
    r'C:\Program Files (x86)\BraveSoftware\Brave-Browser\Application\brave.exe',
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    os.path.expandvars(r'%LOCALAPPDATA%\BraveSoftware\Brave-Browser\Application\brave.exe'),
    os.path.expandvars(r'%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe'),
    # Linux
    '/usr/bin/brave-browser', '/usr/bin/google-chrome', '/usr/bin/chromium',
    '/usr/bin/chromium-browser', '/snap/bin/chromium',
]
UA_FALLBACK = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
               '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36')
CHALLENGE_RE = re.compile(r'just a moment|un instant|attention required|checking your browser'
                          r'|verifying you are human', re.I)

# ── LECTURE DE LA PREMIÈRE OFFRE, dans le HTML BRUT ────────────────────
# Plus de navigateur pour exécuter du JS : on lit le HTML tel qu'il arrive. Les
# lignes d'offres y sont dans l'ordre, donc on borne la recherche à la PREMIÈRE
# ligne — sinon le prix d'une ligne et la langue d'une autre se mélangeraient.
ROW_RE = re.compile(r'<div id="articleRow\d+"')
PRICE_RE = re.compile(r'class="color-primary[^"]*fw-bold[^"]*">\s*([\d.,]+)\s*(?:&nbsp;|\s)*€', re.I)
PRICE_RE2 = re.compile(r'class="color-primary[^"]*">\s*([\d.,]+)\s*(?:&nbsp;|\s)*€', re.I)
COND_RE = re.compile(r'class="article-condition[^"]*"[^>]*title="([^"]+)"'
                     r'|title="([^"]+)"[^>]*class="article-condition', re.I)
LANG_RE = re.compile(r'showMsgBox\(this,\s*`([^`]+)`\)')
SELLER_RE = re.compile(r'/fr/Pokemon/Users/([^"?]+)"')
OG_IMG_RE = re.compile(r'<meta[^>]+property="og:image"[^>]+content="([^"]+)"', re.I)
TITLE_RE = re.compile(r'<title>(.*?)</title>', re.S | re.I)
PRODUCT_RE = re.compile(r'info-list-container|tabContent-info', re.I)


def parse_amount(txt):
    """« 31,98 » / « 1.234,56 » → float (le point est un séparateur de milliers)."""
    if not txt:
        return None
    s = re.sub(r'[^\d.,]', '', txt)
    if not s:
        return None
    s = s.replace('.', '').replace(',', '.') if ',' in s else s.replace('.', '')
    try:
        return float(s)
    except ValueError:
        return None


def extract(html: str) -> dict:
    title = ''
    m = TITLE_RE.search(html)
    if m:
        title = re.sub(r'\s*\|\s*Cardmarket\s*$', '', m.group(1)).strip()
    if CHALLENGE_RE.search(title):
        return {'challenge': True}
    img = None
    m = OG_IMG_RE.search(html)
    if m:
        # Visuel du produit : TCGdex n'illustre pas certains sets entiers (les
        # Galeries de Dresseurs), l'app affichait un trou.
        img = m.group(1)
    rows = len(ROW_RE.findall(html))
    if not rows:
        # Pas d'offre : soit la fiche existe et personne ne vend dans ce filtre,
        # soit le slug a atterri sur la page de la SÉRIE (défaut d'appariement).
        return {'price': None, 'title': title, 'img': img,
                'reason': 'no-offer' if PRODUCT_RE.search(html) else 'not-product'}
    first = ROW_RE.search(html)
    nxt = ROW_RE.search(html, first.end())
    block = html[first.start():(nxt.start() if nxt else min(len(html), first.start() + 12000))]
    price = None
    for rx in (PRICE_RE, PRICE_RE2):
        m = rx.search(block)
        if m:
            price = parse_amount(m.group(1))
            break
    m = COND_RE.search(block)
    cond = (m.group(1) or m.group(2)) if m else None
    m = LANG_RE.search(block)
    lang = m.group(1) if m else None
    m = SELLER_RE.search(block)
    seller = urllib.parse.unquote(m.group(1)) if m else None
    return {'price': price, 'currency': 'EUR', 'cond': cond, 'lang': lang,
            'seller': seller, 'title': title, 'img': img, 'offers': rows}


def normalize_url(raw: str):
    """Fiche produit Cardmarket + filtres FR/NM garantis, ou None si hors sujet."""
    try:
        u = urllib.parse.urlparse(raw)
    except Exception:
        return None
    if not u.netloc.endswith('cardmarket.com') or '/Products/Singles/' not in u.path:
        return None
    q = urllib.parse.parse_qs(u.query)
    q['language'] = ['2']       # cartes françaises
    q['minCondition'] = ['2']   # Near Mint minimum
    return urllib.parse.urlunparse(('https', 'www.cardmarket.com', u.path, '',
                                    urllib.parse.urlencode(q, doseq=True), ''))


# ── CLEARANCE ──────────────────────────────────────────────────────────
def load_cookies():
    try:
        with open(COOKIE_FILE) as f:
            d = json.load(f)
        return d.get('ua') or UA_FALLBACK, d.get('cookies') or {}, d.get('at') or 0
    except Exception:
        return UA_FALLBACK, {}, 0


def save_cookies(ua, cookies):
    os.makedirs(os.path.dirname(COOKIE_FILE), exist_ok=True)
    tmp = COOKIE_FILE + '.tmp'
    with open(tmp, 'w') as f:
        json.dump({'ua': ua, 'cookies': cookies, 'at': int(time.time())}, f)
    os.replace(tmp, COOKIE_FILE)          # écriture atomique
    try:
        os.chmod(COOKIE_FILE, 0o600)      # ce fichier vaut une session
    except Exception:
        pass


def do_login(headless=True, quiet=False):
    """Renouvelle la clearance et l'enregistre. INVISIBLE par défaut.

    Le pont le fait tout seul : l'utilisateur clique « Sync », ça marche, point.
    Mesuré : avec le profil déjà chaud (cookies et historique de session) et un
    User-Agent de Chrome normal, le mode HEADLESS obtient la clearance en ~1,4 s.
    C'est l'inverse du premier essai de la journée, où un profil VIDE + l'UA
    « HeadlessChrome » se faisaient refuser — d'où la fenêtre visible de la
    version précédente, désormais inutile.

    `headless=False` reste le dernier recours (fenêtre réduite dès l'ouverture),
    et `--login` le geste manuel si Cloudflare exige vraiment un humain.
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print('playwright manquant pour --login : pip3 install playwright')
        return False
    browser = next((b for b in BROWSERS if os.path.exists(b)), None)
    if not browser:
        print('aucun navigateur Chromium trouvé (Brave, Chrome, Chromium, Edge)')
        return False
    os.makedirs(PROFILE, exist_ok=True)
    # Un verrou resté d'une session tuée empêcherait le lancement (mesuré).
    for name in ('SingletonLock', 'SingletonCookie', 'SingletonSocket'):
        try:
            os.unlink(os.path.join(PROFILE, name))
        except Exception:
            pass
    if not quiet:
        print('renouvellement de l’accès Cardmarket'
              + ('…' if headless else ' (fenêtre réduite)…'), flush=True)
    ok = False
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            user_data_dir=PROFILE, executable_path=browser, headless=headless,
            viewport={'width': 1200, 'height': 820}, locale='fr-FR',
            # UA d'un Chrome normal : en headless, l'UA par défaut contient
            # « HeadlessChrome » et Cloudflare le refuse. C'est LA différence
            # entre l'échec du premier essai et le succès actuel.
            user_agent=UA_FALLBACK if headless else None,
            args=['--disable-blink-features=AutomationControlled', '--no-first-run',
                  '--no-default-browser-check'])
        pg = ctx.pages[0] if ctx.pages else ctx.new_page()
        for extra in ctx.pages[1:]:
            try:
                extra.close()
            except Exception:
                pass
        if not headless:
            # Repli visible : on la met dans le Dock dès l'ouverture, elle n'a
            # pas à s'imposer à l'écran.
            try:
                cdp = ctx.new_cdp_session(pg)
                info = cdp.send('Browser.getWindowForTarget')
                cdp.send('Browser.setWindowBounds',
                         {'windowId': info['windowId'], 'bounds': {'windowState': 'minimized'}})
                cdp.detach()
            except Exception:
                pass
        try:
            pg.goto(HOME_URL, wait_until='domcontentloaded', timeout=60000)
            for i in range(64 if not headless else 14):
                t = (pg.title() or '')
                if 'Cardmarket' in t and not CHALLENGE_RE.search(t):
                    ok = True
                    break
                if i == 12 and not headless:
                    print('Cloudflare demande peut-être une case à cocher : la fenêtre est '
                          'dans le Dock, ouvre-la et coche — j’attends.')
                time.sleep(1.5)
            if ok:
                ua = pg.evaluate('navigator.userAgent')
                cks = {c['name']: c['value'] for c in ctx.cookies() if 'cardmarket' in c['domain']}
                if 'cf_clearance' not in cks:
                    print('clearance absente des cookies — réessaie')
                    ok = False
                else:
                    save_cookies(ua, cks)
                    print(f'accès renouvelé ({len(cks)} cookies) → {COOKIE_FILE}')
        finally:
            try:
                ctx.close()
            except Exception:
                pass
    return ok


class Bridge:
    """Client HTTP pur : aucune fenêtre, aucun navigateur en mémoire.

    La CADENCE reste le sujet : à ~2 fiches/s Cloudflare finit par couper. Une
    fiche à la fois, une par seconde (≈ 20 min pour 1 300 cartes).
    """

    def __init__(self, delay: float):
        self.delay = delay
        self.ua, self.cookies, self.cookies_at = load_cookies()
        self.lock = threading.Lock()      # un seul appel HTTP à la fois
        self.gate = threading.Lock()
        self.next_at = 0.0
        self.served = self.blocked = self.challenges = self.renewals = 0
        self.renew_lock = threading.Lock()
        self.needs_login = 'cf_clearance' not in self.cookies

    def _slot(self):
        with self.gate:
            now = time.monotonic()
            wait = max(0.0, self.next_at - now)
            self.next_at = max(now, self.next_at) + self.delay
        if wait:
            time.sleep(wait)

    def _get(self, url: str):
        r = curl_requests.get(
            url, cookies=self.cookies, impersonate='chrome', timeout=35,
            headers={'User-Agent': self.ua, 'Accept-Language': 'fr-FR,fr;q=0.9',
                     'Referer': HOME_URL})
        # Cloudflare fait tourner `__cf_bm` : garder les cookies à jour évite de
        # périmer la session plus vite que nécessaire.
        try:
            fresh = dict(r.cookies.items())
            if fresh and any(self.cookies.get(k) != v for k, v in fresh.items()):
                self.cookies.update(fresh)
                save_cookies(self.ua, self.cookies)
        except Exception:
            pass
        return r

    def can_renew(self) -> bool:
        """Le renouvellement automatique est-il possible ici ?

        Sert à répondre « prêt » au contrôle de santé même si la clearance vient
        d'expirer : l'app ne doit pas refuser la synchro pour quelque chose que
        le pont sait réparer tout seul en une seconde et demie.
        """
        try:
            import playwright  # noqa: F401
        except Exception:
            return False
        return any(os.path.exists(b) for b in BROWSERS)

    def renew(self) -> bool:
        """Renouvelle la clearance sans rien demander à personne.

        D'abord en headless (invisible, ~1,5 s) ; si Cloudflare refuse, une
        fenêtre réduite dans le Dock. L'utilisateur clique « Sync », ça marche —
        il n'a pas à lancer une commande au milieu de sa synchro.
        """
        with self.renew_lock:
            # Un autre thread vient peut-être de le faire.
            if not self.needs_login:
                return True
            for headless in (True, False):
                try:
                    if do_login(headless=headless, quiet=False):
                        self.ua, self.cookies, self.cookies_at = load_cookies()
                        self.needs_login = 'cf_clearance' not in self.cookies
                        self.renewals += 1
                        if not self.needs_login:
                            print('  accès renouvelé tout seul'
                                  + (' (invisible)' if headless else ' (fenêtre réduite)'), flush=True)
                            return True
                except Exception as e:
                    print(f'  renouvellement impossible : {str(e)[:80]}', flush=True)
            return False

    def keepalive(self, every: float = 480.0):
        """Touche le site toutes les 8 minutes : `__cf_bm` glisse de 30 min, et
        une session entretenue expire beaucoup plus rarement en pleine synchro."""
        while True:
            time.sleep(every)
            if self.needs_login:
                self.renew()
                continue
            try:
                with self.lock:
                    r = self._get(HOME_URL)
                if r.status_code == 403 or CHALLENGE_RE.search(r.text[:3000] or ''):
                    self.needs_login = True
                    self.renew()
            except Exception:
                pass

    def price(self, raw_url: str) -> dict:
        url = normalize_url(raw_url)
        if not url:
            return {'ok': False, 'price': None, 'reason': 'not-product'}
        if self.needs_login and not self.renew():
            self.blocked += 1
            return {'ok': False, 'price': None, 'reason': 'login-required', 'url': url}
        with self.lock:
            self._slot()
            try:
                r = self._get(url)
            except Exception as e:
                return {'ok': False, 'price': None, 'reason': f'réseau : {str(e)[:60]}', 'url': url}
            if r.status_code == 404:
                self.served += 1
                return {'ok': True, 'price': None, 'reason': 'not-found', 'url': url, 'status': 404}
            res = extract(r.text or '')
            if res.get('challenge') or r.status_code == 403:
                self.challenges += 1
                self.needs_login = True
                print('  clearance expirée → renouvellement automatique', flush=True)
                if not self.renew():
                    self.blocked += 1
                    return {'ok': False, 'price': None, 'reason': 'login-required', 'url': url}
                try:
                    r = self._get(url)                     # deuxième chance, accès neuf
                except Exception as e:
                    return {'ok': False, 'price': None, 'reason': f'réseau : {str(e)[:60]}', 'url': url}
                res = extract(r.text or '')
                if res.get('challenge') or r.status_code == 403:
                    self.blocked += 1
                    return {'ok': False, 'price': None, 'reason': 'login-required', 'url': url}
        self.served += 1
        out = {'ok': True, 'url': url, 'status': r.status_code}
        out.update(res)
        return out


class Handler(BaseHTTPRequestHandler):
    bridge: Bridge = None

    def log_message(self, *a):
        pass    # une ligne par carte noierait la sortie utile

    def _send(self, code: int, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        # L'app est servie depuis une autre origine (github.io, localhost) :
        # sans CORS ouvert, le navigateur refuserait de lire la réponse.
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send(204, {})

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(u.query)
        b = Handler.bridge
        if u.path == '/health':
            # Clearance expirée MAIS renouvelable = prêt : on lance la
            # réparation en fond et l'app peut y aller, la première fiche
            # attendra simplement une seconde de plus.
            if b.needs_login and b.can_renew():
                threading.Thread(target=b.renew, daemon=True).start()
            return self._send(200, {
                'ok': True, 'ready': (not b.needs_login) or b.can_renew(),
                'alive': True, 'mode': 'http',
                'needsLogin': b.needs_login and not b.can_renew(),
                'clearanceAgeMin': ((int(time.time()) - b.cookies_at) // 60) if b.cookies_at else None,
                'served': b.served, 'blocked': b.blocked, 'challenges': b.challenges,
                'renewals': b.renewals, 'delay': b.delay,
            })
        if u.path == '/price':
            url = (q.get('url') or [''])[0]
            if not url:
                return self._send(400, {'ok': False, 'reason': 'missing url'})
            return self._send(200, b.price(url))
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
        self._send(200, {'ok': True, 'prices': [Handler.bridge.price(str(x)) for x in urls[:200]]})


def main():
    ap = argparse.ArgumentParser(description='Pont Cardmarket (premier prix FR / Near Mint)')
    ap.add_argument('--port', type=int, default=4610)
    ap.add_argument('--login', action='store_true',
                    help='ouvre un navigateur pour renouveler l’accès Cardmarket, puis quitte')
    # Une fiche par seconde : au-delà, Cloudflare coupe (mesuré vers 2/s).
    ap.add_argument('--delay', type=float, default=1.0,
                    help='secondes minimum entre deux fiches (baisser = risque de blocage)')
    args = ap.parse_args()

    if args.login:
        # Geste manuel : fenêtre visible, l'utilisateur peut cocher une case.
        sys.exit(0 if do_login(headless=False) else 1)

    bridge = Bridge(args.delay)
    Handler.bridge = bridge
    srv = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    threading.Thread(target=bridge.keepalive, daemon=True).start()
    if bridge.needs_login:
        print('aucun accès enregistré : je le fabrique…')
        bridge.renew()
    if bridge.needs_login:
        print('Cloudflare a résisté. Dernier recours, une fois :')
        print('  python3 scripts/cm_price_bridge.py --login')
    else:
        print(f'accès Cardmarket en place (obtenu il y a '
              f'{(int(time.time()) - bridge.cookies_at) // 60} min)')
    print(f'pont prêt sur http://127.0.0.1:{args.port} — aucune fenêtre, requêtes HTTP seules')
    print('Ctrl+C pour arrêter')
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print('\narrêt')
    finally:
        srv.shutdown()


if __name__ == '__main__':
    main()
