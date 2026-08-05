# RCP — passe de fiabilisation des sauvegardes de performances

## Comportement livré

- la coche est affichée immédiatement ;
- les changements d’une fiche restent dans un brouillon local ;
- une seule action `setPerformanceLevels` enregistre tous ses niveaux finaux ;
- les paliers déjà achetés conservent leurs montants historiques ;
- les nouveaux paliers utilisent le prix catalogue actuel ;
- décocher puis recocher avant sauvegarde restaure exactement l’état initial ;
- une erreur laisse le brouillon visible pour permettre une nouvelle tentative.

Les coefficients, la TVA, les arrondis, les prix achetés et les règles de
véhicules sont conservés.
