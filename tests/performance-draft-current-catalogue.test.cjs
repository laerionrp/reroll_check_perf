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
  extractFunctionBlock('getCurrentPerfPrice', 'findGarageVehicle') + '\n' +
  extractFunctionBlock('buildGaragePerformanceDraft', 'applyGaragePerformanceMutationResult'),
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

const currentPrice = percent => context.calculatePerformancePrice(
  69000,
  percent,
  0.14
);

assert.equal(
  vm.runInContext("getCurrentPerfPrice(savedVehicle, 'blindage', 0)", context),
  1437,
  'Un palier acheté doit garder son prix historique.'
);
assert.equal(
  vm.runInContext("getCurrentPerfPrice(savedVehicle, 'blindage', 1)", context),
  currentPrice(0.07),
  'Un ancien tarif mémorisé pour un palier non acheté doit être ignoré.'
);
assert.equal(
  vm.runInContext("getCurrentPerfPrice(savedVehicle, 'suspension', 0)", context),
  currentPrice(0.02),
  'Une performance non achetée doit suivre le catalogue actuel.'
);

const savedLevels = {
  blindage: 1,
  frein: 3,
  moteur: 3,
  suspension: 0,
  transmission: 1,
  turbo: 0
};

context.savedLevels = savedLevels;

const onePendingChange = vm.runInContext(
  "buildGaragePerformanceDraft(savedVehicle, { ...savedLevels, moteur: 4 })",
  context
);

assert.deepEqual(
  JSON.parse(onePendingChange.moteur_steps),
  [479, 958, 1437, currentPrice(0.05)]
);
assert.equal(onePendingChange.moteur_paid, 2874 + currentPrice(0.05));
assert.equal(onePendingChange.blindage_paid, 1437);
assert.equal(onePendingChange.frein_paid, 5268);
assert.equal(onePendingChange.transmission_paid, 958);
assert.equal(onePendingChange.depense_total, 56737 + currentPrice(0.05));

const twoPendingChanges = vm.runInContext(
  "buildGaragePerformanceDraft(savedVehicle, { ...savedLevels, moteur: 4, transmission: 2 })",
  context
);

assert.equal(
  twoPendingChanges.depense_total,
  56737 + currentPrice(0.05) + currentPrice(0.04),
  'Chaque coche doit seulement ajouter son propre palier au total.'
);
assert.equal(
  Object.keys(context.data.performances).reduce(
    (total, perfName) => total + Number(twoPendingChanges[perfName + '_paid'] || 0),
    0
  ),
  twoPendingChanges.depense_total - savedVehicle.price_ttc,
  'Total perfs et Dépense totale doivent rester strictement cohérents.'
);

const restored = vm.runInContext(
  'buildGaragePerformanceDraft(savedVehicle, savedLevels)',
  context
);

assert.equal(restored.depense_total, 56737);
assert.equal(restored.moteur_paid, 2874);
assert.deepEqual(JSON.parse(restored.moteur_steps), [479, 958, 1437]);

assert.match(
  source,
  /function renderGaragePreservingVehicle\(cardId\)/,
  'La restauration de position par fiche doit être présente.'
);
assert.match(
  extractFunctionBlock('togglePerf', 'handleGarageTariffScopeChange'),
  /renderGaragePreservingVehicle\(cardId\)/,
  'Une coche doit reconstruire l’Inventaire en conservant la fiche à l’écran.'
);
assert.match(
  extractFunctionBlock('saveGarageVehiclePerformances', 'enqueueGaragePerformanceLevelMutation'),
  /renderGaragePreservingVehicle\(numericCardId\)/,
  'La sauvegarde doit conserver la fiche à l’écran.'
);

let activeCard;
const scrollMoves = [];
const oldCard = {
  dataset: { cardId: '3' },
  isConnected: true,
  closest: () => oldCard,
  getBoundingClientRect: () => ({ top: 240 })
};
const newCard = {
  dataset: { cardId: '3' },
  isConnected: true,
  closest: () => newCard,
  getBoundingClientRect: () => ({ top: 275 })
};

activeCard = oldCard;

const viewportContext = {
  console,
  Number,
  Math,
  garageViewportAnchor: null,
  garageViewportRestoreFrame: 0,
  document: {
    querySelector: () => activeCard
  },
  window: {
    scrollY: 900,
    cancelAnimationFrame: () => {},
    requestAnimationFrame: () => 1,
    scrollBy: (x, y) => scrollMoves.push([x, y]),
    scrollTo: (x, y) => scrollMoves.push([x, y])
  },
  renderGarage: () => {
    oldCard.isConnected = false;
    activeCard = newCard;
  }
};

vm.createContext(viewportContext);
vm.runInContext(
  extractFunctionBlock('restoreGarageViewportAnchor', 'scheduleGarageViewportRestore') + '\n' +
  extractFunctionBlock('scheduleGarageViewportRestore', 'preserveGarageViewportPosition') + '\n' +
  extractFunctionBlock('preserveGarageViewportPosition', 'renderGaragePreservingVehicle') + '\n' +
  extractFunctionBlock('renderGaragePreservingVehicle', 'layoutGarageMasonry'),
  viewportContext,
  { filename: 'garage-viewport-extract.js' }
);
vm.runInContext('renderGaragePreservingVehicle(3)', viewportContext);

assert.deepEqual(
  scrollMoves,
  [[0, 35]],
  'La nouvelle fiche doit retrouver exactement la position visuelle de l’ancienne.'
);

console.log(
  'Brouillon frontend : tarifs mixtes, totaux cohérents et ancrage de la fiche validés.'
);
