let data = null;
let token = localStorage.getItem('garage_token') || '';

const GARAGE_TARIFF_CACHE_SUFFIX = '_' + RcpTariff.get();
const GARAGE_CACHE_KEY = 'rcp_garage_data_v1_3_2' + GARAGE_TARIFF_CACHE_SUFFIX;
const GARAGE_CACHE_TIME_KEY = 'rcp_garage_data_time_v1_3_2' + GARAGE_TARIFF_CACHE_SUFFIX;
const GARAGE_CACHE_TOKEN_KEY = 'rcp_garage_data_token_v1_3_2' + GARAGE_TARIFF_CACHE_SUFFIX;
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

const VEHICLE_COLLAPSE_STORAGE_KEY = 'rcp_vehicle_collapse_states';
const SECTION_COLLAPSE_STORAGE_KEY = 'rcp_vehicle_section_states';
const GARAGE_PANEL_COLLAPSE_STORAGE_KEY = 'rcp_garage_panel_states';
const GARAGE_MASONRY_MIN_WIDTH = 1351;

const vehicleCollapseStates = loadGarageUiStates(VEHICLE_COLLAPSE_STORAGE_KEY);
const vehicleSectionStates = loadGarageUiStates(SECTION_COLLAPSE_STORAGE_KEY);
const garagePanelStates = loadGarageUiStates(GARAGE_PANEL_COLLAPSE_STORAGE_KEY);
const GARAGE_PANEL_DEFAULT_STATES = new Map([
  ['actions', true],
  ['cards', true],
  ['inventory', false]
]);
const vehicleOptionsStates = new Map();
const pendingGarageFieldUpdates = new Map();
let garageVehicleFilter = 'active';
let garageMasonryFrame = 0;
let garageViewportRestoreFrame = 0;
let garageViewportAnchor = null;

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
  window.location.href = 'login.html?target=inventory';
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
  const roundedValue = roundUpMoneyGarage(value);
  const displayedValue = Object.is(roundedValue, -0)
    ? 0
    : roundedValue;

  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0
  }).format(displayedValue) + ' $';
}

function moneyOrDashGarage(value) {
  const normalizedValue = Math.max(0, roundUpMoneyGarage(value));

  return normalizedValue > 0
    ? moneyGarage(normalizedValue)
    : '—';
}

function normalizeGarageAhmSuffix(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/^(?:AHM\.)+/, '');
}

function formatGarageAhmCode(value) {
  const suffix = normalizeGarageAhmSuffix(value);

  return suffix ? `AHM.${suffix}` : '';
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

function loadGarageUiStates(storageKey) {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');

    return new Map(
      Object.entries(stored).map(([key, value]) => [key, value === true])
    );
  } catch (error) {
    return new Map();
  }
}

function saveGarageUiStates(storageKey, states) {
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify(Object.fromEntries(states))
    );
  } catch (error) {
    /* L'interface reste utilisable si le stockage local est indisponible. */
  }
}

function restoreGarageViewportAnchor() {
  if (!garageViewportAnchor) return;

  const { element, top } = garageViewportAnchor;

  if (!element.isConnected) {
    garageViewportAnchor = null;
    return;
  }

  const offset = element.getBoundingClientRect().top - top;

  if (Math.abs(offset) > 0.5) {
    window.scrollBy(0, offset);
  }
}

function scheduleGarageViewportRestore(frameCount = 4) {
  window.cancelAnimationFrame(garageViewportRestoreFrame);

  const restoreOnNextFrame = () => {
    restoreGarageViewportAnchor();
    frameCount -= 1;

    if (garageViewportAnchor && frameCount > 0) {
      garageViewportRestoreFrame = window.requestAnimationFrame(
        restoreOnNextFrame
      );
      return;
    }

    garageViewportRestoreFrame = 0;
    garageViewportAnchor = null;
  };

  garageViewportRestoreFrame = window.requestAnimationFrame(
    restoreOnNextFrame
  );
}

