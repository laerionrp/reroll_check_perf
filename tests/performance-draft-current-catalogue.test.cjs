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
    catalog: [{ vehicle_id: 'veh-1', price: 69000 }],
    performances: {
      blindage: [{ percent: 0.03 }, { percent: 0.07 }],
      moteur: [{ percent: 0.03 }]
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
  vehicle_id: 'veh-1',
  catalog_vehicle_id: 'veh-1',
  price_ht: 42000,
  price_ttc: 46200,
  depense_total: 47637,
  blindage_level: 1,
  blindage_paid: 1437,
  blindage_steps: JSON.stringify([1437]),
  moteur_level: 0,
  moteur_paid: 0,
  moteur_steps: '[]'
};

context.savedVehicle = savedVehicle;

const draft = vm.runInContext(
  'buildGaragePerformanceDraft(savedVehicle, { blindage: 2, moteur: 1 })',
  context
);

assert.deepEqual(JSON.parse(draft.blindage_steps).slice(0, 2), [1437, 5508]);
assert.equal(draft.blindage_paid, 6945);
assert.deepEqual(JSON.parse(draft.moteur_steps).slice(0, 1), [2360]);
assert.equal(draft.moteur_paid, 2360);
assert.equal(draft.depense_total, 55505);

const restored = vm.runInContext(
  'buildGaragePerformanceDraft(savedVehicle, { blindage: 1, moteur: 0 })',
  context
);

assert.deepEqual(JSON.parse(restored.blindage_steps), [1437]);
assert.equal(restored.blindage_paid, 1437);
assert.equal(restored.depense_total, 47637);

console.log('Brouillon frontend : historique figé et nouveaux paliers au prix catalogue actuel validés.');
