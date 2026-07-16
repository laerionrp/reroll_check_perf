<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  >

  <title>Inventaire - Reroll Check Perf</title>

  <link
    rel="icon"
    type="image/x-icon"
    href="images/favicon.ico"
  >

  <link
    rel="icon"
    type="image/png"
    sizes="32x32"
    href="images/favicon-32x32.png"
  >

  <link
    rel="icon"
    type="image/png"
    sizes="192x192"
    href="images/favicon-192x192.png"
  >

  <link
    rel="apple-touch-icon"
    href="images/apple-touch-icon.png"
  >

  <link
    rel="manifest"
    href="manifest.webmanifest"
  >

  <link
    rel="stylesheet"
    href="css/style.css"
  >
</head>

<body class="garage-page">
  <header>Inventaire Ailean</header>

  <main>
    <div class="tabs">
      <a
        class="tab"
        href="index.html"
      >
        Contrôle tarif
      </a>

      <a
        class="tab active"
        href="garage.html"
      >
        Inventaire
      </a>
    </div>

    <div
      id="error"
      class="error"
    ></div>

    <div class="card">
      <h2>Actions</h2>

      <div class="grid">
        <button
          type="button"
          onclick="toggleCardForm()"
        >
          Acheter une carte grise
        </button>

        <button
          type="button"
          onclick="toggleVehicleForm()"
        >
          Ajouter un véhicule
        </button>
      </div>

      <div
        id="cardForm"
        class="inline-form"
        style="display:none;"
      >
        <input
          id="cardDate"
          placeholder="Date d’achat, ex. 03/07/2026"
        >

        <input
          id="cardPrice"
          type="number"
          min="0"
          placeholder="Prix payé"
        >

        <input
          id="cardComment"
          placeholder="Commentaire"
        >

        <button
          type="button"
          onclick="buyCard()"
        >
          Valider l’achat
        </button>
      </div>

      <div
        id="vehicleForm"
        class="inline-form"
        style="display:none;"
      >
        <select id="cardSelect"></select>

        <select id="vehicleSelect"></select>

        <input
          id="customName"
          placeholder="Nom personnalisé"
        >

        <input
          id="plate"
          placeholder="Plaque"
        >

        <input
          id="dateAchat"
          placeholder="Date d’achat, ex. 03/07/2026"
        >

        <button
          type="button"
          onclick="addVehicle()"
        >
          Ajouter
        </button>
      </div>
    </div>

    <div class="card">
      <div class="grid stats-grid">
        <div class="stat">
          <span>Cartes possédées</span>
          <strong id="cardsTotal">-</strong>
        </div>

        <div class="stat">
          <span>Cartes utilisées</span>
          <strong id="cardsUsed">-</strong>
        </div>

        <div class="stat">
          <span>Cartes libres</span>
          <strong id="cardsFree">-</strong>
        </div>

        <div class="stat">
          <span>Dépensé en cartes</span>
          <strong id="cardsSpent">-</strong>
        </div>
      </div>
    </div>

    <div class="card inventory-card">
      <h2>Inventaire</h2>

      <div id="vehicleList"></div>
    </div>
  </main>

  <div
    id="exitModal"
    class="modal"
    aria-hidden="true"
  >
    <div class="modal-backdrop"></div>

    <div
      class="modal-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exitModalTitle"
    >
      <h2 id="exitModalTitle">
        Sortir le véhicule
      </h2>

      <label for="exitType">
        Motif de sortie
      </label>

      <select
        id="exitType"
        onchange="updateExitModalFields()"
      >
        <option value="vendu">
          Véhicule vendu
        </option>

        <option value="assurance">
          Destruction prise en charge par l’assurance
        </option>
      </select>

      <label for="exitDate">
        Date de sortie
      </label>

      <input
        id="exitDate"
        placeholder="Ex. 03/07/2026"
      >

      <div id="recoveredAmountGroup">
        <label for="recoveredAmount">
          Somme récupérée
        </label>

        <input
          id="recoveredAmount"
          type="number"
          min="0"
          placeholder="Prix de vente"
        >
      </div>

      <div class="modal-actions">
        <button
          type="button"
          class="secondary-button"
          onclick="closeExitModal()"
        >
          Annuler
        </button>

        <button
          type="button"
          onclick="confirmVehicleExit()"
        >
          Confirmer la sortie
        </button>
      </div>
    </div>
  </div>

  <button
    id="themeToggle"
    class="theme-toggle"
    title="Changer de thème"
    type="button"
  >
    ☀
  </button>

  <script src="js/config.js"></script>
  <script src="js/api.js"></script>
  <script src="js/theme.js"></script>
  <script src="js/garage.js"></script>
</body>
</html>