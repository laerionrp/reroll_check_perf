const catalogueState = {
  data: null,
  vehicles: [],
  selectedId: '',
  filters: { category: '', dealership: '', manufacturer: '' }
};

const cataloguePerfOrder = ['blindage', 'frein', 'moteur', 'suspension', 'transmission', 'turbo'];
const cataloguePerfLabels = {
  blindage: 'Blindage',
  frein: 'Freins',
  moteur: 'Moteur',
  suspension: 'Suspension',
  transmission: 'Transmission',
  turbo: 'Turbo'
};

const catalogueElements = {
  search: document.getElementById('catalogueSearch'),
  reset: document.getElementById('catalogueReset'),
  count: document.getElementById('catalogueResultCount'),
  list: document.getElementById('catalogueVehicleList'),
  error: document.getElementById('catalogueError'),
  placeholder: document.getElementById('cataloguePlaceholder'),
  detail: document.getElementById('catalogueVehicleDetail'),
  manufacturer: document.getElementById('catalogueManufacturer'),
  name: document.getElementById('catalogueVehicleName'),
  category: document.getElementById('catalogueVehicleCategory'),
  dealership: document.getElementById('catalogueDealership'),
  priceHT: document.getElementById('cataloguePriceHT'),
  vat: document.getElementById('catalogueVat'),
  priceTTC: document.getElementById('cataloguePriceTTC'),
  characteristics: document.getElementById('catalogueCharacteristics'),
  performances: document.getElementById('cataloguePerformances')
};

function catalogueNormalize(value) {
  return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function catalogueMoney(value) {
  const rounded = Math.ceil((Number(value) || 0) - 0.000001);
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.max(0, rounded)) + ' $';
}

function catalogueEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
}

function catalogueDisplayDealership(value) {
  const known = {
    benefactor_gallivanter: 'Benefactor-Gallivanter Dealership',
    bourgeois_bicycles: 'Bourgeois Bicycles',
    elitas_travel: 'Elitas Travel',
    get_aweigh: 'Get Aweigh',
    larrys_rv_sales: "Larry's RV Sales",
    luxury_auto: 'Luxury Auto',
    sanders_motorcycles: 'Sanders Motorcycles',
    vapid_los_santos: 'Vapid of Los Santos'
  };
  return known[catalogueNormalize(value).replace(/\s+/g, '_')] || String(value || 'Non renseignée');
}

function catalogueVehicleDealerships(vehicle) {
  if (Array.isArray(vehicle?.dealerships) && vehicle.dealerships.length) {
    return vehicle.dealerships;
  }
  if (catalogueState.data?.officialDealershipsAvailable) return [];
  const legacy = String(vehicle?.dealership_id || '').trim();
  return legacy ? [{ dealership_id: legacy, display_name: catalogueDisplayDealership(legacy) }] : [];
}

function catalogueDealershipText(vehicle) {
  const dealerships = catalogueVehicleDealerships(vehicle);
  return dealerships.length
    ? dealerships.map(item => item.display_name || catalogueDisplayDealership(item.dealership_id)).join(' · ')
    : 'Aucune concession commerciale';
}

function cataloguePrimaryDealerId(vehicle) {
  return catalogueVehicleDealerships(vehicle)[0]?.dealership_id || vehicle?.dealership_id || '';
}

function catalogueDealerClass(value) {
  const key = catalogueNormalize(value).replace(/\s+/g, '-');
  return key ? 'catalogue-dealer-' + key : 'catalogue-dealer-neutral';
}

function catalogueGetFilteredVehicles() {
  const query = catalogueNormalize(catalogueElements.search.value);
  return catalogueState.vehicles.filter(vehicle => {
    const searchable = [vehicle.name, vehicle.category, vehicle.manufacturer, catalogueDealershipText(vehicle)].map(catalogueNormalize).join(' ');
    return (!query || searchable.includes(query)) &&
      (!catalogueState.filters.category || catalogueNormalize(vehicle.category) === catalogueState.filters.category) &&
      (!catalogueState.filters.dealership || catalogueVehicleDealerships(vehicle).some(item => catalogueNormalize(item.dealership_id) === catalogueState.filters.dealership)) &&
      (!catalogueState.filters.manufacturer || catalogueNormalize(vehicle.manufacturer) === catalogueState.filters.manufacturer);
  });
}

