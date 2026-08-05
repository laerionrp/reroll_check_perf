# Correctif ciblé — tarifs et totaux du brouillon Inventaire

Fichier frontend modifié :

- `js/garage.js` : les performances non achetées utilisent le prix actuel du
  véhicule dans le catalogue chargé depuis `RCP_VEHICLES` ; le brouillon est
  reconstruit depuis la fiche enregistrée pour éviter tout recalcul ou cumul
  des montants historiques.

Le thème, le responsive, le masonry, les calculs du Contrôle tarif et les autres
pages ne sont pas modifiés.
