# Déploiement propre et retest RCP v1.3.4

## 1. Backend Apps Script

1. Faire une copie des feuilles `GARAGE_DB`, `GARAGE_CARDS`, `RCP_VEHICLES`,
   `RCP_SETTINGS`, `RCP_PERFORMANCE_RATES`, `RCP_PRICE_HISTORY` et
   `RCP_SYNC_LOG`.
2. Remplacer tous les fichiers `.gs` du projet Apps Script par ceux de
   l’archive backend.
3. Vérifier que `Api.gs` contient `case 'setPerformanceLevels'` et que
   `Garage.gs` contient `function setPerformanceLevels(...)`.
4. Enregistrer le projet.
5. Dans **Déployer → Gérer les déploiements**, modifier le Web App actuel et
   choisir **Nouvelle version**.
6. Conserver l’exécution en tant que propriétaire et l’accès public déjà
   utilisés.
7. Déployer. Ne pas exécuter d’initialisation, de migration ni de réparation
   pour cette passe.

`RCP_VEHICLES` est désormais le catalogue actif et directement modifiable.
`DATA` ne sert qu’à l’analyse et à la synchronisation explicitement appliquée.
La feuille historique `RCP_VEHICLE_OVERRIDES`, si elle existe déjà, est ignorée
par cette version et n’a pas besoin d’être créée.

## 2. Frontend GitHub Pages

Remplacer le contenu du dépôt par le contenu de l’archive frontend. Ne mélange
pas les fichiers avec une ancienne archive. Avant le push :

```bash
git status
git diff --check
git add index.html login.html garage.html settings.html mentions-legales.html manifest.webmanifest favicon.ico css images js tests README.md DEPLOIEMENT_RETEST.md CORRECTIF_TARIFS_BROUILLON.md LICENSE
git diff --cached --check
git commit -m "fix(v1.3.4): reconstruction propre catalogue et sauvegarde inventaire"
git push origin main
```

Après la publication, faire un rechargement forcé du site. Les nouvelles clés
de cache évitent de réutiliser les anciennes réponses Catalogue et Inventaire.

## 3. Retest obligatoire

- Contrôle tarif : charger un véhicule et vérifier les montants habituels.
- Inventaire : cocher plusieurs niveaux ou plusieurs performances sur une
  même fiche. Vérifier que les cases changent sans appel serveur immédiat,
  que l’indicateur et le bouton passent dans la teinte de l’en-tête.
- Comparer le prix d’un palier non acheté entre Contrôle tarif et Inventaire :
  les deux montants doivent être strictement identiques.
- Sur une fiche contenant déjà une performance, la décocher puis la recocher
  avant sauvegarde : son montant historique et la dépense initiale doivent être
  restaurés exactement.
- Cliquer sur « Enregistrer les performances » et vérifier que le bouton
  revient dans la teinte du fond, puis recharger la page.
- Modifier une seconde fiche sans l’enregistrer : son indicateur doit rester
  indépendant et son bouton doit être le seul à enregistrer cette fiche.
- Tester un retour au niveau initial : l’indicateur doit disparaître sans
  écriture serveur inutile.
- Vérifier dans `GARAGE_DB` la ligne du `card_id` : niveau, montant payé,
  colonne `_steps` et `depense_total` doivent être modifiés.
- Catalogue : modifier un prix ou un nom, enregistrer, recharger Paramètres,
  puis vérifier que la valeur est bien dans `RCP_VEHICLES`.
- Vérifier qu’aucune coche « Aucune correction manuelle » n’apparaît.

Les calculs IG, la TVA à 14 %, les niveaux cumulatifs et les prix historiques
des performances achetées restent inchangés. Les nouveaux paliers utilisent le
prix HT actuel de `RCP_VEHICLES`.