function preserveGarageViewportPosition(element, updateState) {
  if (!element) {
    updateState();
    return;
  }

  window.cancelAnimationFrame(garageViewportRestoreFrame);
  garageViewportAnchor = {
    element,
    top: element.getBoundingClientRect().top
  };

  updateState();
  restoreGarageViewportAnchor();
  scheduleGarageViewportRestore();
}

function layoutGarageMasonry(list) {
  if (!list) return;

  const items = Array.from(list.children);
  const wideLayout = window.innerWidth >= GARAGE_MASONRY_MIN_WIDTH;

  items.forEach(item => {
    item.style.gridRowEnd = 'auto';
  });

  if (!wideLayout || items.length === 0) return;

  const styles = window.getComputedStyle(list);
  const rowHeight = Number.parseFloat(styles.gridAutoRows) || 8;
  const itemGap = Number.parseFloat(
    styles.getPropertyValue('--garage-masonry-gap')
  ) || 20;

  items.forEach(item => {
    const itemHeight = item.getBoundingClientRect().height;
    const rowSpan = Math.max(
      1,
      Math.ceil((itemHeight + itemGap) / rowHeight)
    );

    item.style.gridRowEnd = `span ${rowSpan}`;
  });
}

function scheduleGarageMasonry() {
  window.cancelAnimationFrame(garageMasonryFrame);

  garageMasonryFrame = window.requestAnimationFrame(() => {
    document.querySelectorAll('.garage-vehicle-section-list').forEach(
      layoutGarageMasonry
    );
    restoreGarageViewportAnchor();
  });
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
  requireCompatibleGarageData(data);
  RcpTariff.resolve(data.tariffScope);
  localStorage.setItem(GARAGE_CACHE_KEY, JSON.stringify(data));
  localStorage.setItem(GARAGE_CACHE_TIME_KEY, String(Date.now()));
  localStorage.setItem(GARAGE_CACHE_TOKEN_KEY, token);
}

function isCompatibleGarageData(candidate) {
  return Boolean(
    candidate &&
    candidate.apiVersion === CONFIG.VERSION &&
    Array.isArray(candidate.vehicles) &&
    Array.isArray(candidate.catalog) &&
    candidate.catalog.every(vehicle =>
      Boolean(vehicle.vehicle_id) &&
      typeof vehicle.is_job === 'boolean' &&
      typeof vehicle.is_special === 'boolean' &&
      Array.isArray(vehicle.allowed_perfs)
    ) &&
    candidate.vehicles.every(vehicle =>
      typeof vehicle.is_special === 'boolean' &&
      Array.isArray(vehicle.allowed_perfs)
    )
  );
}

function requireCompatibleGarageData(candidate) {
  if (!isCompatibleGarageData(candidate)) {
    throw new Error(
      'Version de l’API Inventaire incompatible. Déploie le backend v1.2 consolidé.'
    );
  }

  return candidate;
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
    message.includes('Connexion requise') ||
    message.includes('Connexion indisponible')
  );
}

