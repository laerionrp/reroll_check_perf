let appData = null;
let selectedVehicle = null;

const PUBLIC_CACHE_KEY = 'rcp_public_data_v1_3_3';
const PUBLIC_CACHE_TIME_KEY = 'rcp_public_data_time_v1_3_3';
const PUBLIC_LEGACY_CACHE_KEYS = [
  'rcp_public_data_v1_3_2',
  'rcp_public_data_v1_3_2_',
  'rcp_public_data_v1_3_2_LS',
  'rcp_public_data_v1_3_2_BC'
];
const PUBLIC_CACHE_DURATION = 24 * 60 * 60 * 1000;

const perfLabels = {
  blindage: ['20%', '40%', '60%'],

  frein: ['rue', 'sport', 'course'],

  moteur: [
    'reprog',
    'reprog niv. 1',
    'reprog niv. 2',
    'reprog niv. 3'
  ],

  suspension: ['rue', 'sport', 'course'],

  transmission: [
    'rue',
    'sport',
    'course',
    'niveau 4'
  ],

  turbo: ['turbo']
};

const perfOrder = [
  'blindage',
  'frein',
  'moteur',
  'suspension',
  'transmission',
  'turbo'
];

const searchInput = document.getElementById('search');
const vehicleSelect = document.getElementById('vehicleSelect');
const debugBox = document.getElementById('debug');
const errorBox = document.getElementById('errorBox');

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function roundUpMoney(value) {
  return Math.ceil((Number(value) || 0) - 0.000001);
}

function money(value) {
  const roundedValue = roundUpMoney(value);
  const displayedValue = Object.is(roundedValue, -0)
    ? 0
    : roundedValue;

  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0
  }).format(displayedValue) + ' $';
}

function showError(message) {
  errorBox.style.display = 'block';
  errorBox.textContent = message;
}

function clearError() {
  errorBox.style.display = 'none';
  errorBox.textContent = '';
}

function isJobVehicle(vehicle) {
  return vehicle?.is_job === true;
}

function isCompatiblePublicData(candidate) {
  return Boolean(
    candidate &&
    candidate.apiVersion === CONFIG.VERSION &&
    Array.isArray(candidate.vehicles) &&
    Array.isArray(candidate.tariffProfiles) &&
    candidate.tariffProfiles.length >= 2 &&
    candidate.vehicles.every(vehicle =>
      typeof vehicle.is_job === 'boolean' &&
      Array.isArray(vehicle.public_allowed_perfs)
    )
  );
}

function requireCompatiblePublicData(candidate) {
  if (!isCompatiblePublicData(candidate)) {
    throw new Error(
      'Version de l’API incompatible. Déploie le backend v1.3.3.'
    );
  }

  return candidate;
}

function applyPublicTariffScope(candidate, requestedScope) {
  const scope = String(
    requestedScope || candidate?.tariffScope || ''
  ).trim().toUpperCase();
  const profile = (candidate?.tariffProfiles || []).find(
    item => String(item.scope || '').toUpperCase() === scope
  );

  if (!profile) return false;

  candidate.tariffScope = profile.scope;
  candidate.tvaVehicle = Number(profile.vehicleVat) || 0;
  candidate.tvaPerf = Number(profile.customizationVat) || 0;
  return true;
}

function readPublicCache() {
  const cacheKeys = [PUBLIC_CACHE_KEY, ...PUBLIC_LEGACY_CACHE_KEYS];

  for (const cacheKey of cacheKeys) {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) continue;

    try {
      const candidate = JSON.parse(raw);
      if (!isCompatiblePublicData(candidate)) continue;

      const timeKey = cacheKey === PUBLIC_CACHE_KEY
        ? PUBLIC_CACHE_TIME_KEY
        : cacheKey.replace('rcp_public_data_v1_3_2', 'rcp_public_data_time_v1_3_2');
      const cachedTime = Number(localStorage.getItem(timeKey)) || 0;

      if (Date.now() - cachedTime < PUBLIC_CACHE_DURATION) {
        return { data: candidate, fresh: true };
      }

      return { data: candidate, fresh: false };
    } catch (error) {
      localStorage.removeItem(cacheKey);
    }
  }

  return null;
}

function getVehicleTTC(vehicle) {
  const priceHT = roundUpMoney(vehicle.price);

  if (isJobVehicle(vehicle)) {
    return null;
  }

  return roundUpMoney(
    priceHT * (1 + appData.tvaVehicle)
  );
}

