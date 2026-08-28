-- ═══════════════════════════════════════════════════════════════════════
--  IronDex — schéma Supabase
--  À coller ENTIÈREMENT dans : Supabase › SQL Editor › New query › Run.
--  Rejouable sans risque (tout est idempotent).
--
--  Trois tables, trois régimes de visibilité différents :
--   · profiles     — une ligne par compte, visible de son seul propriétaire
--   · collections  — LA collection, un document JSON par compte, isolé par RLS
--   · prices       — les cotes, cache PARTAGÉ : tout le monde lit, seuls les
--                    curateurs écrivent (voir la note en bas de fichier)
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. TABLES ──────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  avatar_url   text,
  -- Seul un curateur peut écrire dans le cache de cotes partagé. Mets-toi
  -- curateur à la main une fois ton compte créé (requête en bas de fichier).
  is_curator   boolean not null default false,
  created_at   timestamptz not null default now()
);

-- La collection est stockée telle que l'app la produit : le résultat exact de
-- collectionSnapshot() (wishlists, binders, sealed, investCards, milobellus…).
-- Un document JSONB plutôt que dix tables normalisées, et c'est un choix :
-- l'app parle déjà en instantanés complets, donc la base épouse sa forme au
-- lieu de forcer une réécriture de 500 Ko de JS. Postgres sait indexer et
-- requêter du JSONB le jour où on voudra découper.
create table if not exists public.collections (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Une LIGNE PAR CARTE, et non un gros blob : c'est ce qui permet au cache de
-- FUSIONNER entre comptes (chacun apporte les cartes qu'il a cotées) et de ne
-- relire que le delta (where updated_at > dernière synchro).
create table if not exists public.prices (
  card_id    text primary key,
  -- { raw, currency, src, cmId?, cmUrl?, doubtCM? } — la forme de priceCache.
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists prices_updated_at_idx on public.prices (updated_at);

-- ── 2. updated_at TENU PAR LA BASE ─────────────────────────────────────
-- Jamais par le client : deux appareils mal réglés à l'heure suffisent à
-- inverser l'ordre de deux modifications. C'est l'horloge du serveur qui
-- arbitre « qui est le plus récent ».

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists collections_touch on public.collections;
create trigger collections_touch before update on public.collections
  for each row execute function public.touch_updated_at();

drop trigger if exists prices_touch on public.prices;
create trigger prices_touch before update on public.prices
  for each row execute function public.touch_updated_at();

-- ── 3. PROFIL CRÉÉ AUTOMATIQUEMENT À L'INSCRIPTION ─────────────────────
-- security definer : le trigger tourne avec les droits du propriétaire de la
-- fonction, sinon la RLS de profiles bloquerait sa propre insertion.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(coalesce(new.email, 'dresseur@'), '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 4. ROW LEVEL SECURITY ──────────────────────────────────────────────
-- C'EST LA PIÈCE MAÎTRESSE. Sans elle, la clé anon (qui est publique, elle est
-- dans le code de la page) donnerait accès à toutes les lignes de tout le
-- monde. Avec elle, Postgres refuse au niveau du moteur toute ligne dont le
-- user_id n'est pas celui du jeton — même si le JS de la page est modifié.

alter table public.profiles    enable row level security;
alter table public.collections enable row level security;
alter table public.prices      enable row level security;

-- profiles : chacun le sien
drop policy if exists "profil lisible par son proprietaire"    on public.profiles;
drop policy if exists "profil creable par son proprietaire"    on public.profiles;
drop policy if exists "profil modifiable par son proprietaire" on public.profiles;

create policy "profil lisible par son proprietaire" on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy "profil creable par son proprietaire" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "profil modifiable par son proprietaire" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- collections : isolation stricte, les quatre verbes
drop policy if exists "collection lisible par son proprietaire"     on public.collections;
drop policy if exists "collection creable par son proprietaire"     on public.collections;
drop policy if exists "collection modifiable par son proprietaire"  on public.collections;
drop policy if exists "collection supprimable par son proprietaire" on public.collections;

create policy "collection lisible par son proprietaire" on public.collections
  for select to authenticated using (auth.uid() = user_id);
create policy "collection creable par son proprietaire" on public.collections
  for insert to authenticated with check (auth.uid() = user_id);
create policy "collection modifiable par son proprietaire" on public.collections
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "collection supprimable par son proprietaire" on public.collections
  for delete to authenticated using (auth.uid() = user_id);

-- prices : lecture pour tout compte connecté, écriture réservée aux curateurs
drop policy if exists "cotes lisibles par tout compte connecte" on public.prices;
drop policy if exists "cotes ecrites par les curateurs"         on public.prices;
drop policy if exists "cotes majes par les curateurs"           on public.prices;

create policy "cotes lisibles par tout compte connecte" on public.prices
  for select to authenticated using (true);
create policy "cotes ecrites par les curateurs" on public.prices
  for insert to authenticated with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_curator)
  );
create policy "cotes majes par les curateurs" on public.prices
  for update to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_curator)
  );

-- ── 4 bis. LE DRAPEAU CURATEUR NE DOIT PAS ÊTRE AUTO-ATTRIBUABLE ───────
-- Défaut repéré le 2026-08-28 : la politique « profil modifiable par son
-- propriétaire » autorise un compte à modifier N'IMPORTE QUELLE colonne de sa
-- ligne — `is_curator` compris. Autrement dit, n'importe qui pouvait se
-- promouvoir curateur et écrire dans le cache de cotes partagé. Le garde-fou
-- ne tenait que par le fait que l'app ne propose pas le geste.
--
-- Ce trigger le rend réel : une requête PORTANT UN JETON UTILISATEUR
-- (auth.uid() non nul) ne peut pas faire bouger le drapeau — la valeur d'avant
-- est silencieusement remise. Le tableau de bord Supabase, lui, n'a pas de
-- auth.uid() : l'attribution depuis le Table Editor ou le SQL Editor continue
-- de fonctionner.

create or replace function public.protect_curator_flag()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and new.is_curator is distinct from old.is_curator then
    new.is_curator = old.is_curator;
  end if;
  return new;
end $$;

drop trigger if exists profiles_protect_curator on public.profiles;
create trigger profiles_protect_curator before update on public.profiles
  for each row execute function public.protect_curator_flag();

-- ── 5. TEMPS RÉEL ──────────────────────────────────────────────────────
-- Pour que le Mac voie arriver une carte ajoutée sur l'iPhone sans rien
-- rouvrir. La RLS s'applique AUSSI au flux temps réel : personne ne reçoit
-- les changements d'un autre compte.
do $$
begin
  alter publication supabase_realtime add table public.collections;
exception when duplicate_object then null;
end $$;

-- ═══════════════════════════════════════════════════════════════════════
--  APRÈS TA PREMIÈRE CONNEXION — deviens curateur des cotes
--  Ton Mac est le seul à faire tourner le pont Cardmarket : c'est donc ton
--  compte qui alimente le cache de cotes pour tout le monde. Remplace
--  l'adresse et exécute :
--
--    update public.profiles set is_curator = true where email = 'TON@EMAIL';
--
--  Vérifier que la RLS est bien active partout :
--    select relname, relrowsecurity from pg_class
--    where relname in ('profiles','collections','prices');
--  → les trois doivent être à true.
-- ═══════════════════════════════════════════════════════════════════════
