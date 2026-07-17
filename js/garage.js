let data = null;
let token = localStorage.getItem('garage_token') || '';

const GARAGE_CACHE_KEY = 'rcp_garage_data';
const GARAGE_CACHE_TIME_KEY = 'rcp_garage_data_time';
const GARAGE_CACHE_TOKEN_KEY = 'rcp_garage_data_token';
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

const vehicleCollapseStates = new Map();
const vehicleOptionsStates = new Map();
const pendingGarageFieldUpdates = new Map();
let garageVehicleFilter = 'active';

const GARAGE_STATUS_OPTIONS = [
  'Appartement',
  "Benny's",
  'LSDWP',
  'Parking public',
  'Parking privé',
  'Fourrière',
  'Disparu'
];

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

function renderGarageStatusOptions(currentStatus) {
  const current = String(currentStatus || '');
  const statuses = Array.isArray(data.statusOptions) && data.statusOptions.length
    ? data.statusOptions
    : GARAGE_STATUS_OPTIONS;

  let html = '';

  if (current && !statuses.includes(current)) {
    html += `
      <option value="${escapeAttr(current)}" selected disabled>
        ${escapeHtml(current)} — ancien statut
      </option>
    `;
  }

  statuses.forEach(status => {
    const selected = status === current ? 'selected' : '';

    html += `
      <option value="${escapeAttr(status)}" ${selected}>
        ${escapeHtml(status)}
      </option>
    `;
  });

  return html;
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
  localStorage.setItem(GARAGE_CACHE_TOKEN_KEY, token);
}

function clearGarageCache() {
  localStorage.removeItem(GARAGE_CACHE_KEY);
  localStorage.removeItem(GARAGE_CACHE_TIME_KEY);
  localStorage.removeItem(GARAGE_CACHE_TOKEN_KEY);
}

function isGarageSessionError(error) {
  const message = String(error?.message || error || '');

  return (
    message.includes('Session expirée') ||
    message.includes('Connexion requise')
  );
}

function redirectToGarageLogin(message) {
  localStorage.removeItem('garage_token');
  clearGarageCache();

  if (message) {
    sessionStorage.setItem('garage_login_message', message);
  }

  window.location.replace('login.html');
}

async function logoutGarageUser() {
  const logoutButton = document.getElementById('logoutButton');

  logoutButton.disabled = true;
  logoutButton.textContent = 'Déconnexion...';

  try {
    await api('logoutGarage', {}, token);
  } catch (error) {
    /* La déconnexion locale reste prioritaire si le réseau est indisponible. */
  }

  redirectToGarageLogin('Déconnexion effectuée.');
}

function isGarageVehicleArchived(vehicle) {
  const status = normalizeGarage(vehicle.status);

  return (
    status === 'vendu' ||
    status === 'sorti' ||
    Boolean(vehicle.exit_type)
  );
}

function getGarageExitType(vehicle) {
  const exitType = normalizeGarage(vehicle.exit_type);

  if (exitType === 'assurance') return 'assurance';
  if (exitType === 'vendu') return 'vendu';

  return normalizeGarage(vehicle.status) === 'vendu'
    ? 'vendu'
    : '';
}

function matchesGarageVehicleFilter(vehicle, filter) {
  if (filter === 'all') return true;

  const archived = isGarageVehicleArchived(vehicle);

  if (filter === 'active') return !archived;

  return archived && getGarageExitType(vehicle) === filter;
}

function updateGarageVehicleFilters() {
  const counts = {
    active: data.vehicles.filter(vehicle =>
      matchesGarageVehicleFilter(vehicle, 'active')
    ).length,
    vendu: data.vehicles.filter(vehicle =>
      matchesGarageVehicleFilter(vehicle, 'vendu')
    ).length,
    assurance: data.vehicles.filter(vehicle =>
      matchesGarageVehicleFilter(vehicle, 'assurance')
    ).length,
    all: data.vehicles.length
  };

  document.getElementById('activeVehiclesCount').textContent = counts.active;
  document.getElementById('soldVehiclesCount').textContent = counts.vendu;
  document.getElementById('insuredVehiclesCount').textContent = counts.assurance;
  document.getElementById('allVehiclesCount').textContent = counts.all;

  document.querySelectorAll('.vehicle-filter').forEach(button => {
    const selected = button.dataset.filter === garageVehicleFilter;

    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', selected ? 'true' : 'false');
  });
}

