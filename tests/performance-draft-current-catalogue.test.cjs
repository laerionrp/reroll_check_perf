const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'js', 'garage.js'),
  'utf8'
);

function extractFunctionBlock(startName, nextName) {
  const start = source.indexOf('function ' + startName + '(');
  const end = source.indexOf('function ' + nextName + '(', start);

  assert.ok(start >= 0, 'Fonction absente : ' + startName);
  assert.ok(end > start, 'Fin de fonction introuvable : ' + startName);
  return source.slice(start, end);
}

const context = {
  console,
  JSON,
  Math,
  Number,
  Object,
  String,
  Array,
  data: {
    tariffScope: 'LS',
    tvaPerf: 0.14,
    catalog: [{ vehicle_id: 'indiana', price: 69000 }],
    performances: {
      blindage: [{ percent: 0.03 }, { percent: 0.07 }, { percent: 0.10 }],
      frein: [{ percent: 0.02 }, { percent: 0.04 }, { percent: 0.05 }],
      moteur: [{ percent: 0.01 }, { percent: 0.02 }, { percent: 0.03 }, { percent: 0.05 }],
      suspension: [{ percent: 0.02 }, { percent: 0.04 }, { percent: 0.05 }],
      transmission: [{ percent: 0.02 }, { percent: 0.04 }, { percent: 0.05 }],
      turbo: [{ percent: 0.16 }]
    }
  },
  pendingGaragePerformanceChanges: new Map(),
  normalizeGarage: value => String(value || '').toLowerCase().trim(),
  parseStepsGarage: value => JSON.parse(value || '[]'),
  shouldShowPerfGarage: () => true,
  calculatePerformancePrice: (vehiclePriceHT, coefficient, tvaRate) => {
    const priceHT = Math.ceil(Number(vehiclePriceHT) * Number(coefficient));
    return priceHT + Math.ceil(priceHT * Number(tvaRate));
  }
};

vm.createContext(context);
vm.runInContext(
  extractFunctionBlock('isGarageVehicleArchived', 'getGarageExitType') + '\n' +
  extractFunctionBlock('getCurrentPerfPrice', 'createGaragePerformanceTariffSnapshot') + '\n' +
  extractFunctionBlock('createGaragePerformanceTariffSnapshot', 'findGarageVehicle') + '\n' +
  extractFunctionBlock('findGarageVehicle', 'buildGaragePerformanceDraft') + '\n' +
  extractFunctionBlock('buildGaragePerformanceDraft', 'applyOptimisticPerformanceChange') + '\n' +
  extractFunctionBlock('garagePerformanceLevelsForVehicle', 'garagePerformanceChangeCount') + '\n' +
  extractFunctionBlock('rememberGaragePerformanceChange', 'cleanupGaragePerformanceChange'),
  context,
  { filename: 'garage-performance-draft-extract.js' }
);

const savedVehicle = {
  card_id: 3,
  vehicle_id: 'indiana',
  catalog_vehicle_id: 'indiana',
  price_ht: 42000,
  price_ttc: 46200,
  depense_total: 56737,
  allowed_perfs: ['blindage', 'frein', 'moteur', 'suspension', 'transmission', 'turbo'],
  blindage_level: 1,
  blindage_paid: 1437,
  blindage_steps: JSON.stringify([1437, 3353, 4788]),
  frein_level: 3,
  frein_paid: 5268,
  frein_steps: JSON.stringify([958, 1916, 2394]),
  moteur_level: 3,
  moteur_paid: 2874,
  moteur_steps: JSON.stringify([479, 958, 1437, 2394]),
  suspension_level: 0,
  suspension_paid: 0,
  suspension_steps: JSON.stringify([958, 1916, 2394]),
  transmission_level: 1,
  transmission_paid: 958,
  transmission_steps: JSON.stringify([958, 1916, 2394]),
  turbo_level: 0,
  turbo_paid: 0,
  turbo_steps: JSON.stringify([7661])
};
context.savedVehicle = savedVehicle;

const archivedVehicleUsingSameCard = {
  ...savedVehicle,
  vehicle_id: 'ancien-vehicule',
  catalog_vehicle_id: 'ancien-vehicule',
  status: 'Vendu',
  exit_type: 'vendu'
};

savedVehicle.status = 'Appartement';
savedVehicle.exit_type = '';
context.data.vehicles = [archivedVehicleUsingSameCard, savedVehicle];

