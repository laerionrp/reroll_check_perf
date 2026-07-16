let appData = null;
let selectedVehicle = null;

const PUBLIC_CACHE_KEY = 'rcp_public_data';
const PUBLIC_CACHE_TIME_KEY = 'rcp_public_data_time';
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
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0
  }).format(roundUpMoney(value)) + ' $';
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
  return normalize(vehicle.dealership_id) === 'job';
}

function isAirOrBoatVehicle(vehicle) {
  const dealership = normalize(vehicle.dealership_id);

  return dealership === 'air' || dealership === 'boat';
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

function getPerfBasePrice(vehicle) {
  const priceHT = roundUpMoney(vehicle.price);

  return roundUpMoney(
    priceHT * (1 + appData.tvaPerf)
  );
}

function savePublicCache() {
  localStorage.setItem(
    PUBLIC_CACHE_KEY,
    JSON.stringify(appData)
  );

  localStorage.setItem(
    PUBLIC_CACHE_TIME_KEY,
    String(Date.now())
  );
}

async function loadData() {
  try {
    clearError();

    const cached = localStorage.getItem(
      PUBLIC_CACHE_KEY
    );

    const cachedTime =
      Number(
        localStorage.getItem(
          PUBLIC_CACHE_TIME_KEY
        )
      ) || 0;

    const cacheValid =
      cached &&
      Date.now() - cachedTime <
        PUBLIC_CACHE_DURATION;

    if (cacheValid) {
      appData = JSON.parse(cached);
      renderVehicleList();

      api('getPublicData')
        .then(freshData => {
          appData = freshData;
          savePublicCache();
          renderVehicleList();
        })
        .catch(() => {});

      return;
    }

    appData = await api('getPublicData');
    savePublicCache();

    if (
      !appData.vehicles ||
      appData.vehicles.length === 0
    ) {
      showError(
        'Aucun véhicule trouvé. Vérifie la feuille DATA.'
      );

      return;
    }

    renderVehicleList();

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
  const vehicleId = Number(vehicleSelect.value);

  selectedVehicle = appData.vehicles.find(
    vehicle => Number(vehicle.id) === vehicleId
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

function getPerfLabel(perfName, index) {
  const key = normalize(perfName);

  return (
    perfLabels[key]?.[index] ||
    ('niveau ' + (index + 1))
  );
}

function shouldShowPerformance(
  vehicle,
  perfName
) {
  if (!isAirOrBoatVehicle(vehicle)) {
    return true;
  }

  return normalize(perfName) === 'turbo';
}

function renderPerformances() {
  const container =
    document.getElementById('performances');

  container.innerHTML = '';

  const perfBasePrice =
    getPerfBasePrice(selectedVehicle);

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

    title.textContent = perfName;
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
      const stepPrice = roundUpMoney(
        perfBasePrice * level.percent
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

          ${getPerfLabel(perfName, index)}
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