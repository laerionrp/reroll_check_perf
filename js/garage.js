let data = null;
let token = localStorage.getItem('garage_token') || '';

const GARAGE_CACHE_KEY = 'rcp_garage_data';
const GARAGE_CACHE_TIME_KEY = 'rcp_garage_data_time';
const GARAGE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const perfLabelsGarage = {
  blindage: ['20%', '40%', '60%'],
  moteur: ['reprog', 'reprog niv. 1', 'reprog niv. 2', 'reprog niv. 3'],
  frein: ['rue', 'sport', 'course'],
  suspension: ['rue', 'sport', 'course'],
  transmission: ['rue', 'sport', 'course'],
  turbo: ['turbo']
};

const perfOrderGarage = ['blindage', 'frein', 'moteur', 'suspension', 'transmission', 'turbo'];

if (!token) {
  window.location.href = 'login.html';
}

function normalizeGarage(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function roundUpMoneyGarage(value) {
  return Math.ceil((Number(value) || 0) - 0.000001);
}

function moneyGarage(value) {
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0
  }).format(roundUpMoneyGarage(value)) + ' $';
}

function setError(message) {
  document.getElementById('error').textContent = message || '';
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function parseStepsGarage(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveGarageCache() {
  localStorage.setItem(GARAGE_CACHE_KEY, JSON.stringify(data));
  localStorage.setItem(GARAGE_CACHE_TIME_KEY, String(Date.now()));
}

function clearGarageCache() {
  localStorage.removeItem(GARAGE_CACHE_KEY);
  localStorage.removeItem(GARAGE_CACHE_TIME_KEY);
}

function isAirOrBoatGarage(vehicle) {
  const catalogVehicle = data.catalog.find(v => v.name === String(vehicle.vehicle_name || ''));

  if (!catalogVehicle) return false;

  const dealership = normalizeGarage(catalogVehicle.dealership_id);
  return dealership === 'air' || dealership === 'boat';
}

function shouldShowPerfGarage(vehicle, perfName) {
  if (!isAirOrBoatGarage(vehicle)) return true;
  return normalizeGarage(perfName) === 'turbo';
}

function getPerfLabelGarage(perfName, index) {
  const key = normalizeGarage(perfName);
  return perfLabelsGarage[key]?.[index] || ('niveau ' + (index + 1));
}

function getCurrentPerfPrice(vehicle, perfName, index) {
  const steps = parseStepsGarage(vehicle[perfName + '_steps']);
  const dbPrice = Number(steps[index]) || 0;

  if (dbPrice > 0) return dbPrice;

  const perfLevels = data.performances[perfName] || [];
  const level = perfLevels[index];

  if (!level) return 0;

  const priceBase = roundUpMoneyGarage(Number(vehicle.price_ht) * (1 + data.tvaPerf));
  return roundUpMoneyGarage(priceBase * level.percent);
}

async function loadGarage() {
  try {
    setError('');

    const cached = localStorage.getItem(GARAGE_CACHE_KEY);
    const cachedTime = Number(localStorage.getItem(GARAGE_CACHE_TIME_KEY)) || 0;
    const cacheValid = cached && Date.now() - cachedTime < GARAGE_CACHE_DURATION;

    if (cacheValid) {
      data = JSON.parse(cached);
      renderGarage();

      api('getGarageData', {}, token)
        .then(freshData => {
          data = freshData;
          saveGarageCache();
          renderGarage();
        })
        .catch(() => {});

      return;
    }

    data = await api('getGarageData', {}, token);
    saveGarageCache();
    renderGarage();

  } catch (error) {
    setError(error.message);

    if (error.message.includes('Session') || error.message.includes('Connexion')) {
      localStorage.removeItem('garage_token');
      clearGarageCache();
      window.location.href = 'login.html';
    }
  }
}

function renderGarage() {
  document.getElementById('cardsTotal').textContent = data.cardsTotal;
  document.getElementById('cardsUsed').textContent = data.cardsUsed;
  document.getElementById('cardsFree').textContent = data.cardsFree;
  document.getElementById('cardsSpent').textContent = moneyGarage(data.cardsSpent || 0);

  const cardSelect = document.getElementById('cardSelect');
  cardSelect.innerHTML = data.freeCards.length === 0
    ? '<option value="">Aucune carte grise libre</option>'
    : data.freeCards.map(id => `<option value="${id}">Carte grise n°${id}</option>`).join('');

  document.getElementById('vehicleSelect').innerHTML = data.catalog.map(v =>
    `<option value="${escapeAttr(v.name)}">${escapeHtml(v.name)} — ${escapeHtml(v.category)}</option>`
  ).join('');

  renderVehiclesGarage();
}

function renderVehiclesGarage() {
  const container = document.getElementById('vehicleList');
  container.innerHTML = '';

  if (!data.vehicles.length) {
    container.innerHTML = '<p class="muted">Aucun véhicule enregistré.</p>';
    return;
  }

  data.vehicles.forEach(vehicle => {
    const sold = String(vehicle.status).toLowerCase() === 'vendu';
    const totalPerfs = Math.max(
      0,
      Number(vehicle.depense_total || 0) - Number(vehicle.price_ttc || 0)
    );

    const div = document.createElement('div');
    div.className = 'vehicle' + (sold ? ' sold' : '');

    div.innerHTML = `
      <div class="vehicle-title-box">
        <h3>Carte grise n°${escapeHtml(vehicle.card_id)} — ${escapeHtml(vehicle.vehicle_name)}</h3>
        <p class="muted">
          <strong>Gamme :</strong> ${escapeHtml(vehicle.category)}
          &nbsp;&nbsp;·&nbsp;&nbsp;
          <strong>Statut :</strong> ${escapeHtml(vehicle.status)}
        </p>
      </div>

      <div class="line">
        <strong>Nom personnalisé</strong>
        <input ${sold ? 'disabled' : ''} value="${escapeAttr(vehicle.custom_name || '')}" onchange="updateField(${vehicle.card_id}, 'custom_name', this.value)">
      </div>

      <div class="line">
        <strong>Plaque</strong>
        <input ${sold ? 'disabled' : ''} value="${escapeAttr(vehicle.plate || '')}" onchange="updateField(${vehicle.card_id}, 'plate', this.value)">
      </div>

      <div class="line last-info">
        <strong>Achat</strong>
        <span>${escapeHtml(vehicle.date_achat || '-')}</span>
      </div>
    `;

    if (sold) {
      div.innerHTML += `
        <div>
          <div class="line"><strong>Date vente</strong><span>${escapeHtml(vehicle.date_vente || '-')}</span></div>
          <div class="line"><strong>Prix vente</strong><span>${moneyGarage(vehicle.prix_vente)}</span></div>
          <div class="line last-info"><strong>Perte net</strong><span>${moneyGarage(vehicle.perte_net)}</span></div>
        </div>
      `;
    } else {
      div.innerHTML += renderPerfsGarage(vehicle);
      div.innerHTML += `<div class="section-separator"></div>`;
      div.innerHTML += `<button onclick="sellVehicle(${vehicle.card_id})">Vendre le véhicule</button>`;
    }

    div.innerHTML += `
      <div class="expense-box" style="margin-top:14px;">
        <div class="expense-row"><span>Achat véhicule</span><span>${moneyGarage(vehicle.price_ttc)}</span></div>
        <div class="expense-row"><span>Total perfs</span><span>${moneyGarage(totalPerfs)}</span></div>
        <div class="expense-row expense-main"><span>Dépense totale</span><span>${moneyGarage(vehicle.depense_total)}</span></div>
      </div>
    `;

    container.appendChild(div);
  });
}

function renderPerfsGarage(vehicle) {
  let html = '<div class="perfs">';

  const entries = Object.entries(data.performances)
    .filter(([perfName]) => shouldShowPerfGarage(vehicle, perfName))
    .sort((a, b) => {
      const ia = perfOrderGarage.indexOf(normalizeGarage(a[0]));
      const ib = perfOrderGarage.indexOf(normalizeGarage(b[0]));

      if (ia === -1 && ib === -1) return a[0].localeCompare(b[0], 'fr');
      if (ia === -1) return 1;
      if (ib === -1) return -1;

      return ia - ib;
    });

  entries.forEach(([perfName, levels]) => {
    const current = Number(vehicle[perfName + '_level']) || 0;

    html += `<div class="perf"><h4>${escapeHtml(perfName)}</h4>`;

    levels.forEach((level, index) => {
      const lvl = index + 1;
      const label = getPerfLabelGarage(perfName, index);
      const checked = current >= lvl ? 'checked' : '';
      const canChange = lvl === current || lvl === current + 1;
      const disabled = canChange ? '' : 'disabled';
      const price = getCurrentPerfPrice(vehicle, perfName, index);

      html += `
        <label class="perf-row">
          <span>
            <input
              type="checkbox"
              ${checked}
              ${disabled}
              onchange="togglePerf(${vehicle.card_id}, '${escapeAttr(perfName)}', ${lvl}, this.checked)"
            >
            ${escapeHtml(label)}
          </span>
          <span>${moneyGarage(price)}</span>
        </label>
      `;
    });

    html += '</div>';
  });

  html += '</div>';
  return html;
}

function toggleCardForm() {
  const cardForm = document.getElementById('cardForm');
  const vehicleForm = document.getElementById('vehicleForm');

  const willOpen = cardForm.style.display === 'none';

  cardForm.style.display = willOpen ? 'grid' : 'none';
  vehicleForm.style.display = 'none';
}

function toggleVehicleForm() {
  const cardForm = document.getElementById('cardForm');
  const vehicleForm = document.getElementById('vehicleForm');

  const willOpen = vehicleForm.style.display === 'none';

  vehicleForm.style.display = willOpen ? 'grid' : 'none';
  cardForm.style.display = 'none';
}

async function buyCard() {
  const payload = {
    date_achat: document.getElementById('cardDate').value,
    prix: document.getElementById('cardPrice').value,
    commentaire: document.getElementById('cardComment').value
  };

  try {
    setError('');
    data = await api('addGarageCard', payload, token);
    saveGarageCache();

    document.getElementById('cardDate').value = '';
    document.getElementById('cardPrice').value = '';
    document.getElementById('cardComment').value = '';
    document.getElementById('cardForm').style.display = 'none';

    renderGarage();
  } catch (error) {
    setError(error.message);
  }
}

async function addVehicle() {
  const cardId = document.getElementById('cardSelect').value;

  if (!cardId) {
    setError('Aucune carte grise libre.');
    return;
  }

  const payload = {
    card_id: cardId,
    vehicle_name: document.getElementById('vehicleSelect').value,
    custom_name: document.getElementById('customName').value,
    plate: document.getElementById('plate').value,
    date_achat: document.getElementById('dateAchat').value
  };

  try {
    setError('');
    data = await api('addGarageVehicle', payload, token);
    saveGarageCache();

    document.getElementById('customName').value = '';
    document.getElementById('plate').value = '';
    document.getElementById('dateAchat').value = '';
    document.getElementById('vehicleForm').style.display = 'none';

    renderGarage();
  } catch (error) {
    setError(error.message);
  }
}

async function updateField(cardId, field, value) {
  try {
    setError('');

    data = await api('updateGarageField', {
      cardId,
      field,
      value
    }, token);

    saveGarageCache();
    renderGarage();
  } catch (error) {
    setError(error.message);
  }
}

async function togglePerf(cardId, perfName, level, checked) {
  const action = checked ? 'upgradePerformance' : 'downgradePerformance';

  const payload = checked
    ? {
        cardId,
        perfName,
        newLevel: level
      }
    : {
        cardId,
        perfName,
        targetLevel: level - 1
      };

  try {
    setError('');
    data = await api(action, payload, token);
    saveGarageCache();
    renderGarage();
  } catch (error) {
    setError(error.message);
    loadGarage();
  }
}

async function sellVehicle(cardId) {
  const date = prompt('Date de vente ?');
  const price = prompt('Prix de vente ?');

  if (price === null) return;

  try {
    setError('');

    data = await api('sellGarageVehicle', {
      cardId,
      dateVente: date,
      prixVente: price
    }, token);

    saveGarageCache();
    renderGarage();
  } catch (error) {
    setError(error.message);
  }
}

loadGarage();