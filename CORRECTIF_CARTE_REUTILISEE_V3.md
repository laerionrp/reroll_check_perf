# Correctif brouillon — carte grise réutilisée

## Cause

Une carte grise peut être réattribuée après la vente ou la sortie de son ancien
véhicule. Le frontend recherchait la première ligne possédant le `card_id`, y
compris lorsqu'elle appartenait à un véhicule archivé.

Le brouillon de la fiche active pouvait alors reprendre le prix d'achat et les
performances de l'ancien véhicule ayant utilisé la même carte.

## Correction

- `findGarageVehicle()` cible uniquement le véhicule actif associé à la carte ;
- l'ancrage de défilement cible lui aussi la fiche active ;
- le backend Apps Script n'est pas modifié : il utilisait déjà la ligne active ;
- un test reproduit une carte réutilisée avec l'ancien véhicule placé avant le
  véhicule actif dans les données.

## Résultat attendu sur l'Indiana

- état enregistré : `Total perfs 10 537 $`, `Dépense totale 56 737 $` ;
- ajout du turbo à `7 661 $` : `Total perfs 18 198 $`,
  `Dépense totale 64 398 $` ;
- aucun niveau d'une autre performance ne change ;
- la fiche reste à la même position dans la page.