function redirectToGarageLogin(message) {
  localStorage.removeItem('garage_token');
  clearGarageCache();

  if (message) {
    sessionStorage.setItem('garage_login_message', message);
  }

  window.location.replace('login.html?target=inventory');
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

function getVehicleCollapseKey(vehicle) {
  return String(vehicle.card_id);
}

function resizeGarageComment(textarea) {
  if (!textarea) return;

  textarea.style.height = 'auto';

  const borderHeight = textarea.offsetHeight - textarea.clientHeight;
  textarea.style.height = `${textarea.scrollHeight + borderHeight}px`;
}

function scheduleGarageCommentResize(card) {
  window.requestAnimationFrame(() => {
    const textarea = card.querySelector('.vehicle-comment-field textarea');

    if (!textarea || textarea.offsetParent === null) return;

    resizeGarageComment(textarea);
    scheduleGarageMasonry();
  });
}

function setVehicleCardCollapsed(card, collapseKey, collapsed) {
  card.classList.toggle('collapsed', collapsed);
  vehicleCollapseStates.set(collapseKey, collapsed);
  saveGarageUiStates(VEHICLE_COLLAPSE_STORAGE_KEY, vehicleCollapseStates);

  const header = card.querySelector('.vehicle-collapse-header');
  const icon = card.querySelector('.vehicle-collapse-icon');

  header.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  icon.textContent = collapsed ? '▼' : '▲';

  if (!collapsed) {
    scheduleGarageCommentResize(card);
  }

  scheduleGarageMasonry();
}

function setGarageSectionCollapsed(section, sectionKey, collapsed) {
  section.classList.toggle('collapsed', collapsed);
  vehicleSectionStates.set(sectionKey, collapsed);
  saveGarageUiStates(SECTION_COLLAPSE_STORAGE_KEY, vehicleSectionStates);

  const header = section.querySelector('.garage-vehicle-section-toggle');
  const icon = section.querySelector('.garage-vehicle-section-icon');

  header.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  icon.textContent = collapsed ? '▼' : '▲';
  scheduleGarageMasonry();
}

function setGaragePanelCollapsed(panel, panelKey, collapsed, persist = true) {
  panel.classList.toggle('collapsed', collapsed);

  const toggle = panel.querySelector('.garage-panel-toggle');
  const icon = panel.querySelector('.garage-panel-icon');

  toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  icon.textContent = collapsed ? '▼' : '▲';

  if (persist) {
    garagePanelStates.set(panelKey, collapsed);
    saveGarageUiStates(
      GARAGE_PANEL_COLLAPSE_STORAGE_KEY,
      garagePanelStates
    );
  }

  scheduleGarageMasonry();
}

function initializeGaragePanels() {
  document.querySelectorAll('[data-garage-panel]').forEach(panel => {
    const panelKey = panel.dataset.garagePanel;
    const collapsed = garagePanelStates.has(panelKey)
      ? garagePanelStates.get(panelKey) === true
      : GARAGE_PANEL_DEFAULT_STATES.get(panelKey) === true;
    const toggle = panel.querySelector('.garage-panel-toggle');

    setGaragePanelCollapsed(panel, panelKey, collapsed, false);

    toggle.addEventListener('click', () => {
      preserveGarageViewportPosition(toggle, () => {
        setGaragePanelCollapsed(
          panel,
          panelKey,
          !panel.classList.contains('collapsed')
        );
      });
    });
  });
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

  if (open) {
    scheduleGarageCommentResize(card);
  }

  scheduleGarageMasonry();
}

function toggleVehicleOptions(card, collapseKey) {
  setVehicleOptionsOpen(
    card,
    collapseKey,
    !card.classList.contains('options-open')
  );
}

function isSpecialGarageVehicle(vehicle) {
  return vehicle?.is_special === true;
}

function updateGarageCardSelect() {
  const vehicleSelect = document.getElementById('vehicleSelect');
  const cardSelect = document.getElementById('cardSelect');

  if (!vehicleSelect || !cardSelect || !data) return;

  const selectedVehicle = data.catalog.find(
    vehicle => String(vehicle.vehicle_id) === vehicleSelect.value
  );
  const special = selectedVehicle?.required_card_type === 'special';
  const availableCards = special
    ? (data.freeSpecialCards || [])
    : (data.freeCards || []);
  const label = special ? 'spéciale' : 'ordinaire';

  cardSelect.innerHTML = availableCards.length === 0
    ? `<option value="">Aucune carte grise ${label} libre</option>`
    : availableCards.map(
        id => {
          const displayNumber = data.cardDisplayNumbers?.[id] || id;

          return `<option value="${id}">Carte grise ${label} n°${displayNumber}</option>`;
        }
      ).join('');
}

function shouldShowPerfGarage(vehicle, perfName) {
  const allowedPerfs = Array.isArray(vehicle?.allowed_perfs)
    ? vehicle.allowed_perfs.map(normalizeGarage)
    : [];

  return allowedPerfs.includes(normalizeGarage(perfName));
}

function getPerfLabelGarage(perfName, index, levels) {
  const key = normalizeGarage(perfName);
  return levels?.[index]?.label || perfLabelsGarage[key]?.[index] || ('niveau ' + (index + 1));
}

function getCurrentPerfPrice(vehicle, perfName, index) {
  const steps = parseStepsGarage(vehicle[perfName + '_steps']);
  const dbPrice = Number(steps[index]) || 0;

  if (dbPrice > 0) return dbPrice;

  const perfLevels = data.performances[perfName] || [];
  const level = perfLevels[index];

  if (!level) return 0;

  return calculatePerformancePrice(
    Number(vehicle.price_ht),
    level.percent,
    data.tvaPerf
  );
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

        if (!isCompatibleGarageData(parsedCache)) {
          throw new Error('Cache incomplet');
        }

        data = parsedCache;
        RcpTariff.resolve(data.tariffScope);
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

      api('getGarageData', { tariffScope: RcpTariff.getRequestScope() }, token)
        .then(freshData => {
          data = requireCompatibleGarageData(freshData);
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

    data = requireCompatibleGarageData(
      await api('getGarageData', { tariffScope: RcpTariff.getRequestScope() }, token)
    );
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
  if (Array.isArray(data.dataWarnings) && data.dataWarnings.length) {
    setError('Avertissement données : ' + data.dataWarnings.join(' | '));
  }

  const activeVehicles = data.vehicles.filter(
    vehicle => !isGarageVehicleArchived(vehicle)
  );
  const normalCardsUsed = activeVehicles.filter(
    vehicle => !isSpecialGarageVehicle(vehicle)
  ).length;
  const specialCardsUsed = activeVehicles.filter(isSpecialGarageVehicle).length;
  const normalCardsFree = (data.freeCards || []).length;
  const specialCardsFree = (data.freeSpecialCards || []).length;
  const normalCardsSpent = Math.max(0, Number(data.normalCardsSpent) || 0);
  const specialCardsSpent = Math.max(0, Number(data.specialCardsSpent) || 0);
  const cardsSpent = normalCardsSpent + specialCardsSpent;

  document.getElementById('normalCardsTotal').textContent = normalCardsUsed + normalCardsFree;
  document.getElementById('normalCardsUsed').textContent = normalCardsUsed;
  document.getElementById('normalCardsFree').textContent = normalCardsFree;
  document.getElementById('specialCardsTotal').textContent = specialCardsUsed + specialCardsFree;
  document.getElementById('specialCardsUsed').textContent = specialCardsUsed;
  document.getElementById('specialCardsFree').textContent = specialCardsFree;
  document.getElementById('normalCardsSpent').textContent = moneyOrDashGarage(normalCardsSpent);
  document.getElementById('specialCardsSpent').textContent = moneyOrDashGarage(specialCardsSpent);
  document.getElementById('cardsSpent').textContent = moneyOrDashGarage(cardsSpent);

  document.getElementById('vehicleSelect').innerHTML = data.catalog.map(v =>
    `<option value="${escapeAttr(v.vehicle_id)}">${escapeHtml(v.name)} — ${escapeHtml(v.category)}</option>`
  ).join('');

  updateGarageCardSelect();

  renderVehiclesGarage();
}

function renderVehiclesGarage() {
  const container = document.getElementById('vehicleList');
  container.innerHTML = '';

  updateGarageVehicleFilters();

  const visibleVehicles = data.vehicles.filter(vehicle =>
    matchesGarageVehicleFilter(vehicle, garageVehicleFilter)
  );

  const mainVehicles = visibleVehicles.filter(
    vehicle => !isSpecialGarageVehicle(vehicle)
  );
  const specialVehicles = visibleVehicles.filter(isSpecialGarageVehicle);

  const sections = [
    { key: 'normal', title: 'Véhicules', special: false, vehicles: mainVehicles },
    { key: 'special', title: 'Véhicules spéciaux', special: true, vehicles: specialVehicles }
  ];

  sections.forEach(section => {
    const sectionElement = document.createElement('section');
    const sectionCollapsed = vehicleSectionStates.get(section.key) === true;
    sectionElement.className =
      'garage-vehicle-section' +
      (section.special ? ' special' : '') +
      (sectionCollapsed ? ' collapsed' : '');
    sectionElement.innerHTML = `
      <button
        type="button"
        class="garage-vehicle-section-toggle"
        aria-expanded="${sectionCollapsed ? 'false' : 'true'}"
      >
        <span>${section.title}</span>
        <span class="garage-vehicle-section-icon" aria-hidden="true">${sectionCollapsed ? '▼' : '▲'}</span>
      </button>
      <div class="garage-vehicle-section-content">
        <div class="garage-vehicle-section-list"></div>
      </div>
    `;

    const sectionList = sectionElement.querySelector('.garage-vehicle-section-list');

    if (!section.vehicles.length) {
      sectionList.innerHTML = '<p class="muted vehicle-filter-empty">Aucun véhicule dans cette catégorie.</p>';
    }

    const sectionToggle = sectionElement.querySelector(
      '.garage-vehicle-section-toggle'
    );

    sectionToggle.addEventListener('click', () => {
      preserveGarageViewportPosition(sectionToggle, () => {
        setGarageSectionCollapsed(
          sectionElement,
          section.key,
          !sectionElement.classList.contains('collapsed')
        );
      });
    });

    section.vehicles.forEach(vehicle => {
    const archived = isGarageVehicleArchived(vehicle);
    const exitType = getGarageExitType(vehicle);
    const collapseKey = getVehicleCollapseKey(vehicle);
    const collapsed = vehicleCollapseStates.has(collapseKey)
      ? vehicleCollapseStates.get(collapseKey)
      : archived;
    const optionsOpen = !archived && vehicleOptionsStates.get(collapseKey) === true;
    const cardNumber = escapeHtml(vehicle.card_number || vehicle.card_id);
    const displayedAhmCode = escapeHtml(
      formatGarageAhmCode(vehicle.code_ahm) || 'AHM.?'
    );
    const displayedCustomName = escapeHtml(vehicle.custom_name || '-');
    const displayedCardNumber = section.special
      ? `Spéciale N°${cardNumber}`
      : `N°${cardNumber}`;

    const totalPerfs = Math.max(0, Number(vehicle.performance_total) || 0);

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
          <span class="vehicle-title-text">
            <span class="vehicle-title-identity"><span class="vehicle-ahm-code">${displayedAhmCode}</span><span class="vehicle-title-separator" aria-hidden="true"> — </span><span class="vehicle-custom-name">${displayedCustomName}</span></span>
            <span class="vehicle-title-separator" aria-hidden="true"> — </span>
            <span class="vehicle-card-name">${escapeHtml(vehicle.vehicle_name)}</span>
          </span>
          <span class="vehicle-collapse-icon" aria-hidden="true">${collapsed ? '▼' : '▲'}</span>
        </h3>
      </div>

      <div class="vehicle-collapse-content">
        <div class="vehicle-summary-grid">
          <div class="vehicle-summary-item">
            <span class="vehicle-summary-label">Carte grise</span>
            <strong class="vehicle-summary-value">${displayedCardNumber}</strong>
          </div>

          <div class="vehicle-summary-item">
            <span class="vehicle-summary-label">Gamme</span>
            <strong class="vehicle-summary-value">${escapeHtml(vehicle.category || '-')}</strong>
          </div>

          <div class="vehicle-summary-item vehicle-summary-options-hidden">
            <span class="vehicle-summary-label">Plaque</span>
            <strong class="vehicle-summary-value">${escapeHtml(vehicle.plate || '-')}</strong>
          </div>

          <div class="vehicle-summary-item vehicle-summary-options-hidden">
            <span class="vehicle-summary-label">Statut</span>
            <strong class="vehicle-summary-value">${escapeHtml(vehicle.status || '-')}</strong>
          </div>

          <div class="vehicle-summary-item vehicle-summary-comment vehicle-summary-options-hidden">
            <span class="vehicle-summary-label">Commentaire</span>
            <span class="vehicle-summary-value vehicle-summary-comment-value">${escapeHtml(vehicle.commentaire || 'Aucun commentaire')}</span>
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

      vehicleHtml += '<div class="vehicle-info-separator"></div>';
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
              Code AHM
              <span class="vehicle-ahm-input">
                <span class="vehicle-ahm-prefix">AHM.</span>
                <input
                  value="${escapeAttr(normalizeGarageAhmSuffix(vehicle.code_ahm))}"
                  placeholder="Q01"
                  maxlength="28"
                  onchange="updateGarageAhmField(${vehicle.card_id}, this)"
                >
              </span>
            </label>

            <label>
              Nom personnalisé
              <input maxlength="120" value="${escapeAttr(vehicle.custom_name || '')}" onchange="updateField(${vehicle.card_id}, 'custom_name', this.value)">
            </label>

            <label>
              Plaque
              <input maxlength="24" value="${escapeAttr(vehicle.plate || '')}" onchange="updateField(${vehicle.card_id}, 'plate', this.value)">
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
                maxlength="5000"
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
      preserveGarageViewportPosition(collapseHeader, () => {
        toggleVehicleCard(div, collapseKey);
      });
    });

    collapseHeader.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;

      event.preventDefault();
      preserveGarageViewportPosition(collapseHeader, () => {
        toggleVehicleCard(div, collapseKey);
      });
    });

    const optionsButton = div.querySelector('.vehicle-options-toggle');

    if (optionsButton) {
      optionsButton.addEventListener('click', () => {
        preserveGarageViewportPosition(optionsButton, () => {
          toggleVehicleOptions(div, collapseKey);
        });
      });
    }

    const commentTextarea = div.querySelector('.vehicle-comment-field textarea');

    if (commentTextarea) {
      commentTextarea.addEventListener('input', () => {
        resizeGarageComment(commentTextarea);
        scheduleGarageMasonry();
      });
    }

    sectionList.appendChild(div);

    if (optionsOpen && !collapsed) {
      scheduleGarageCommentResize(div);
    }
    });

    container.appendChild(sectionElement);
  });

  scheduleGarageMasonry();
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

  if (entries.length === 0) return '';

  entries.forEach(([perfName, levels]) => {
    const current = Number(vehicle[perfName + '_level']) || 0;

    html += `<div class="perf"><h4>${escapeHtml(levels?.[0]?.performance_label || perfName)}</h4>`;

    levels.forEach((level, index) => {
      const lvl = index + 1;
      const label = getPerfLabelGarage(perfName, index, levels);
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
    card_type: document.getElementById('cardType').value,
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
    tariffScope: RcpTariff.get(),
    card_id: cardId,
    vehicle_id: document.getElementById('vehicleSelect').value,
    custom_name: document.getElementById('customName').value,
    plate: document.getElementById('plate').value,
    code_ahm: formatGarageAhmCode(document.getElementById('codeAhm').value),
    date_achat: document.getElementById('dateAchat').value
  };

  try {
    setError('');
    data = await api('addGarageVehicle', payload, token);
    saveGarageCache();

    document.getElementById('customName').value = '';
    document.getElementById('plate').value = '';
    document.getElementById('codeAhm').value = '';
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

async function updateGarageAhmField(cardId, input) {
  const suffix = normalizeGarageAhmSuffix(input.value);

  input.value = suffix;
  return updateField(cardId, 'code_ahm', formatGarageAhmCode(suffix));
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
      newLevel: level,
      tariffScope: RcpTariff.get()
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

window.addEventListener('rcp:tariff-scope-change', () => window.location.reload());

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

window.addEventListener('resize', scheduleGarageMasonry, { passive: true });

if (document.fonts?.ready) {
  document.fonts.ready.then(scheduleGarageMasonry);
}

initializeGaragePanels();
loadGarage();
