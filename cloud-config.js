/* ══════════════════════════════════════════════════════════════════════
   IronDex — coordonnées du projet Supabase

   Les deux valeurs se trouvent dans : Supabase › Project Settings › API.
   Voir SUPABASE.md, étape 4.

   POURQUOI CE FICHIER EST DANS UN DÉPÔT PUBLIC, et pourquoi ce n'est pas une
   fuite : la clé « anon » est une clé PUBLIABLE. Elle voyage forcément dans le
   code d'une page servie à tout le monde. Elle n'ouvre rien par elle-même :
   toute requête qu'elle porte est filtrée par la Row Level Security de
   Postgres, qui ne rend que les lignes du compte connecté (voir
   supabase/schema.sql). Un visiteur non connecté ne peut lire aucune
   collection ; un visiteur connecté ne peut lire que la sienne.

   La clé à ne JAMAIS écrire ici : `service_role`. Celle-là contourne la RLS.
   ══════════════════════════════════════════════════════════════════════ */
window.IRONDEX_SUPABASE = {
  // La RACINE du projet, sans /rest/v1 : le client ajoute lui-même le chemin
  // de chaque service (rest, auth, realtime). Avec /rest/v1 collé au bout,
  // l'authentification irait chercher /rest/v1/auth/v1/… et échouerait.
  url: 'https://pmwruopefnwziogfdegq.supabase.co',
  // Project Settings › API Keys. Deux formes possibles selon l'âge du projet,
  // et createClient accepte les deux à cette place :
  //  · la nouvelle « Publishable key », qui commence par 'sb_publishable_'
  //  · l'ancienne « anon public », un long jeton qui commence par 'eyJ'
  //    (onglet « Legacy API keys » de la même page)
  anonKey: '',
};
