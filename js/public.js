let appData = null;
let selectedVehicle = null;

const perfLabels = {
  blindage: ['20%', '40%', '60%'],
  moteur: ['reprog', '1', '2', '3'],
  frein: ['rue', 'sport', 'course'],
  suspension: ['rue', 'sport', 'course'],
  transmission: ['rue', 'sport', 'course'],
  turbo: ['turbo']
};

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

  return roundUpMoney(priceHT * (1 + appData.tvaVehicle));
}

function getVehiclePurchaseTotal(vehicle) {
  const priceHT = roundUpMoney(vehicle.price);

  if (isJobVehicle(vehicle)) {
    return priceHT;
  }

  return roundUpMoney(priceHT * (1 + appData.tvaVehicle));
}

function getPerfBasePrice(vehicle) {
  const priceHT = roundUpMoney(vehicle.price);
  return roundUpMoney(priceHT * (1 + appData.tvaPerf));
}

async function loadData() {
  try {
    clearError();
    appData = await api('getPublicData');

    if (!appData.vehicles || appData.vehicles.length === 0) {
      showError('Aucun véhicule trouvé. Vérifie la feuille DATA, colonnes A à D.');
      return;
    }

    renderVehicleList();
  } catch (error) {
    showError('Erreur API : ' + error.message);
  }
}

function renderVehicleList() {
  if (!appData) return;

  const filter = normalize(searchInput.value);
  vehicleSelect.innerHTML = '';

  const filteredVehicles = appData.vehicles.filter(vehicle => {
    return (
      normalize(vehicle.name).includes(filter) ||
      normalize(vehicle.category).includes(filter) ||
      normalize(vehicle.dealership_id).includes(filter)
    );
  });

  debugBox.textContent =
    filteredVehicles.length + ' véhicule(s) affiché(s) / ' +
    appData.vehicles.length + ' chargé(s)';

  if (filteredVehicles.length === 0) {
    vehicleSelect.innerHTML = '<option value="">Aucun véhicule trouvé</option>';
    selectedVehicle = null;
    clearVehicleDisplay();
    return;
  }

  filteredVehicles.forEach(vehicle => {
    const option = document.createElement('option');
    option.value = vehicle.id;
    option.textContent = vehicle.name + ' — ' + vehicle.category;
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

  selectedVehicle = appData.vehicles.find(vehicle => Number(vehicle.id) === vehicleId);

  if (!selectedVehicle) {
    clearVehicleDisplay();
    return;
  }

  const priceHT = roundUpMoney(selectedVehicle.price);
  const priceTTC = getVehicleTTC(selectedVehicle);

  document.getElementById('modelName').textContent = selectedVehicle.name;
  document.getElementById('category').textContent = selectedVehicle.category;
  document.getElementById('priceHT').textContent = money(priceHT);
  document.getElementById('priceTTC').textContent = priceTTC === null ? '-' : money(priceTTC);

  renderPerformances();
  calculateTotal();
}

function getPerfLabel(perfName, index) {
  const key = normalize(perfName);
  return perfLabels[key]?.[index] || ('niveau ' + (index + 1));
}

function shouldShowPerformance(vehicle, perfName) {
  if (!isAirOrBoatVehicle(vehicle)) {
    return true;
  }

  return normalize(perfName) === 'turbo';
}

function renderPerformances() {
  const container = document.getElementById('performances');
  container.innerHTML = '';

  const priceTTCForPerf = getPerfBasePrice(selectedVehicle);
  const orderedNames = ['moteur', 'transmission', 'blindage', 'frein', 'suspension', 'turbo'];

  const entries = Object.entries(appData.performances)
    .filter(([perfName]) => shouldShowPerformance(selectedVehicle, perfName))
    .sort((a, b) => {
      const ia = orderedNames.indexOf(normalize(a[0]));
      const ib = orderedNames.indexOf(normalize(b[0]));

      if (ia === -1 && ib === -1) return a[0].localeCompare(b[0], 'fr');
      if (ia === -1) return 1;
      if (ib === -1) return -1;

      return ia - ib;
    });

  entries.forEach(([perfName, levels]) => {
    const block = document.createElement('div');
    block.className = 'perf-block';

    const title = document.createElement('h3');
    title.textContent = perfName;
    block.appendChild(title);

    const noneLabel = document.createElement('label');
    noneLabel.className = 'radio-line perf-row';
    noneLabel.innerHTML = `
      <span><input type="radio" name="${perfName}" value="0" data-total="0" checked> aucun</span>
      <span>${money(0)}</span>
    `;
    block.appendChild(noneLabel);

    let cumulativeTotal = 0;

    levels.forEach((level, index) => {
      const stepPrice = roundUpMoney(priceTTCForPerf * level.percent);
      cumulativeTotal += stepPrice;

      const label = document.createElement('label');
      label.className = 'radio-line perf-row';
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

  document.querySelectorAll('input[type="radio"]').forEach(input => {
    input.addEventListener('change', calculateTotal);
  });
}

function calculateTotal() {
  if (!selectedVehicle) return;

  const vehiclePurchaseTotal = getVehiclePurchaseTotal(selectedVehicle);
  let totalPerfs = 0;

  document.querySelectorAll('input[type="radio"]:checked').forEach(input => {
    totalPerfs += Number(input.dataset.total) || 0;
  });

  document.getElementById('vehicleTotal').textContent = money(vehiclePurchaseTotal);
  document.getElementById('perfTotal').textContent = money(totalPerfs);
  document.getElementById('globalTotal').textContent = money(vehiclePurchaseTotal + totalPerfs);
}

searchInput.addEventListener('input', renderVehicleList);
vehicleSelect.addEventListener('change', renderSelectedVehicle);

loadData();