assert.equal(
  vm.runInContext('findGarageVehicle(3).vehicle_id', context),
  'indiana',
  'Une carte réutilisée doit toujours cibler le véhicule actif.'
);

const currentPrice = percent => context.calculatePerformancePrice(69000, percent, 0.14);

assert.equal(
  vm.runInContext("getCurrentPerfPrice(savedVehicle, 'blindage', 0)", context),
  1437,
  'Un palier acheté conserve son montant historique.'
);
assert.equal(
  vm.runInContext("getCurrentPerfPrice(savedVehicle, 'blindage', 1)", context),
  currentPrice(0.07),
  'Un montant présent dans un ancien tableau mais non acheté doit être ignoré.'
);
assert.equal(
  vm.runInContext("getCurrentPerfPrice(savedVehicle, 'suspension', 0)", context),
  currentPrice(0.02),
  'Un nouveau palier doit utiliser le catalogue actuel.'
);

context.pendingGaragePerformanceChanges.set(3, {
  tariffSnapshot: vm.runInContext(
    'createGaragePerformanceTariffSnapshot(savedVehicle)',
    context
  )
});
context.data.catalog[0].price = 99999;
assert.equal(
  vm.runInContext("getCurrentPerfPrice(savedVehicle, 'suspension', 0)", context),
  currentPrice(0.02),
  'Le prix d un brouillon reste celui du profil capturé au début du brouillon.'
);

context.data.catalog[0].price = 69000;
const savedLevels = {
  blindage: 1,
  frein: 3,
  moteur: 3,
  suspension: 0,
  transmission: 1,
  turbo: 0
};
context.savedLevels = savedLevels;

const draft = vm.runInContext(
  'buildGaragePerformanceDraft(savedVehicle, { ...savedLevels, moteur: 4, transmission: 2 })',
  context
);

assert.deepEqual(JSON.parse(draft.moteur_steps), [479, 958, 1437, currentPrice(0.05)]);
assert.equal(draft.moteur_paid, 2874 + currentPrice(0.05));
assert.equal(draft.transmission_paid, 958 + currentPrice(0.04));
assert.equal(
  draft.depense_total,
  56737 + currentPrice(0.05) + currentPrice(0.04),
  'Le total ne doit évoluer que selon les nouveaux paliers préparés.'
);

const restored = vm.runInContext(
  'buildGaragePerformanceDraft(savedVehicle, savedLevels)',
  context
);
assert.equal(restored.depense_total, 56737, 'Le retour à l état initial annule le brouillon.');
assert.equal(restored.moteur_paid, 2874);

context.pendingGaragePerformanceChanges.set(3, {
  savedLevels,
  draftLevels: { ...savedLevels, moteur: 4 },
  tariffSnapshot: vm.runInContext(
    'createGaragePerformanceTariffSnapshot(savedVehicle)',
    context
  ),
  draftVehicle: { ...savedVehicle }
});
assert.equal(
  context.pendingGaragePerformanceChanges.get(3).tariffSnapshot.tariffScope,
  'LS',
  'Le profil tarifaire utilisé doit être conservé dans l instantané.'
);
context.data.catalog[0].price = 75000;
context.data.tvaPerf = 0.20;
vm.runInContext(
  'refreshGaragePerformanceDraftsForTariffScope()',
  context
);
const profileChangedDraft = vm.runInContext(
  'pendingGaragePerformanceChanges.get(3).draftVehicle',
  context
);
const changedProfilePrice = context.calculatePerformancePrice(75000, 0.05, 0.20);
assert.equal(
  JSON.parse(profileChangedDraft.moteur_steps)[3],
  changedProfilePrice,
  'Un brouillon ouvert doit reprendre les tarifs du nouveau profil LS/BC.'
);

assert.match(source, /function renderGaragePreservingVehicle\(cardId\)/);
assert.match(
  extractFunctionBlock('renderGaragePreservingVehicle', 'layoutGarageMasonry'),
  /:not\(\.archived\)/,
  'La restauration du défilement doit viser la carte active.'
);
assert.match(source, /function saveGarageVehiclePerformances\(cardId\)/);
assert.match(source, /api\(\s*'setPerformanceLevels'/);
assert.match(source, /!isGarageVehicleArchived\(vehicle\)/);

console.log(
  'NO GO frontend : tarifs historiques, catalogue courant, carte réutilisée, brouillon et sauvegarde groupée validés.'
);
