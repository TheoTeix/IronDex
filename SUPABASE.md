# Comptes et base de données — la mise en route

Ce que ça change : la collection ne vit plus dans le dépôt GitHub, elle vit
dans **Postgres**, **liée à un compte**. Le dépôt ne sert plus qu'à héberger le
code. Trois conséquences directes :

1. **Plus aucun jeton à coller.** Tu te connectes avec Google, sur le Mac comme
   sur l'iPhone, et tes données arrivent.
2. **Chaque compte est cloisonné.** Ce n'est pas une politesse du JavaScript :
   c'est Postgres qui refuse (RLS, voir `supabase/schema.sql`). Même en
   trafiquant le code de la page, un compte ne peut pas lire la collection d'un
   autre.
3. **Pousser du code redevient banal** : `git push`, rien d'autre. Le dépôt ne
   contient plus une seule donnée personnelle.

Il y a quatre étapes, toutes dans des consoles web. Compte 20 minutes.

---

## 1. Créer le projet Supabase

1. [supabase.com](https://supabase.com) → **Start your project** → connecte-toi
   avec GitHub.
2. **New project**
   - **Name** : `irondex`
   - **Database password** : génère-en un et **range-le dans ton gestionnaire
     de mots de passe**. Il ne sert pas à l'app, mais à toi si tu veux te
     brancher sur la base directement.
   - **Region** : `West EU (Ireland)` ou `Central EU (Frankfurt)` — le plus
     proche de toi, c'est de la latence en moins à chaque enregistrement.
3. Attends la fin de la création (~2 min).

## 2. Créer les tables

Dans le projet : **SQL Editor** › **New query**.

Colle **tout** le contenu de [`supabase/schema.sql`](supabase/schema.sql) et
clique **Run**. Tu dois lire `Success. No rows returned`.

Ce fichier crée les trois tables, les politiques d'isolation, le trigger qui
fabrique ton profil à l'inscription, et le temps réel. Il est rejouable : si tu
le relances plus tard, rien ne casse.

## 3. Brancher Google

C'est la seule étape en deux consoles, parce que Google et Supabase doivent se
présenter mutuellement.

### 3a. Côté Supabase — récupérer l'adresse de retour

**Authentication** › **Sign In / Providers** › **Google**. Active-le. Note
l'**URL de callback** affichée, de la forme :

```
https://<ton-ref>.supabase.co/auth/v1/callback
```

Laisse l'onglet ouvert, on y revient dans 30 secondes.

### 3b. Côté Google — créer le client OAuth

[console.cloud.google.com](https://console.cloud.google.com) :

1. **Nouveau projet** → nom `IronDex` → Créer, puis sélectionne-le.
2. **APIs et services** › **Écran de consentement OAuth** :
   - Type : **Externe**
   - Nom de l'application : `IronDex` · e-mail d'assistance : le tien
   - Coordonnées du développeur : le tien → Enregistrer
   - **Laisse l'application en mode « Test » seulement si tu es seul.** Comme
     tu veux que n'importe qui puisse s'inscrire, clique **PUBLIER
     L'APPLICATION**. Sans publication, Google refuse tout compte qui n'est pas
     dans ta liste de testeurs (100 max).
3. **Identifiants** › **Créer des identifiants** › **ID client OAuth** :
   - Type : **Application Web**, nom : `IronDex web`
   - **Origines JavaScript autorisées** :
     ```
     https://theoteix.github.io
     http://localhost:8000
     ```
   - **URI de redirection autorisés** — colle l'URL de callback de l'étape 3a :
     ```
     https://<ton-ref>.supabase.co/auth/v1/callback
     ```
   - Créer. Google affiche un **ID client** et un **code secret**.

### 3c. Retour dans Supabase

Colle l'**ID client** et le **code secret** dans le panneau Google, puis
**Save**.

Toujours dans **Authentication** › **URL Configuration** :

- **Site URL** : `https://theoteix.github.io/IronDex/`
- **Redirect URLs** — ajoute les deux lignes :
  ```
  https://theoteix.github.io/IronDex/**
  http://localhost:8000/**
  ```

> Sans ces deux lignes, Google te renverra bien à Supabase, mais Supabase
> refusera de te renvoyer à l'app : tu resterais bloqué sur une page blanche
> avec `redirect_to is not allowed`.

## 4. Donner les clés à l'app

**Project Settings** › **API Keys** — attention, ce n'est PAS la page « Data
API », qui ne montre que les réglages du schéma.

Selon l'âge du projet, tu y verras l'une ou l'autre de ces deux formes ; **les
deux conviennent**, `createClient` les accepte à la même place :

| Forme | Où | À quoi ça ressemble |
|---|---|---|
| **Publishable key** (récent) | onglet principal | `sb_publishable_…` |
| **anon public** (historique) | onglet **Legacy API keys** | `eyJ…`, très long |

Si l'onglet « Legacy API keys » est vide ou désactivé, prends simplement la
**Publishable key** : c'est son remplaçant officiel, avec le même rôle et les
mêmes limites (elle ne donne accès qu'à ce que la RLS autorise).

Ne prends jamais la **Secret key** / **`service_role`** : celle-là ignore la
RLS et n'a rien à faire dans une page web.

L'**URL du projet** est sur la même page. Prends la **racine** —
`https://<ton-ref>.supabase.co` — et non l'adresse REST qui se termine par
`/rest/v1/` : le client ajoute lui-même le chemin de chaque service.

Ouvre [`cloud-config.js`](cloud-config.js) à la racine du projet et remplis les
deux valeurs. Puis :

```bash
git add -A && git commit -m "Supabase : configuration du projet" && git push
```

> **Cette clé est faite pour être publique** — elle est dans le code
> d'une page servie à tout le monde, il ne peut pas en être autrement. Ce n'est
> pas un mot de passe : elle ne donne accès qu'à ce que la RLS autorise, c'est-
> à-dire les lignes du compte connecté. La clé qu'il ne faut **jamais** mettre
> dans le dépôt est la **`service_role`** : celle-là ignore la RLS. Ne la copie
> nulle part dans ce projet.

---

## Ta première connexion

Ouvre `https://theoteix.github.io/IronDex/`. L'app affiche l'écran d'accueil des
comptes → **Continuer avec Google**.

À ton retour, si ta collection actuelle est encore sur cet appareil (IndexedDB)
ou dans `data/collection.json`, l'app te propose de **la rapatrier dans ton
compte**. Accepte : c'est la migration, elle n'a lieu qu'une fois.

Ensuite, une dernière requête pour pouvoir alimenter les cotes — **SQL
Editor**, avec ton adresse :

```sql
update public.profiles set is_curator = true where email = 'ton@email';
```

Ton Mac est le seul à faire tourner le pont Cardmarket : ce drapeau autorise
ton compte à écrire dans le cache de cotes partagé. Les autres comptes le
lisent, et pour les cartes absentes du cache ils retombent sur la chaîne
habituelle (moyenne Cardmarket, ptcg, tcgplayer) — ils ont donc une cote, juste
pas le premier prix français Near Mint.

## Sur l'iPhone

Même URL dans **Safari** → **Partager › Sur l'écran d'accueil** → ouvre l'app →
**Continuer avec Google**. Rien à coller, rien à configurer : ta collection
arrive.

> Si la connexion Google te sort de l'app plein écran et n'y revient pas, dis-
> le moi : c'est une limite connue des PWA iOS installées, et l'écran d'auth est
> écrit pour qu'ajouter « e-mail + mot de passe » en secours soit une ligne.

## Ce qui reste dans le dépôt

Le code, et rien d'autre. `data/collection.json` et `data/prices.json` ne sont
plus écrits par l'app : ils restent en place comme archive de la migration, et
tu peux les supprimer une fois que tu as vérifié que tout est bien dans ton
compte.

## Si ça coince

| Symptôme | Cause |
|---|---|
| `redirect_to is not allowed` | les **Redirect URLs** de l'étape 3c manquent |
| `Unsupported provider` | Google pas activé, ou ID/secret pas enregistrés côté Supabase |
| Écran de connexion en boucle | l'heure de l'appareil est fausse (le jeton paraît expiré) |
| `Accès bloqué : IronDex n'a pas terminé la procédure de validation` | écran de consentement resté en mode Test — publie-le (étape 3b) |
| `new row violates row-level security policy` sur les cotes | ton compte n'est pas curateur — la requête `update … is_curator` ci-dessus |
| Collection vide après connexion | c'est normal sur un compte neuf : la migration ne se propose que si l'appareil a des données locales |
