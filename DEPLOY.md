# Mettre IronDex en ligne (GitHub Pages) et le garder à jour

Trois choses à comprendre avant de commencer :

1. **Pages héberge le CODE.** Le site est une page statique : GitHub ne fait
   tourner aucun serveur pour toi.
2. **Le dépôt stocke aussi tes DONNÉES.** L'app écrit ta collection dans
   `data/collection.json` et tes cotes dans `data/prices.json`, via l'API
   GitHub. C'est ça qui remplace les sauvegardes fragiles du navigateur : le
   Mac et l'iPhone lisent le même fichier, et chaque enregistrement est un
   commit qu'on peut rouvrir.
3. **Le pont Cardmarket reste sur le Mac.** Cloudflare exige un vrai
   navigateur, donc les cotes se calculent sur le Mac (bouton Sync), puis
   partent dans le dépôt. L'iPhone les lit, il n'a rien à calculer.

---

## 1. Créer le dépôt et pousser (une seule fois)

Le dossier est déjà un dépôt git avec un premier commit. Il reste à créer le
dépôt distant et à l'y envoyer.

Sur github.com : **New repository** → nom `IronDex` → **Public** → *ne coche
rien* (pas de README, pas de .gitignore) → **Create**.

Puis, dans le dossier du projet :

```bash
git remote add origin https://github.com/<TON-COMPTE>/IronDex.git
git branch -M main
git push -u origin main
```

GitHub demandera un mot de passe : ce n'est pas celui du compte, c'est un
**jeton**. Celui de l'étape 3 fait l'affaire (ou laisse macOS retenir le
premier que tu colles).

## 2. Activer Pages

Dans le dépôt : **Settings › Pages** → *Source* : **Deploy from a branch** →
branche `main`, dossier `/ (root)` → **Save**.

Une minute plus tard, le site est sur :

```
https://<TON-COMPTE>.github.io/IronDex/
```

C'est l'URL à ouvrir sur le Mac **et** sur l'iPhone. Le `file://` d'avant peut
être oublié.

## 3. Créer le jeton d'accès

C'est lui qui autorise l'app à écrire ta collection dans le dépôt.

github.com › **Settings › Developer settings › Personal access tokens ›
Fine-grained tokens › Generate new token** :

