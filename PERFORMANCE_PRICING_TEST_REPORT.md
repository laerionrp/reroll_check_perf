# RCP v1.3.1 — rapport de validation

## Règle contrôlée

1. `prixPerformanceHT = Math.ceil(prixVehiculeHT * coefficientCumule)`
2. `montantTVA = Math.ceil(prixPerformanceHT * tauxTVA)`
3. `prixPerformanceFinal = prixPerformanceHT + montantTVA`

Aucun epsilon n'est utilisé dans le helper de tarification des performances.

## Cas de référence

| Véhicule | Base HT | Performance | Résultat |
|---|---:|---|---:|
| Speeder | 60 000 $ | Turbo (`0,16`) | 10 945 $ |
| Indiana Rancher | 42 000 $ | Blindage niveau 1 (`0,03`) | 1 437 $ |
| Indiana Rancher | 42 000 $ | Blindage niveau 2 cumulé (`0,07`) | 3 353 $ |

Les trois cas passent avec le helper frontend et le helper backend.

## Contrôles complémentaires

- syntaxe de tous les fichiers frontend `.js` : valide ;
- syntaxe de tous les fichiers backend `.gs` : valide ;
- Contrôle tarif et Inventaire appellent la même implémentation frontend ;
- l'achat backend appelle la règle équivalente dans `Utils.gs` ;
- aucun fichier de réparation ou de validation des dépenses historiques modifié ;
- coefficients, TVA, conversion d'achat et restrictions métier inchangés.