function catalogueHasActiveFilter() {
  return Boolean(catalogueElements.search.value.trim() || Object.values(catalogueState.filters).some(Boolean));
}

function catalogueRenderFilters() {
  document.querySelectorAll('.catalogue-filter').forEach(filter => {
    const field = filter.dataset.filter;
    const menu = filter.querySelector('.catalogue-filter-menu');
    const values = [...new Set(catalogueState.vehicles.flatMap(vehicle => field === 'dealership'
      ? catalogueVehicleDealerships(vehicle).map(item => String(item.dealership_id || '').trim())
      : [String(vehicle[field === 'manufacturer' ? 'manufacturer' : 'category'] || '').trim()]).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'fr'));
    menu.innerHTML = values.map(value => `<button type="button" class="catalogue-option" data-value="${catalogueEscape(value)}">${catalogueEscape(field === 'dealership' ? catalogueDisplayDealership(value) : value)}</button>`).join('');
    menu.querySelectorAll('.catalogue-option').forEach(button => button.addEventListener('click', () => {
      catalogueState.filters[field] = catalogueNormalize(button.dataset.value);
      filter.querySelector('.catalogue-filter-button').textContent = field === 'category' ? 'Catégories : ' + button.textContent : field === 'dealership' ? 'Concession : ' + button.textContent : 'Marque : ' + button.textContent;
      menu.hidden = true;
      filter.querySelector('.catalogue-filter-button').setAttribute('aria-expanded', 'false');
      catalogueRender();
    }));
  });
}

function catalogueRenderList() {
  const vehicles = catalogueGetFilteredVehicles();
  catalogueElements.count.textContent = `${vehicles.length} véhicule${vehicles.length > 1 ? 's' : ''} affiché${vehicles.length > 1 ? 's' : ''} / ${catalogueState.vehicles.length}`;
  catalogueElements.reset.hidden = !catalogueHasActiveFilter();
  catalogueElements.list.innerHTML = '';
  if (!vehicles.length) {
    catalogueElements.list.innerHTML = '<div class="catalogue-empty">Aucun véhicule ne correspond aux filtres.</div>';
    catalogueRenderDetail(null);
    return;
  }
  if (!vehicles.some(vehicle => String(vehicle.id) === String(catalogueState.selectedId))) catalogueState.selectedId = String(vehicles[0].id);
  vehicles.forEach(vehicle => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'catalogue-vehicle-item ' + (String(vehicle.id) === catalogueState.selectedId ? 'selected ' : '') + catalogueDealerClass(cataloguePrimaryDealerId(vehicle));
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', String(vehicle.id) === catalogueState.selectedId ? 'true' : 'false');
    item.innerHTML = `<strong>${catalogueEscape(vehicle.name)}</strong><span>${catalogueEscape(vehicle.manufacturer || vehicle.category || 'Fabricant non renseigné')}</span>`;
    item.addEventListener('click', () => { catalogueState.selectedId = String(vehicle.id); catalogueRender(); });
    catalogueElements.list.appendChild(item);
  });
  catalogueRenderDetail(vehicles.find(vehicle => String(vehicle.id) === catalogueState.selectedId));
}

function catalogueRenderCharacteristics(vehicle) {
  const definitions = [
    ['seats', 'Places', value => value],
    ['trunk_kg', 'Coffre', value => `${value} kg`],
    ['hitch', 'Attelage', value => value === true || String(value).toLowerCase() === 'true' ? 'Oui' : 'Non'],
    ['license_type', 'Permis', value => value],
    ['fuel_type', 'Carburant', value => value]
  ];
  const available = definitions.filter(([key]) => vehicle[key] !== undefined && vehicle[key] !== null && vehicle[key] !== '');
  catalogueElements.characteristics.innerHTML = available.length
    ? available.map(([key, label, formatter]) => `<div class="catalogue-characteristic"><span>${label}</span><strong>${catalogueEscape(formatter(vehicle[key]))}</strong></div>`).join('')
    : '<div class="catalogue-empty catalogue-empty--inline">Aucune caractéristique complémentaire disponible.</div>';
}