| Champ | Valeur |
|---|---|
| Token name | `irondex` |
| Expiration | 1 an (à renouveler ; l'app te dira « 401 » le jour où il expire) |
| Repository access | **Only select repositories** → `IronDex` |
| Permissions › Repository › **Contents** | **Read and write** |

Génère, **copie le jeton** (il ne s'affiche qu'une fois).

## 4. Brancher l'app sur le dépôt

Sur le site, en haut à droite : l'icône **nuage** → « Coffre en ligne ».

1. Colle le jeton. Le compte, le dépôt et la branche sont déjà devinés depuis
   l'URL — corrige-les seulement s'ils sont faux.
2. **Vérifier et enregistrer** : l'app lit le dépôt, contrôle que le jeton a le
   droit d'écrire, puis écrit vraiment un fichier témoin. Elle dit exactement
   ce qui bloque s'il y a un problème.
3. **Envoyer maintenant** : ta collection et tes cotes partent dans le dépôt.

À partir de là, chaque modification déclenche un commit ~4 s plus tard. La
pastille du nuage dit où on en est : vert = en ligne, jaune = envoi en cours,
rouge = échec (avec un toast qui explique).

Le jeton reste dans le `localStorage` de l'appareil. Il n'est **jamais** écrit
dans le dépôt, qui est public. S'il fuite, révoque-le sur GitHub et recolle-en
un nouveau : le pire qu'on puisse en faire est d'écrire dans ce seul dépôt.

## 5. Installer sur l'iPhone

1. Ouvre l'URL dans **Safari** (pas Chrome : lui ne sait pas installer).
2. **Partager › Sur l'écran d'accueil**.
3. Ouvre l'app depuis l'icône : plein écran, sans barre Safari.
4. Icône nuage → colle le **même jeton** → « Vérifier et enregistrer ».

La collection arrive toute seule : un appareil vide se remplit depuis le dépôt.
Ensuite, le plus récent gagne — modifie sur l'iPhone, le Mac le verra à sa
prochaine ouverture, et inversement.

Deux réflexes utiles : si tu modifies au même moment sur les deux appareils, le
dernier envoi écrase le précédent (l'ancien reste dans l'historique git) ; et
un appareil hors ligne garde ses modifications en local, il les enverra au
retour du réseau.

---

## Le cycle quotidien : j'ai changé quelque chose, et maintenant ?

**Tes données** : rien à faire. Elles partent automatiquement.

**Le code** (quand on modifie `app.js`, `style.css`, `index.html`) :

```bash
git pull --rebase        # l'app commite elle aussi (dans data/) : on récupère d'abord
git add -A
git commit -m "ce que j'ai changé"
git push
```

Compte 30 à 60 secondes avant que Pages serve la nouvelle version.

Une seule règle à ne pas oublier : quand `app.js` ou `style.css` change, il
faut **monter le numéro de version** dans `index.html` —

```html
<link rel="stylesheet" href="style.css?v=ui9">
<script src="app.js?v=ui9"></script>
```

Sans ça, les navigateurs (et surtout l'app installée sur l'iPhone) continuent
de servir l'ancien fichier depuis leur cache : on croit que le changement n'a
pas marché alors qu'il n'est jamais arrivé. Le `sw.js` liste aussi ces deux
URL — même version.

## Mettre les cotes à jour

Sur le **Mac** uniquement :

```bash
python3 scripts/cm_price_bridge.py
```

Aucune fenêtre ne s'ouvre : le pont fait des requêtes HTTP, avec l'accès
Cardmarket enregistré dans `~/.irondex/cm-cookies.json`. Clique **Sync** dans
l'app ; la ligne sous « Synchronisation des cotes » doit dire « premier prix
FR · Near Mint ». Compte ~20 min pour 1 300 cartes. À la fin, les cotes partent
dans le dépôt : l'iPhone les aura sans rien faire.

Quand l'accès expire (Cloudflare le fait tourner), le pont le dit et l'app
aussi. Une seule commande, une fenêtre de 10 s, et c'est reparti :

```bash
python3 scripts/cm_price_bridge.py --login
```

Si tu cliques Sync sans le pont, l'app refuse et te le dit — elle ne remplacera
pas tes vrais prix français par des moyennes toutes langues sans te demander.

## Ce qui ne monte pas en ligne (et pourquoi)

`.gitignore` écarte : les `*.bak`, `.DS_Store`, les dossiers de travail
(`.redesign-backup`, `.impeccable`, `sauvegardes-recuperees`), les exports
locaux (`milodex-sauvegarde.json`, `irondex-restauration-*.json`) et
`cm-slugs.json` — ce dernier est un doublon de `cm-slugs.js` (2 Mo pour rien,
l'app charge le `.js`).

Ce qui monte : l'app (≈ 26 Mo, surtout les modèles 3D), et `data/` que l'app
gère elle-même.

## Si quelque chose cloche

| Symptôme | Cause la plus probable |
|---|---|
| Le site affiche une vieille version | version `?v=` pas montée, ou cache de l'app installée : ferme-la et réouvre-la |
| Pastille nuage rouge | jeton expiré (401), permission Contents manquante, ou hors ligne — le message du toast le dit |
| L'iPhone n'a pas les dernières cotes | la synchro n'a pas été relancée sur le Mac depuis |
| « pont Cardmarket éteint » | le script `cm_price_bridge.py` ne tourne pas sur ce Mac |
| Collection vide sur un appareil | jeton pas encore collé sur cet appareil, ou dépôt sans `data/collection.json` |