function setGarageVehicleFilter(filter) {
  const validFilters = ['active', 'vendu', 'assurance', 'all'];

  if (!validFilters.includes(filter)) return;

  garageVehicleFilter = filter;
  renderVehiclesGarage();
}

function getTodayGarageInputDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatGarageInputDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);

  return match
    ? `${match[3]}/${match[2]}/${match[1]}`
    : String(value || '');
}

function parseGarageMoneyInput(value) {
  const normalized = String(value || '')
    .replace(/\s/g, '')
    .replace(',', '.');

  return Number(normalized);
}

function getVehicleCollapseKey(vehicle, index) {
  const archiveState = isGarageVehicleArchived(vehicle)
    ? 'archived'
    : 'active';

  return [
    index,
    vehicle.card_id,
    vehicle.vehicle_name,
    vehicle.created_at || vehicle.date_achat || '',
    archiveState
  ].join('|');
}

function setVehicleCardCollapsed(card, collapseKey, collapsed) {
  card.classList.toggle('collapsed', collapsed);
  vehicleCollapseStates.set(collapseKey, collapsed);

  const header = card.querySelector('.vehicle-collapse-header');
  const icon = card.querySelector('.vehicle-collapse-icon');

  header.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  icon.textContent = collapsed ? '▼' : '▲';
}

function toggleVehicleCard(card, collapseKey) {
  setVehicleCardCollapsed(
    card,
    collapseKey,
    !card.classList.contains('collapsed')
  );
}

function setVehicleOptionsOpen(card, collapseKey, open) {
  card.classList.toggle('options-open', open);
  vehicleOptionsStates.set(collapseKey, open);

  const button = card.querySelector('.vehicle-options-toggle');
  const icon = card.querySelector('.vehicle-options-icon');

  button.setAttribute('aria-expanded', open ? 'true' : 'false');
  icon.textContent = open ? '▲' : '▼';
}

