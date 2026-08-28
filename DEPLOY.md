# Mettre IronDex en ligne et le garder à jour

Deux choses vivent séparément, et c'est tout le changement depuis la version
« tout dans le dépôt » :

1. **Le CODE est sur GitHub Pages.** Le site est une page statique : GitHub ne
   fait tourner aucun serveur. Pousser du code, c'est `git push`, point.
2. **Les DONNÉES sont dans Postgres (Supabase), liées à un compte.** La
   collection, les wishlists et les cotes n'existent plus dans le dépôt. Elles
   appartiennent au compte connecté, et Postgres refuse de les servir à
   quelqu'un d'autre (Row Level Security).
3. **Le pont Cardmarket reste sur le Mac.** Cloudflare exige un vrai
   navigateur : les cotes se calculent ici, puis rejoignent le cache partagé.
   L'iPhone les lit, il n'a rien à calculer.

La mise en route de la base (projet Supabase, Google, clés) est décrite dans
**[SUPABASE.md](SUPABASE.md)** — c'est à faire une fois.

---

## 1. Le dépôt et Pages (une seule fois)

```bash
git remote add origin https://github.com/TheoTeix/IronDex.git
git branch -M main
git push -u origin main
```

Dans le dépôt : **Settings › Pages** → *Source* : **Deploy from a branch** →
branche `main`, dossier `/ (root)` → **Save**.

Une minute plus tard, le site est sur :

```
https://theoteix.github.io/IronDex/
```

C'est l'URL à ouvrir sur le Mac **et** sur l'iPhone.

## 2. Installer sur l'iPhone

1. Ouvre l'URL dans **Safari** (pas Chrome : lui ne sait pas installer).
2. **Partager › Sur l'écran d'accueil**.
3. Ouvre l'app depuis l'icône : plein écran, sans barre Safari.
4. **Continuer avec Google**.

Rien à coller, rien à configurer : la collection arrive. Une modification faite
sur l'iPhone apparaît sur le Mac sans rien rouvrir (le temps réel de Supabase),
et un appareil hors ligne garde ses modifications en local jusqu'au retour du
réseau.

---

## Le cycle quotidien : j'ai changé quelque chose, et maintenant ?

**Tes données** : rien à faire. Elles partent toutes seules, ~1,5 s après la
modification.

**Le code** (`app.js`, `style.css`, `index.html`) :

```bash
git add -A && git commit -m "ce que j'ai changé" && git push
```

Plus besoin de `git pull --rebase` d'abord : l'app ne commite plus rien.

Compte 30 à 60 secondes avant que Pages serve la nouvelle version.

Une seule règle à ne pas oublier : quand `app.js` ou `style.css` change, il
faut **monter le numéro de version** dans `index.html` —

```html
<link rel="stylesheet" href="style.css?v=ui48">
<script src="cloud-config.js?v=ui48"></script>
<script src="app.js?v=ui48"></script>
```

Sans ça, les navigateurs (et surtout l'app installée sur l'iPhone) continuent
de servir l'ancien fichier depuis leur cache : on croit que le changement n'a
pas marché alors qu'il n'est jamais arrivé. **`sw.js`** liste aussi ces URL
(même version, et monte son `V`), et **`version.json`** porte le même numéro —
c'est lui qui permet à une app installée de détecter qu'elle est périmée.

## Mettre les cotes à jour

Sur le **Mac** uniquement :

```bash
python3 scripts/cm_price_bridge.py
```

Aucune fenêtre ne s'ouvre : le pont fait des requêtes HTTP, avec l'accès
Cardmarket enregistré dans `~/.irondex/cm-cookies.json`. Ensuite, une carte se
recote **depuis sa propre tuile** — une seconde, et c'est celle qu'on regarde.
Il n'y a plus de « Sync » global : recoter 1 400 cartes prenait 20 minutes pour
refaire ce qui était déjà juste.

Chaque cote obtenue rejoint le **cache partagé** (table `prices`) — à condition
que ton compte soit curateur (voir SUPABASE.md). L'iPhone la récupère ensuite
sans rien calculer : ⌘K → « Récupérer les cotes partagées ».

Quand l'accès Cardmarket expire, le pont le **renouvelle tout seul** (~1,5 s).
La commande manuelle ne sert que si Cloudflare exige une vérification humaine —
l'app te le dira explicitement :

```bash
python3 scripts/cm_price_bridge.py --login
```

## Ce qui ne monte pas en ligne (et pourquoi)

`.gitignore` écarte : les `*.bak` et `app.js.pre-supabase`, `.DS_Store`, les
dossiers de travail (`.redesign-backup`, `.impeccable`,
`sauvegardes-recuperees`), les exports locaux (`milodex-sauvegarde.json`,
`irondex-restauration-*.json`), `logo-source.png` et `cm-slugs.json` — ce
dernier est un doublon de `cm-slugs.js` (2 Mo pour rien).

`data/collection.json` et `data/prices.json` sont encore là, mais **plus rien
ne les écrit** : ce sont les archives de l'ancienne version, et l'app ne les lit
qu'une fois, pour proposer le rapatriement au premier login. Une fois ta
collection vérifiée dans ton compte, tu peux les supprimer.

## Si quelque chose cloche

| Symptôme | Cause la plus probable |
|---|---|
| Le site affiche une vieille version | version `?v=` pas montée, ou cache de l'app installée : ferme-la et réouvre-la |
| L'écran de connexion s'affiche alors que j'étais connecté | session expirée, ou horloge de l'appareil fausse |
| « Configuration incomplète » sur l'écran de connexion | `cloud-config.js` pas rempli — voir SUPABASE.md étape 4 |
| Pastille du compte rouge | échec d'envoi : le libellé exact est dans la feuille de profil (icône du compte) |
| Pastille du compte bleue | hors ligne — rien n'est perdu, tout part au retour du réseau |
| Une cote ne part pas vers les autres appareils | ton compte n'est pas curateur (SUPABASE.md, dernière étape) |
| « pont Cardmarket éteint » | le script `cm_price_bridge.py` ne tourne pas sur ce Mac |
| Collection vide après connexion | c'est normal sur un compte neuf ; si ce n'est pas le tien, vérifie l'adresse dans la feuille de profil |
