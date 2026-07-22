const settingsToken = localStorage.getItem('garage_token') || '';
const settingsError = document.getElementById('settingsError');
const settingsContent = document.getElementById('settingsContent');
const SETTINGS_TAB_KEY = 'rcp_settings_active_tab_v1';
const SETTINGS_PERFORMANCE_KEY = 'rcp_settings_open_performance_v1';
const PERFORMANCE_ORDER = ['blindage', 'frein', 'moteur', 'suspension', 'transmission', 'turbo'];
const SETTINGS_TABS = [
  ['tariffs', 'Tarifs'], ['performances', 'Performances'], ['catalogue', 'Catalogue'],
  ['sync', 'Synchronisation'], ['history', 'Historique']
];
let settingsData = null;
let tariffSaveState = null;
let tariffSaveResult = null;
let tariffDraft = null;
let syncPreview = null;
let syncAnalysisState = null;
let syncApplyState = null;
let syncApplyResult = null;
let syncAnalysisTimer = null;
let syncMessageTimer = null;
const SYNC_WAIT_MESSAGES = [
  'Ouverture du capot de DATA…',
  'Comptage des boulons du catalogue…',
  'Comparaison des véhicules, un par un, évidemment…',
  'Interrogatoire musclé des tarifs suspects…',
  'Vérification que personne n’a changé DATA en douce…',
  'Presque terminé… normalement.'
];

function escapeSettings(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
function formatPercent(value) { return new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 2 }).format(Number(value) || 0); }
function formatPercentInput(value) {
  const percent = (Number(value) || 0) * 100;
  return String(Number(percent.toFixed(4))).replace('.', ',');
}
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
  const saving = Boolean(tariffSaveState && tariffSaveState.running);
  const displayedTariffs = tariffDraft ? tariffDraft.tariffs : settingsData.tariffs;
  const displayedDefaultScope = tariffDraft ? tariffDraft.defaultScope : settingsData.defaultScope;
  const status = saving
    ? '<div class="settings-save-status saving" role="status"><span class="settings-save-spinner" aria-hidden="true"></span><strong>Enregistrement des profils tarifaires…</strong></div>'
    : tariffSaveResult
      ? `<div class="settings-save-status success" role="status"><strong>${tariffSaveResult.changed ? 'Profils tarifaires enregistrés avec succès.' : 'Aucune modification à enregistrer.'}</strong></div>`
      : '';
  const cards = displayedTariffs.map(item => {
    const scope = escapeSettings(item.scope);
    const scopeLabel = item.scope === 'LS' ? 'Los Santos' : 'Blaine County';
    return `<article class="tariff-settings-card">
      <h3>${escapeSettings(scopeLabel)} <small>${scope}</small></h3>
      <label for="vehicleVat-${scope}">TVA véhicules</label>
      <div class="settings-percent-input"><input id="vehicleVat-${scope}" inputmode="decimal" autocomplete="off" value="${escapeSettings(formatPercentInput(item.vehicleVat))}" ${saving ? 'disabled' : ''}><span>%</span></div>
      <label for="customizationVat-${scope}">TVA customisations</label>
      <div class="settings-percent-input"><input id="customizationVat-${scope}" inputmode="decimal" autocomplete="off" value="${escapeSettings(formatPercentInput(item.customizationVat))}" ${saving ? 'disabled' : ''}><span>%</span></div>
    </article>`;
  }).join('');

  return panel('Profils tarifaires', `<form class="tariff-settings-form" onsubmit="saveTariffSettings(event)">
    ${status}
    <div class="settings-grid">${cards}</div>
    <div class="tariff-default-setting">
      <label for="defaultTariffScope">Zone utilisée par défaut</label>
      <select id="defaultTariffScope" ${saving ? 'disabled' : ''}>${['LS', 'BC'].map(scope => `<option value="${scope}" ${scope === displayedDefaultScope ? 'selected' : ''}>${scope === 'LS' ? 'Los Santos (LS)' : 'Blaine County (BC)'}</option>`).join('')}</select>
      <p>Elle s’applique seulement lorsqu’aucun choix LS/BC n’est déjà mémorisé dans le navigateur.</p>
    </div>
    <p class="settings-form-help">Valeurs acceptées : de 0 à 100 %. Les dépenses déjà enregistrées ne sont jamais recalculées.</p>
    <button type="submit" ${saving ? 'disabled' : ''}>${saving ? 'Enregistrement…' : 'Enregistrer les profils tarifaires'}</button>
  </form>`, 'tariffs');
}