function toggleVehicleOptions(card, collapseKey) {
  setVehicleOptionsOpen(
    card,
    collapseKey,
    !card.classList.contains('options-open')
  );
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

    let cacheLoaded = false;

    const cached = localStorage.getItem(GARAGE_CACHE_KEY);
    const cachedTime = Number(localStorage.getItem(GARAGE_CACHE_TIME_KEY)) || 0;
    const cachedToken = localStorage.getItem(GARAGE_CACHE_TOKEN_KEY);
    const cacheValid =
      cached &&
      cachedToken === token &&
      Date.now() - cachedTime < GARAGE_CACHE_DURATION;

    if (cacheValid) {
      try {
        const parsedCache = JSON.parse(cached);

        if (!parsedCache || !Array.isArray(parsedCache.vehicles)) {
          throw new Error('Cache incomplet');
        }

        data = parsedCache;
        renderGarage();
        cacheLoaded = true;
      } catch (error) {
        clearGarageCache();
        data = null;
      }
    } else if (cached) {
      clearGarageCache();
    }

    if (cacheLoaded) {

      api('getGarageData', {}, token)
        .then(freshData => {
          data = freshData;
          saveGarageCache();
          renderGarage();
        })
        .catch(error => {
          if (isGarageSessionError(error)) {
            redirectToGarageLogin('Ta session a expiré. Reconnecte-toi.');
            return;
          }

          setError(
            'Mise à jour impossible : affichage des dernières données enregistrées.'
          );
        });

      return;
    }

    data = await api('getGarageData', {}, token);
    saveGarageCache();
    renderGarage();

  } catch (error) {
    if (isGarageSessionError(error)) {
      redirectToGarageLogin('Ta session a expiré. Reconnecte-toi.');
      return;
    }

    setError(error.message);
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

  updateGarageVehicleFilters();

  if (!data.vehicles.length) {
    container.innerHTML = '<p class="muted">Aucun véhicule enregistré.</p>';
    return;
  }

  const visibleVehicles = data.vehicles.filter(vehicle =>
    matchesGarageVehicleFilter(vehicle, garageVehicleFilter)
  );

  if (!visibleVehicles.length) {
    const emptyMessages = {
      active: 'Aucun véhicule actuellement en possession.',
      vendu: 'Aucun véhicule vendu.',
      assurance: "Aucun véhicule sorti par l'assurance.",
      all: 'Aucun véhicule enregistré.'
    };

    container.innerHTML = `<p class="muted vehicle-filter-empty">${emptyMessages[garageVehicleFilter]}</p>`;
    return;
  }

  visibleVehicles.forEach(vehicle => {
    const vehicleIndex = data.vehicles.indexOf(vehicle);
    const archived = isGarageVehicleArchived(vehicle);
    const exitType = getGarageExitType(vehicle);
    const collapseKey = getVehicleCollapseKey(vehicle, vehicleIndex);
    const collapsed = vehicleCollapseStates.has(collapseKey)
      ? vehicleCollapseStates.get(collapseKey)
      : archived;
    const optionsOpen = !archived && vehicleOptionsStates.get(collapseKey) === true;

    const totalPerfs = Math.max(
      0,
      Number(vehicle.depense_total || 0) - Number(vehicle.price_ttc || 0)
    );

    const div = document.createElement('div');
    div.className =
      'vehicle' +
      (archived ? ' sold archived' : '') +
      (collapsed ? ' collapsed' : '') +
      (optionsOpen ? ' options-open' : '');

    let vehicleHtml = `
      <div
        class="vehicle-title-box vehicle-collapse-header"
        role="button"
        tabindex="0"
        aria-expanded="${collapsed ? 'false' : 'true'}"
      >
        <h3>
          <span>Carte grise n°${escapeHtml(vehicle.card_id)} — ${escapeHtml(vehicle.vehicle_name)}</span>
          <span class="vehicle-collapse-icon" aria-hidden="true">${collapsed ? '▼' : '▲'}</span>
        </h3>
      </div>

      <div class="vehicle-collapse-content">
        <div class="vehicle-summary-grid">
          <div class="vehicle-summary-item">
            <span class="vehicle-summary-label">Gamme</span>
            <strong class="vehicle-summary-value">${escapeHtml(vehicle.category || '-')}</strong>
          </div>

          <div class="vehicle-summary-item">
            <span class="vehicle-summary-label">Statut</span>
            <strong class="vehicle-summary-value">${escapeHtml(vehicle.status || '-')}</strong>
          </div>

          <div class="vehicle-summary-item vehicle-summary-optional">
            <span class="vehicle-summary-label">Nom personnalisé</span>
            <strong class="vehicle-summary-value">${escapeHtml(vehicle.custom_name || '-')}</strong>
          </div>

          <div class="vehicle-summary-item vehicle-summary-optional">
            <span class="vehicle-summary-label">Plaque</span>
            <strong class="vehicle-summary-value">${escapeHtml(vehicle.plate || '-')}</strong>
          </div>
        </div>

    `;

    if (archived) {
      if (exitType === 'assurance') {
        vehicleHtml += `
          <div class="vehicle-info-separator"></div>

          <div class="vehicle-summary-grid vehicle-sale-grid">
            <div class="vehicle-summary-item">
              <span class="vehicle-summary-label">Motif de sortie</span>
              <strong class="vehicle-summary-value">Assurance</strong>
            </div>

            <div class="vehicle-summary-item">
              <span class="vehicle-summary-label">Date de sortie</span>
              <strong class="vehicle-summary-value">${escapeHtml(vehicle.date_vente || '-')}</strong>
            </div>

            <div class="vehicle-summary-item">
              <span class="vehicle-summary-label">Perte nette</span>
              <strong class="vehicle-summary-value">${moneyGarage(vehicle.perte_net)}</strong>
            </div>
          </div>
        `;
      } else {
        vehicleHtml += `
        <div class="vehicle-info-separator"></div>

        <div class="vehicle-summary-grid vehicle-sale-grid">
          <div class="vehicle-summary-item">
            <span class="vehicle-summary-label">Date de vente</span>
            <strong class="vehicle-summary-value">${escapeHtml(vehicle.date_vente || '-')}</strong>
          </div>

          <div class="vehicle-summary-item">
            <span class="vehicle-summary-label">Prix de vente</span>
            <strong class="vehicle-summary-value">${moneyGarage(vehicle.prix_vente)}</strong>
          </div>

          <div class="vehicle-summary-item">
            <span class="vehicle-summary-label">Perte nette</span>
            <strong class="vehicle-summary-value">${moneyGarage(vehicle.perte_net)}</strong>
          </div>
        </div>
        `;
      }

      vehicleHtml += `
        <div class="vehicle-info-separator"></div>

        <div class="vehicle-archive-comment">
          <span class="vehicle-summary-label">Commentaire</span>
          <p>${escapeHtml(vehicle.commentaire || 'Aucun commentaire')}</p>
        </div>

        <div class="vehicle-info-separator"></div>
      `;
    } else {
      vehicleHtml += `
        <button
          type="button"
          class="secondary-button vehicle-options-toggle"
          aria-expanded="${optionsOpen ? 'true' : 'false'}"
        >
          <span>Options du véhicule</span>
          <span class="vehicle-options-icon" aria-hidden="true">${optionsOpen ? '▲' : '▼'}</span>
        </button>

        <div class="vehicle-options-panel">
          <div class="vehicle-options-fields">
            <label>
              Nom personnalisé
              <input value="${escapeAttr(vehicle.custom_name || '')}" onchange="updateField(${vehicle.card_id}, 'custom_name', this.value)">
            </label>

            <label>
              Plaque
              <input value="${escapeAttr(vehicle.plate || '')}" onchange="updateField(${vehicle.card_id}, 'plate', this.value)">
            </label>

            <label>
              Statut
              <select onchange="updateGarageStatus(${vehicle.card_id}, this.value)">
                ${renderGarageStatusOptions(vehicle.status)}
              </select>
            </label>

            <label class="vehicle-comment-field">
              Commentaire
              <textarea
                placeholder="Commentaire libre"
                onchange="updateField(${vehicle.card_id}, 'commentaire', this.value)"
              >${escapeHtml(vehicle.commentaire || '')}</textarea>
            </label>
          </div>

          <div class="vehicle-exit-box">
            <h4>Sortie du véhicule</h4>
            <p class="vehicle-exit-warning">
              Cette opération archive définitivement le véhicule et libère sa carte grise.
            </p>

            <div class="vehicle-exit-fields">
              <label>
                Motif
                <select id="exitType-${vehicle.card_id}" onchange="updateGarageExitForm(${vehicle.card_id})">
                  <option value="vendu">Vendu</option>
                  <option value="assurance">Assurance</option>
                </select>
              </label>

              <label>
                Date de sortie
                <input id="exitDate-${vehicle.card_id}" type="date" value="${getTodayGarageInputDate()}">
              </label>

              <label id="exitAmountField-${vehicle.card_id}">
                Prix de vente
                <input id="exitAmount-${vehicle.card_id}" inputmode="decimal" placeholder="Ex : 21 500">
              </label>
            </div>

            <button type="button" class="vehicle-exit-button" onclick="exitVehicle(${vehicle.card_id})">
              Valider la sortie définitive
            </button>
          </div>
        </div>
      `;

      vehicleHtml += renderPerfsGarage(vehicle);
    }

    vehicleHtml += `
      <div class="expense-box vehicle-expense-box">
        <div class="expense-row"><span>Achat véhicule — ${escapeHtml(vehicle.date_achat || '-')}</span><span>${moneyGarage(vehicle.price_ttc)}</span></div>
        <div class="expense-row"><span>Total perfs</span><span>${moneyGarage(totalPerfs)}</span></div>
        <div class="expense-row expense-main"><span>Dépense totale</span><span>${moneyGarage(vehicle.depense_total)}</span></div>
      </div>
      </div>
    `;

    div.innerHTML = vehicleHtml;

    const collapseHeader = div.querySelector('.vehicle-collapse-header');

    collapseHeader.addEventListener('click', () => {
      toggleVehicleCard(div, collapseKey);
    });

    collapseHeader.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;

      event.preventDefault();
      toggleVehicleCard(div, collapseKey);
    });

    const optionsButton = div.querySelector('.vehicle-options-toggle');

    if (optionsButton) {
      optionsButton.addEventListener('click', () => {
        toggleVehicleOptions(div, collapseKey);
      });
    }

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
  const updateKey = `${cardId}|${field}`;
  const request = (async () => {
    try {
      setError('');

      data = await api('updateGarageField', {
        cardId,
        field,
        value
      }, token);

      saveGarageCache();
      renderGarage();
      return true;
    } catch (error) {
      setError(error.message);
      return false;
    }
  })();

  pendingGarageFieldUpdates.set(updateKey, request);

  const result = await request;

  if (pendingGarageFieldUpdates.get(updateKey) === request) {
    pendingGarageFieldUpdates.delete(updateKey);
  }

  return result;
}

