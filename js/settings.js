const settingsToken = localStorage.getItem('garage_token') || '';
const settingsError = document.getElementById('settingsError');
const settingsContent = document.getElementById('settingsContent');
const SETTINGS_TAB_KEY = 'rcp_settings_active_tab_v1';
const SETTINGS_TABS = [
  ['tariffs', 'Tarifs'], ['performances', 'Performances'], ['catalogue', 'Catalogue'],
  ['sync', 'Synchronisation'], ['history', 'Historique']
];
let settingsData = null;
let syncPreview = null;

function escapeSettings(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
function formatPercent(value) { return new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 2 }).format(Number(value) || 0); }
function setSettingsError(message) { settingsError.textContent = message || ''; }
function currentSettingsTab() {
  const saved = localStorage.getItem(SETTINGS_TAB_KEY);
  return SETTINGS_TABS.some(([id]) => id === saved) ? saved : 'tariffs';
}
function selectSettingsTab(tab) { localStorage.setItem(SETTINGS_TAB_KEY, tab); renderSettings(); }
function renderSettingsTabs() {
  const active = currentSettingsTab();
  document.getElementById('settingsTabs').innerHTML = SETTINGS_TABS.map(([id, label]) => `<button type="button" class="${id === active ? 'active' : ''}" onclick="selectSettingsTab('${id}')">${label}</button>`).join('');
}
function panel(title, content, id) {
  const key = 'rcp_settings_panel_' + id;
  const collapsed = localStorage.getItem(key) === '1';
  return `<section class="card settings-panel ${collapsed ? 'collapsed' : ''}" data-settings-panel="${id}"><button class="settings-panel-toggle" onclick="toggleSettingsPanel('${id}')"><span>${title}</span><span>${collapsed ? '▼' : '▲'}</span></button><div class="settings-panel-body">${content}</div></section>`;
}
function toggleSettingsPanel(id) {
  const key = 'rcp_settings_panel_' + id;
  localStorage.setItem(key, localStorage.getItem(key) === '1' ? '0' : '1'); renderSettings();
}
function renderTariffs() {
  if (!settingsData.initialized) return panel('Initialisation requise', '<p>Exécute <code>initializeRcpV132Sheets</code> une fois dans Apps Script.</p>', 'init');
  return panel('Profils tarifaires', `<div class="settings-grid">${settingsData.tariffs.map(item => `<article><h3>${item.scope}</h3><p>TVA véhicule : <strong>${formatPercent(item.vehicleVat)}</strong></p><p>TVA customisations : <strong>${formatPercent(item.customizationVat)}</strong></p></article>`).join('')}</div><p>Zone par défaut : <strong>${escapeSettings(settingsData.defaultScope)}</strong></p>`, 'tariffs');
}
function renderPerformances() {
  const rows = settingsData.performanceRates || [];
  return panel('Coefficients et niveaux', `<div class="settings-table-wrap"><table><thead><tr><th>Performance</th><th>Niveau</th><th>Libellé</th><th>Coefficient</th><th>Active</th></tr></thead><tbody>${rows.map(item => `<tr><td>${escapeSettings(item.performance_label)}</td><td>${escapeSettings(item.level)}</td><td>${escapeSettings(item.level_label)}</td><td>${formatPercent(item.coefficient)}</td><td>${item.active ? 'Oui' : 'Non'}</td></tr>`).join('')}</tbody></table></div>`, 'performances');
}
function renderCatalogue() {
  const vehicles = settingsData.vehicles || [];
  return panel('Catalogue', `<div class="settings-toolbar"><input id="catalogueSearch" placeholder="Rechercher" oninput="filterCatalogue()"><select id="catalogueStatus" onchange="filterCatalogue()"><option value="all">Tous</option><option value="active">Actifs</option><option value="retired">Retirés</option></select></div><p><strong>${vehicles.length}</strong> véhicules</p><div class="settings-table-wrap"><table id="catalogueTable"><thead><tr><th>Nom</th><th>Prix</th><th>Catégorie</th><th>Dealership</th><th>Statut</th></tr></thead><tbody>${vehicles.map(item => `<tr data-search="${escapeSettings((item.name + ' ' + item.category + ' ' + item.dealership_id).toLowerCase())}" data-status="${escapeSettings(item.catalogue_status)}"><td>${escapeSettings(item.name)}</td><td>${escapeSettings(item.price)} $</td><td>${escapeSettings(item.category)}</td><td>${escapeSettings(item.dealership_id)}</td><td>${escapeSettings(item.catalogue_status)}</td></tr>`).join('')}</tbody></table></div>`, 'catalogue');
}
function filterCatalogue() {
  const search = document.getElementById('catalogueSearch').value.toLowerCase(); const status = document.getElementById('catalogueStatus').value;
  document.querySelectorAll('#catalogueTable tbody tr').forEach(row => { row.hidden = !row.dataset.search.includes(search) || (status !== 'all' && row.dataset.status !== status); });
}
function renderSync() {
  const preview = syncPreview;
  const summary = preview ? `<div class="settings-grid"><article>Ajouts<strong>${preview.added.length}</strong></article><article>Modifications<strong>${preview.changed.length}</strong></article><article>Prix modifiés<strong>${preview.priceChanged.length}</strong></article><article>Retraits<strong>${preview.retired.length}</strong></article></div>${preview.blockingErrors.length ? `<div class="error">${preview.blockingErrors.map(escapeSettings).join('<br>')}</div>` : ''}<button onclick="applySync()" ${preview.ready ? '' : 'disabled'}>Appliquer la synchronisation</button>` : '<p>L’analyse ne modifie aucune donnée.</p>';
  return panel('DATA → RCP_VEHICLES', `<button onclick="analyzeSync()">Analyser les changements</button>${summary}`, 'sync');
}
function renderHistory() {
  const prices = settingsData.priceHistory || []; const logs = settingsData.syncLog || [];
  return panel('Historique des prix', `<div class="settings-table-wrap"><table><thead><tr><th>Véhicule</th><th>Ancien</th><th>Nouveau</th><th>Date</th></tr></thead><tbody>${prices.map(item => `<tr><td>${escapeSettings(item.vehicle_name)}</td><td>${escapeSettings(item.old_price)} $</td><td>${escapeSettings(item.new_price)} $</td><td>${escapeSettings(item.effective_at)}</td></tr>`).join('')}</tbody></table></div>`, 'price-history') + panel('Journal des synchronisations', `<div class="settings-table-wrap"><table><thead><tr><th>Statut</th><th>Ajouts</th><th>Mises à jour</th><th>Retraits</th><th>Date</th></tr></thead><tbody>${logs.map(item => `<tr><td>${escapeSettings(item.status)}</td><td>${escapeSettings(item.added_count)}</td><td>${escapeSettings(item.updated_count)}</td><td>${escapeSettings(item.retired_count)}</td><td>${escapeSettings(item.applied_at)}</td></tr>`).join('')}</tbody></table></div>`, 'sync-history');
}
function renderSettings() {
  renderSettingsTabs(); if (!settingsData) return;
  const tab = currentSettingsTab(); settingsContent.innerHTML = ({ tariffs: renderTariffs, performances: renderPerformances, catalogue: renderCatalogue, sync: renderSync, history: renderHistory })[tab]();
}
async function loadSettings() {
  if (!settingsToken) { window.location.href = 'login.html?target=settings'; return; }
  try { setSettingsError(''); settingsData = await api('getRcpSettingsData', {}, settingsToken); renderSettings(); }
  catch (error) { if (/Token|Session|Connexion indisponible/i.test(error.message)) { localStorage.removeItem('garage_token'); window.location.href = 'login.html?target=settings'; return; } setSettingsError(error.message); }
}
async function analyzeSync() { try { syncPreview = await api('analyzeRcpVehicleSync', {}, settingsToken); renderSettings(); } catch (error) { setSettingsError(error.message); } }
async function applySync() { if (!syncPreview || !syncPreview.ready) return; try { await api('applyRcpVehicleSync', { sourceSignature: syncPreview.sourceSignature }, settingsToken); syncPreview = null; await loadSettings(); } catch (error) { setSettingsError(error.message); } }
async function logoutSettings() { try { await api('logoutGarage', {}, settingsToken); } catch (_) {} localStorage.removeItem('garage_token'); window.location.href = 'login.html?target=settings'; }
window.addEventListener('rcp:tariff-scope-change', renderSettings); loadSettings();
