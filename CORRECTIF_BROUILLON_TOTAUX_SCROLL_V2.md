# RCP v1.3.4 — correctif brouillon, totaux et défilement v2

## Périmètre

Cette passe modifie uniquement le frontend `js/garage.js`.

## Corrections

- Un palier déjà acheté affiche et conserve son montant historique.
- Un palier non acheté ignore les anciens tarifs résiduels présents après le
  niveau enregistré et utilise le tarif catalogue actuel.
- Le brouillon est reconstruit depuis les niveaux et montants enregistrés à
  chaque coche.
- `Total perfs` correspond à la somme exacte des champs `*_paid` du brouillon.
- `Dépense totale` correspond au prix TTC historique du véhicule additionné au
  `Total perfs` du brouillon.
- Une coche ne modifie que le coût du palier ajouté ou retiré.
- La fiche conserve sa position visuelle après une coche et pendant les deux
  rendus de la sauvegarde.

## Scénario de non-régression

Le test `tests/performance-draft-current-catalogue.test.cjs` couvre une fiche
dont le prix d'achat historique diffère du catalogue actuel et qui contient :

- plusieurs performances historiques ;
- d'anciens tarifs résiduels pour des paliers non achetés ;
- une puis deux modifications en attente ;
- l'annulation complète du brouillon ;
- la reconstruction de la fiche avec restauration de sa position.

Commande :

```bash
node tests/performance-draft-current-catalogue.test.cjs
```

Résultat attendu :

```text
Brouillon frontend : tarifs mixtes, totaux cohérents et ancrage de la fiche validés.
```

## Déploiement

Le backend Apps Script n'est pas modifié par cette passe. Il ne faut donc ni
faire de `clasp push`, ni créer une nouvelle version du Web App.