async function updateGarageStatus(cardId, status) {
  try {
    setError('');

    data = await api('updateGarageStatus', {
      cardId,
      status
    }, token);

    saveGarageCache();
    renderGarage();
  } catch (error) {
    setError(error.message);
    renderGarage();
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

function updateGarageExitForm(cardId) {
  const exitType = document.getElementById(`exitType-${cardId}`).value;
  const amountField = document.getElementById(`exitAmountField-${cardId}`);
  const amountInput = document.getElementById(`exitAmount-${cardId}`);

  const isSale = exitType === 'vendu';

  amountField.hidden = !isSale;
  amountInput.disabled = !isSale;

  if (!isSale) {
    amountInput.value = '';
  }
}

async function exitVehicle(cardId) {
  const exitType = document.getElementById(`exitType-${cardId}`).value;
  const exitDateInput = document.getElementById(`exitDate-${cardId}`);
  const amountInput = document.getElementById(`exitAmount-${cardId}`);
  const exitDate = formatGarageInputDate(exitDateInput.value);

  if (!exitDate) {
    setError('Indique une date de sortie.');
    exitDateInput.focus();
    return;
  }

  let recoveredAmount = 0;

  if (exitType === 'vendu') {
    if (!amountInput.value.trim()) {
      setError('Indique le prix de vente.');
      amountInput.focus();
      return;
    }

    recoveredAmount = parseGarageMoneyInput(amountInput.value);

    if (!Number.isFinite(recoveredAmount) || recoveredAmount < 0) {
      setError('Le prix de vente est invalide.');
      amountInput.focus();
      return;
    }
  }

  const actionLabel = exitType === 'vendu'
    ? 'vendre et archiver ce véhicule'
    : "archiver ce véhicule au titre de l'assurance";

  if (!confirm(`Confirmer : ${actionLabel} ? Cette action est définitive.`)) {
    return;
  }

  const pendingCommentUpdate = pendingGarageFieldUpdates.get(
    `${cardId}|commentaire`
  );

  if (pendingCommentUpdate) {
    const commentSaved = await pendingCommentUpdate;

    if (!commentSaved) return;
  }

  try {
    setError('');

    data = await api('exitGarageVehicle', {
      cardId,
      exitType,
      exitDate,
      recoveredAmount
    }, token);

    garageVehicleFilter = exitType;
    saveGarageCache();
    renderGarage();
  } catch (error) {
    setError(error.message);
  }
}

loadGarage();
