const catalogueState = {
  data: null,
  vehicles: [],
  selectedId: '',
  filters: { category: '', dealership: '', manufacturer: '', fuel_type: '', license_type: '', seats: '', hitch: '', vehicle_type: '' }
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

const catalogueCategoryLabels = {
  compacts: 'Compactes',
  sports: 'Sportives',
  sportsclassics: 'Sportives classiques',
  super: 'Supercars',
  sedans: 'Berlines',
  coupes: 'Coupés',
  muscle: 'Muscle cars',
  grossescylindrees: 'Grosses cylindrées',
  suvs: 'SUV',
  offroad: 'Tout-terrain',
  motorcycles: 'Motos',
  industrial: 'Industriels',
  utility: 'Utilitaires',
  vans: 'Fourgonnettes',
  planes: 'Avions',
  helicopters: 'Hélicoptères',
  boats: 'Bateaux',
  service: 'Services',
  emergency: 'Urgence',
  military: 'Militaires',
  commercial: 'Commerciaux',
  openwheel: 'Monoplaces',
  cycles: 'Cycles',
  trailers: 'Remorques',
  other: 'Autres'
};

const catalogueElements = {
  search: document.getElementById('catalogueSearch'),
  reset: document.getElementById('catalogueReset'),
  count: document.getElementById('catalogueResultCount'),
  list: document.getElementById('catalogueVehicleList'),
  error: document.getElementById('catalogueError'),
  placeholder: document.getElementById('cataloguePlaceholder'),
  detail: document.getElementById('catalogueVehicleDetail'),
  name: document.getElementById('catalogueVehicleName'),
  category: document.getElementById('catalogueVehicleCategory'),
  brandIdentity: document.getElementById('catalogueBrandIdentity'),
  badges: document.getElementById('catalogueVehicleBadges'),
  photoWrap: document.getElementById('catalogueVehiclePhotoWrap'),
  photo: document.getElementById('catalogueVehiclePhoto'),
  dealership: document.getElementById('catalogueDealership'),
  priceHT: document.getElementById('cataloguePriceHT'),
  vat: document.getElementById('catalogueVat'),
  priceTTC: document.getElementById('cataloguePriceTTC'),
  characteristics: document.getElementById('catalogueCharacteristics'),
  performances: document.getElementById('cataloguePerformances'),
  moreFiltersToggle: document.getElementById('catalogueMoreFiltersToggle'),
  moreFilters: document.getElementById('catalogueMoreFilters'),
  fuelFilter: document.getElementById('catalogueFuelFilter'),
  licenseFilter: document.getElementById('catalogueLicenseFilter'),
  seatsFilter: document.getElementById('catalogueSeatsFilter'),
  hitchFilter: document.getElementById('catalogueHitchFilter'),
  typeFilter: document.getElementById('catalogueTypeFilter'),
  copySummary: document.getElementById('catalogueCopySummary'),
  copyLink: document.getElementById('catalogueCopyLink'),
  copyDiscord: document.getElementById('catalogueCopyDiscord'),
  copyFeedback: document.getElementById('catalogueCopyFeedback')
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

function catalogueIcon(name, label = '') {
  return `<span class="catalogue-icon catalogue-icon--${catalogueEscape(name)}" aria-hidden="true"></span>${label ? `<span>${catalogueEscape(label)}</span>` : ''}`;
}

function catalogueFlag(countryCode) {
  const code = String(countryCode || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(...[...code].map(letter => 127397 + letter.charCodeAt(0)));
}

function catalogueBrandName(vehicle) {
  return String(vehicle?.brand?.display_name || vehicle?.manufacturer || 'Autres').trim();
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

function catalogueDisplayCategory(value) {
  const key = catalogueNormalize(value).replace(/[\s_-]+/g, '');
  return catalogueCategoryLabels[key] || String(value || 'Catégorie non renseignée');
}

function catalogueSafeImageUrl(value) {
  try {
    const url = new URL(String(value || '').trim(), window.location.href);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch (error) {
    return '';
  }
}

function catalogueRenderBrand(vehicle) {
  const brand = vehicle?.brand;
  const displayName = String(brand?.display_name || vehicle?.manufacturer || '').trim();
  const currentLogo = catalogueSafeImageUrl(brand?.logo_url_current);
  const legacyLogo = catalogueSafeImageUrl(brand?.logo_url_legacy);
  const textLogo = catalogueSafeImageUrl(brand?.logo_text_url);
  const identity = [];
  if (currentLogo) identity.push(`<img class="catalogue-brand-logo-image" data-brand-role="current" src="${catalogueEscape(currentLogo)}" alt="" loading="lazy" referrerpolicy="no-referrer">`);
  if (textLogo) {
    identity.push(`<img class="catalogue-brand-wordmark" data-brand-role="text" src="${catalogueEscape(textLogo)}" alt="${catalogueEscape(displayName)}" loading="lazy" referrerpolicy="no-referrer">`);
  } else if (displayName) {
    identity.push(`<span class="catalogue-brand-name">${catalogueEscape(displayName)}</span>`);
  }
  if (legacyLogo) identity.push(`<img class="catalogue-brand-logo-image catalogue-brand-logo-image--legacy" data-brand-role="legacy" src="${catalogueEscape(legacyLogo)}" alt="" loading="lazy" referrerpolicy="no-referrer">`);

  const identityElement = catalogueElements.brandIdentity;
  identityElement.hidden = identity.length === 0;
  identityElement.innerHTML = identity.join('');
  identityElement.querySelectorAll('img').forEach(image => image.addEventListener('error', () => {
    if (image.dataset.brandRole === 'text' && displayName) {
      const fallback = document.createElement('span');
      fallback.className = 'catalogue-brand-name';
      fallback.textContent = displayName;
      image.replaceWith(fallback);
    } else {
      image.remove();
    }
    identityElement.hidden = identityElement.children.length === 0;
  }));
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
  const dealerships = catalogueVehicleDealerships(vehicle);
  const selectedDealership = catalogueState.filters.dealership;
  const filteredDealer = dealerships.find(item => catalogueNormalize(item.dealership_id) === selectedDealership);
  return filteredDealer?.dealership_id || dealerships[0]?.dealership_id || '';
}

function catalogueDealershipMarkup(vehicle) {
  const dealerships = catalogueVehicleDealerships(vehicle);
  if (!dealerships.length) return 'Non renseignée';
  return `<span class="catalogue-dealership-badges">${dealerships.map(item => `<span class="catalogue-dealership-badge">${catalogueEscape(item.display_name || catalogueDisplayDealership(item.dealership_id))}</span>`).join('')}</span>`;
}

function catalogueDealerClass(value) {
  const key = catalogueNormalize(value).replace(/\s+/g, '-');
  return key ? 'catalogue-dealer-' + key : 'catalogue-dealer-neutral';
}

function catalogueGetFilteredVehicles() {
  const query = catalogueNormalize(catalogueElements.search.value);
  return catalogueState.vehicles.filter(vehicle => {
    const searchable = [vehicle.name, vehicle.category, catalogueBrandName(vehicle), catalogueDealershipText(vehicle)].map(catalogueNormalize).join(' ');
    return (!query || searchable.includes(query)) &&
      (!catalogueState.filters.category || catalogueNormalize(vehicle.category) === catalogueState.filters.category) &&
      (!catalogueState.filters.dealership || catalogueVehicleDealerships(vehicle).some(item => catalogueNormalize(item.dealership_id) === catalogueState.filters.dealership)) &&
      (!catalogueState.filters.manufacturer || catalogueNormalize(catalogueBrandName(vehicle)) === catalogueState.filters.manufacturer) &&
      (!catalogueState.filters.fuel_type || catalogueNormalize(vehicle.fuel_type) === catalogueState.filters.fuel_type) &&
      (!catalogueState.filters.license_type || catalogueNormalize(vehicle.license_type) === catalogueState.filters.license_type) &&
      (!catalogueState.filters.seats || String(vehicle.seats) === catalogueState.filters.seats) &&
      (!catalogueState.filters.hitch || String(Boolean(vehicle.hitch === true || catalogueNormalize(vehicle.hitch) === 'oui' || catalogueNormalize(vehicle.hitch) === 'true')) === catalogueState.filters.hitch) &&
      (!catalogueState.filters.vehicle_type || (catalogueState.filters.vehicle_type === 'business' ? vehicle.is_job === true : vehicle.is_job !== true));
  });
}

function catalogueHasActiveFilter() {
  return Boolean(catalogueElements.search.value.trim() || Object.values(catalogueState.filters).some(Boolean));
}

function catalogueRenderFilters() {
  document.querySelectorAll('.catalogue-filter').forEach(filter => {
    const field = filter.dataset.filter;
    const menu = filter.querySelector('.catalogue-filter-menu');
    const vehiclesForOptions = catalogueState.vehicles.filter(vehicle => {
      return Object.entries(catalogueState.filters).every(([activeField, activeValue]) => {
        if (!activeValue || activeField === field) return true;
        if (activeField === 'fuel_type' || activeField === 'license_type') return catalogueNormalize(vehicle[activeField]) === activeValue;
        if (activeField === 'seats') return String(vehicle.seats) === activeValue;
        if (activeField === 'hitch') return String(Boolean(vehicle.hitch === true || catalogueNormalize(vehicle.hitch) === 'oui' || catalogueNormalize(vehicle.hitch) === 'true')) === activeValue;
        if (activeField === 'vehicle_type') return activeValue === 'business' ? vehicle.is_job === true : vehicle.is_job !== true;
        if (activeField === 'dealership') return catalogueVehicleDealerships(vehicle).some(item => catalogueNormalize(item.dealership_id) === activeValue);
        if (activeField === 'manufacturer') return catalogueNormalize(catalogueBrandName(vehicle)) === activeValue;
        return catalogueNormalize(vehicle[activeField]) === activeValue;
      });
    });
    const values = [...new Set(vehiclesForOptions.flatMap(vehicle => field === 'dealership'
      ? catalogueVehicleDealerships(vehicle).map(item => String(item.dealership_id || '').trim())
      : [String(field === 'manufacturer' ? catalogueBrandName(vehicle) : vehicle.category || '').trim()]).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'fr'));
    const clearLabel = field === 'category' ? 'Toutes les catégories' : field === 'dealership' ? 'Toutes les concessions' : 'Toutes les marques';
    menu.innerHTML = `<button type="button" class="catalogue-option catalogue-option--clear" data-value="">${clearLabel}</button>` + values.map(value => {
      const label = field === 'dealership' ? catalogueDisplayDealership(value) : field === 'category' ? catalogueDisplayCategory(value) : value;
      return `<button type="button" class="catalogue-option" data-value="${catalogueEscape(value)}">${catalogueEscape(label)}</button>`;
    }).join('');
    menu.querySelectorAll('.catalogue-option').forEach(button => button.addEventListener('click', () => {
      catalogueState.filters[field] = catalogueNormalize(button.dataset.value);
      const baseLabel = field === 'category' ? 'Catégories' : field === 'dealership' ? 'Concessions' : 'Marques';
      const selectedLabel = button.dataset.value === '' ? baseLabel : button.textContent;
      filter.querySelector('.catalogue-filter-button').textContent = selectedLabel;
      menu.hidden = true;
      filter.querySelector('.catalogue-filter-button').setAttribute('aria-expanded', 'false');
      catalogueRenderFilters();
      catalogueRender();
    }));
  });
  cataloguePopulateSecondaryFilters();
}

function cataloguePopulateSelect(select, values, emptyLabel) {
  if (!select) return;
  const current = select.value;
  select.innerHTML = `<option value="">${emptyLabel}</option>` + values.map(value => `<option value="${catalogueEscape(value)}">${catalogueEscape(value)}</option>`).join('');
  select.value = values.includes(current) ? current : '';
}

function cataloguePopulateSecondaryFilters() {
  const vehicles = catalogueState.vehicles;
  cataloguePopulateSelect(catalogueElements.fuelFilter, [...new Set(vehicles.map(v => v.fuel_type).filter(Boolean))].sort(), 'Tous');
  cataloguePopulateSelect(catalogueElements.licenseFilter, [...new Set(vehicles.map(v => v.license_type).filter(Boolean))].sort(), 'Tous');
  cataloguePopulateSelect(catalogueElements.seatsFilter, [...new Set(vehicles.map(v => v.seats).filter(v => v !== '' && v !== null && v !== undefined))].sort((a, b) => Number(a) - Number(b)), 'Toutes');
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
    item.innerHTML = `<strong>${catalogueEscape(vehicle.name)}</strong><span>${catalogueEscape(catalogueBrandName(vehicle))}</span>`;
    item.addEventListener('click', () => { catalogueState.selectedId = String(vehicle.id); catalogueRender(); });
    catalogueElements.list.appendChild(item);
  });
  catalogueRenderDetail(vehicles.find(vehicle => String(vehicle.id) === catalogueState.selectedId));
}

function catalogueRenderCharacteristics(vehicle) {
  const definitions = [
    ['seats', 'Places', value => value],
    ['trunk_kg', 'Coffre', value => Number(value) === 0 ? 'Aucun coffre' : `${value} kg`],
    ['hitch', 'Attelage', value => value === true || String(value).toLowerCase() === 'true' ? 'Oui' : 'Non'],
    ['license_type', 'Permis', value => value],
    ['fuel_type', 'Carburant', value => value]
  ];
  const available = definitions.filter(([key]) => vehicle[key] !== undefined && vehicle[key] !== null && vehicle[key] !== '');
  if (vehicle?.brand?.country) available.push(['brand_country', 'Pays de fabrication', () => `${catalogueFlag(vehicle.brand.country_code)}${catalogueFlag(vehicle.brand.country_code) ? ' ' : ''}${vehicle.brand.country}`]);
  catalogueElements.characteristics.innerHTML = available.length
    ? available.map(([key, label, formatter]) => {
      const iconName = { seats: 'seats', trunk_kg: 'trunk', hitch: 'hitch', license_type: 'license', fuel_type: catalogueNormalize(vehicle.fuel_type).includes('elect') ? 'electric' : 'fuel', brand_country: 'globe' }[key];
      return `<div class="catalogue-characteristic"><span>${iconName ? catalogueIcon(iconName) : ''}${catalogueEscape(label)}</span><strong>${catalogueEscape(formatter(vehicle[key]))}</strong></div>`;
    }).join('')
    : '<div class="catalogue-empty catalogue-empty--inline">Aucune caractéristique complémentaire disponible.</div>';
}

function catalogueRenderPerformances(vehicle) {
  const allowed = Array.isArray(vehicle.public_allowed_perfs) ? vehicle.public_allowed_perfs.map(catalogueNormalize) : [];
  const entries = cataloguePerfOrder.filter(key => allowed.includes(key));
  catalogueElements.performances.innerHTML = entries.length
    ? entries.map(key => `<span class="catalogue-performance">${cataloguePerfLabels[key]}</span>`).join('')
    : '<div class="catalogue-empty catalogue-empty--inline">Aucune amélioration disponible.</div>';
}

function catalogueRenderDetail(vehicle) {
  if (!vehicle) {
    catalogueElements.placeholder.hidden = false;
    catalogueElements.detail.hidden = true;
    catalogueElements.photoWrap.hidden = true;
    return;
  }
  catalogueElements.placeholder.hidden = true;
  catalogueElements.detail.hidden = false;
  catalogueElements.detail.className = 'catalogue-vehicle-detail ' + catalogueDealerClass(cataloguePrimaryDealerId(vehicle));
  catalogueElements.name.textContent = vehicle.name || '-';
  catalogueElements.category.textContent = catalogueDisplayCategory(vehicle.category);
  catalogueRenderBrand(vehicle);
  catalogueRenderBadges(vehicle);
  catalogueRenderPhoto(vehicle);
  catalogueElements.dealership.innerHTML = catalogueDealershipMarkup(vehicle);
  catalogueElements.priceHT.textContent = catalogueMoney(vehicle.price);
  catalogueElements.vat.textContent = vehicle.is_job ? '—' : `${Math.round((Number(catalogueState.data.tvaVehicle) || 0) * 100)} %`;
  catalogueElements.priceTTC.textContent = vehicle.is_job ? '—' : catalogueMoney(Number(vehicle.price) * (1 + Number(catalogueState.data.tvaVehicle || 0)));
  catalogueRenderCharacteristics(vehicle);
  catalogueRenderPerformances(vehicle);
}

function catalogueVehicleTypeIcon(vehicle) {
  const category = catalogueNormalize(vehicle.category);
  if (category.includes('helicopter')) return 'helicopter';
  if (category.includes('plane')) return 'plane';
  if (category.includes('boat')) return 'boat';
  if (category.includes('cycle')) return 'bicycle';
  if (category.includes('motor')) return 'motorcycle';
  if (category.includes('trailer')) return 'trailer';
  return '';
}

function catalogueRenderBadges(vehicle) {
  const badges = [];
  const typeIcon = catalogueVehicleTypeIcon(vehicle);
  const typeLabels = { plane: 'Avion', helicopter: 'Hélicoptère', boat: 'Bateau', bicycle: 'Vélo', motorcycle: 'Moto', trailer: 'Remorque' };
  if (vehicle.is_job === true) badges.push({ icon: 'business', label: 'Véhicule entreprise' });
  if (catalogueVehicleDealerships(vehicle).length > 1) badges.push({ icon: 'multi-dealership', label: 'Multi-concessions' });
  if (typeIcon) badges.push({ icon: typeIcon, label: typeLabels[typeIcon] });
  catalogueElements.badges.innerHTML = badges.map(item => `<span class="catalogue-badge">${catalogueIcon(item.icon, item.label)}</span>`).join('');
}

function catalogueRenderPhoto(vehicle) {
  const photoUrl = catalogueSafeImageUrl(vehicle.photo_url);
  catalogueElements.photoWrap.hidden = !photoUrl;
  catalogueElements.photo.removeAttribute('src');
  if (!photoUrl) return;
  catalogueElements.photo.src = photoUrl;
  catalogueElements.photo.alt = vehicle.name ? `Photo de ${vehicle.name}` : '';
  catalogueElements.photo.onerror = () => {
    catalogueElements.photo.removeAttribute('src');
    catalogueElements.photoWrap.hidden = true;
  };
}

function catalogueRender() { catalogueRenderList(); }

function catalogueReset() {
  catalogueElements.search.value = '';
  catalogueState.filters = { category: '', dealership: '', manufacturer: '', fuel_type: '', license_type: '', seats: '', hitch: '', vehicle_type: '' };
  [catalogueElements.fuelFilter, catalogueElements.licenseFilter, catalogueElements.seatsFilter, catalogueElements.hitchFilter, catalogueElements.typeFilter].forEach(select => { if (select) select.value = ''; });
  document.querySelectorAll('.catalogue-filter').forEach(filter => {
    const field = filter.dataset.filter;
    filter.querySelector('.catalogue-filter-button').textContent = field === 'category' ? 'Catégories' : field === 'dealership' ? 'Concessions' : 'Marques';
  });
  catalogueRenderFilters();
  catalogueRender();
}

function catalogueSummary(vehicle) {
  const characteristics = [];
  if (vehicle.seats !== '' && vehicle.seats !== null && vehicle.seats !== undefined) characteristics.push(`${vehicle.seats} place${Number(vehicle.seats) > 1 ? 's' : ''}`);
  if (vehicle.trunk_kg !== '' && vehicle.trunk_kg !== null && vehicle.trunk_kg !== undefined) characteristics.push(Number(vehicle.trunk_kg) === 0 ? 'Aucun coffre' : `Coffre ${vehicle.trunk_kg} kg`);
  if (vehicle.fuel_type) characteristics.push(String(vehicle.fuel_type));
  if (vehicle.license_type) characteristics.push(`Permis ${vehicle.license_type}`);
  const dealerships = catalogueVehicleDealerships(vehicle).map(item => item.display_name || catalogueDisplayDealership(item.dealership_id));
  const price = vehicle.is_job ? 'Prix non applicable' : `Prix : ${catalogueMoney(vehicle.price)} HT / ${catalogueMoney(Number(vehicle.price) * (1 + Number(catalogueState.data?.tvaVehicle || 0)))} TTC`;
  return [vehicle.name, catalogueDisplayCategory(vehicle.category), catalogueBrandName(vehicle), dealerships.length ? dealerships.join(' · ') : 'Concession : Non renseignée', characteristics.join(' — '), price].filter(Boolean).join('\n');
}

async function catalogueCopyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    catalogueElements.copyFeedback.textContent = 'Copié.';
  } catch (error) {
    catalogueElements.copyFeedback.textContent = 'Copie impossible.';
  }
  window.setTimeout(() => { catalogueElements.copyFeedback.textContent = ''; }, 2200);
}

function catalogueDiscordSummary(vehicle) {
  const dealerships = catalogueVehicleDealerships(vehicle).map(item => item.display_name || catalogueDisplayDealership(item.dealership_id));
  const characteristics = [];
  if (vehicle.seats !== '' && vehicle.seats !== null && vehicle.seats !== undefined) characteristics.push(`**Places :** ${vehicle.seats}`);
  if (vehicle.trunk_kg !== '' && vehicle.trunk_kg !== null && vehicle.trunk_kg !== undefined) characteristics.push(`**Coffre :** ${Number(vehicle.trunk_kg) === 0 ? 'Aucun coffre' : `${vehicle.trunk_kg} kg`}`);
  if (vehicle.hitch !== '' && vehicle.hitch !== null && vehicle.hitch !== undefined) characteristics.push(`**Attelage :** ${vehicle.hitch === true ? 'Oui' : vehicle.hitch}`);
  if (vehicle.license_type) characteristics.push(`**Permis :** ${vehicle.license_type}`);
  if (vehicle.fuel_type) characteristics.push(`**Carburant :** ${vehicle.fuel_type}`);
  const allowed = Array.isArray(vehicle.public_allowed_perfs) ? vehicle.public_allowed_perfs.map(catalogueNormalize) : [];
  const available = cataloguePerfOrder.filter(item => allowed.includes(item)).map(item => cataloguePerfLabels[item]);
  const priceLines = vehicle.is_job
    ? ['**Prix HT :** —', '**TVA :** —', '**Prix TTC :** —']
    : [`**Prix HT :** ${catalogueMoney(vehicle.price)}`, `**TVA :** ${Math.round((Number(catalogueState.data?.tvaVehicle) || 0) * 100)} %`, `**Prix TTC :** ${catalogueMoney(Number(vehicle.price) * (1 + Number(catalogueState.data?.tvaVehicle || 0)))}`];
  return [
    `🚗 **RCP — ${catalogueBrandName(vehicle)} ${vehicle.name || ''}**`,
    `*${catalogueDisplayCategory(vehicle.category)}*`,
    '', '**Informations**',
    `> **Concessionnaire(s) :** ${dealerships.length ? dealerships.join(' · ') : 'Non renseignée'}`,
    ...priceLines.map(line => `> ${line}`),
    '', '**Caractéristiques**',
    ...characteristics.map(line => `> ${line}`),
    '', '**Améliorations disponibles**',
    `> ${available.length ? available.join(' · ') : 'Aucune amélioration disponible'}`
  ].join('\n');
}

function catalogueDirectVehicleId() {
  return new URLSearchParams(window.location.search).get('vehicle') || '';
}

async function catalogueLoad() {
  try {
    const data = await api('getPublicData', {});
    catalogueState.data = data;
    catalogueState.vehicles = Array.isArray(data.vehicles) ? data.vehicles : [];
    const directId = catalogueDirectVehicleId();
    catalogueState.selectedId = catalogueState.vehicles.some(vehicle => String(vehicle.id) === directId || String(vehicle.vehicle_id) === directId) ? directId : '';
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
catalogueElements.moreFiltersToggle?.addEventListener('click', () => {
  const willOpen = catalogueElements.moreFilters.hidden;
  catalogueElements.moreFilters.hidden = !willOpen;
  catalogueElements.moreFiltersToggle.setAttribute('aria-expanded', String(willOpen));
});

[
  ['fuelFilter', 'fuel_type'],
  ['licenseFilter', 'license_type'],
  ['seatsFilter', 'seats'],
  ['hitchFilter', 'hitch'],
  ['typeFilter', 'vehicle_type']
].forEach(([elementKey, field]) => catalogueElements[elementKey]?.addEventListener('change', event => {
  catalogueState.filters[field] = catalogueNormalize(event.target.value);
  catalogueRenderFilters();
  catalogueRender();
}));

catalogueElements.copySummary?.addEventListener('click', () => {
  const vehicle = catalogueState.vehicles.find(item => String(item.id) === String(catalogueState.selectedId));
  if (vehicle) catalogueCopyText(catalogueSummary(vehicle));
});
catalogueElements.copyLink?.addEventListener('click', () => {
  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('vehicle', catalogueState.selectedId);
  catalogueCopyText(url.toString());
});
catalogueElements.copyDiscord?.addEventListener('click', () => {
  const vehicle = catalogueState.vehicles.find(item => String(item.id) === String(catalogueState.selectedId));
  if (vehicle) catalogueCopyText(catalogueDiscordSummary(vehicle));
});
document.querySelectorAll('.catalogue-filter-button').forEach(button => button.addEventListener('click', () => {
  const filter = button.closest('.catalogue-filter');
  const menu = filter.querySelector('.catalogue-filter-menu');
  const willOpen = menu.hidden;
  document.querySelectorAll('.catalogue-filter-menu').forEach(other => { other.hidden = true; other.previousElementSibling.setAttribute('aria-expanded', 'false'); });
  menu.hidden = !willOpen;
  button.setAttribute('aria-expanded', String(willOpen));
}));

catalogueLoad();
