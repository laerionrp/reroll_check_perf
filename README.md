# Reroll Check Perf

## v1.3.2 — profils tarifaires et chargement optimisé

Les nouveaux tarifs de performances utilisent deux plafonds distincts : d'abord
le prix HT du palier, puis sa TVA. `js/performance-pricing.js` porte cette règle
commune à Contrôle tarif et à l'Inventaire. Les achats historiques enregistrés
restent inchangés.

Application web de gestion de véhicules GTA RP.

## Fonctionnalités

- 🚗 Contrôle des tarifs véhicules
- 💰 Calcul automatique HT / TTC
- ⚙️ Calcul des performances
- 📋 Gestion des cartes grises
- 🚘 Inventaire des véhicules
- 🌗 Thème clair / sombre
- 📱 Interface responsive
- ☁️ Base de données Google Sheets
- 🔐 Authentification par mot de passe

## Technologies

- HTML5
- CSS3
- JavaScript
- Google Apps Script (API)
- Google Sheets
- GitHub Pages

## Architecture

Le projet est séparé en trois parties :

1. **Frontend GitHub Pages**
   - `index.html` et `js/public.js` : contrôle public des tarifs ;
   - `login.html` et `js/login.js` : connexion à l’inventaire ;
   - `garage.html` et `js/garage.js` : inventaire privé ;
   - `js/api.js` : appels vers le Web App Apps Script ;
   - `css/style.css` : styles partagés et responsive.

2. **Backend Google Apps Script**
   - `Api.gs` : point d’entrée JSON `doPost()` et routage des actions ;
   - `Public.gs` : lecture des tarifs et performances publics ;
   - `Garage.gs` : authentification et gestion de l’inventaire ;
   - `Schema.gs` : validation du schéma et migration manuelle v1.2 ;
   - `Validation.gs` : validation des données reçues et lues ;
   - `VehicleRules.gs` : règles autoritaires des véhicules et performances ;
   - `Settings.gs` : lecture des réglages ;
   - `Utils.gs` : fonctions utilitaires ;
   - `Config.gs` : noms des feuilles et constantes ;
   - `Code.gs` : repère documentaire, sans exécution.

3. **Google Sheets**
   - `DATA` : source privée d'analyse et de synchronisation ;
   - `RCP_VEHICLES`, `RCP_SETTINGS` et `RCP_PERFORMANCE_RATES` : données
     publiques préparées et utilisées pour les consultations courantes ;
   - `GARAGE_CARDS` : cartes grises ;
   - `GARAGE_DB` : véhicules et dépenses ;
   - `SETTINGS` : réglages privés.

Le navigateur charge le site depuis GitHub Pages. Les pages réutilisent leurs
données mémorisées localement tant qu'elles restent compatibles et récentes ;
elles ne relancent pas automatiquement une requête complète en arrière-plan à
chaque ouverture. Le catalogue Paramètres est chargé uniquement à l'ouverture
de son onglet. Le backend ne sert aucune page HTML : `doGet()` et `include()`
ne font plus partie de l’architecture.

## Déploiement

- Les changements frontend sont publiés avec GitHub Pages après un
  `git push` sur la branche principale.
- Les changements backend sont publiés depuis Apps Script en créant
  une nouvelle version du déploiement Web App existant.
- L’URL du Web App utilisée par le frontend se trouve dans
  `js/config.js`.

## Paramétrage des performances

Les coefficients et libellés actifs sont lus depuis `RCP_PERFORMANCE_RATES`.
La page Paramètres permet de modifier un bloc de performance à la fois ; les
niveaux, leur ordre et leur état actif restent structurels. `js/public.js` et
`js/garage.js` conservent uniquement leurs valeurs de secours pour rester
lisibles avec une ancienne réponse API.

## Configuration privée

Le mot de passe de l’inventaire est stocké uniquement dans la propriété
de script Apps Script `RCP_LOGIN_PASSWORD`. Il ne doit jamais être ajouté
au dépôt Git.

Après le premier déploiement de cette consolidation, exécuter une seule
fois `migrateRcpV12Schema()` depuis l’éditeur Apps Script. La migration est
idempotente : elle ajoute les colonnes manquantes et complète uniquement les
cellules prévues restées vides, sans supprimer ni remplacer une valeur non vide.

## Version

**v1.3.2**