function getVehiclePurchaseTotal(vehicle) {
  const priceHT = roundUpMoney(vehicle.price);

  if (isJobVehicle(vehicle)) {
    return priceHT;
  }

  return roundUpMoney(
    priceHT * (1 + appData.tvaVehicle)
  );
}

function savePublicCache() {
  requireCompatiblePublicData(appData);
  RcpTariff.resolve(appData.tariffScope);
  localStorage.setItem(
    PUBLIC_CACHE_KEY,
    JSON.stringify(appData)
  );

  localStorage.setItem(
    PUBLIC_CACHE_TIME_KEY,
    String(Date.now())
  );
}

function applyCachedPublicData(candidate) {
  appData = candidate;
  const requestedScope = RcpTariff.getRequestScope() || appData.tariffScope;

  if (!applyPublicTariffScope(appData, requestedScope)) {
    throw new Error('Profil tarifaire absent des données mémorisées.');
  }

  RcpTariff.resolve(appData.tariffScope);
  renderVehicleList();
}

async function loadPublicDataFromServer() {
  appData = requireCompatiblePublicData(
    await api('getPublicData', { tariffScope: RcpTariff.getRequestScope() })
  );
  applyPublicTariffScope(appData, appData.tariffScope);
  savePublicCache();

  if (!appData.vehicles || appData.vehicles.length === 0) {
    showError('Aucun véhicule trouvé. Vérifie les tables RCP.');
    return;
  }

  renderVehicleList();
}

async function refreshPublicCacheIfNeeded(cachedData) {
  try {
    const revisionState = await RcpRevisions.fetch();

    if (RcpRevisions.matches(cachedData.revisionState, revisionState, false)) {
      localStorage.setItem(PUBLIC_CACHE_TIME_KEY, String(Date.now()));
      return;
    }

    await loadPublicDataFromServer();
  } catch (_) {
    // Les données mémorisées restent utilisables si la vérification légère échoue.
  }
}

async function loadData() {
  try {
    clearError();

    const cachedEntry = readPublicCache();

    if (cachedEntry) {
      applyCachedPublicData(cachedEntry.data);
      if (!cachedEntry.fresh) void refreshPublicCacheIfNeeded(cachedEntry.data);
      return;
    }

    await loadPublicDataFromServer();

  } catch (error) {
    showError('Erreur API : ' + error.message);
  }
}

function renderVehicleList() {
  if (!appData) {
    return;
  }

  const filter = normalize(searchInput.value);

  vehicleSelect.innerHTML = '';

  const filteredVehicles =
    appData.vehicles.filter(vehicle => {
      return (
        normalize(vehicle.name).includes(filter) ||
        normalize(vehicle.category).includes(filter) ||
        normalize(vehicle.dealership_id).includes(filter)
      );
    });

  debugBox.textContent =
    filteredVehicles.length +
    ' véhicule(s) affiché(s) / ' +
    appData.vehicles.length +
    ' chargé(s)';

  if (filteredVehicles.length === 0) {
    vehicleSelect.innerHTML =
      '<option value="">Aucun véhicule trouvé</option>';

    selectedVehicle = null;
    clearVehicleDisplay();

    return;
  }

  filteredVehicles.forEach(vehicle => {
    const option = document.createElement('option');

    option.value = vehicle.id;
    option.textContent =
      vehicle.name + ' — ' + vehicle.category;

    vehicleSelect.appendChild(option);
  });

  vehicleSelect.value = filteredVehicles[0].id;

  renderSelectedVehicle();
}

function clearVehicleDisplay() {
  document.getElementById('modelName').textContent = '-';
  document.getElementById('category').textContent = '-';
  document.getElementById('priceHT').textContent = '-';
  document.getElementById('priceTTC').textContent = '-';

  document.getElementById('performances').innerHTML = '';

  document.getElementById('vehicleTotal').textContent = '-';
  document.getElementById('perfTotal').textContent = '-';
  document.getElementById('globalTotal').textContent = '-';
}

function renderSelectedVehicle() {
  const vehicleId = vehicleSelect.value;

  selectedVehicle = appData.vehicles.find(
    vehicle => String(vehicle.id) === vehicleId
  );

  if (!selectedVehicle) {
    clearVehicleDisplay();
    return;
  }

  const priceHT = roundUpMoney(
    selectedVehicle.price
  );

  const priceTTC = getVehicleTTC(
    selectedVehicle
  );

  document.getElementById('modelName').textContent =
    selectedVehicle.name;

  document.getElementById('category').textContent =
    selectedVehicle.category;

  document.getElementById('priceHT').textContent =
    money(priceHT);

  document.getElementById('priceTTC').textContent =
    priceTTC === null
      ? '-'
      : money(priceTTC);

  renderPerformances();
  calculateTotal();
}

