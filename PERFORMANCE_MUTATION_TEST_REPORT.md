# RCP — passe de fiabilisation des sauvegardes de performances

## Comportement livré

- la coche est affichée immédiatement ;
- les clics rapprochés sur une même performance sont regroupés ;
- une seule action `setPerformanceLevel` est envoyée pour le niveau final ;
- les requêtes restent séquentielles ;
- une erreur provoque une resynchronisation de l’inventaire.

Les calculs, les prix achetés et les règles de véhicules sont conservés.
