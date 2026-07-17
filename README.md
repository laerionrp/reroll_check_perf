# Reroll Check Perf

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
   - `Settings.gs` : lecture des réglages ;
   - `Utils.gs` : fonctions utilitaires ;
   - `Config.gs` : noms des feuilles et constantes ;
   - `Code.gs` : repère documentaire, sans exécution.

3. **Google Sheets**
   - `DATA` : catalogue, TVA et performances ;
   - `GARAGE_CARDS` : cartes grises ;
   - `GARAGE_DB` : véhicules et dépenses ;
   - `SETTINGS` : réglages privés.

Le navigateur charge le site depuis GitHub Pages. Les données sont
ensuite demandées au Web App Apps Script, qui lit ou modifie Google
Sheets. Le backend ne sert aucune page HTML : `doGet()` et `include()`
ne font plus partie de l’architecture.

## Déploiement

- Les changements frontend sont publiés avec GitHub Pages après un
  `git push` sur la branche principale.
- Les changements backend sont publiés depuis Apps Script en créant
  une nouvelle version du déploiement Web App existant.
- L’URL du Web App utilisée par le frontend se trouve dans
  `js/config.js`.

## Choix de maintenance

Les ordres et libellés des performances restent actuellement définis
dans `js/public.js` et `js/garage.js`. Les deux pages sont autonomes et
leurs libellés ne sont pas strictement identiques. Leur centralisation
est donc reportée à une évolution dédiée, avec tests des calculs et de
l’affichage.

## Version

**1.0.0**
