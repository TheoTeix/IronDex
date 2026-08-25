#!/usr/bin/env python3
"""Reconstruit cm-slugs.json — la base locale idProduct → slug Cardmarket.

À relancer quand de nouveaux sets sortent (les cartes des sets absents de la
base retombent sur les résolveurs réseau, plus lents et sous quota) :

    pip3 install pycryptodome
    python3 scripts/build_cm_slugs.py          # ~4 min, écrit cm-slugs.json

Source : les pages séries publiques de pokecardex.com, qui embarquent pour
chaque carte l'idProduct Cardmarket (id_cardmarket) et le slug exact de la
fiche (cardmarket_url). Les données sont chiffrées AES-CBC dans le HTML avec
une clé embarquée dans leur bundle JS — si la clé change, la récupérer dans
leur bundle (chercher `AES-CBC` puis la constante passée à TextEncoder).

Index produits :
  byId  : idProduct Cardmarket (fourni par TCGdex pricing) → slug ;
  byNum : « CODE#numéro » (nom_court + numéro sans zéros de tête) → slug,
          clés ambiguës retirées.
"""
import json, re, base64, time, subprocess, sys
from pathlib import Path

try:
    from Crypto.Cipher import AES
except ImportError:
    sys.exit("pycryptodome manquant : pip3 install pycryptodome")

KEY = b'oe61R0RgVTJm9omokoKuRem2N2GUbUZ8'
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'cm-slugs.json'

def fetch(url):
    return subprocess.run(['curl', '-s', '-m', '25', '-A', UA, url],
                          capture_output=True, text=True).stdout

def decrypt(blob):
    iv = base64.b64decode(blob['iv'])
    data = base64.b64decode(blob['data'])
    dec = AES.new(KEY, AES.MODE_CBC, iv).decrypt(data)
    return json.loads(dec[:-dec[-1]])

def embedded(html):
    m = re.search(r'window\.__INITIAL_DATA_ENCRYPTED__ = (\{.*?\});', html, re.S)
    return decrypt(json.loads(m.group(1))) if m else None

def num_key(x):
    m = re.match(r'^([A-Za-z]*)0*(\d+)$', str(x or '').strip())
    return (m.group(1).upper() + m.group(2)) if m else str(x or '').strip().upper()

# 1) liste des séries internationales (menu embarqué dans n'importe quelle page)
seed = embedded(fetch('https://www.pokecardex.com/series/SSP'))
codes = [s['shortName'] for b in seed['seriesMenu']['blocksByRegion']['FR'] for s in b['series']]
print(f'{len(codes)} séries internationales')

# 2) moisson
by_id, by_num, ambiguous = {}, {}, set()
for i, code in enumerate(codes):
    try:
        obj = embedded(fetch(f'https://www.pokecardex.com/series/{code}'))
        cartes = obj.get('cartes', []) if obj else []
    except Exception as e:
        print(f'[{i+1}/{len(codes)}] {code}: ERREUR {e}'); continue
    for c in cartes:
        slug = c.get('cardmarket_url')
        if not slug:
            continue
        if c.get('id_cardmarket'):
            by_id.setdefault(str(c['id_cardmarket']), slug)
        short, num = c.get('nom_court'), c.get('num_card')
        if short and num:
            nk = f"{short.upper()}#{num_key(str(num).split('/')[0])}"
            if nk in by_num and by_num[nk] != slug:
                ambiguous.add(nk)
            else:
                by_num[nk] = slug
    print(f'[{i+1}/{len(codes)}] {code}: {len(cartes)} cartes', flush=True)
    time.sleep(0.35)

for k in ambiguous:
    by_num.pop(k, None)

payload = json.dumps({'byId': by_id, 'byNum': by_num}, separators=(',', ':'))
OUT.write_text(payload)
# Variante <script> : seule voie de chargement qui marche quand l'app est
# ouverte en file:// (fetch de fichiers locaux interdit par le navigateur).
(ROOT / 'cm-slugs.js').write_text('window.CM_SLUGS=' + payload + ';')
print(f'byId: {len(by_id)}, byNum: {len(by_num)} (ambiguës retirées : {len(ambiguous)})')
print(f'écrit : {OUT} + cm-slugs.js ({OUT.stat().st_size/1e6:.2f} Mo chacun)')