function getPerfLabel(perfName, index, levels) {
  const key = normalize(perfName);

  return (
    levels?.[index]?.label ||
    perfLabels[key]?.[index] ||
    ('niveau ' + (index + 1))
  );
}

function shouldShowPerformance(
  vehicle,
  perfName
) {
  const allowedPerfs = Array.isArray(vehicle?.public_allowed_perfs)
    ? vehicle.public_allowed_perfs.map(normalize)
    : [];

  return allowedPerfs.includes(normalize(perfName));
}

function renderPerformances() {
  const container =
    document.getElementById('performances');

  container.innerHTML = '';

  const vehiclePriceHT = roundUpMoney(
    selectedVehicle.price
  );

  const entries = Object
    .entries(appData.performances)
    .filter(([perfName]) =>
      shouldShowPerformance(
        selectedVehicle,
        perfName
      )
    )
    .sort((first, second) => {
      const firstIndex = perfOrder.indexOf(
        normalize(first[0])
      );

      const secondIndex = perfOrder.indexOf(
        normalize(second[0])
      );

      if (
        firstIndex === -1 &&
        secondIndex === -1
      ) {
        return first[0].localeCompare(
          second[0],
          'fr'
        );
      }

      if (firstIndex === -1) {
        return 1;
      }

      if (secondIndex === -1) {
        return -1;
      }

      return firstIndex - secondIndex;
    });

  entries.forEach(([perfName, levels]) => {
    const block = document.createElement('div');

    block.className = 'perf-block';

    const title = document.createElement('h3');

    title.textContent = levels?.[0]?.performance_label || perfName;
    block.appendChild(title);

    const noneLabel =
      document.createElement('label');

    noneLabel.className =
      'radio-line perf-row';

    noneLabel.innerHTML = `
      <span>
        <input
          type="radio"
          name="${perfName}"
          value="0"
          data-total="0"
          checked
        >
        aucun
      </span>

      <span>${money(0)}</span>
    `;

    block.appendChild(noneLabel);

    let cumulativeTotal = 0;

    levels.forEach((level, index) => {
      const stepPrice = calculatePerformancePrice(
        vehiclePriceHT,
        level.percent,
        appData.tvaPerf
      );

      cumulativeTotal += stepPrice;

      const label =
        document.createElement('label');

      label.className =
        'radio-line perf-row';

      label.innerHTML = `
        <span>
          <input
            type="radio"
            name="${perfName}"
            value="${stepPrice}"
            data-total="${cumulativeTotal}"
          >

        ${getPerfLabel(perfName, index, levels)}
        </span>

        <span>${money(stepPrice)}</span>
      `;

      block.appendChild(label);
    });

    container.appendChild(block);
  });

  document
    .querySelectorAll(
      '#performances input[type="radio"]'
    )
    .forEach(input => {
      input.addEventListener(
        'change',
        calculateTotal
      );
    });
}

function calculateTotal() {
  if (!selectedVehicle) {
    return;
  }

  const vehiclePurchaseTotal =
    getVehiclePurchaseTotal(selectedVehicle);

  let totalPerfs = 0;

  document
    .querySelectorAll(
      '#performances input[type="radio"]:checked'
    )
    .forEach(input => {
      totalPerfs +=
        Number(input.dataset.total) || 0;
    });

  document.getElementById('vehicleTotal').textContent =
    money(vehiclePurchaseTotal);

  document.getElementById('perfTotal').textContent =
    money(totalPerfs);

  document.getElementById('globalTotal').textContent =
    money(
      vehiclePurchaseTotal + totalPerfs
    );
}

searchInput.addEventListener(
  'input',
  renderVehicleList
);

vehicleSelect.addEventListener(
  'change',
  renderSelectedVehicle
);

loadData();
window.addEventListener('rcp:tariff-scope-change', () => {
  if (!appData) {
    loadData();
    return;
  }

  if (!applyPublicTariffScope(appData, RcpTariff.get())) {
    loadData();
    return;
  }

  clearError();
  renderVehicleList();
});