function parseTariffPercentInput(input, label) {
  const rawValue = String(input.value || '').trim();

  if (!rawValue) throw new Error(label + ' est obligatoire.');

  const percent = Number(rawValue.replace(/\s/g, '').replace(',', '.'));

  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error(label + ' doit être compris entre 0 et 100 %.');
  }

  return Math.round(percent * 10000) / 1000000;
}

function clearTariffCaches() {
  ['', 'LS', 'BC'].forEach(scope => {
    const suffix = '_' + scope;
    localStorage.removeItem('rcp_public_data_v1_3_2' + suffix);
    localStorage.removeItem('rcp_public_data_time_v1_3_2' + suffix);
    localStorage.removeItem('rcp_garage_data_v1_3_2' + suffix);
    localStorage.removeItem('rcp_garage_data_time_v1_3_2' + suffix);
    localStorage.removeItem('rcp_garage_data_token_v1_3_2' + suffix);
  });
}

async function calculateTariffRevision(tariffs, defaultScope) {
  if (!window.crypto || !window.crypto.subtle || typeof TextEncoder === 'undefined') {
    throw new Error('Impossible de vérifier la version des paramètres dans ce navigateur.');
  }

  const serialized = ['LS', 'BC'].map(scope => {
    const profile = tariffs.find(item => item.scope === scope);

    if (!profile) throw new Error('Profil tarifaire ' + scope + ' absent.');

    return [scope, profile.vehicleVat, profile.customizationVat].join('\u001f');
  }).concat(defaultScope).join('\u001e');
  const digest = await window.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(serialized)
  );

  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function saveTariffSettings(event) {
  event.preventDefault();
  if (tariffSaveState && tariffSaveState.running) return;

  let payload;

  try {
    const draft = {
      tariffs: settingsData.tariffs.map(item => ({
        scope: item.scope,
        vehicleVat: parseTariffPercentInput(
          document.getElementById('vehicleVat-' + item.scope),
          'TVA véhicules ' + item.scope
        ),
        customizationVat: parseTariffPercentInput(
          document.getElementById('customizationVat-' + item.scope),
          'TVA customisations ' + item.scope
        )
      })),
      defaultScope: document.getElementById('defaultTariffScope').value
    };
    const loadedRevision = String(settingsData.tariffRevision || '').trim();

    payload = {
      ...draft,
      expectedRevision: loadedRevision || await calculateTariffRevision(
        settingsData.tariffs,
        settingsData.defaultScope
      )
    };
    tariffDraft = draft;
  } catch (error) {
    setSettingsError(error.message);
    return;
  }

  setSettingsError('');
  tariffSaveResult = null;
  tariffSaveState = { running: true };
  renderSettings();

  try {
    const result = await api(
      'updateRcpTariffSettings',
      payload,
      settingsToken
    );

    settingsData.tariffs = result.tariffs;
    settingsData.defaultScope = result.defaultScope;
    settingsData.tariffRevision = result.tariffRevision;
    tariffSaveResult = { changed: result.changed, savedAt: result.savedAt };
    tariffDraft = null;
    clearTariffCaches();
    RcpTariff.resolve(result.defaultScope);
  } catch (error) {
    setSettingsError('Enregistrement impossible : ' + error.message);
  } finally {
    tariffSaveState = null;
    renderSettings();
  }
}
function renderPerformances() {
  const rows = settingsData.performanceRates || [];
  const groups = rows.reduce((result, item) => {
    const key = String(item.performance_key || '').toLowerCase();
    if (!result[key]) result[key] = [];
    result[key].push(item);
    return result;
  }, {});
  const availableKeys = PERFORMANCE_ORDER.filter(key => groups[key] && groups[key].length);
  Object.keys(groups).forEach(key => { if (!availableKeys.includes(key)) availableKeys.push(key); });
  const savedKey = localStorage.getItem(SETTINGS_PERFORMANCE_KEY);
  const openKey = savedKey === '__none__' ? '' : (availableKeys.includes(savedKey) ? savedKey : availableKeys[0] || '');

  return `<div class="performance-settings-list">${availableKeys.map(key => {
    const levels = groups[key].slice().sort((a, b) => Number(a.display_order || a.level) - Number(b.display_order || b.level));
    const label = levels[0].performance_label || key;
    const isOpen = key === openKey;
    return `<section class="card performance-settings-item ${isOpen ? '' : 'collapsed'}">
      <button type="button" class="performance-settings-toggle" aria-expanded="${isOpen}" onclick="togglePerformanceSettings('${escapeSettings(key)}', ${isOpen})">
        <span>${escapeSettings(label)} <small>· ${levels.length} niveau${levels.length > 1 ? 'x' : ''}</small></span>
        <span aria-hidden="true">${isOpen ? '▲' : '▼'}</span>
      </button>
      <div class="performance-settings-body">
        <div class="settings-table-wrap"><table><thead><tr><th>Niveau</th><th>Libellé</th><th>Coefficient</th><th>Active</th></tr></thead><tbody>${levels.map(item => `<tr><td>${escapeSettings(item.level)}</td><td>${escapeSettings(item.level_label)}</td><td>${formatPercent(item.coefficient)}</td><td>${item.active ? 'Oui' : 'Non'}</td></tr>`).join('')}</tbody></table></div>
      </div>
    </section>`;
  }).join('')}</div>`;
}
function togglePerformanceSettings(key, isOpen) {
  localStorage.setItem(SETTINGS_PERFORMANCE_KEY, isOpen ? '__none__' : key);
  renderSettings();
}
function renderCatalogue() {
  const vehicles = settingsData.vehicles || [];
  return panel('Catalogue', `<div class="settings-toolbar"><input id="catalogueSearch" placeholder="Rechercher" oninput="filterCatalogue()"><select id="catalogueStatus" onchange="filterCatalogue()"><option value="all">Tous</option><option value="active">Actifs</option><option value="retired">Retirés</option></select></div><p><strong>${vehicles.length}</strong> véhicules</p><div class="settings-table-wrap"><table id="catalogueTable"><thead><tr><th>Nom</th><th>Prix</th><th>Catégorie</th><th>Dealership</th><th>Statut</th></tr></thead><tbody>${vehicles.map(item => `<tr data-search="${escapeSettings((item.name + ' ' + item.category + ' ' + item.dealership_id).toLowerCase())}" data-status="${escapeSettings(item.catalogue_status)}"><td>${escapeSettings(item.name)}</td><td>${escapeSettings(item.price)} $</td><td>${escapeSettings(item.category)}</td><td>${escapeSettings(item.dealership_id)}</td><td>${escapeSettings(item.catalogue_status)}</td></tr>`).join('')}</tbody></table></div>`, 'catalogue');
}
function filterCatalogue() {
  const search = document.getElementById('catalogueSearch').value.toLowerCase(); const status = document.getElementById('catalogueStatus').value;
  document.querySelectorAll('#catalogueTable tbody tr').forEach(row => { row.hidden = !row.dataset.search.includes(search) || (status !== 'all' && row.dataset.status !== status); });
}
function formatElapsed(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes} min ${String(seconds % 60).padStart(2, '0')} s` : `${seconds} s`;
}
function syncLines(item) {
  const parts = [];
  if (item.sourceLine) parts.push(`DATA ligne ${item.sourceLine}`);
  if (item.targetLine) parts.push(`RCP_VEHICLES ligne ${item.targetLine}`);
  return parts.length ? `<span class="sync-lines">${parts.map(escapeSettings).join(' · ')}</span>` : '';
}
function renderSyncDetails(preview) {
  const groups = [];
  if (preview.added.length) groups.push(`<h3>Nouveaux véhicules</h3><ul class="sync-detail-list">${preview.added.map(item => `<li><strong>${escapeSettings(item.name)}</strong>${syncLines(item)}</li>`).join('')}</ul>`);
  if (preview.changed.length) groups.push(`<h3>Informations modifiées</h3><ul class="sync-detail-list">${preview.changed.map(item => `<li><strong>${escapeSettings(item.name)}</strong>${syncLines(item)}<ul>${(item.changes || []).map(change => `<li>${escapeSettings(change.label)} : <del>${escapeSettings(change.before || 'vide')}</del> → <ins>${escapeSettings(change.after || 'vide')}</ins></li>`).join('')}</ul></li>`).join('')}</ul>`);
  if (preview.priceChanged.length) groups.push(`<h3>Tarifs modifiés</h3><ul class="sync-detail-list">${preview.priceChanged.map(item => `<li><strong>${escapeSettings(item.name)}</strong>${syncLines(item)}<div>${escapeSettings(item.oldPrice)} $ → ${escapeSettings(item.newPrice)} $</div></li>`).join('')}</ul>`);
  if (preview.retired.length) groups.push(`<h3>Véhicules absents de DATA</h3><ul class="sync-detail-list">${preview.retired.map(item => `<li><strong>${escapeSettings(item.name || item)}</strong>${syncLines(item)}</li>`).join('')}</ul>`);
  return groups.length ? `<div class="sync-details">${groups.join('')}</div>` : '<p class="sync-clean">Aucun changement détecté : DATA et RCP_VEHICLES sont alignés.</p>';
}
function renderSync() {
  if (syncAnalysisState && syncAnalysisState.running) {
    const elapsed = Date.now() - syncAnalysisState.startedAt;
    return panel('DATA → RCP_VEHICLES', `<div class="sync-progress" role="status" aria-live="polite"><div class="sync-progress-track"><span></span></div><strong>${escapeSettings(SYNC_WAIT_MESSAGES[syncAnalysisState.messageIndex])}</strong><span>Analyse en cours depuis ${formatElapsed(elapsed)}</span></div><button disabled>Analyse en cours…</button><p>L’analyse ne modifie aucune donnée.</p>`, 'sync');
  }
  if (syncApplyState && syncApplyState.running) {
    const elapsed = Date.now() - syncApplyState.startedAt;
    return panel('DATA → RCP_VEHICLES', `<div class="sync-progress" role="status" aria-live="polite"><div class="sync-progress-track"><span></span></div><strong>Synchronisation en cours…</strong><span>Application des changements depuis ${formatElapsed(elapsed)}</span></div><button disabled>Synchronisation en cours…</button><p>Ne ferme pas cette page pendant l’opération.</p>`, 'sync');
  }
  const preview = syncPreview;
  const applied = syncApplyResult ? `<div class="sync-clean" role="status" aria-live="polite"><strong>Synchronisation terminée avec succès.</strong><br>${syncApplyResult.added} ajout${syncApplyResult.added > 1 ? 's' : ''} · ${syncApplyResult.updated} mise${syncApplyResult.updated > 1 ? 's' : ''} à jour · ${syncApplyResult.retired} retrait${syncApplyResult.retired > 1 ? 's' : ''} · ${syncApplyResult.priceHistoryCreated} tarif${syncApplyResult.priceHistoryCreated > 1 ? 's' : ''} historisé${syncApplyResult.priceHistoryCreated > 1 ? 's' : ''}<br>Terminée en ${escapeSettings(syncApplyResult.duration)}.</div>` : '';
  const summary = preview ? `<div class="settings-grid sync-summary"><article>Ajouts<strong>${preview.added.length}</strong></article><article>Modifications<strong>${preview.changed.length}</strong></article><article>Prix modifiés<strong>${preview.priceChanged.length}</strong></article><article>Retraits<strong>${preview.retired.length}</strong></article><article>Inchangés<strong>${(preview.unchanged || []).length}</strong></article></div>${preview.analysisDuration ? `<p class="sync-duration">Analyse terminée en ${escapeSettings(preview.analysisDuration)}.</p>` : ''}${preview.blockingErrors.length ? `<div class="error">${preview.blockingErrors.map(escapeSettings).join('<br>')}</div>` : ''}${renderSyncDetails(preview)}<button onclick="applySync()" ${preview.ready ? '' : 'disabled'}>Appliquer la synchronisation</button>` : '<p>L’analyse ne modifie aucune donnée.</p>';
  return panel('DATA → RCP_VEHICLES', `${applied}<button onclick="analyzeSync()">Analyser les changements</button>${summary}`, 'sync');
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
  try { setSettingsError(''); settingsData = await api('getRcpSettingsData', {}, settingsToken); tariffDraft = null; RcpTariff.resolve(settingsData.defaultScope); renderSettings(); }
  catch (error) { if (/Token|Session|Connexion indisponible/i.test(error.message)) { localStorage.removeItem('garage_token'); window.location.href = 'login.html?target=settings'; return; } setSettingsError(error.message); }
}
function stopSyncAnalysisFeedback() {
  clearInterval(syncAnalysisTimer); clearInterval(syncMessageTimer);
  syncAnalysisTimer = null; syncMessageTimer = null;
}
async function analyzeSync() {
  if (syncAnalysisState && syncAnalysisState.running) return;
  setSettingsError(''); syncPreview = null; syncApplyResult = null;
  syncAnalysisState = { running: true, startedAt: Date.now(), messageIndex: 0 };
  renderSettings();
  syncAnalysisTimer = setInterval(renderSettings, 1000);
  syncMessageTimer = setInterval(() => { syncAnalysisState.messageIndex = (syncAnalysisState.messageIndex + 1) % SYNC_WAIT_MESSAGES.length; renderSettings(); }, 12000);
  try {
    const preview = await api('analyzeRcpVehicleSync', {}, settingsToken);
    preview.analysisDuration = formatElapsed(Date.now() - syncAnalysisState.startedAt);
    syncPreview = preview;
  } catch (error) { setSettingsError('Analyse impossible : ' + error.message); }
  finally { stopSyncAnalysisFeedback(); syncAnalysisState = null; renderSettings(); }
}
async function applySync() {
  if (!syncPreview || !syncPreview.ready || (syncApplyState && syncApplyState.running)) return;
  setSettingsError(''); syncApplyResult = null;
  syncApplyState = { running: true, startedAt: Date.now() };
  renderSettings();
  syncAnalysisTimer = setInterval(renderSettings, 1000);
  try {
    const result = await api('applyRcpVehicleSync', { sourceSignature: syncPreview.sourceSignature }, settingsToken);
    syncApplyResult = { ...result, duration: formatElapsed(Date.now() - syncApplyState.startedAt) };
    syncPreview = null;
    await loadSettings();
  } catch (error) { setSettingsError('Synchronisation impossible : ' + error.message); }
  finally { clearInterval(syncAnalysisTimer); syncAnalysisTimer = null; syncApplyState = null; renderSettings(); }
}
async function logoutSettings() { try { await api('logoutGarage', {}, settingsToken); } catch (_) {} localStorage.removeItem('garage_token'); window.location.href = 'login.html?target=settings'; }
window.addEventListener('rcp:tariff-scope-change', renderSettings); loadSettings();