function catalogueRenderPerformances(vehicle) {
  const allowed = Array.isArray(vehicle.public_allowed_perfs) ? vehicle.public_allowed_perfs.map(catalogueNormalize) : [];
  const entries = cataloguePerfOrder.filter(key => allowed.includes(key));
  catalogueElements.performances.innerHTML = entries.length
    ? entries.map(key => `<span class="catalogue-performance">${cataloguePerfLabels[key]}</span>`).join('')
    : '<div class="catalogue-empty catalogue-empty--inline">Aucune performance disponible.</div>';
}

function catalogueRenderDetail(vehicle) {
  if (!vehicle) {
    catalogueElements.placeholder.hidden = false;
    catalogueElements.detail.hidden = true;
    return;
  }
  catalogueElements.placeholder.hidden = true;
  catalogueElements.detail.hidden = false;
  catalogueElements.detail.className = 'catalogue-vehicle-detail ' + catalogueDealerClass(cataloguePrimaryDealerId(vehicle));
  catalogueElements.manufacturer.textContent = vehicle.manufacturer || 'Fabricant non renseigné';
  catalogueElements.name.textContent = vehicle.name || '-';
  catalogueElements.category.textContent = vehicle.category || 'Catégorie non renseignée';
  catalogueElements.dealership.textContent = catalogueDealershipText(vehicle);
  catalogueElements.priceHT.textContent = catalogueMoney(vehicle.price);
  catalogueElements.vat.textContent = vehicle.is_job ? '—' : `${Math.round((Number(catalogueState.data.tvaVehicle) || 0) * 100)} %`;
  catalogueElements.priceTTC.textContent = vehicle.is_job ? '—' : catalogueMoney(Number(vehicle.price) * (1 + Number(catalogueState.data.tvaVehicle || 0)));
  catalogueRenderCharacteristics(vehicle);
  catalogueRenderPerformances(vehicle);
}

function catalogueRender() { catalogueRenderList(); }

function catalogueReset() {
  catalogueElements.search.value = '';
  catalogueState.filters = { category: '', dealership: '', manufacturer: '' };
  document.querySelectorAll('.catalogue-filter').forEach(filter => {
    const field = filter.dataset.filter;
    filter.querySelector('.catalogue-filter-button').textContent = field === 'category' ? 'Catégories' : field === 'dealership' ? 'Concessions' : 'Marques';
  });
  catalogueRender();
}

async function catalogueLoad() {
  try {
    const data = await api('getPublicData', {});
    catalogueState.data = data;
    catalogueState.vehicles = (data.vehicles || []).filter(vehicle => !vehicle.is_job && catalogueNormalize(vehicle.dealership_id) !== 'job');
    catalogueRenderFilters();
    catalogueRender();
  } catch (error) {
    catalogueElements.error.textContent = 'Erreur de chargement du catalogue : ' + error.message;
    catalogueElements.error.hidden = false;
    catalogueElements.list.innerHTML = '<div class="catalogue-empty">Catalogue indisponible.</div>';
  }
}

catalogueElements.search.addEventListener('input', catalogueRender);
catalogueElements.reset.addEventListener('click', catalogueReset);
document.querySelectorAll('.catalogue-filter-button').forEach(button => button.addEventListener('click', () => {
  const filter = button.closest('.catalogue-filter');
  const menu = filter.querySelector('.catalogue-filter-menu');
  const willOpen = menu.hidden;
  document.querySelectorAll('.catalogue-filter-menu').forEach(other => { other.hidden = true; other.previousElementSibling.setAttribute('aria-expanded', 'false'); });
  menu.hidden = !willOpen;
  button.setAttribute('aria-expanded', String(willOpen));
}));

catalogueLoad();
