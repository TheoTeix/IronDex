# Product

## Register

product

## Users
Un collectionneur de cartes Pokémon (TCG) qui suit sa collection à forte valeur : classeurs, wishlists par série, produits scellés et cartes d'investissement. Contexte : usage perso, sur desktop et mobile, souvent le soir ; il veut voir la valeur de son coffre et sa plus belle pièce d'un coup d'œil, et ajouter/gérer des cartes sans friction.

## Product Purpose
IronDex est le « coffre-fort » d'une collection Pokémon : estimer et suivre la valeur (cotes Cardmarket enregistrées, mises à jour en un clic via « Sync »), curer sa pièce maîtresse, et construire des wishlists depuis le catalogue complet (API tcgdex). Succès = l'appli donne l'impression de manipuler une collection premium, avec zéro jank et un feedback instantané.

## Brand Personality
Premium, « liquid glass » à la Apple, fluide et confiant. Trois mots : **raffiné, vivant, collectionneur**. Identité actuelle : **VAULT** (2026-08-21) — un coffre de collectionneur en acier froid quasi-noir, où quatre signatures se répondent : (1) **PRISME**, la couleur du type de la carte regardée inonde l'UI (coulée d'1s sur `--acc`, avec un plancher de saturation pour que les types ternes restent des accents utilisables) ; (2) **LIQUID GLASS**, toute l'app est faite de dalles de verre — flou + teinte + arête spéculaire, et une vraie réfraction (carte de déplacement SVG) sur les grandes surfaces ; (3) **AURORA**, des nappes colorées dérivent derrière l'app pour donner au verre quelque chose à réfracter ; (4) **PROFONDEUR RÉELLE**, WebGL (créature d'ambiance, classeur feuilletable) et un spotlight qui suit le curseur, plutôt que des ombres décoratives.

## Anti-references
Ne doit PAS ressembler à un SaaS généré par IA : fond crème + serif éditorial, template hero-métrique (gros chiffre + petit label + stats + accent dégradé), petits eyebrows majuscules trackés au-dessus de chaque section, glassmorphism décoratif par défaut, grilles de cartes identiques icône+titre+texte, bordures latérales colorées, texte en dégradé. Pas de « fait par une IA » : chaque état doit sembler décidé par un designer.

## Design Principles
- **La carte est la vedette.** Le visuel de la carte (scan API) est intégral, jamais rogné, jamais surchargé de texte ; les infos vivent autour, pas dessus.
- **Une seule voix typographique.** Inter partout ; la hiérarchie vient du poids, de la taille et de l'interlettrage — pas d'un zoo de polices.
- **Feedback instantané, fluidité Apple.** Sauvegardes immédiates, cotes enregistrées (valeurs affichées dès la première frame, même hors ligne), scène 3D persistante, motion selon la philosophie Emil Kowalski (ease-out fort, <300ms, pas de rebond gratuit, reduced-motion respecté).
- **Cohérence des composants.** Un seul langage de bouton (primaire / ghost / danger), un seul matériau (le verre : `--lg-tint` + `--lg-shine`), une seule échelle d'élévation (`--e1`→`--e4`) et un seul rythme de motion (`--dur-*` + `--ease-out`) ; tout se ressemble d'un écran à l'autre.
- **Le verre sert le contenu, jamais l'inverse.** La réfraction est réservée aux grandes surfaces peu nombreuses ; les couches flottantes (modales, palette) utilisent un verre SOMBRE pour que le texte garde son contraste ; jamais de verre empilé sur du verre. Coût de composition constant, indépendant de la taille des grilles.
- **Navigation adaptative, jamais déplacée.** Rail latéral ≥1024px, tab bar en bas sous 1024px, 4 destinations, même emplacement sur toutes les vues. La palette ⌘K est l'accélérateur : sauter à une vue, retrouver n'importe quelle carte, lancer la synchro.
- **La couleur n'informe jamais seule.** Répartition de valeur, raretés, plus-values : toujours un libellé ou une icône en plus de la teinte.
- **Couleur pilotée par le contenu.** L'accent est la couleur du type de la carte focalisée, pas une teinte décidée arbitrairement.

## Accessibility & Inclusion
Cible WCAG AA, **contrastes mesurés** sur le canvas `#06070A` : `--t1` 18.4:1, `--t2` 7.6:1, `--t3` 5.0:1 (ne pas redescendre `--t3` sous `.50` : à `.40` il tombait à 3.5:1). Focus toujours visible, cibles tactiles ≥ 44px, `prefers-reduced-motion` honoré (les fondus restent, les déplacements et le spotlight disparaissent, les indicateurs de chargement continuent de tourner), survols neutralisés au tactile (`@media (hover:none)`), lien d'évitement clavier, Échap ferme toujours la couche du dessus. FR par défaut.
