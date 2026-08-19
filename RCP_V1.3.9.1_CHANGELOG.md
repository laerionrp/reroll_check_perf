# RCP v1.3.9.1 — Catalogue

## Périmètre

Cette passe part de v1.3.9 et reste dans la branche 1.3.9.x. Elle ne remplace
pas le Catalogue et ne retire aucune page existante.

## Fichiers frontend touchés

- `catalogue.html`
- `catalogue-prive.html`
- `css/style.css`
- `js/catalogue.js`
- `js/config.js`
- `README.md`
- `images/catalogue-icons/*.svg`

## Fichiers Apps Script touchés

- `backend/Config.gs`
- `backend/BrandSchema.gs`
- `backend/Public.gs`
- `backend/RCP_BRANDS_SETUP.md`

## Fonctions ajoutées ou améliorées

- affichage de tous les véhicules renvoyés par `RCP_VEHICLES`, y compris les
  véhicules entreprise, sans concession ou avec données partielles ;
- distinction visuelle « Véhicule entreprise » sans créer de concession
  artificielle ;
- affichage de toutes les concessions actives liées par
  `RCP_VEHICLE_DEALERS` et badge multi-concessions ;
- photos depuis `RCP_VEHICLES.photo_url`, sans placeholder ni espace réservé
  lorsqu'elles sont absentes ou invalides ;
- filtres secondaires et options recalculées selon les filtres actifs ;
- lien direct `catalogue.html?vehicle=<vehicle_id>` ;
- copie du résumé et du lien de la fiche ;
- icônes SVG monochromes pilotées par CSS ;
- caractéristiques avec « Aucun coffre » pour une valeur de 0 ;
- `country_code` ajouté de manière idempotente à `RCP_BRANDS` ;
- migration sans suppression de colonne ni écrasement par une valeur vide.

## Données Vapid/Gallivanter contrôlées

Le dépouillement fourni contient 160 fiches, dont 155 rapprochements sûrs et
5 véhicules à créer : ATV Trailer, Dorado ST, Hardy Way, Verus Utility ATV et
Vivanite.

Les cinq véhicules ne sont pas injectés automatiquement : leurs
`vehicle_id` n'existent pas encore et ne doivent pas être inventés. Les
renommages proposés restent également soumis à validation.

Les prix et catégories existants ne sont pas écrasés par ce paquet.

## Feuilles concernées

- lecture Catalogue : `RCP_VEHICLES` ;
- relations concessionnaires : `RCP_VEHICLE_DEALERS` ;
- concessions actives : `RCP_DEALERS` ;
- marques : `RCP_BRANDS` ;
- tarifs : structures RCP existantes inchangées.

## Vérifications réalisées

- syntaxe de tous les fichiers frontend `.js` : OK ;
- syntaxe des fichiers Apps Script `.gs` : OK ;
- contrôle des en-têtes et des colonnes des fichiers CSV/XLSX : OK ;
- aucune source CSV/XLSX modifiée.

## Finition visuelle intégrée

- rubrique `Informations` séparée et placée avant les caractéristiques ;
- séparateurs, liseré, icônes et intitulés pilotés par l'accent local de la
  concession ;
- valeurs conservées dans la couleur de texte normale ;
- concessions multiples rendues sous forme de badges ;
- actions regroupées après les améliorations disponibles ;
- ajout de `Copier pour Discord`, qui copie un résumé Markdown compatible avec
  Discord, sans webhook ni envoi externe.
